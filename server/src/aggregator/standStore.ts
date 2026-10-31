import type { ChatEvent, Fan, RecentJoin, Side, StandState } from "@twitch-graderia/shared";
import { SIDES } from "@twitch-graderia/shared";
import { parseJoinCommand } from "../chat/joinCommand.js";

interface StandMember extends Fan {
  activityCount: number;
  joinedAt: number;
  lastActive: number;
}

const FAN_CAP = 300;
const RECENT_JOIN_DURATION_MS = 3_000;
const RECENT_JOIN_LIMIT = 20;

export class StandStore {
  private readonly users = new Map<string, StandMember>();
  private readonly recentJoins: RecentJoin[] = [];

  handleChatEvent(event: ChatEvent): void {
    const now = event.timestamp || Date.now();
    const requestedSide = parseJoinCommand(event.text);
    const existing = this.users.get(event.userId);

    if (requestedSide) {
      const member: StandMember = {
        userId: event.userId,
        userName: event.userName,
        side: requestedSide,
        activityCount: (existing?.activityCount ?? 0) + 1,
        joinedAt: now,
        lastActive: now,
      };
      this.users.set(event.userId, member);
      this.recentJoins.push({
        userId: member.userId,
        userName: member.userName,
        side: member.side,
        timestamp: now,
      });
      if (this.recentJoins.length > RECENT_JOIN_LIMIT) this.recentJoins.shift();
      return;
    }

    if (existing) {
      existing.userName = event.userName;
      existing.lastActive = now;
      existing.activityCount += 1;
    }
  }

  createSnapshot(now = Date.now()): StandState {
    const counts = Object.fromEntries(SIDES.map((side) => [side.id, 0])) as Record<Side, number>;
    const bySide = Object.fromEntries(SIDES.map((side) => [side.id, [] as StandMember[]])) as Record<
      Side,
      StandMember[]
    >;

    for (const member of this.users.values()) {
      counts[member.side] += 1;
      bySide[member.side].push(member);
    }

    for (const side of SIDES) {
      bySide[side.id].sort((left, right) => memberPriority(right, now) - memberPriority(left, now));
    }

    const selected = new Map<Side, StandMember[]>();
    let remaining = FAN_CAP;
    const balancedFirstPass = Math.floor(FAN_CAP / SIDES.length);

    for (const side of SIDES) {
      const members = bySide[side.id].slice(0, balancedFirstPass);
      selected.set(side.id, members);
      remaining -= members.length;
    }

    while (remaining > 0) {
      let allocated = false;
      for (const side of SIDES) {
        const members = selected.get(side.id) ?? [];
        const candidate = bySide[side.id][members.length];
        if (!candidate || remaining === 0) continue;
        members.push(candidate);
        selected.set(side.id, members);
        remaining -= 1;
        allocated = true;
      }
      if (!allocated) break;
    }

    const fans: Fan[] = SIDES.flatMap((side) =>
      (selected.get(side.id) ?? []).map(({ userId, userName, side: memberSide }) => ({
        userId,
        userName,
        side: memberSide,
      })),
    );
    const overflowCounts = Object.fromEntries(
      SIDES.map((side) => [side.id, counts[side.id] - (selected.get(side.id)?.length ?? 0)]),
    ) as Record<Side, number>;

    while (this.recentJoins[0] && this.recentJoins[0].timestamp < now - RECENT_JOIN_DURATION_MS) {
      this.recentJoins.shift();
    }

    return {
      counts,
      fans,
      overflowCounts,
      recentJoins: [...this.recentJoins],
    };
  }
}

function memberPriority(member: StandMember, now: number): number {
  const recencyBonus = Math.max(0, RECENT_JOIN_DURATION_MS * 20 - (now - member.lastActive)) / 1_000;
  return member.activityCount * 100 + recencyBonus;
}
