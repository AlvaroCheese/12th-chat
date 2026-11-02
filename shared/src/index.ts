import type { Side } from "./sides.js";

export { SIDES } from "./sides.js";
export type { Side } from "./sides.js";
export { PRESSURE_CONFIG } from "./pressureConfig.js";
export type { PressureConfig } from "./pressureConfig.js";

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
  pressure: Record<Side, PressureState>;
}

export type PressureMood = "cold" | "calm" | "hot";

export interface PressureState {
  value: number;
  mood: PressureMood;
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

export interface MatchStatsSummary {
  durationMs: number;
  finalScoreBySide: Record<Side, number>;
  peakFansBySide: Record<Side, number>;
  loudestSide: Side;
  averagePressureBySide: Record<Side, number>;
  peakActivityMinute: number;
  peakActivityMessages: number;
  topChants: Array<{ text: string; count: number }>;
  chantsTriggeredBySide: Record<Side, number>;
  mostActiveFan: { displayName: string; messageCount: number } | null;
  fansJoined: number;
  fansLeft: number;
  fansSwitchedSides: number;
  pressureHighlights: Array<{ minute: number; side: Side; event: "cold" | "recovered" }>;
}

export interface CrowdReport {
  source: "ai" | "template";
  createdAt: string;
  language: string;
  title: string;
  narrative: string;
  mvpBlurb: string;
  loudestMoment: string;
  tagline: string;
  stats: MatchStatsSummary;
}

export interface MatchEndedEvent {
  status: "generating" | "ready";
  finalScoreBySide: Record<Side, number>;
  reportUrl: string;
  source?: CrowdReport["source"];
}

export type ServerToOverlayMessage =
  | { type: "stand:update"; state: StandState }
  | { type: "chant"; chant: ChantEvent }
  | { type: "goal"; goal: GoalEvent }
  | { type: "matchEnded"; event: MatchEndedEvent }
  | { type: "match:end"; report: string };
