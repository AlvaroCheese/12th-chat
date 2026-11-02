import type { ChatEvent, Side } from "@twitch-graderia/shared";
import { chatEventBus } from "../chat/eventBus.js";
import { DEMO_SCRIPT_CONFIG as config } from "../config/demo.js";

export interface DemoScriptActions {
  startMatch(): void;
  goal(side: Side): void;
  endMatch(): Promise<void> | void;
}

let cancelCurrent: (() => void) | undefined;

export function runDemoScript(actions: DemoScriptActions): void {
  cancelCurrent?.();
  actions.startMatch();
  const startedAt = Date.now();
  const timers: NodeJS.Timeout[] = [];
  const users: Record<Side, string[]> = { argentina: [], mexico: [] };
  let messageNumber = 0;

  for (let index = 0; index < config.crowdSize; index += 1) {
    const side: Side = index % 2 === 0 ? "argentina" : "mexico";
    const userId = "demo-sim-" + (index + 1);
    const userName = "DemoFan" + (index + 1);
    users[side].push(userId);
    emit(userId, userName, "!join " + side);
  }

  timers.push(setInterval(() => {
    const elapsed = Date.now() - startedAt;
    for (const side of ["argentina", "mexico"] as const) {
      const argentinaQuiet = elapsed >= config.argentinaQuietStartMs && elapsed < config.argentinaQuietEndMs;
      if (side === "argentina" && argentinaQuiet) continue;
      const group = users[side];
      for (let count = 0; count < config.messagesPerSidePerBurst; count += 1) {
        const userId = group[(messageNumber + count * 7) % group.length];
        if (userId) emit(userId, "DemoFan" + Number(userId.slice("demo-sim-".length)), "crowd activity " + messageNumber++);
      }
    }
  }, config.activityIntervalMs));

  for (const [index, atMs] of config.chantAtMs.entries()) {
    timers.push(setTimeout(() => {
      const side: Side = index === 0 ? "argentina" : "mexico";
      const text = side === "argentina" ? "VAMOOOS!!" : "¡VAMOS MÉXICO!";
      for (const userId of users[side].slice(0, 8)) {
        emit(userId, "DemoFan" + Number(userId.slice("demo-sim-".length)), text);
      }
    }, atMs));
  }

  timers.push(setTimeout(() => actions.goal("argentina"), config.argentinaGoalAtMs));
  timers.push(setTimeout(() => actions.goal("mexico"), config.mexicoGoalAtMs));
  timers.push(setTimeout(() => {
    cancelCurrent?.();
    void actions.endMatch();
  }, config.durationMs));

  cancelCurrent = () => {
    for (const timer of timers) {
      clearInterval(timer);
      clearTimeout(timer);
    }
    cancelCurrent = undefined;
  };
}

export function stopDemoScript(): void {
  cancelCurrent?.();
}

function emit(userId: string, userName: string, text: string): void {
  const event: ChatEvent = {
    userId,
    userName,
    text,
    emotes: [],
    badges: { broadcaster: false, moderator: false, subscriber: false },
    timestamp: Date.now(),
    source: "mock",
  };
  chatEventBus.emit("chat", event);
}
