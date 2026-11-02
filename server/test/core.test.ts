import { describe, expect, it } from "vitest";
import { filterChant } from "../src/chat/filter.js";
import { normalizeChantText } from "../src/chat/normalizeChant.js";
import { parseJoinCommand } from "../src/chat/joinCommand.js";
import { parseGoalSide } from "../src/match/goalController.js";
import { PressureMeter } from "../src/chat/pressure.js";
import { PRESSURE_CONFIG } from "@twitch-graderia/shared";

describe("chant normalization and filtering", () => {
  it("normalizes repeated letters, punctuation, and accents consistently", () => {
    expect(normalizeChantText("VAMOOOS!!")).toBe("vamos");
    expect(normalizeChantText("¡VÁMOS!")).toBe("vamos");
  });

  it("strips links and rejects symbol spam and blocked text", () => {
    expect(filterChant("Vamos https://example.com ahora")).toBe("Vamos ahora");
    expect(filterChant("!!!!!")).toBeNull();
    expect(filterChant("blocked placeholder chant")).toBeNull();
  });
});

describe("chat command parsing", () => {
  it("accepts side ids and names case-insensitively", () => {
    expect(parseJoinCommand(" !JOIN ARGENTINA ")).toBe("argentina");
    expect(parseJoinCommand("!join Mexico")).toBe("mexico");
    expect(parseGoalSide("!goal MEXICO")).toBe("mexico");
    expect(parseJoinCommand("!join unknown")).toBeUndefined();
  });
});

describe("pressure mood hysteresis", () => {
  it("stays hot through the hot-exit band before returning to calm and cold", () => {
    const config = {
      ...PRESSURE_CONFIG.mock,
      windowMs: 1_000,
      smoothingAlpha: 0.5,
      minimumFans: 1,
      targetMessagesPerFanPerWindow: 1,
    };
    const meter = new PressureMeter(config);
    const counts = { argentina: 1, mexico: 1 };
    meter.recordMessage("argentina", 100);
    expect(meter.update(100, counts).argentina.mood).toBe("calm");
    meter.recordMessage("argentina", 200);
    expect(meter.update(200, counts).argentina.mood).toBe("hot");
    expect(meter.update(1_300, counts).argentina.mood).toBe("calm");
    expect(meter.update(1_400, counts).argentina.mood).toBe("cold");
  });
});
