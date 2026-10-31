import type { ChantEvent, ChatEvent, Side } from "@twitch-graderia/shared";
import type { ChantConfig } from "../config/chants.js";
import { filterChant } from "./filter.js";
import { normalizeChantText } from "./normalizeChant.js";
import type { StandStore } from "../aggregator/standStore.js";

interface ChantWindow {
  text: string;
  participants: Map<string, number>;
}

export class ChantDetector {
  private readonly windows = new Map<Side, Map<string, ChantWindow>>();
  private readonly cooldowns = new Map<string, number>();

  constructor(
    private readonly store: StandStore,
    private readonly config: ChantConfig,
  ) {}

  handle(event: ChatEvent, side: Side, now = Date.now()): ChantEvent | undefined {
    const input = event.text.trim();
    if (input.startsWith("!") || input.length < 3) return undefined;

    const text = filterChant(input);
    if (!text) {
      console.info("Chant rejected by content filter");
      return undefined;
    }

    const normalizedText = normalizeChantText(text);
    if (normalizedText.length < 3) return undefined;

    let sideWindows = this.windows.get(side);
    if (!sideWindows) {
      sideWindows = new Map();
      this.windows.set(side, sideWindows);
    }
    this.pruneSideWindows(sideWindows, now);

    let window = sideWindows.get(normalizedText);
    if (!window) {
      window = { text, participants: new Map() };
      sideWindows.set(normalizedText, window);
    }
    window.participants.set(event.userId, now);
    if (window.participants.size < this.config.distinctUsers) return undefined;

    const singing = this.store.getSinging(side);
    if (singing && normalizeChantText(singing.text) === normalizedText) {
      this.store.setSinging(side, {
        ...singing,
        endsAt: now + this.config.singingDurationMs,
        intensity: this.intensity(window.participants.size),
      });
      return undefined;
    }

    const cooldownKey = `${side}:${normalizedText}`;
    const lastTrigger = this.cooldowns.get(cooldownKey) ?? 0;
    if (now - lastTrigger < this.config.cooldownMs) return undefined;

    const chant: ChantEvent = {
      side,
      text,
      intensity: this.intensity(window.participants.size),
      durationMs: this.config.singingDurationMs,
    };
    this.cooldowns.set(cooldownKey, now);
    this.store.setSinging(side, { text, intensity: chant.intensity, endsAt: now + chant.durationMs });
    return chant;
  }

  private pruneSideWindows(sideWindows: Map<string, ChantWindow>, now: number): void {
    for (const [text, window] of sideWindows) {
      for (const [userId, timestamp] of window.participants) {
        if (timestamp < now - this.config.windowMs) window.participants.delete(userId);
      }
      if (window.participants.size === 0) sideWindows.delete(text);
    }

    for (const [key, timestamp] of this.cooldowns) {
      if (timestamp < now - this.config.cooldownMs * 3) this.cooldowns.delete(key);
    }
  }

  private intensity(distinctUsers: number): number {
    return Math.min(1, distinctUsers / (this.config.distinctUsers * 2));
  }
}
