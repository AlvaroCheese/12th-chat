import { readFileSync } from "node:fs";
import { normalizeChantText } from "./normalizeChant.js";

const blocklist = JSON.parse(readFileSync(new URL("./blocklist.json", import.meta.url), "utf8")) as string[];
const normalizedBlocklist = new Set(blocklist.map(normalizeChantText));
const URL_PATTERN = /(?:https?:\/\/|www\.)[^\s]+|\b[\w.-]+\.(?:com|net|org|tv|io)(?:\/[^\s]*)?/giu;

/** Filter every chant before it is delivered to an overlay. */
export function filterChant(input: string): string | null {
  const withoutUrls = input.replace(URL_PATTERN, " ").replace(/\s+/gu, " ").trim();
  if (!withoutUrls || withoutUrls.length > 60) return null;
  if (/([^\p{L}\p{N}\s])\1{2,}/u.test(withoutUrls)) return null;

  const normalized = normalizeChantText(withoutUrls);
  if (!normalized || normalizedBlocklist.has(normalized)) return null;

  // Future AI moderation hook: add an async moderation check here in the AI milestone.
  return withoutUrls;
}
