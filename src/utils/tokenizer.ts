/**
 * Lightweight token estimator for VietRP.
 *
 * Uses a character-heuristic tuned for Vietnamese + Latin text rather than
 * shipping a full BPE vocabulary (~3 MB).  Accuracy is ±15 % which is
 * sufficient for context-budget enforcement and summarisation triggers.
 *
 * If `js-tiktoken` is ever added as a dependency, swap the internals of
 * `countTokens` to use it — the public API stays the same.
 */

// ── Public API ──────────────────────────────────────────────────────────────

/**
 * Estimate the token count of a single string.
 *
 * Heuristic:
 *   - ASCII / basic Latin  → ~4 chars per token  (0.25 tokens/char)
 *   - CJK / Vietnamese diacritics / emoji  → ~2 chars per token (0.5 tokens/char)
 *   - Overhead for special tokens ≈ negligible at string level
 */
export function countTokens(text: string): number {
  if (!text) return 0;

  let count = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    // Code points above 0x02FF cover CJK, Vietnamese diacritics, emoji, etc.
    if (code > 0x02ff) {
      count += 0.5;
    } else {
      count += 0.25;
    }
  }
  return Math.ceil(count);
}

/** Shape accepted by `estimateMessagesToken` — matches OpenRouterMessage. */
interface MessageLike {
  role: string;
  content: string;
}

/**
 * Estimate total tokens for an array of chat messages.
 *
 * Each message carries ~4 tokens of structural overhead (role label, delimiters)
 * on top of its content tokens.
 */
export function estimateMessagesToken(messages: MessageLike[]): number {
  let total = 0;
  for (const msg of messages) {
    total += countTokens(msg.content) + 4; // +4 for role / framing overhead
  }
  return total;
}
