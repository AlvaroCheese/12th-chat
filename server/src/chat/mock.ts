import type { ChatEvent, Side } from "@twitch-graderia/shared";
import { chatEventBus } from "./eventBus.js";
import { getPressureConfig, isMockPressureActive } from "./pressure.js";

const mockUsersBySide: Record<Side, string[]> = { argentina: [], mexico: [] };
let nextUserIndex = 0;
let leaveCursor = 0;
let switchCursor = 12;
let mockGoalCycle = 0;
let pressureActivityCursor = 0;
const pressureMockConfig = getPressureConfig(true);

export function startMockChat(): void {
  console.info("Mock chat generator started (500 initial joiners with continuous churn)");

  const initialJoinTimer = setInterval(() => {
    for (let count = 0; count < 10 && nextUserIndex < 500; count += 1) {
      addMockUser(nextUserIndex);
      nextUserIndex += 1;
    }

    if (nextUserIndex >= 500) clearInterval(initialJoinTimer);
  }, 50);

  setInterval(() => {
    for (let count = 0; count < 20; count += 1) {
      addMockUser(nextUserIndex);
      nextUserIndex += 1;
    }
  }, 4_500);

  setInterval(() => {
    for (let count = 0; count < 10; count += 1) {
      const side: Side = count % 2 === 0 ? "argentina" : "mexico";
      const visibleCandidates = mockUsersBySide[side].slice(0, 150);
      const userName = visibleCandidates[leaveCursor % Math.max(visibleCandidates.length, 1)];
      if (userName) emitMockEvent(userName, "!leave");
      leaveCursor += 1;
    }
  }, 8_000);

  setInterval(() => {
    const currentSide: Side = switchCursor % 2 === 0 ? "argentina" : "mexico";
    const otherSide: Side = currentSide === "argentina" ? "mexico" : "argentina";
    const userName = mockUsersBySide[currentSide][switchCursor % Math.max(mockUsersBySide[currentSide].length, 1)];
    if (userName) emitMockEvent(userName, `!join ${otherSide}`);
    switchCursor += 7;
  }, 6_500);

  setTimeout(() => {
    const joinedUser = mockUsersBySide.argentina[0];
    if (joinedUser) emitMockEvent(joinedUser, "blocked placeholder chant");
  }, 1_500);

  let chantCycle = 0;
  setInterval(() => {
    const side: Side = chantCycle % 2 === 0 ? "argentina" : "mexico";
    const text = chantCycle % 2 === 0 ? "VAMOOOS!!" : "Dale dale dale";
    emitCoordinatedChant(side, text);
    chantCycle += 1;
  }, 10_000);

  setInterval(() => {
    const joinedUser = mockUsersBySide.mexico.at(-1);
    if (joinedUser) emitMockEvent(joinedUser, "¡VAMOS! No coordinación suficiente");
  }, 7_000);

  setInterval(() => {
    const side: Side = mockGoalCycle % 2 === 0 ? "argentina" : "mexico";
    emitMockEvent(side === "argentina" ? "AlbiFan125" : "TriFan250", `!goal ${side}`);
    mockGoalCycle += 1;
  }, 18_000);

  setInterval(() => {
    for (const side of ["argentina", "mexico"] as const) {
      if (!isMockPressureActive(side, Date.now())) continue;
      const candidates = mockUsersBySide[side].slice(-100);
      for (let count = 0; count < pressureMockConfig.mockBurstMessages && candidates.length > 0; count += 1) {
        const userName = candidates[pressureActivityCursor % candidates.length];
        if (userName) emitMockEvent(userName, `crowd activity ${pressureActivityCursor}`);
        pressureActivityCursor += 1;
      }
    }
  }, pressureMockConfig.mockBurstIntervalMs);
}

function addMockUser(index: number): void {
  const side: Side = index % 2 === 0 ? "argentina" : "mexico";
  const userName = `${side === "argentina" ? "Albi" : "Tri"}Fan${index + 1}`;
  mockUsersBySide[side].push(userName);
  emitMockEvent(userName, `!join ${side}`);
}

function emitCoordinatedChant(side: Side, text: string): void {
  const group = mockUsersBySide[side].slice(-5);
  if (group.length < 5) return;

  for (const userName of group) emitMockEvent(userName, `!join ${side}`);
  for (const userName of group) emitMockEvent(userName, text);
}

function emitMockEvent(userName: string, text: string): void {
  const side: Side = userName.startsWith("Albi") ? "argentina" : "mexico";
  const event: ChatEvent = {
    userId: `mock-${userName.toLowerCase()}`,
    userName,
    text,
    emotes: [],
    badges: {
      broadcaster: false,
      moderator: Number(userName.replace(/\D/gu, "")) % 125 === 0,
      subscriber: Number(userName.replace(/\D/gu, "")) % 3 === 0,
    },
    side,
    timestamp: Date.now(),
  };
  chatEventBus.emit("chat", event);
}
