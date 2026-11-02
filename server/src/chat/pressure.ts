import { PRESSURE_CONFIG, type PressureConfig, type PressureMood, type PressureState, type Side } from "@twitch-graderia/shared";

export function getPressureConfig(mock: boolean): PressureConfig {
  return mock ? PRESSURE_CONFIG.mock : PRESSURE_CONFIG.live;
}

export function isMockPressureActive(side: Side, now = Date.now()): boolean {
  const config = PRESSURE_CONFIG.mock;
  const cycleMs = config.mockHighMs + config.mockQuietMs;
  const offset = side === "mexico" ? config.mockSideOffsetMs : 0;
  return ((now + offset) % cycleMs) < config.mockHighMs;
}

export class PressureMeter {
  private readonly events: Record<Side, number[]> = { argentina: [], mexico: [] };
  private readonly boosts: Record<Side, { value: number; endsAt: number; durationMs: number }> = {
    argentina: { value: 0, endsAt: 0, durationMs: 0 },
    mexico: { value: 0, endsAt: 0, durationMs: 0 },
  };
  private readonly state: Record<Side, PressureState> = {
    argentina: { value: 0, mood: "cold" },
    mexico: { value: 0, mood: "cold" },
  };

  constructor(private readonly config: PressureConfig) {}

  recordMessage(side: Side, now = Date.now()): void {
    this.events[side].push(now);
  }

  boost(side: Side, source: "chant" | "goal", now = Date.now()): void {
    const value = source === "goal" ? this.config.goalBoost : this.config.chantBoost;
    const durationMs = source === "goal" ? this.config.goalBoostMs : this.config.chantBoostMs;
    const boost = this.boosts[side];
    if (boost.endsAt > now && boost.value > value) return;
    this.boosts[side] = { value, endsAt: now + durationMs, durationMs };
  }

  update(now: number, counts: Record<Side, number>): Record<Side, PressureState> {
    for (const side of ["argentina", "mexico"] as const) {
      const events = this.events[side];
      while (events[0] !== undefined && events[0] <= now - this.config.windowMs) events.shift();

      const ratePerSecond = events.length / (this.config.windowMs / 1_000);
      const effectiveFans = Math.max(counts[side], this.config.minimumFans);
      const targetRate = effectiveFans * this.config.targetMessagesPerFanPerWindow / (this.config.windowMs / 1_000);
      let target = Math.min(1, ratePerSecond / targetRate);

      const boost = this.boosts[side];
      if (boost.endsAt > now) {
        const duration = boost.endsAt - now;
        const boostValue = boost.value * Math.min(1, duration / boost.durationMs);
        target = Math.max(target, boostValue);
      } else {
        boost.value = 0;
        boost.endsAt = 0;
        boost.durationMs = 0;
      }

      const previous = this.state[side];
      const value = previous.value + (target - previous.value) * this.config.smoothingAlpha;
      this.state[side] = { value, mood: nextMood(previous.mood, value, this.config) };
    }
    return { argentina: { ...this.state.argentina }, mexico: { ...this.state.mexico } };
  }

  isMeaningfulChange(previous: Record<Side, PressureState> | undefined, current: Record<Side, PressureState>): boolean {
    if (!previous) return true;
    return (["argentina", "mexico"] as const).some(
      (side) => previous[side].mood !== current[side].mood || Math.abs(previous[side].value - current[side].value) >= this.config.meaningfulDelta,
    );
  }
}

function nextMood(current: PressureMood, value: number, config: PressureConfig): PressureMood {
  if (current === "cold") {
    if (value >= config.hotEnter) return "hot";
    return value >= config.coldExit ? "calm" : "cold";
  }
  if (current === "hot") {
    if (value <= config.coldEnter) return "cold";
    return value <= config.hotExit ? "calm" : "hot";
  }
  if (value <= config.coldEnter) return "cold";
  if (value >= config.hotEnter) return "hot";
  return "calm";
}
