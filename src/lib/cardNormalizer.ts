import { TavernCardV2Data } from "@/types/taverncard";
import { countTokens, truncateToTokens } from "@/utils/tokenizer";
import { CARD_FIELD_BUDGET } from "./cardSchema";

export interface NormalizeOptions {
  /** Aggressive trimming — cut fields even within budget to save tokens */
  aggressive?: boolean;
}

/**
 * Trim text to a max token count, cutting at the nearest sentence boundary.
 */
export function trimToTokens(text: string, maxTokens: number): string {
  if (!text) return "";
  if (countTokens(text) <= maxTokens) return text;

  // Split into sentence/paragraph segments
  // This regex matches a block of text followed by sentence endings (. ! ?) or newlines.
  const segments = text.match(/[^\.!\?\n]+[\.!\?\n]*/g);
  if (!segments || segments.length === 0) {
    const rough = truncateToTokens(text, maxTokens);
    return rough.trimEnd() + "...";
  }

  let accumulatedText = "";
  for (const segment of segments) {
    const candidate = accumulatedText + segment;
    if (countTokens(candidate) > maxTokens) {
      break;
    }
    accumulatedText = candidate;
  }

  const trimmed = accumulatedText.trimEnd();

  // If even the first segment is too long to fit, fallback to raw truncation
  if (!trimmed) {
    const rough = truncateToTokens(text, maxTokens);
    return rough.trimEnd() + "...";
  }

  return trimmed;
}

/**
 * Normalize a card for injection into the chat system.
 * Safe, deterministic transforms — no AI calls.
 */
export function normalizeCard(
  card: TavernCardV2Data,
  options: NormalizeOptions = {},
): TavernCardV2Data {
  const n = { ...card };

  // 1. Trim description to budget
  if (countTokens(n.description || "") > CARD_FIELD_BUDGET.description.maxTokens) {
    n.description = trimToTokens(n.description, CARD_FIELD_BUDGET.description.maxTokens);
  }

  // 2. Trim personality to budget
  if (countTokens(n.personality || "") > CARD_FIELD_BUDGET.personality.maxTokens) {
    n.personality = trimToTokens(n.personality, CARD_FIELD_BUDGET.personality.maxTokens);
  }

  // 3. Trim system_prompt to budget
  if (countTokens(n.system_prompt || "") > CARD_FIELD_BUDGET.system_prompt.maxTokens) {
    n.system_prompt = trimToTokens(n.system_prompt, CARD_FIELD_BUDGET.system_prompt.maxTokens);
  }

  // 4. Trim first_mes to budget
  if (countTokens(n.first_mes || "") > CARD_FIELD_BUDGET.first_mes.maxTokens) {
    n.first_mes = trimToTokens(n.first_mes, CARD_FIELD_BUDGET.first_mes.maxTokens);
  }

  // 5. Normalize mes_example — ensure <START> markers
  if (n.mes_example && !n.mes_example.includes("<START>")) {
    n.mes_example = "<START>\n" + n.mes_example;
  }

  // 6. Collapse triple+ newlines
  const collapseNewlines = (s: string) => s?.replace(/\n{3,}/g, "\n\n").trim() || "";
  n.description = collapseNewlines(n.description);
  n.personality = collapseNewlines(n.personality);
  n.scenario = collapseNewlines(n.scenario);
  n.system_prompt = collapseNewlines(n.system_prompt);

  // 7. Tags: lowercase, dedupe, cap at maxItems
  if (n.tags) {
    n.tags = [
      ...new Set(
        n.tags
          .map((t) => t.toLowerCase().trim())
          .filter((t) => t.length > 0),
      ),
    ].slice(0, CARD_FIELD_BUDGET.tags.maxItems);
  }

  // 8. Aggressive mode — extra cuts
  if (options.aggressive) {
    if (countTokens(n.description || "") > CARD_FIELD_BUDGET.description.maxTokens * 0.8) {
      n.description = trimToTokens(n.description, Math.floor(CARD_FIELD_BUDGET.description.maxTokens * 0.8));
    }
    if (countTokens(n.personality || "") > CARD_FIELD_BUDGET.personality.maxTokens * 0.8) {
      n.personality = trimToTokens(n.personality, Math.floor(CARD_FIELD_BUDGET.personality.maxTokens * 0.8));
    }
  }

  return n;
}
