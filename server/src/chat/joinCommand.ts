import { SIDES, type Side } from "@twitch-graderia/shared";

export function parseJoinCommand(text: string): Side | undefined {
  const match = /^\s*!join\s+(.+?)\s*$/i.exec(text);
  const requestedSide = match?.[1]?.trim().toLocaleLowerCase();
  if (!requestedSide) return undefined;

  return SIDES.find(
    (side) => side.id.toLocaleLowerCase() === requestedSide || side.name.toLocaleLowerCase() === requestedSide,
  )?.id;
}
