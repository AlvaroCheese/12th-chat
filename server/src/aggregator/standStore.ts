import type { ChatEvent, Fan, RecentJoin, Side, SingingState, StandState } from "@twitch-graderia/shared";
import { SIDES } from "@twitch-graderia/shared";
import { parseJoinCommand } from "../chat/joinCommand.js";

interface StandMember extends Omit<Fan, "seat"> {
  activityCount: number;
  joinedAt: number;
  lastActive: number;
  seat?: number;
}

export type StandMemberChange =
  | { type: "joined" | "left"; userId: string; userName: string; side: Side }
  | { type: "switched"; userId: string; userName: string; fromSide: Side; toSide: Side };

const DISPLAY_CAP = 300;
const SEATS_PER_SIDE = DISPLAY_CAP;
const RECENT_JOIN_DURATION_MS = 3_000;
const RECENT_JOIN_LIMIT = 20;

export class StandStore {
  private readonly users = new Map<string, StandMember>();
  private readonly occupiedSeats = Object.fromEntries(SIDES.map((side) => [side.id, new Map<number, string>()])) as Record<
    Side,
    Map<number, string>
  >;
  private readonly recentJoins: RecentJoin[] = [];
  private readonly pendingJoinedIds = new Set<string>();
  private readonly pendingLeftIds = new Set<string>();
  private readonly singing = Object.fromEntries(SIDES.map((side) => [side.id, null])) as Record<
    Side,
    SingingState | null
  >;
  private readonly scoreBySide: Record<Side, number> = { argentina: 0, mexico: 0 };
  private memberChangeListener: ((change: StandMemberChange) => void) | undefined;

  constructor(private readonly inactivityTimeoutMs = 120_000) {}

  onMemberChange(listener: (change: StandMemberChange) => void): void {
    this.memberChangeListener = listener;
  }

  handleChatEvent(event: ChatEvent): Side | undefined {
    const now = event.timestamp || Date.now();
    const existing = this.users.get(event.userId);
    const requestedSide = parseJoinCommand(event.text);

    if (requestedSide) {
      if (existing?.side === requestedSide) {
        existing.userName = event.userName;
        existing.lastActive = now;
        existing.activityCount += 1;
        return undefined;
      }

      const activityCount = (existing?.activityCount ?? 0) + 1;
      if (existing) {
        const fromSide = existing.side;
        this.removeMember(event.userId, false);
        this.memberChangeListener?.({
          type: "switched",
          userId: event.userId,
          userName: event.userName,
          fromSide,
          toSide: requestedSide,
        });
      } else {
        this.memberChangeListener?.({
          type: "joined",
          userId: event.userId,
          userName: event.userName,
          side: requestedSide,
        });
      }
      this.users.set(event.userId, {
        userId: event.userId,
        userName: event.userName,
        side: requestedSide,
        activityCount,
        joinedAt: now,
        lastActive: now,
      });
      this.promoteWaiting();
      return undefined;
    }

    if (/^\s*!leave\s*$/i.test(event.text)) {
      if (existing) {
        this.removeMember(event.userId);
        this.promoteWaiting();
      }
      return undefined;
    }

    if (!existing) return undefined;
    existing.userName = event.userName;
    existing.lastActive = now;
    existing.activityCount += 1;

    // Commands can keep a fan active, but are never considered chant text.
    return event.text.trim().startsWith("!") ? undefined : existing.side;
  }

  expireInactive(now = Date.now()): boolean {
    const expiredUserIds = [...this.users.values()]
      .filter((member) => now - member.lastActive >= this.inactivityTimeoutMs)
      .map((member) => member.userId);
    if (expiredUserIds.length === 0) return false;

    for (const userId of expiredUserIds) this.removeMember(userId);
    this.promoteWaiting();
    return true;
  }

  setSinging(side: Side, state: SingingState): void {
    this.singing[side] = state;
  }

  getSinging(side: Side): SingingState | null {
    return this.singing[side];
  }

  scoreGoal(side: Side): Record<Side, number> {
    this.scoreBySide[side] += 1;
    return { ...this.scoreBySide };
  }

  resetScore(): Record<Side, number> {
    this.scoreBySide.argentina = 0;
    this.scoreBySide.mexico = 0;
    return { ...this.scoreBySide };
  }

  expireSinging(now = Date.now()): boolean {
    let changed = false;
    for (const side of SIDES) {
      if (this.singing[side.id] && this.singing[side.id]!.endsAt <= now) {
        this.singing[side.id] = null;
        changed = true;
      }
    }
    return changed;
  }

  createSnapshot(now = Date.now(), includeDeltas = true): StandState {
    const counts = Object.fromEntries(SIDES.map((side) => [side.id, 0])) as Record<Side, number>;
    const fans: Fan[] = [];

    for (const member of this.users.values()) counts[member.side] += 1;
    for (const side of SIDES) {
      const sideSeats = this.occupiedSeats[side.id];
      for (const [seat, userId] of sideSeats) {
        const member = this.users.get(userId);
        if (!member) continue;
        fans.push({ userId, userName: member.userName, side: side.id, seat });
      }
    }

    const visibleCounts = Object.fromEntries(SIDES.map((side) => [side.id, this.occupiedSeats[side.id].size])) as Record<
      Side,
      number
    >;
    const overflowCounts = Object.fromEntries(
      SIDES.map((side) => [side.id, counts[side.id] - visibleCounts[side.id]]),
    ) as Record<Side, number>;

    while (this.recentJoins[0] && this.recentJoins[0].timestamp < now - RECENT_JOIN_DURATION_MS) {
      this.recentJoins.shift();
    }

    return {
      counts,
      fans,
      overflowCounts,
      recentJoins: [...this.recentJoins],
      joinedIds: includeDeltas ? [...this.pendingJoinedIds] : [],
      leftIds: includeDeltas ? [...this.pendingLeftIds] : [],
      singing: Object.fromEntries(SIDES.map((side) => [side.id, this.singing[side.id] && { ...this.singing[side.id] }])) as Record<
        Side,
        SingingState | null
      >,
      scoreBySide: { ...this.scoreBySide },
      pressure: {
        argentina: { value: 0, mood: "cold" },
        mexico: { value: 0, mood: "cold" },
      },
    };
  }

  acknowledgeSnapshot(): void {
    this.pendingJoinedIds.clear();
    this.pendingLeftIds.clear();
  }

  private removeMember(userId: string, countAsLeave = true): void {
    const member = this.users.get(userId);
    if (!member) return;
    this.users.delete(userId);
    if (countAsLeave) {
      this.memberChangeListener?.({
        type: "left",
        userId: member.userId,
        userName: member.userName,
        side: member.side,
      });
    }
    if (member.seat === undefined) return;

    this.occupiedSeats[member.side].delete(member.seat);
    this.pendingLeftIds.add(userId);
  }

  private promoteWaiting(): void {
    while (this.displayedFanCount() < DISPLAY_CAP) {
      const candidates = SIDES.map((side) => {
        const waiting = [...this.users.values()]
          .filter((member) => member.side === side.id && member.seat === undefined)
          .sort((left, right) => left.joinedAt - right.joinedAt);
        return { side: side.id, visible: this.occupiedSeats[side.id].size, member: waiting[0] };
      })
        .filter((candidate) => candidate.member && candidate.visible < SEATS_PER_SIDE)
        .sort((left, right) => left.visible - right.visible || (left.member!.joinedAt - right.member!.joinedAt));

      const candidate = candidates[0];
      if (!candidate?.member) return;

      const seat = this.findFirstFreeSeat(candidate.side);
      if (seat === undefined) return;
      candidate.member.seat = seat;
      this.occupiedSeats[candidate.side].set(seat, candidate.member.userId);
      this.pendingJoinedIds.add(candidate.member.userId);
      this.recentJoins.push({
        userId: candidate.member.userId,
        userName: candidate.member.userName,
        side: candidate.side,
        timestamp: Date.now(),
      });
      if (this.recentJoins.length > RECENT_JOIN_LIMIT) this.recentJoins.shift();
    }
  }

  private findFirstFreeSeat(side: Side): number | undefined {
    for (let seat = 0; seat < SEATS_PER_SIDE; seat += 1) {
      if (!this.occupiedSeats[side].has(seat)) return seat;
    }
    return undefined;
  }

  private displayedFanCount(): number {
    return SIDES.reduce((total, side) => total + this.occupiedSeats[side.id].size, 0);
  }
}
