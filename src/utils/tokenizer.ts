/**
 * Lightweight token estimator for VietRP.
 *
 * When WASM is available, uses tiktoken-rs (cl100k_base) for accurate BPE
 * tokenization. Falls back to a character-heuristic when WASM is not loaded.
 *
 * Build WASM: cd wasm-lib && wasm-pack build --target web --out-dir ../src/wasm-pkg
 */

// ── WASM bridge (lazy-loaded) ───────────────────────────────────

let wasmReady = false;
let wasmModule: {
  count_tokens: (text: string) => number;
  truncate_to_tokens: (text: string, max_tokens: number) => string;
} | null = null;

/**
 * Initialize the WASM module. Call once at app startup.
 * Gracefully falls back to heuristic if WASM fails to load.
 */
export async function initWasm(): Promise<void> {
  try {
    const mod = await import("@/wasm-pkg/wasm_lib");
    await mod.default(); // wasm-pack --target web requires calling default export
    wasmModule = mod;
    wasmReady = true;
    console.log("[tokenizer] WASM loaded — using tiktoken-rs (cl100k_base)");
  } catch {
    console.warn("[tokenizer] WASM not available — using char heuristic fallback");
  }
}

// ── Heuristic fallback ──────────────────────────────────────────

function heuristicCountTokens(text: string): number {
  if (!text) return 0;

  let count = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    if (code > 0x02ff) {
      count += 0.5;
    } else {
      count += 0.25;
    }
  }
  return Math.ceil(count);
}

function heuristicTruncate(text: string, maxTokens: number): string {
  // Rough: 1 token ≈ 3.5 chars average (blend of ASCII and CJK)
  const maxChars = Math.floor(maxTokens * 3.5);
  if (text.length <= maxChars) return text;
  return text.slice(0, maxChars) + "...";
}

// ── Public API ──────────────────────────────────────────────────

/** Shape accepted by `estimateMessagesToken` — matches OpenRouterMessage. */
interface MessageLike {
  role: string;
  content: string;
}

/**
 * Count tokens in a single string.
 * Uses WASM tiktoken when available, falls back to char heuristic.
 */
export function countTokens(text: string): number {
  if (!text) return 0;
  if (wasmReady && wasmModule) {
    return wasmModule.count_tokens(text);
  }
  return heuristicCountTokens(text);
}

/**
 * Truncate text to fit within `max_tokens`.
 * Uses WASM tiktoken when available, falls back to char heuristic.
 */
export function truncateToTokens(text: string, maxTokens: number): string {
  if (!text) return "";
  if (wasmReady && wasmModule) {
    return wasmModule.truncate_to_tokens(text, maxTokens);
  }
  return heuristicTruncate(text, maxTokens);
}

/**
 * Estimate total tokens for an array of chat messages.
 * Each message carries ~4 tokens of structural overhead.
 */
export function estimateMessagesToken(messages: MessageLike[]): number {
  let total = 0;
  for (const msg of messages) {
    total += countTokens(msg.content) + 4;
  }
  return total;
}

/** Check if WASM tokenizer is loaded and active. */
export function isWasmReady(): boolean {
  return wasmReady;
}
