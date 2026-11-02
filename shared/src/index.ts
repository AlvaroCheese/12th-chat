import type { Side } from "./sides.js";

export { SIDES } from "./sides.js";
export type { Side } from "./sides.js";

export interface Fan {
  userId: string;
  userName: string;
  side: Side;
  seat: number;
}

export interface RecentJoin {
  userId: string;
  userName: string;
  side: Side;
  timestamp: number;
}

export interface ChatEvent {
  userId: string;
  userName: string;
  text: string;
  emotes: string[];
  badges: {
    broadcaster: boolean;
    moderator: boolean;
    subscriber: boolean;
  };
  side?: Side;
  timestamp: number;
}

export interface StandState {
  counts: Record<Side, number>;
  fans: Fan[];
  overflowCounts: Record<Side, number>;
  recentJoins: RecentJoin[];
  joinedIds: string[];
  leftIds: string[];
  singing: Record<Side, SingingState | null>;
  scoreBySide: Record<Side, number>;
}

export interface SingingState {
  text: string;
  intensity: number;
  endsAt: number;
}

export interface ChantEvent {
  side: Side;
  text: string;
  intensity: number;
  durationMs: number;
}

export interface GoalEvent {
  side: Side;
  scoreBySide: Record<Side, number>;
}

export type ServerToOverlayMessage =
  | { type: "stand:update"; state: StandState }
  | { type: "chant"; chant: ChantEvent }
  | { type: "goal"; goal: GoalEvent }
  | { type: "match:end"; report: string };
