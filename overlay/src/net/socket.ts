import { io } from "socket.io-client";
import type { ChantEvent, GoalEvent, MatchEndedEvent, MatchStartedEvent, StandState } from "@twitch-graderia/shared";

export function connectToServer(
  onStandState: (state: StandState) => void,
  onChant: (chant: ChantEvent) => void,
  onGoal: (goal: GoalEvent) => void,
  onMatchEnded: (event: MatchEndedEvent) => void,
  onMatchStarted: (event: MatchStartedEvent) => void,
): void {
  const socket = io(import.meta.env.VITE_SERVER_URL ?? "http://localhost:3000", {
    autoConnect: true,
  });

  socket.on("connect", () => console.info("Server connected", socket.id));
  socket.on("disconnect", (reason) => console.info("Server disconnected", reason));
  socket.on("connect_error", (error) => console.warn("Server connection error", error.message));
  socket.on("stand:update", (state: StandState) => onStandState(state));
  socket.on("chant", (chant: ChantEvent) => onChant(chant));
  socket.on("goal", (goal: GoalEvent) => onGoal(goal));
  socket.on("matchEnded", (event: MatchEndedEvent) => onMatchEnded(event));
  socket.on("matchStarted", (event: MatchStartedEvent) => onMatchStarted(event));
}

export function connectMatchLifecycle(
  onMatchEnded: (event: MatchEndedEvent) => void,
  onMatchStarted: (event: MatchStartedEvent) => void,
): void {
  const socket = io(import.meta.env.VITE_SERVER_URL ?? "http://localhost:3000", {
    autoConnect: true,
    reconnection: false,
  });
  socket.on("matchEnded", onMatchEnded);
  socket.on("matchStarted", onMatchStarted);
}
