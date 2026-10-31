import type { StandState } from "@twitch-graderia/shared";
import type { Server, Socket } from "socket.io";
import { StandStore } from "./standStore.js";

const SNAPSHOT_INTERVAL_MS = 250;

export class StandAggregator {
  private lastSerializedSnapshot = "";
  private timer: NodeJS.Timeout | undefined;
  private readonly baselineSocketIds = new Set<string>();

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
    const now = Date.now();
    this.store.expireInactive(now);
    this.store.expireSinging(now);
    const snapshot = this.store.createSnapshot(now, false);
    this.onSnapshot?.(snapshot);
    socket.emit("stand:update", snapshot);
    this.baselineSocketIds.add(socket.id);
  }

  removeSocket(socket: Socket): void {
    this.baselineSocketIds.delete(socket.id);
  }

  private publishIfChanged(): void {
    const now = Date.now();
    this.store.expireInactive(now);
    this.store.expireSinging(now);
    const snapshot: StandState = this.store.createSnapshot(now);
    const serialized = JSON.stringify(snapshot);
    if (serialized === this.lastSerializedSnapshot) return;

    this.lastSerializedSnapshot = serialized;
    this.onSnapshot?.(snapshot);
    for (const socket of this.io.sockets.sockets.values()) {
      const payload = this.baselineSocketIds.has(socket.id)
        ? { ...snapshot, joinedIds: [], leftIds: [] }
        : snapshot;
      socket.emit("stand:update", payload);
      this.baselineSocketIds.delete(socket.id);
    }
    this.store.acknowledgeSnapshot();
  }
}

export { StandStore } from "./standStore.js";
