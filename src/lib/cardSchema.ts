/**
 * Card field budgets — based on SillyTavern community best practices.
 * These limits keep the assembled system prompt under ~1200 tokens.
 */

export const CARD_FIELD_BUDGET = {
  // Injected into system prompt — total < 1200 tokens
  description:   { maxTokens: 400, maxChars: 1600 },
  personality:   { maxTokens: 150, maxChars: 600  },
  scenario:      { maxTokens: 100, maxChars: 400  },
  system_prompt: { maxTokens: 200, maxChars: 800  },

  // Injected separately — not in main system prompt
  first_mes:     { maxTokens: 250, maxChars: 1000 },
  mes_example:   { minPairs: 6, idealPairs: 8, maxPairs: 12 },

  // Metadata only — not injected into chat
  creator_notes: { maxChars: 500 },
  tags:          { maxItems: 10 },
} as const;

export const FORMAT_RULES = {
  /** first_mes must not start with a greeting */
  first_mes_forbidden_starts: [
    "Xin chào", "Chào", "Hello", "Hi ", "Ồ chào",
    "Hey ", "Xin chào bạn",
  ],

  /** mes_example dialogue marker */
  mes_example_required_marker: "<START>",

  /** Valid Vietnamese pronoun pairs for consistency checking */
  valid_pronoun_pairs: [
    "mày-tao", "anh-em", "chị-em", "cậu-tớ",
    "ta-ngươi", "chú-cháu",
  ],
} as const;

/** Pronoun patterns to detect in text */
const PRONOUN_PATTERNS: { pattern: RegExp; label: string }[] = [
  { pattern: /\bmày\b.*\btao\b|\btao\b.*\bmày\b/i, label: "mày-tao" },
  { pattern: /\banh\b.*\bem\b|\bem\b.*\banh\b/i,     label: "anh-em" },
  { pattern: /\bchị\b.*\bem\b|\bem\b.*\bchị\b/i,     label: "chị-em" },
  { pattern: /\bcậu\b.*\btớ\b|\btớ\b.*\bcậu\b/i,     label: "cậu-tớ" },
  { pattern: /\bta\b.*\bngươi\b|\bngươi\b.*\bta\b/i,  label: "ta-ngươi" },
  { pattern: /\bchú\b.*\bcháu\b|\bcháu\b.*\bchú\b/i, label: "chú-cháu" },
];

/**
 * Detect the dominant pronoun pair in a text.
 * Returns the pronoun label (e.g. "anh-em") or null if none detected.
 */
export function detectPronouns(text: string): string | null {
  if (!text) return null;
  for (const { pattern, label } of PRONOUN_PATTERNS) {
    if (pattern.test(text)) return label;
  }
  return null;
}
