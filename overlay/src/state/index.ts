import { SIDES, type Side, type StandState } from "@twitch-graderia/shared";

const emptyCounts = Object.fromEntries(SIDES.map((side) => [side.id, 0])) as Record<Side, number>;

let currentState: StandState = {
  counts: { ...emptyCounts },
  fans: [],
  overflowCounts: { ...emptyCounts },
  recentJoins: [],
  joinedIds: [],
  leftIds: [],
  singing: { argentina: null, mexico: null },
  scoreBySide: { argentina: 0, mexico: 0 },
};

const subscribers = new Set<(state: StandState) => void>();

export function getStandState(): StandState {
  return currentState;
}

export function setStandState(state: StandState): void {
  currentState = state;
  for (const subscriber of subscribers) subscriber(state);
}

export function subscribeToStandState(subscriber: (state: StandState) => void): () => void {
  subscribers.add(subscriber);
  return () => subscribers.delete(subscriber);
}
