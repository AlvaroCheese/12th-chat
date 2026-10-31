import type { Side } from "./sides.js";

export { SIDES } from "./sides.js";
export type { Side } from "./sides.js";

export interface Fan {
  userId: string;
  userName: string;
  side: Side;
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
}

export type ServerToOverlayMessage =
  | { type: "stand:update"; state: StandState }
  | { type: "chant"; side: Side; text: string }
  | { type: "goal"; side: Side }
  | { type: "match:end"; report: string };
