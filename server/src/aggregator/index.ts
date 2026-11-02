import type { PressureState, Side, StandState } from "@twitch-graderia/shared";
import type { Server, Socket } from "socket.io";
import { StandStore } from "./standStore.js";
import { PressureMeter } from "../chat/pressure.js";

const SNAPSHOT_INTERVAL_MS = 250;

export class StandAggregator {
  private lastSerializedSnapshot = "";
  private lastPressure: Record<Side, PressureState> | undefined;
  private timer: NodeJS.Timeout | undefined;
  private readonly baselineSocketIds = new Set<string>();
  private frozen = false;

  constructor(
    private readonly io: Server,
    private readonly store: StandStore,
    private readonly pressure: PressureMeter,
    private readonly onSnapshot?: (snapshot: StandState) => void,
    private readonly onSample?: (snapshot: StandState, now: number) => void,
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

  setFrozen(frozen: boolean): void {
    this.frozen = frozen;
  }

  sendTo(socket: Socket): void {
    const now = Date.now();
    this.store.expireInactive(now);
    this.store.expireSinging(now);
    const snapshot = this.makeSnapshot(now, false);
    this.onSnapshot?.(snapshot);
    socket.emit("stand:update", snapshot);
    this.baselineSocketIds.add(socket.id);
  }

  removeSocket(socket: Socket): void {
    this.baselineSocketIds.delete(socket.id);
  }

  private publishIfChanged(): void {
    if (this.frozen) return;
    const now = Date.now();
    this.store.expireInactive(now);
    this.store.expireSinging(now);
    const snapshot = this.makeSnapshot(now);
    this.onSample?.(snapshot, now);
    const serialized = JSON.stringify({ ...snapshot, pressure: undefined });
    const baseChanged = serialized !== this.lastSerializedSnapshot;
    const pressureChanged = this.pressure.isMeaningfulChange(this.lastPressure, snapshot.pressure);
    if (!baseChanged && !pressureChanged) return;

    this.lastSerializedSnapshot = serialized;
    this.lastPressure = snapshot.pressure;
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

  private makeSnapshot(now: number, includeDeltas = true): StandState {
    const snapshot = this.store.createSnapshot(now, includeDeltas);
    snapshot.pressure = this.pressure.update(now, snapshot.counts);
    return snapshot;
  }
}

export { StandStore } from "./standStore.js";
