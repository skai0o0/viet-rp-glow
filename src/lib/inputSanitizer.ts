/**
 * Input Sanitizer — layer 1 defense against injection and garbage input.
 * Runs before data enters card fields, chat messages, or assembly.
 */

const SUSPICIOUS_PATTERNS: { pattern: RegExp; label: string }[] = [
  // Cyrillic block (10+ consecutive)
  { pattern: /[Ѐ-ӿ]{10,}/g, label: "CYRILLIC_SPAM" },
  // Gothic/Fraktur mathematical symbols
  { pattern: /[\u{1D504}-\u{1D56B}]{5,}/gu, label: "GOTHIC_SYMBOLS" },
  // Greek letters spam (8+ consecutive)
  { pattern: /[αβγδεζηθικλμνξοπρστυφχψωΑΒΓΔΕΖΗΘΙΚΛΜΝΞΟΠΡΣΤΥΦΧΨΩ]{8,}/g, label: "GREEK_SPAM" },
  // Math symbols spam (5+ consecutive)
  { pattern: /[∀∃∧∨¬⇒⇔⊤⊥⊢≡≈⊕⊗∞∝∠∵∴∫∑√∂∇]{5,}/g, label: "MATH_SYMBOLS" },
  // Mixed script chaos (Latin + Cyrillic alternating 3+ times)
  { pattern: /([a-zA-Z][А-Яа-я]|[А-Яа-я][a-zA-Z]){3,}/g, label: "MIXED_SCRIPT" },
  // Physics/math keyword spam (same keyword 3+ times)
  { pattern: /(Hamiltonian|Lagrangian|Schrödinger|Heisenberg|Wormhole|Singularity).{0,30}\1/gi, label: "KEYWORD_SPAM" },
  // Repeated Unicode blocks that look like noise
  { pattern: /[▀-▟]{10,}/g, label: "BLOCK_ART_SPAM" },
  // Null bytes and control characters (except newline/tab)
  { pattern: /[\x00-\x08\x0B\x0C\x0E-\x1F]/g, label: "CONTROL_CHARS" },
];

/** Max ratio of non-ASCII/non-Vietnamese characters before flagging */
const MAX_FOREIGN_RATIO = 0.15;

/** Hard character limits per context */
const CONTEXT_LIMITS: Record<SanitizeContext, number> = {
  chat: 4000,
  card_field: 8000,
  lore: 16000,
};

export type SanitizeContext = "chat" | "card_field" | "lore";

export interface SanitizeResult {
  clean: string;
  flagged: boolean;
  reason: string | null;
  removedChars: number;
}

/**
 * Sanitize user input for a given context.
 * - Strips suspicious patterns (context-dependent)
 * - Checks foreign character ratio
 * - Detects token-bomb patterns
 * - Enforces hard length limits
 */
export function sanitizeUserInput(
  input: string,
  context: SanitizeContext,
): SanitizeResult {
  if (!input) {
    return { clean: "", flagged: false, reason: null, removedChars: 0 };
  }

  let clean = input;
  let flagged = false;
  let reason: string | null = null;
  const originalLength = input.length;

  // 1. Detect suspicious patterns
  for (const { pattern, label } of SUSPICIOUS_PATTERNS) {
    // Reset regex state for global patterns
    pattern.lastIndex = 0;
    if (pattern.test(clean)) {
      flagged = true;
      reason = reason ?? label;
      // For card fields and lore, strip the matched content
      if (context !== "chat") {
        pattern.lastIndex = 0;
        clean = clean.replace(pattern, "");
      }
    }
  }

  // 2. Non-Vietnamese ratio check (skip for short inputs)
  if (clean.length > 100) {
    // Count chars that are NOT: ASCII printable, Vietnamese diacritics, CJK, basic punctuation
    const nonVietChars = (
      clean.match(/[^\x00-\x7FÀ-ɏḀ-ỿ̀-ͯĀ-ſ\s]/g) || []
    ).length;
    const ratio = nonVietChars / clean.length;
    if (ratio > MAX_FOREIGN_RATIO) {
      flagged = true;
      reason = reason ?? "HIGH_FOREIGN_CHAR_RATIO";
    }
  }

  // 3. Token bomb check — near-zero word repetition = likely noise
  const words = clean.split(/\s+/).filter((w) => w.length > 2);
  if (words.length > 50) {
    const uniqueWords = new Set(words.map((w) => w.toLowerCase())).size;
    const uniqueRatio = uniqueWords / words.length;
    if (uniqueRatio > 0.95) {
      flagged = true;
      reason = reason ?? "TOKEN_BOMB_SUSPECTED";
    }
  }

  // 4. Hard length limit
  const limit = CONTEXT_LIMITS[context];
  if (clean.length > limit) {
    clean = clean.slice(0, limit);
    flagged = true;
    reason = reason ?? "INPUT_TOO_LONG";
  }

  return {
    clean,
    flagged,
    reason,
    removedChars: originalLength - clean.length,
  };
}
