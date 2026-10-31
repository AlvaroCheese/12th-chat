import type { StandState } from "@twitch-graderia/shared";
import type { Server, Socket } from "socket.io";
import { StandStore } from "./standStore.js";

const SNAPSHOT_INTERVAL_MS = 250;

export class StandAggregator {
  private lastSerializedSnapshot = "";
  private timer: NodeJS.Timeout | undefined;

  constructor(
    private readonly io: Server,
    private readonly store: StandStore,
    private readonly onSnapshot?: (snapshot: StandState) => void,
  ) {}

  start(): void {
    if (this.timer) return;
    this.timer = setInterval(() => this.publishIfChanged(), SNAPSHOT_INTERVAL_MS);
  }

  stop(): void {
    if (!this.timer) return;
    clearInterval(this.timer);
    this.timer = undefined;
  }

  sendTo(socket: Socket): void {
    const snapshot = this.store.createSnapshot();
    this.onSnapshot?.(snapshot);
    socket.emit("stand:update", snapshot);
  }

  private publishIfChanged(): void {
    const snapshot: StandState = this.store.createSnapshot();
    const serialized = JSON.stringify(snapshot);
    if (serialized === this.lastSerializedSnapshot) return;

    this.lastSerializedSnapshot = serialized;
    this.onSnapshot?.(snapshot);
    this.io.emit("stand:update", snapshot);
  }
}

export { StandStore } from "./standStore.js";
