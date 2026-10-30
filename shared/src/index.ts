export type Side = "home" | "away";

export interface ChatEvent {
  userId: string;
  username: string;
  message: string;
  side?: Side;
  timestamp: number;
}

export interface StandState {
  homeCount: number;
  awayCount: number;
  homePressure: number;
  awayPressure: number;
}

export type ServerToOverlayMessage =
  | { type: "stand:update"; state: StandState }
  | { type: "chant"; side: Side; text: string }
  | { type: "goal"; side: Side }
  | { type: "match:end"; report: string };
