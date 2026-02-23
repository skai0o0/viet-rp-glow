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

/** Keywords that signal NSFW content when found in text fields */
const NSFW_KEYWORDS = [
  "nsfw", "sex", "erotic", "hentai", "porn", "nude", "naked",
  "bdsm", "bondage", "submissive", "dominant", "fetish",
  "ntr", "netorare", "cuckold", "mind break", "mind control",
  "rape", "non-con", "dubcon", "blackmail", "coercion",
  "orgy", "threesome", "gangbang", "incest",
  "slave", "master-slave", "pet play",
  "gore", "guro", "snuff", "torture",
  "loli", "shota", "underage",
  "drug", "drugged", "intoxicated",
  "breeding", "impregnation", "mating",
  "ahegao", "tentacle", "monster girl",
  "succubus", "incubus",
];

/** Check if text content contains NSFW keywords */
export function hasNsfwContent(...texts: (string | null | undefined)[]): boolean {
  const combined = texts.filter(Boolean).join(" ").toLowerCase();
  if (!combined) return false;
  return NSFW_KEYWORDS.some((kw) => combined.includes(kw));
}

export function isNsfwCharacter(tags?: string[] | null): boolean {
  if (!tags || tags.length === 0) return false;
  return tags.some((tag) => NSFW_TAGS.has(tag.toLowerCase()));
}

/** Check if a character is NSFW by tags OR content */
export function isCharacterNsfw(char: {
  tags?: string[] | null;
  name?: string | null;
  description?: string | null;
  short_summary?: string | null;
}): boolean {
  return isNsfwCharacter(char.tags) || hasNsfwContent(char.name, char.description, char.short_summary);
}

export function getNsfwMode(): boolean {
  return localStorage.getItem("vietrp_nsfw_mode") === "true";
}

/** Filter characters list based on current NSFW mode */
export function filterByNsfw<T extends { tags?: string[] | null }>(chars: T[]): T[] {
  if (getNsfwMode()) return chars; // show all
  return chars.filter((c) => !isNsfwCharacter(c.tags));
}
