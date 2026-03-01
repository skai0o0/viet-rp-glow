/**
 * NSFW detection & filtering utility.
 *
 * Two layers:
 *  1. Tag-based  – exact match against a known NSFW tag set.
 *  2. Content-based – keyword scan on name / description / summary,
 *     using word-boundary regex for short ambiguous words and simple
 *     substring matching for longer, unambiguous terms.
 *
 * filterByNsfw() now checks BOTH tags AND content so that cards
 * missing proper tags but containing explicit text are still caught.
 */

// ── Tag set (exact, case-insensitive) ────────────────────────────
const NSFW_TAGS = new Set([
  // Direct labels
  "nsfw", "18+", "r18", "r-18", "mature", "explicit", "smut",
  "lemon", "adult", "adult only", "r18+",

  // Sexual themes
  "bdsm", "bondage", "ntr", "netorare", "cuckold",
  "mind break", "blackmail",
  "rough sex", "exhibitionism", "exhibitionism-lite",
  "threesome", "threesome-implied", "orgy",
  "harem", "reverse harem",
  "futanari", "futa",
  "pet play", "master-slave",
  "breeding", "impregnation",
  "tentacle", "tentacle rape",
  "rape", "non-con", "dubcon", "noncon",
  "honeytrap", "verbal abuse", "haughty sub",
  "femdom", "maledom", "humiliation",
  "yuri nsfw", "yaoi nsfw",
  "ahegao", "ecchi",

  // Violence / gore
  "gore", "guro", "snuff", "torture", "ryona",

  // Problematic / illegal
  "loli", "shota", "underage", "minor",
  "incest",

  // Substance
  "drug use", "drugged",

  // Vietnamese labels
  "khiêu dâm", "người lớn", "nội dung 18+",
]);

// ── Keyword lists ────────────────────────────────────────────────

function esc(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/**
 * Short / ambiguous keywords that need word-boundary matching
 * so "sex" catches "sex", "sexual" but NOT "bisexual" / "unisex".
 */
const BOUNDARY_WORDS = [
  "sex", "rape", "oral", "anal", "cum", "cock", "dick",
  "pussy", "tits", "boob", "slut", "whore", "milf",
  "dildo", "vibrator", "orgasm",
];

const boundaryPatterns = BOUNDARY_WORDS.map(
  (kw) => new RegExp(`\\b${esc(kw)}`, "i"),
);

/**
 * Longer / unambiguous keywords safe for substring matching.
 * Sorted by category for maintainability.
 */
const SUBSTRING_KEYWORDS = [
  // Labels
  "nsfw", "erotic", "hentai", "porn", "naked", "xxx", "r-18", "r18",

  // Acts / themes
  "bdsm", "bondage", "fetish", "kink",
  "netorare", "cuckold", "mind break", "mind control",
  "non-con", "dubcon", "noncon", "blackmail", "coercion",
  "gangbang", "incest", "threesome", "orgy", "foursome",
  "master-slave", "pet play", "slave play",
  "breeding", "impregnation", "mating press",
  "ahegao", "tentacle", "futanari",
  "creampie", "blowjob", "handjob", "footjob", "rimjob",
  "nipple", "genital", "penis", "vagina", "clitoris", "phallus",
  "undress", "groping", "fondle", "molest",
  "voyeur", "peeping",
  "aphrodisiac", "love potion",
  "dominatrix", "sadomaso",

  // Body / nudity (specific enough)
  "topless", "bottomless", "nude photo", "strip tease",
  "lingerie", "see-through",

  // Violence / gore
  "gore", "guro", "snuff", "disembowel", "eviscerate",

  // Problematic
  "loli", "shota", "underage", "pedophil",

  // Substance
  "drugged", "intoxicated", "roofie",

  // Mythological (strongly NSFW-associated)
  "succubus", "incubus",

  // Vietnamese keywords
  "khiêu dâm", "dâm dục", "quan hệ tình dục",
  "cưỡng hiếp", "hiếp dâm", "cưỡng bức",
  "loạn luân", "đồi trụy",
  "nô lệ tình dục",
  "khỏa thân", "lõa thể", "trần truồng",
  "thủ dâm", "kích dục",
  "giao cấu", "giao hợp",
  "cưỡng dâm", "dâm ô",
  "biến thái", "thác loạn",
  "nứng", "sục cặc", "bú cặc", "liếm lồn",
  "địt", "chịch",
];

// ── Public API ───────────────────────────────────────────────────

/** Check if any of the provided text strings contain NSFW keywords */
export function hasNsfwContent(
  ...texts: (string | null | undefined)[]
): boolean {
  const raw = texts.filter(Boolean).join(" ");
  if (!raw) return false;
  const lower = raw.toLowerCase();

  if (SUBSTRING_KEYWORDS.some((kw) => lower.includes(kw))) return true;
  if (boundaryPatterns.some((re) => re.test(raw))) return true;

  return false;
}

/** Check if character tags contain any known NSFW tag */
export function isNsfwCharacter(tags?: string[] | null): boolean {
  if (!tags || tags.length === 0) return false;
  return tags.some((tag) => NSFW_TAGS.has(tag.trim().toLowerCase()));
}

/** Check if a character is NSFW by tags OR content */
export function isCharacterNsfw(char: {
  tags?: string[] | null;
  name?: string | null;
  description?: string | null;
  short_summary?: string | null;
}): boolean {
  return (
    isNsfwCharacter(char.tags) ||
    hasNsfwContent(char.name, char.description, char.short_summary)
  );
}

export function getNsfwMode(): boolean {
  return localStorage.getItem("vietrp_nsfw_mode") === "true";
}

/** Filter characters list based on current NSFW mode (checks tags + content) */
export function filterByNsfw<
  T extends {
    tags?: string[] | null;
    name?: string | null;
    description?: string | null;
    short_summary?: string | null;
  },
>(chars: T[], nsfwModeOverride?: boolean): T[] {
  const isNsfwOn = nsfwModeOverride ?? getNsfwMode();
  if (isNsfwOn) return chars;
  return chars.filter((c) => !isCharacterNsfw(c));
}
