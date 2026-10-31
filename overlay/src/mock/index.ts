import { SIDES, type ChatEvent, type Fan, type RecentJoin, type Side, type StandState } from "@twitch-graderia/shared";

const TOTAL_MOCK_USERS = 500;
const MOCK_BATCH_SIZE = 25;
const MAX_FANS = 300;
const RECENT_JOIN_MS = 3_000;

export function startMockMode(setState: (state: StandState) => void): void {
  console.info("Overlay mock mode enabled");
  const mockEvents: ChatEvent[] = [];
  let nextUser = 0;

  const intervalId = window.setInterval(() => {
    const now = Date.now();
    for (let index = 0; index < MOCK_BATCH_SIZE && nextUser < TOTAL_MOCK_USERS; index += 1) {
      const userNumber = nextUser + 1;
      const side: Side = nextUser % 2 === 0 ? "argentina" : "mexico";
      const sideName = SIDES.find((candidate) => candidate.id === side)?.name ?? side;
      mockEvents.push({
        userId: `overlay-mock-${userNumber}`,
        userName: `${side === "argentina" ? "Albi" : "Tri"}Fan${userNumber}`,
        text: `!join ${sideName}`,
        emotes: [],
        badges: { broadcaster: false, moderator: userNumber % 100 === 0, subscriber: userNumber % 3 === 0 },
        side,
        timestamp: now,
      });
      nextUser += 1;
    }

    setState(createSnapshot(mockEvents, now));
    if (nextUser >= TOTAL_MOCK_USERS) window.clearInterval(intervalId);
  }, 100);
}

function createSnapshot(events: ChatEvent[], now: number): StandState {
  const bySide = new Map<Side, Fan[]>();
  for (const side of SIDES) bySide.set(side.id, []);
  for (const event of events) {
    if (!event.side) continue;
    bySide.get(event.side)?.push({ userId: event.userId, userName: event.userName, side: event.side });
  }

  const counts = Object.fromEntries(SIDES.map((side) => [side.id, bySide.get(side.id)?.length ?? 0])) as Record<
    Side,
    number
  >;
  const selected = new Map<Side, Fan[]>();
  let slots = MAX_FANS;
  const balancedLimit = Math.floor(MAX_FANS / SIDES.length);

  for (const side of SIDES) {
    const fans = (bySide.get(side.id) ?? []).slice(0, balancedLimit);
    selected.set(side.id, fans);
    slots -= fans.length;
  }

  while (slots > 0) {
    let added = false;
    for (const side of SIDES) {
      const fans = selected.get(side.id) ?? [];
      const nextFan = bySide.get(side.id)?.[fans.length];
      if (!nextFan || slots === 0) continue;
      fans.push(nextFan);
      selected.set(side.id, fans);
      slots -= 1;
      added = true;
    }
    if (!added) break;
  }

  const recentJoins: RecentJoin[] = events
    .filter((event): event is ChatEvent & { side: Side } => Boolean(event.side) && now - event.timestamp <= RECENT_JOIN_MS)
    .slice(-20)
    .map((event) => ({
      userId: event.userId,
      userName: event.userName,
      side: event.side,
      timestamp: event.timestamp,
    }));

  return {
    counts,
    fans: SIDES.flatMap((side) => selected.get(side.id) ?? []),
    overflowCounts: Object.fromEntries(
      SIDES.map((side) => [side.id, counts[side.id] - (selected.get(side.id)?.length ?? 0)]),
    ) as Record<Side, number>,
    recentJoins,
  };
}
