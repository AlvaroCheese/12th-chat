export const SIDES = [
  { id: "argentina", name: "Argentina", primaryColor: 0x75b9e7, secondaryColor: 0xffffff },
  { id: "mexico", name: "Mexico", primaryColor: 0x006847, secondaryColor: 0xce1126 },
] as const;

export type Side = (typeof SIDES)[number]["id"];
