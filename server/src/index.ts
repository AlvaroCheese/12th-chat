import Fastify from "fastify";
import fastifyStatic from "@fastify/static";
import { Server } from "socket.io";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { RefreshingAuthProvider } from "@twurple/auth";
import { env } from "./config/env.js";
import { chatEventBus } from "./chat/eventBus.js";
import { startMockChat, stopMockChat } from "./chat/mock.js";
import { TwitchChatService } from "./twitch/chatService.js";
import { FileTokenStore } from "./twitch/tokenStore.js";
import { registerTwitchAuthRoutes } from "./routes/twitchAuth.js";
import { StandAggregator, StandStore } from "./aggregator/index.js";
import { ChantDetector } from "./chat/chantDetector.js";
import { getChantConfig, getFanInactivityTimeoutMs } from "./config/chants.js";
import { GoalController, parseGoalSide } from "./match/goalController.js";
import { registerControlRoutes } from "./routes/control.js";
import { getPressureConfig, PressureMeter } from "./chat/pressure.js";
import { MatchStats } from "./chat/matchStats.js";
import { generateCrowdReport } from "./ai/report.js";
import { ReportStore } from "./ai/reportStore.js";
import { registerReportRoutes } from "./routes/report.js";
import { runDemoScript, stopDemoScript } from "./demo/script.js";

const app = Fastify({
  logger: {
    level: "info",
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
const mockChatEnabled = env.MOCK_CHAT === "1";
const demoCrowdEnabled = env.DEMO_CROWD === "1";
const mockCrowdEnabled = mockChatEnabled || demoCrowdEnabled;
const standStore = new StandStore(getFanInactivityTimeoutMs(mockChatEnabled));
const chantDetector = new ChantDetector(standStore, getChantConfig(mockCrowdEnabled));
const goalController = new GoalController(standStore);
const pressureMeter = new PressureMeter(getPressureConfig(mockCrowdEnabled));
const matchStats = new MatchStats();
const reportStore = new ReportStore();
await reportStore.load();
let mockMatchTimer: NodeJS.Timeout | undefined;
let reportInProgress = false;
let matchGeneration = 0;
let matchFrozen = false;
const standAggregator = new StandAggregator(io, standStore, pressureMeter, undefined, (snapshot, now) =>
  matchStats.recordSnapshot(snapshot, now),
);
standStore.onMemberChange((change) => matchStats.recordMemberChange(change));

function startMatchStats(): void {
  stopDemoScript();
  matchGeneration += 1;
  matchFrozen = false;
  standStore.setFrozen(false);
  pressureMeter.setFrozen(false);
  standAggregator.setFrozen(false);
  if (mockMatchTimer) clearTimeout(mockMatchTimer);
  mockMatchTimer = undefined;
  reportInProgress = false;
  matchStats.start();
  if (mockCrowdEnabled) startMockChat();
  if (mockChatEnabled) {
    mockMatchTimer = setTimeout(() => void finishMatch(), env.MOCK_MATCH_DURATION_MINUTES * 60_000);
  }
  io.emit("matchStarted", { scoreBySide: standStore.createSnapshot().scoreBySide });
}

async function finishMatch(): Promise<void> {
  if (!matchStats.isActive || reportInProgress) return;
  reportInProgress = true;
  const generation = matchGeneration;
  matchFrozen = true;
  standStore.setFrozen(true);
  pressureMeter.setFrozen(true);
  standAggregator.setFrozen(true);
  stopMockChat();
  stopDemoScript();
  if (mockMatchTimer) clearTimeout(mockMatchTimer);
  mockMatchTimer = undefined;
  const finalState = standStore.createSnapshot();
  const stats = matchStats.finish(Date.now(), finalState.scoreBySide);
  io.emit("matchEnded", { status: "generating", finalScoreBySide: stats.finalScoreBySide, reportUrl: "/report" });
  try {
    const report = await generateCrowdReport(stats);
    if (generation !== matchGeneration) return;
    await reportStore.save(report);
    io.emit("matchEnded", { status: "ready", finalScoreBySide: stats.finalScoreBySide, reportUrl: "/report", source: report.source });
  } catch {
    app.log.error("Could not save the crowd report");
  } finally {
    if (generation === matchGeneration) reportInProgress = false;
  }
}

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
registerControlRoutes(app, goalController, standStore, (side, scoreBySide) => {
  pressureMeter.boost(side, "goal");
  io.emit("goal", { side, scoreBySide });
}, startMatchStats, finishMatch, () => {
    runDemoScript({
      startMatch: () => {
        goalController.start();
        startMatchStats();
        stopMockChat();
      },
      goal: (side) => {
        const goal = goalController.goal(side);
        if (!goal) return;
        pressureMeter.boost(side, "goal");
        io.emit("goal", goal);
      },
      endMatch: finishMatch,
    });
  }, () => matchFrozen);
registerReportRoutes(app, reportStore);

if (env.NODE_ENV === "production") {
  const overlayRoot = resolve(dirname(fileURLToPath(import.meta.url)), "../../overlay/dist");
  await app.register(fastifyStatic, { root: overlayRoot, prefix: "/", wildcard: false, index: false });
  app.get("/", async (_request, reply) => reply.sendFile("index.html"));
}

chatEventBus.on("chat", (event) => {
  const privileged = event.badges.broadcaster || event.badges.moderator;
  const startsMatch = /^\s*!start\s*$/i.test(event.text);
  if (matchFrozen && (!privileged || !startsMatch)) return;
  if (!privileged && /^\s*!goal\b/i.test(event.text)) return;
  if (!privileged && /^\s*!end\b/i.test(event.text)) return;
  if (privileged && /^\s*!goal\b/i.test(event.text)) {
    const side = parseGoalSide(event.text);
    const goal = side && goalController.goal(side);
    if (goal) {
      pressureMeter.boost(goal.side, "goal");
      io.emit("goal", goal);
      app.log.info({ side: goal.side }, "Goal triggered");
    }
  } else if (privileged && /^\s*!start\s*$/i.test(event.text)) {
    goalController.start();
    startMatchStats();
    app.log.info("Match score reset");
  } else if (privileged && /^\s*!end\s*$/i.test(event.text)) {
    void finishMatch();
  }

  const side = standStore.handleChatEvent(event);
  matchStats.recordChatMessage(event, side);
  if (side) {
    pressureMeter.recordMessage(side, event.timestamp || Date.now());
    const chant = chantDetector.handle(event, side);
    if (chant) {
      pressureMeter.boost(side, "chant");
      matchStats.recordChantTriggered(side);
      io.emit("chant", chant);
      app.log.info({ side: chant.side, intensity: chant.intensity }, "Chant triggered");
    }
  }
  const safeText = event.text.replace(/\p{Cc}+/gu, " ").slice(0, 160);
  console.info(`[chat] ${event.userName}: ${safeText}`);
});

app.log.info(`Mock chat ${mockChatEnabled ? "enabled" : "disabled"}; demo crowd ${demoCrowdEnabled ? "enabled" : "disabled"}`);

if (mockChatEnabled) {
  goalController.start();
  startMockChat();
  startMatchStats();
} else {
  if (demoCrowdEnabled) startMockChat();
}

if (!mockChatEnabled && env.TWITCH_CLIENT_ID && env.TWITCH_CLIENT_SECRET) {
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
    standAggregator.removeSocket(socket);
    app.log.info({ socketId: socket.id }, "Overlay disconnected");
  });
});

standAggregator.start();

await app.listen({ port: env.PORT, host: "0.0.0.0" });
