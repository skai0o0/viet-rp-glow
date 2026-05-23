/**
 * Assembly Guard — final defense layer before messages hit OpenRouter.
 * Sanitizes user message + trims character data to safe token budget.
 */

import { CharacterCard } from "@/types/character";
import { countTokens } from "@/utils/tokenizer";
import { trimToTokens } from "./cardNormalizer";
import { sanitizeUserInput } from "./inputSanitizer";

export interface GuardResult {
  safeCharacter: CharacterCard;
  safeMessage: string;
  blocked: boolean;
  reason: string | null;
}

const MAX_CHAR_TOKENS = 1500;

/**
 * Guard assembly: sanitize user message + ensure character data fits budget.
 * Call this right before buildMessages().
 */
export function guardAssembly(
  character: CharacterCard,
  userMessage: string,
): GuardResult {
  // 1. Sanitize user message
  const msgResult = sanitizeUserInput(userMessage, "chat");

  if (msgResult.flagged) {
    console.warn("[Guard] Message flagged:", msgResult.reason);
  }

  // 2. Block if message is clearly a token bomb
  const blocked = msgResult.flagged && msgResult.reason === "TOKEN_BOMB_SUSPECTED";

  // 3. Check character data token budget
  const charTexts = [
    character.description,
    character.personality,
    character.scenario,
    character.system_prompt,
  ]
    .filter(Boolean)
    .join(" ");

  const charTokens = countTokens(charTexts);

  let safeCharacter = character;
  if (charTokens > MAX_CHAR_TOKENS) {
    console.warn("[Guard] Character exceeds token budget:", charTokens, "→ trimming");
    safeCharacter = trimCharacterToBudget(character, MAX_CHAR_TOKENS);
  }

  return {
    safeCharacter,
    safeMessage: msgResult.clean,
    blocked,
    reason: msgResult.reason,
  };
}

/**
 * Trim character fields to fit within maxTokens total.
 * Priority: keep system_prompt > personality > scenario > description (trim last).
 */
export function trimCharacterToBudget(
  char: CharacterCard,
  maxTokens: number,
): CharacterCard {
  const trimmed = { ...char };
  let remaining = maxTokens;

  // Budget allocation (proportional to importance)
  const sysBudget = Math.min(countTokens(trimmed.system_prompt || ""), Math.floor(maxTokens * 0.2));
  remaining -= sysBudget;

  const persBudget = Math.min(countTokens(trimmed.personality || ""), Math.floor(maxTokens * 0.15));
  remaining -= persBudget;

  const scenBudget = Math.min(countTokens(trimmed.scenario || ""), Math.floor(maxTokens * 0.1));
  remaining -= scenBudget;

  // Description gets whatever is left
  const descBudget = Math.max(remaining, 200);

  if (countTokens(trimmed.description || "") > descBudget) {
    trimmed.description = trimToTokens(trimmed.description, descBudget);
  }
  if (countTokens(trimmed.personality || "") > persBudget) {
    trimmed.personality = trimToTokens(trimmed.personality, persBudget);
  }
  if (countTokens(trimmed.scenario || "") > scenBudget) {
    trimmed.scenario = trimToTokens(trimmed.scenario, scenBudget);
  }

  return trimmed;
}
