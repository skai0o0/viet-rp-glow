/**
 * NSFW tag filter utility.
 * Characters with any of these tags (case-insensitive) are hidden when NSFW mode is off.
 */

const NSFW_TAGS = new Set([
  "nsfw", "ntr", "bdsm", "mind break", "blackmail",
  "rough sex", "exhibitionism-lite", "threesome-implied",
  "honeytrap", "sacrifice", "maid", "verbal abuse",
  "haughty sub", "slimmy",
]);

export function isNsfwCharacter(tags?: string[] | null): boolean {
  if (!tags || tags.length === 0) return false;
  return tags.some((tag) => NSFW_TAGS.has(tag.toLowerCase()));
}

export function getNsfwMode(): boolean {
  return localStorage.getItem("vietrp_nsfw_mode") === "true";
}

/** Filter characters list based on current NSFW mode */
export function filterByNsfw<T extends { tags?: string[] | null }>(chars: T[]): T[] {
  if (getNsfwMode()) return chars; // show all
  return chars.filter((c) => !isNsfwCharacter(c.tags));
}
