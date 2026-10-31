import { io } from "socket.io-client";
import type { ChantEvent, StandState } from "@twitch-graderia/shared";

export function connectToServer(
  onStandState: (state: StandState) => void,
  onChant: (chant: ChantEvent) => void,
): void {
  const socket = io(import.meta.env.VITE_SERVER_URL ?? "http://localhost:3000", {
    autoConnect: true,
  });

  socket.on("connect", () => console.info("Server connected", socket.id));
  socket.on("disconnect", (reason) => console.info("Server disconnected", reason));
  socket.on("connect_error", (error) => console.warn("Server connection error", error.message));
  socket.on("stand:update", (state: StandState) => onStandState(state));
  socket.on("chant", (chant: ChantEvent) => onChant(chant));
}
