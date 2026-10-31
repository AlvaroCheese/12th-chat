import Fastify from "fastify";
import { Server } from "socket.io";
import { RefreshingAuthProvider } from "@twurple/auth";
import { env } from "./config/env.js";
import { chatEventBus } from "./chat/eventBus.js";
import { startMockChat } from "./chat/mock.js";
import { TwitchChatService } from "./twitch/chatService.js";
import { FileTokenStore } from "./twitch/tokenStore.js";
import { registerTwitchAuthRoutes } from "./routes/twitchAuth.js";
import { StandAggregator, StandStore } from "./aggregator/index.js";

const app = Fastify({
  logger: {
    level: "debug",
    serializers: {
      req(request) {
        return { method: request.method, url: request.url.split("?")[0] };
      },
    },
  },
});
const io = new Server(app.server, { cors: { origin: true } });
const tokenStore = new FileTokenStore();
const authProvider = new RefreshingAuthProvider({
  clientId: env.TWITCH_CLIENT_ID ?? "",
  clientSecret: env.TWITCH_CLIENT_SECRET ?? "",
  redirectUri: env.TWITCH_REDIRECT_URI,
});
const chatService = new TwitchChatService(authProvider, tokenStore);
const standStore = new StandStore();
const standAggregator = new StandAggregator(io, standStore, (snapshot) => {
  app.log.debug(
    {
      fans: snapshot.fans.length,
      argentina: snapshot.counts.argentina,
      mexico: snapshot.counts.mexico,
    },
    "StandState snapshot emitted",
  );
});

authProvider.onRefresh((userId, token) => {
  void chatService.saveRefreshedToken(userId, token).catch(() => {
    app.log.error("Could not persist refreshed Twitch credentials");
  });
});
authProvider.onRefreshFailure(() => {
  app.log.error("Twitch token refresh failed; reconnect at /auth/twitch");
});

app.get("/health", async () => ({ ok: true }));
registerTwitchAuthRoutes(app, authProvider, chatService, tokenStore);

chatEventBus.on("chat", (event) => {
  standStore.handleChatEvent(event);
  const safeText = event.text.replace(/\p{Cc}+/gu, " ").slice(0, 160);
  console.info(`[chat] ${event.userName}: ${safeText}`);
});

const mockChatEnabled = env.MOCK_CHAT === "1";
app.log.info(`Mock chat ${mockChatEnabled ? "enabled" : "disabled"}`);

if (mockChatEnabled) {
  startMockChat();
} else if (env.TWITCH_CLIENT_ID && env.TWITCH_CLIENT_SECRET) {
  try {
    const channel = await chatService.restore();
    if (channel) console.info(`Restored Twitch chat connection for ${channel}`);
  } catch {
    app.log.error("Could not restore Twitch chat connection; reconnect at /auth/twitch");
  }
}

io.on("connection", (socket) => {
  app.log.info({ socketId: socket.id }, "Overlay connected");
  standAggregator.sendTo(socket);
  socket.on("disconnect", () => {
    app.log.info({ socketId: socket.id }, "Overlay disconnected");
  });
});

standAggregator.start();

await app.listen({ port: env.PORT, host: "0.0.0.0" });
