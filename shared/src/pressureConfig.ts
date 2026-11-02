export interface PressureConfig {
  windowMs: number;
  smoothingAlpha: number;
  minimumFans: number;
  targetMessagesPerFanPerWindow: number;
  coldEnter: number;
  coldExit: number;
  hotEnter: number;
  hotExit: number;
  meaningfulDelta: number;
  chantBoost: number;
  chantBoostMs: number;
  goalBoost: number;
  goalBoostMs: number;
  mockHighMs: number;
  mockQuietMs: number;
  mockSideOffsetMs: number;
  mockBurstIntervalMs: number;
  mockBurstMessages: number;
}

const live: PressureConfig = {
  windowMs: 10_000,
  smoothingAlpha: 0.2,
  minimumFans: 40,
  targetMessagesPerFanPerWindow: 0.12,
  coldEnter: 0.2,
  coldExit: 0.27,
  hotEnter: 0.72,
  hotExit: 0.6,
  meaningfulDelta: 0.025,
  chantBoost: 0.35,
  chantBoostMs: 6_000,
  goalBoost: 0.55,
  goalBoostMs: 4_500,
  mockHighMs: 20_000,
  mockQuietMs: 15_000,
  mockSideOffsetMs: 17_500,
  mockBurstIntervalMs: 900,
  mockBurstMessages: 6,
};

const mock: PressureConfig = {
  ...live,
  windowMs: 2_500,
  smoothingAlpha: 0.55,
  minimumFans: 80,
  targetMessagesPerFanPerWindow: 0.04,
};

/** Tuning shared by the server meter and the standalone overlay mock. */
export const PRESSURE_CONFIG: Readonly<Record<"live" | "mock", Readonly<PressureConfig>>> = { live, mock };
