export const DEMO_SCRIPT_CONFIG = {
  durationMs: 150_000,
  crowdSize: 500,
  activityIntervalMs: 500,
  messagesPerSidePerBurst: 5,
  chantAtMs: [20_000, 32_000],
  argentinaQuietStartMs: 50_000,
  argentinaQuietEndMs: 75_000,
  argentinaGoalAtMs: 95_000,
  mexicoGoalAtMs: 105_000,
} as const;
