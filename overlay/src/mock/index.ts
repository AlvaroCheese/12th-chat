import {
  SIDES,
  type ChantEvent,
  type Fan,
  type RecentJoin,
  type Side,
  type SingingState,
  type StandState,
} from "@twitch-graderia/shared";

const INITIAL_USERS = 500;
const DISPLAY_CAP = 300;
const SEATS_PER_SIDE = DISPLAY_CAP;
const MOCK_INACTIVITY_MS = 12_000;
const CHANT_WINDOW_MS = 4_000;
const CHANT_THRESHOLD = 3;
const CHANT_COOLDOWN_MS = 4_000;
const CHANT_DURATION_MS = 5_000;
const RECENT_JOIN_MS = 3_000;
const BLOCKED_CHANTS = new Set(["blocked placeholder chant", "sample prohibited phrase"]);

interface LocalMember extends Fan {
  lastActive: number;
  joinedAt: number;
}

export function startMockMode(
  setState: (state: StandState) => void,
  onChant: (chant: ChantEvent) => void,
): void {
  console.info("Overlay mock mode enabled with churn and chant simulation");
  const users = new Map<string, LocalMember>();
  const occupiedSeats: Record<Side, Map<number, string>> = { argentina: new Map(), mexico: new Map() };
  const recentJoins: RecentJoin[] = [];
  const joinedIds = new Set<string>();
  const leftIds = new Set<string>();
  const singing: Record<Side, SingingState | null> = { argentina: null, mexico: null };
  const chantParticipants = new Map<string, Map<string, number>>();
  const chantCooldowns = new Map<string, number>();
  let nextUserId = 0;
  let activityCursor = 0;
  let leaveCursor = 0;
  let switchCursor = 10;
  let lastWaveAt = Date.now();
  let lastActivityAt = Date.now();
  let lastLeaveAt = Date.now();
  let lastSwitchAt = Date.now();
  let lastChantAt = Date.now() + 2_000;
  let lastIsolatedAt = Date.now() + 800;
  let sentBlockedExample = false;

  for (let index = 0; index < INITIAL_USERS; index += 1) {
    const side: Side = index % 2 === 0 ? "argentina" : "mexico";
    const userId = `overlay-mock-${index + 1}`;
    const userName = `${side === "argentina" ? "Albi" : "Tri"}Fan${index + 1}`;
    users.set(userId, { userId, userName, side, seat: -1, joinedAt: Date.now(), lastActive: Date.now() });
    nextUserId = index + 1;
  }
  promoteWaiting(users, occupiedSeats, joinedIds, recentJoins);

  const interval = window.setInterval(() => {
    const now = Date.now();

    for (const [userId, member] of users) {
      if (now - member.lastActive >= MOCK_INACTIVITY_MS) {
        removeUser(userId, users, occupiedSeats, leftIds);
      }
    }
    promoteWaiting(users, occupiedSeats, joinedIds, recentJoins);

    if (now - lastWaveAt >= 2_500) {
      for (let count = 0; count < 12; count += 1) {
        const index = nextUserId++;
        const side: Side = index % 2 === 0 ? "argentina" : "mexico";
        const userId = `overlay-mock-${index + 1}`;
        const userName = `${side === "argentina" ? "Albi" : "Tri"}Fan${index + 1}`;
        users.set(userId, { userId, userName, side, seat: -1, joinedAt: now, lastActive: now });
      }
      promoteWaiting(users, occupiedSeats, joinedIds, recentJoins);
      lastWaveAt = now;
    }

    if (now - lastActivityAt >= 900) {
      const active = [...users.values()];
      for (let count = 0; count < 6 && active.length > 0; count += 1) {
        const member = active[activityCursor % active.length];
        if (member) handleLocalMessage(member, `chat message ${activityCursor}`, now);
        activityCursor += 11;
      }
      lastActivityAt = now;
    }

    if (now - lastLeaveAt >= 5_000) {
      const displayed = [...users.values()].filter((member) => member.seat >= 0);
      for (let count = 0; count < 8 && displayed.length > 0; count += 1) {
        const member = displayed[leaveCursor % displayed.length];
        if (member) removeUser(member.userId, users, occupiedSeats, leftIds);
        leaveCursor += 13;
      }
      promoteWaiting(users, occupiedSeats, joinedIds, recentJoins);
      lastLeaveAt = now;
    }

    if (now - lastSwitchAt >= 8_000) {
      const displayed = [...users.values()].filter((member) => member.seat >= 0);
      for (let count = 0; count < 4 && displayed.length > 0; count += 1) {
        const member = displayed[switchCursor % displayed.length];
        if (member) joinUser(member.userId, member.userName, oppositeSide(member.side), now, users, occupiedSeats, joinedIds, leftIds, recentJoins);
        switchCursor += 17;
      }
      lastSwitchAt = now;
    }

    if (now - lastChantAt >= 8_000) {
      const side: Side = Math.floor(now / 8_000) % 2 === 0 ? "argentina" : "mexico";
      const group = [...users.values()].filter((member) => member.side === side).slice(-5);
      for (const member of group) handleLocalMessage(member, chantCycleText(now), now, onChant, chantParticipants, chantCooldowns, singing);
      lastChantAt = now;
    }

    if (now - lastIsolatedAt >= 2_700) {
      const member = [...users.values()][0];
      if (member) handleLocalMessage(member, "una voz aislada", now, onChant, chantParticipants, chantCooldowns, singing);
      lastIsolatedAt = now;
    }

    if (!sentBlockedExample && now > lastChantAt + 1_000) {
      const member = [...users.values()].find((candidate) => candidate.side === "argentina");
      if (member) handleLocalMessage(member, "blocked placeholder chant", now, onChant, chantParticipants, chantCooldowns, singing);
      sentBlockedExample = true;
    }

    for (const side of SIDES) {
      if (singing[side.id] && singing[side.id]!.endsAt <= now) singing[side.id] = null;
    }
    while (recentJoins[0] && recentJoins[0].timestamp < now - RECENT_JOIN_MS) recentJoins.shift();

    setState(createSnapshot(users, occupiedSeats, recentJoins, joinedIds, leftIds, singing));
    joinedIds.clear();
    leftIds.clear();
  }, 250);

  window.addEventListener("beforeunload", () => window.clearInterval(interval), { once: true });
}

function handleLocalMessage(
  member: LocalMember,
  text: string,
  now: number,
  onChant?: (chant: ChantEvent) => void,
  participantsByChant?: Map<string, Map<string, number>>,
  cooldowns?: Map<string, number>,
  singing?: Record<Side, SingingState | null>,
): void {
  member.lastActive = now;
  if (text.startsWith("!") || text.trim().length < 3) return;
  const filtered = filterLocalChant(text);
  if (!filtered) return;
  const normalized = normalizeChant(filtered);
  const key = `${member.side}:${normalized}`;
  let participants = participantsByChant?.get(key);
  if (!participants) {
    participants = new Map();
    participantsByChant?.set(key, participants);
  }
  participants?.set(member.userId, now);
  for (const [userId, timestamp] of participants ?? []) {
    if (timestamp < now - CHANT_WINDOW_MS) participants.delete(userId);
  }
  if (!participants || participants.size < CHANT_THRESHOLD || !singing || !cooldowns) return;

  const active = singing[member.side];
  if (active && normalizeChant(active.text) === normalized) {
    singing[member.side] = { ...active, endsAt: now + CHANT_DURATION_MS };
    return;
  }
  const lastTrigger = cooldowns.get(key) ?? 0;
  if (now - lastTrigger < CHANT_COOLDOWN_MS) return;

  const chant: ChantEvent = {
    side: member.side,
    text: filtered,
    intensity: Math.min(1, participants.size / (CHANT_THRESHOLD * 2)),
    durationMs: CHANT_DURATION_MS,
  };
  cooldowns.set(key, now);
  singing[member.side] = { text: filtered, intensity: chant.intensity, endsAt: now + CHANT_DURATION_MS };
  onChant?.(chant);
}

function joinUser(
  userId: string,
  userName: string,
  side: Side,
  now: number,
  users: Map<string, LocalMember>,
  occupiedSeats: Record<Side, Map<number, string>>,
  joinedIds: Set<string>,
  leftIds: Set<string>,
  recentJoins: RecentJoin[],
): void {
  const existing = users.get(userId);
  if (existing?.side === side) {
    existing.userName = userName;
    existing.lastActive = now;
    return;
  }
  if (existing) removeUser(userId, users, occupiedSeats, leftIds);
  users.set(userId, { userId, userName, side, seat: -1, joinedAt: now, lastActive: now });
  promoteWaiting(users, occupiedSeats, joinedIds, recentJoins);
}

function removeUser(
  userId: string,
  users: Map<string, LocalMember>,
  occupiedSeats: Record<Side, Map<number, string>>,
  leftIds: Set<string>,
): void {
  const member = users.get(userId);
  if (!member) return;
  users.delete(userId);
  if (member.seat >= 0) {
    occupiedSeats[member.side].delete(member.seat);
    leftIds.add(userId);
  }
}

function promoteWaiting(
  users: Map<string, LocalMember>,
  occupiedSeats: Record<Side, Map<number, string>>,
  joinedIds: Set<string>,
  recentJoins: RecentJoin[],
): void {
  while (occupiedSeats.argentina.size + occupiedSeats.mexico.size < DISPLAY_CAP) {
    const candidates = SIDES.map((side) => ({
      side: side.id,
      visible: occupiedSeats[side.id].size,
      member: [...users.values()]
        .filter((user) => user.side === side.id && user.seat < 0)
        .sort((left, right) => left.joinedAt - right.joinedAt)[0],
    })).filter((candidate) => candidate.member && candidate.visible < SEATS_PER_SIDE)
      .sort((left, right) => left.visible - right.visible || (left.member!.joinedAt - right.member!.joinedAt));
    const next = candidates[0];
    if (!next?.member) return;
    let seat = 0;
    while (occupiedSeats[next.side].has(seat)) seat += 1;
    next.member.seat = seat;
    occupiedSeats[next.side].set(seat, next.member.userId);
    joinedIds.add(next.member.userId);
    recentJoins.push({ userId: next.member.userId, userName: next.member.userName, side: next.side, timestamp: Date.now() });
    if (recentJoins.length > 20) recentJoins.shift();
  }
}

function createSnapshot(
  users: Map<string, LocalMember>,
  occupiedSeats: Record<Side, Map<number, string>>,
  recentJoins: RecentJoin[],
  joinedIds: Set<string>,
  leftIds: Set<string>,
  singing: Record<Side, SingingState | null>,
): StandState {
  const counts: Record<Side, number> = { argentina: 0, mexico: 0 };
  for (const member of users.values()) counts[member.side] += 1;
  const fans: Fan[] = [];
  for (const side of SIDES) {
    for (const [seat, userId] of occupiedSeats[side.id]) {
      const member = users.get(userId);
      if (member) fans.push({ userId, userName: member.userName, side: side.id, seat });
    }
  }
  return {
    counts,
    fans,
    overflowCounts: {
      argentina: counts.argentina - occupiedSeats.argentina.size,
      mexico: counts.mexico - occupiedSeats.mexico.size,
    },
    recentJoins: [...recentJoins],
    joinedIds: [...joinedIds],
    leftIds: [...leftIds],
    singing: { argentina: singing.argentina && { ...singing.argentina }, mexico: singing.mexico && { ...singing.mexico } },
  };
}

function filterLocalChant(text: string): string | null {
  const stripped = text.replace(/(?:https?:\/\/|www\.)[^\s]+/giu, " ").replace(/\s+/gu, " ").trim();
  if (!stripped || stripped.length > 60 || /([^\p{L}\p{N}\s])\1{2,}/u.test(stripped)) return null;
  return BLOCKED_CHANTS.has(normalizeChant(stripped)) ? null : stripped;
}

function normalizeChant(text: string): string {
  return text.toLocaleLowerCase().normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ").replace(/([\p{L}\p{N}])\1+/giu, "$1").replace(/\s+/gu, " ").trim();
}

function chantCycleText(now: number): string {
  return Math.floor(now / 8_000) % 2 === 0 ? "VAMOOOS!!" : "vamos";
}

function oppositeSide(side: Side): Side {
  return side === "argentina" ? "mexico" : "argentina";
}
