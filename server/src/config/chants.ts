export interface ChantConfig {
  windowMs: number;
  distinctUsers: number;
  cooldownMs: number;
  singingDurationMs: number;
}

const liveConfig: ChantConfig = {
  windowMs: 8_000,
  distinctUsers: 5,
  cooldownMs: 10_000,
  singingDurationMs: 6_000,
};

const mockConfig: ChantConfig = {
  windowMs: 4_000,
  distinctUsers: 3,
  cooldownMs: 4_000,
  singingDurationMs: 5_000,
};

export function getChantConfig(mock: boolean): ChantConfig {
  return mock ? mockConfig : liveConfig;
}

export function getFanInactivityTimeoutMs(mock: boolean): number {
  return mock ? 30_000 : 120_000;
}
