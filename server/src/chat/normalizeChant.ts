export function normalizeChantText(text: string): string {
  return text
    .toLocaleLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/[^\p{L}\p{N}\s]/gu, " ")
    .replace(/([\p{L}\p{N}])\1+/giu, "$1")
    .replace(/\s+/gu, " ")
    .trim();
}
