import { SIDES, type GoalEvent, type Side } from "@twitch-graderia/shared";
import type { StandStore } from "../aggregator/standStore.js";

const GOAL_COOLDOWN_MS = 3_000;

export class GoalController {
  private lastGoalAt = 0;

  constructor(private readonly store: StandStore) {}

  goal(side: Side, now = Date.now()): GoalEvent | undefined {
    if (now - this.lastGoalAt < GOAL_COOLDOWN_MS) return undefined;
    this.lastGoalAt = now;
    return { side, scoreBySide: this.store.scoreGoal(side) };
  }

  start(): Record<Side, number> {
    this.lastGoalAt = 0;
    return this.store.resetScore();
  }
}

export function parseGoalSide(text: string): Side | undefined {
  const match = /^\s*!goal\s+(.+?)\s*$/i.exec(text);
  const requestedSide = match?.[1]?.trim().toLocaleLowerCase();
  if (!requestedSide) return undefined;
  return SIDES.find((side) => side.id.toLocaleLowerCase() === requestedSide || side.name.toLocaleLowerCase() === requestedSide)?.id;
}
