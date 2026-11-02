import type { ChatEvent, MatchStatsSummary, Side, StandState } from "@twitch-graderia/shared";
import type { StandMemberChange } from "../aggregator/standStore.js";
import { filterChant } from "./filter.js";
import { normalizeChantText } from "./normalizeChant.js";

const MAX_ACTIVITY_MINUTES = 24 * 60;
const MAX_TRACKED_FANS = 10_000;
const MAX_TRACKED_CHANTS = 1_000;
const TOP_CHANTS = 5;
const MAX_PRESSURE_HIGHLIGHTS = 10;

interface FanCounter {
  displayName: string;
  messageCount: number;
}

interface ChantCounter {
  text: string;
  count: number;
  error: number;
}

export class MatchStats {
  private startedAt: number | undefined;
  private active = false;
  private readonly peakFansBySide: Record<Side, number> = { argentina: 0, mexico: 0 };
  private readonly pressureSumBySide: Record<Side, number> = { argentina: 0, mexico: 0 };
  private readonly pressureSamplesBySide: Record<Side, number> = { argentina: 0, mexico: 0 };
  private readonly chantsTriggeredBySide: Record<Side, number> = { argentina: 0, mexico: 0 };
  private readonly activityByMinute = new Map<number, number>();
  private readonly fanCounters = new Map<string, FanCounter>();
  private readonly chantCounters = new Map<string, ChantCounter>();
  private readonly pressureHighlights: MatchStatsSummary["pressureHighlights"] = [];
  private readonly previousMood: Record<Side, "cold" | "calm" | "hot" | undefined> = {
    argentina: undefined,
    mexico: undefined,
  };
  private peakActivityMinuteIndex = 0;
  private peakActivityMessages = 0;
  private fansJoined = 0;
  private fansLeft = 0;
  private fansSwitchedSides = 0;

  get isActive(): boolean {
    return this.active;
  }

  start(now = Date.now()): void {
    this.startedAt = now;
    this.active = true;
    this.peakFansBySide.argentina = 0;
    this.peakFansBySide.mexico = 0;
    this.pressureSumBySide.argentina = 0;
    this.pressureSumBySide.mexico = 0;
    this.pressureSamplesBySide.argentina = 0;
    this.pressureSamplesBySide.mexico = 0;
    this.chantsTriggeredBySide.argentina = 0;
    this.chantsTriggeredBySide.mexico = 0;
    this.activityByMinute.clear();
    this.fanCounters.clear();
    this.chantCounters.clear();
    this.pressureHighlights.length = 0;
    this.previousMood.argentina = undefined;
    this.previousMood.mexico = undefined;
    this.peakActivityMinuteIndex = 0;
    this.peakActivityMessages = 0;
    this.fansJoined = 0;
    this.fansLeft = 0;
    this.fansSwitchedSides = 0;
  }

  recordChatMessage(event: ChatEvent, side: Side | undefined): void {
    if (!this.active || event.text.trim().startsWith("!")) return;
    const now = event.timestamp || Date.now();
    const minute = Math.max(0, Math.floor((now - (this.startedAt ?? now)) / 60_000));
    const minuteCount = (this.activityByMinute.get(minute) ?? 0) + 1;
    this.activityByMinute.set(minute, minuteCount);
    if (minuteCount > this.peakActivityMessages) {
      this.peakActivityMinuteIndex = minute;
      this.peakActivityMessages = minuteCount;
    }
    if (this.activityByMinute.size > MAX_ACTIVITY_MINUTES) {
      const oldestMinute = this.activityByMinute.keys().next().value as number | undefined;
      if (oldestMinute !== undefined) this.activityByMinute.delete(oldestMinute);
    }

    if (!side) return;
    if (event.source !== "mock") this.recordFanMessage(event.userId, event.userName);
    const filtered = filterChant(event.text);
    if (filtered) this.recordChant(filtered);
  }

  recordMemberChange(change: StandMemberChange): void {
    if (!this.active) return;
    if (change.type === "joined") this.fansJoined += 1;
    else if (change.type === "left") this.fansLeft += 1;
    else this.fansSwitchedSides += 1;
  }

  recordChantTriggered(side: Side): void {
    if (this.active) this.chantsTriggeredBySide[side] += 1;
  }

  recordSnapshot(snapshot: StandState, now = Date.now()): void {
    if (!this.active) return;
    for (const side of ["argentina", "mexico"] as const) {
      this.peakFansBySide[side] = Math.max(this.peakFansBySide[side], snapshot.counts[side]);
      this.pressureSumBySide[side] += snapshot.pressure[side].value;
      this.pressureSamplesBySide[side] += 1;

      const mood = snapshot.pressure[side].mood;
      const previous = this.previousMood[side];
      if (mood !== previous) {
        if (mood === "cold") this.addPressureHighlight(side, "cold", now);
        else if (previous === "cold") this.addPressureHighlight(side, "recovered", now);
        this.previousMood[side] = mood;
      }
    }
  }

  finish(now: number, finalScoreBySide: Record<Side, number>): MatchStatsSummary {
    this.active = false;
    const averagePressureBySide: Record<Side, number> = {
      argentina: this.pressureSamplesBySide.argentina
        ? this.pressureSumBySide.argentina / this.pressureSamplesBySide.argentina
        : 0,
      mexico: this.pressureSamplesBySide.mexico
        ? this.pressureSumBySide.mexico / this.pressureSamplesBySide.mexico
        : 0,
    };
    const topFan = [...this.fanCounters.values()].sort((left, right) => right.messageCount - left.messageCount)[0];
    const topChants = [...this.chantCounters.values()]
      .sort((left, right) => right.count - left.count)
      .slice(0, TOP_CHANTS)
      .map(({ text, count }) => ({ text, count }));

    return {
      durationMs: Math.max(0, now - (this.startedAt ?? now)),
      finalScoreBySide: { ...finalScoreBySide },
      peakFansBySide: { ...this.peakFansBySide },
      loudestSide: averagePressureBySide.argentina >= averagePressureBySide.mexico ? "argentina" : "mexico",
      averagePressureBySide,
      peakActivityMinute: this.peakActivityMinuteIndex + 1,
      peakActivityMessages: this.peakActivityMessages,
      topChants,
      chantsTriggeredBySide: { ...this.chantsTriggeredBySide },
      mostActiveFan: topFan
        ? { displayName: topFan.displayName.slice(0, 60), messageCount: topFan.messageCount }
        : null,
      fansJoined: this.fansJoined,
      fansLeft: this.fansLeft,
      fansSwitchedSides: this.fansSwitchedSides,
      pressureHighlights: [...this.pressureHighlights],
    };
  }

  private recordFanMessage(userId: string, userName: string): void {
    const counter = this.fanCounters.get(userId);
    if (counter) {
      counter.displayName = userName;
      counter.messageCount += 1;
      return;
    }
    if (this.fanCounters.size < MAX_TRACKED_FANS) {
      this.fanCounters.set(userId, { displayName: userName, messageCount: 1 });
      return;
    }
    const leastActive = [...this.fanCounters.entries()].sort((left, right) => left[1].messageCount - right[1].messageCount)[0];
    if (leastActive && leastActive[1].messageCount < 2) {
      this.fanCounters.delete(leastActive[0]);
      this.fanCounters.set(userId, { displayName: userName, messageCount: 1 });
    }
  }

  private recordChant(text: string): void {
    const normalized = normalizeChantText(text).slice(0, 60);
    if (normalized.length < 3) return;
    const existing = this.chantCounters.get(normalized);
    if (existing) {
      existing.count += 1;
      return;
    }
    if (this.chantCounters.size < MAX_TRACKED_CHANTS) {
      this.chantCounters.set(normalized, { text: normalized, count: 1, error: 0 });
      return;
    }
    const leastRepeated = [...this.chantCounters.entries()].sort((left, right) => left[1].count - right[1].count)[0];
    if (!leastRepeated) return;
    const estimate = leastRepeated[1].count;
    this.chantCounters.delete(leastRepeated[0]);
    this.chantCounters.set(normalized, { text: normalized, count: estimate + 1, error: estimate });
  }

  private addPressureHighlight(side: Side, event: "cold" | "recovered", now: number): void {
    if (this.pressureHighlights.length >= MAX_PRESSURE_HIGHLIGHTS) this.pressureHighlights.shift();
    this.pressureHighlights.push({
      minute: Math.max(1, Math.floor((now - (this.startedAt ?? now)) / 60_000) + 1),
      side,
      event,
    });
  }
}
