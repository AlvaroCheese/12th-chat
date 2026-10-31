import { randomBytes, timingSafeEqual } from "node:crypto";
import type { FastifyInstance } from "fastify";
import type { RefreshingAuthProvider } from "@twurple/auth";
import { CHAT_INTENT, CHAT_SCOPE, type TwitchChatService } from "../twitch/chatService.js";
import type { TokenStore } from "../twitch/tokenStore.js";
import { env } from "../config/env.js";

const pendingStates = new Map<string, number>();
const STATE_COOKIE = "graderia_oauth_state";

export function registerTwitchAuthRoutes(
  app: FastifyInstance,
  authProvider: RefreshingAuthProvider,
  chatService: TwitchChatService,
  tokenStore: TokenStore,
): void {
  app.get("/auth/twitch", async (_request, reply) => {
    if (!hasTwitchCredentials()) {
      return reply.code(503).send({ error: "Set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET first" });
    }

    const now = Date.now();
    for (const [knownState, expiresAt] of pendingStates) {
      if (expiresAt <= now) pendingStates.delete(knownState);
    }
    const state = randomBytes(32).toString("hex");
    pendingStates.set(state, Date.now() + 10 * 60 * 1000);
    const secure = new URL(env.TWITCH_REDIRECT_URI).protocol === "https:" ? "; Secure" : "";
    reply.header(
      "set-cookie",
      `${STATE_COOKIE}=${state}; HttpOnly; SameSite=Lax; Path=/auth/twitch; Max-Age=600${secure}`,
    );

    const authorizeUrl = new URL("https://id.twitch.tv/oauth2/authorize");
    authorizeUrl.searchParams.set("client_id", env.TWITCH_CLIENT_ID!);
    authorizeUrl.searchParams.set("redirect_uri", env.TWITCH_REDIRECT_URI);
    authorizeUrl.searchParams.set("response_type", "code");
    authorizeUrl.searchParams.set("scope", CHAT_SCOPE);
    authorizeUrl.searchParams.set("state", state);
    return reply.redirect(authorizeUrl.toString());
  });

  app.get("/auth/twitch/callback", async (request, reply) => {
    const query = request.query as { code?: string; state?: string; error?: string };
    const state = query.state;
    const cookieState = readCookie(request.headers.cookie, STATE_COOKIE);
    const expiresAt = state ? pendingStates.get(state) : undefined;
    const validState = Boolean(
      state && cookieState && safeEqual(state, cookieState) && expiresAt && expiresAt > Date.now(),
    );
    if (state) pendingStates.delete(state);
    reply.header("set-cookie", `${STATE_COOKIE}=; HttpOnly; SameSite=Lax; Path=/auth/twitch; Max-Age=0`);

    if (!validState) return reply.code(400).send({ error: "OAuth state validation failed" });
    if (query.error) return reply.code(400).send({ error: "Twitch authorization was not completed" });
    if (!query.code) return reply.code(400).send({ error: "Twitch did not return an authorization code" });
    if (!hasTwitchCredentials()) {
      return reply.code(503).send({ error: "Set TWITCH_CLIENT_ID and TWITCH_CLIENT_SECRET first" });
    }

    try {
      const userId = await authProvider.addUserForCode(query.code, [CHAT_INTENT]);
      const token = await authProvider.getAccessTokenForUser(userId);
      if (!token) throw new Error("Twitch did not return an access token");
      await tokenStore.save({ userId, token });
      const channel = await chatService.connect(userId);
      return reply.type("text/html").send(
        `<!doctype html><html><body><h1>Twitch connected</h1><p>Listening to ${escapeHtml(channel)} chat. You can close this page.</p></body></html>`,
      );
    } catch {
      request.log.error("Twitch authorization or chat connection failed");
      return reply.code(502).send({ error: "Could not connect to Twitch. Check server logs and app settings." });
    }
  });

  app.get("/auth/status", async () => chatService.getStatus());
}

function hasTwitchCredentials(): boolean {
  return Boolean(env.TWITCH_CLIENT_ID && env.TWITCH_CLIENT_SECRET);
}

function readCookie(cookieHeader: string | undefined, name: string): string | undefined {
  return cookieHeader
    ?.split(";")
    .map((part) => part.trim())
    .find((part) => part.startsWith(`${name}=`))
    ?.slice(name.length + 1);
}

function safeEqual(left: string, right: string): boolean {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    };
    return entities[character] ?? character;
  });
}
