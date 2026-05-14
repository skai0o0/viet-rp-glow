import { CharacterCard } from "@/types/character";
import { CharacterBook } from "@/types/taverncard";
import { getCachedUserPersona, buildIdentityString } from "@/services/profileDb";
import {
  getGlobalSystemPrompt,
  getGlobalPromptTypeA,
  getGlobalPromptTypeB,
  getGlobalPostHistoryTypeA,
  getGlobalPostHistoryTypeB,
  getNsfwGatePrompt,
  getNsfwJailbreakPrompt,
} from "@/services/globalSettingsDb";
import { getResponseStylePrompt } from "@/components/GenerationSettings";
import { countTokens } from "@/utils/tokenizer";

export interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface PromptSection {
  id: string;
  content: string;
  order: number;
}

/** @deprecated Use `countTokens` from `@/utils/tokenizer` instead. */
export const estimateTokens = countTokens;

// ─── Card Type Detection ──────────────────────────────────────

export type CardType = "type_a" | "type_b";

/**
 * Auto-detect whether a character card is Type A (single character) or
 * Type B (multi-character / RPG simulation).
 *
 * Type B criteria (either is sufficient):
 *   1. description contains the "--- [Name] ---" separator pattern
 *   2. character_book has at least one entry
 */
export function detectCardType(character: CharacterCard): CardType {
  if (character.description && /---\s*\[.+?\]\s*---/.test(character.description)) {
    return "type_b";
  }
  if (character.character_book?.entries?.length > 0) {
    return "type_b";
  }
  return "type_a";
}

/** Default max context tokens (conservative for most models) */
const DEFAULT_MAX_CONTEXT_TOKENS = 8000;

/**
 * Truncate messages array to fit within token budget.
 * Strategy: keep all system messages (layers 1-5) + last N user/assistant messages that fit.
 */
export function truncateMessages(
  messages: OpenRouterMessage[],
  maxTokens: number = DEFAULT_MAX_CONTEXT_TOKENS,
): OpenRouterMessage[] {
  // Count total tokens
  let totalTokens = 0;
  for (const msg of messages) {
    totalTokens += estimateTokens(msg.content) + 4; // +4 for role overhead
  }

  if (totalTokens <= maxTokens) return messages;

  // Separate system messages (preserving order) from chat messages
  const systemMessages: OpenRouterMessage[] = [];
  const chatMessages: OpenRouterMessage[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      systemMessages.push(msg);
    } else {
      chatMessages.push(msg);
    }
  }

  // Calculate system token budget (max 40% of context for system)
  const systemBudget = Math.floor(maxTokens * 0.4);
  const chatBudget = maxTokens - systemBudget;

  // Truncate system messages if they exceed budget — drop from the middle
  // (keep Layer 1 at top and Layer 5 at bottom for primacy/recency)
  let systemTokens = systemMessages.reduce((sum, m) => sum + estimateTokens(m.content) + 4, 0);
  if (systemTokens > systemBudget) {
    while (systemMessages.length > 2 && systemTokens > systemBudget) {
      // Remove the second-to-last system message (middle of the prompt)
      const removed = systemMessages.splice(systemMessages.length - 2, 1)[0];
      systemTokens -= estimateTokens(removed.content) + 4;
    }
    // If still over budget, truncate the first system message
    if (systemTokens > systemBudget && systemMessages[0]) {
      const maxChars = systemBudget * 4;
      systemMessages[0] = {
        ...systemMessages[0],
        content: systemMessages[0].content.slice(0, maxChars) + "\n[...truncated...]",
      };
    }
  }

  // Keep last N chat messages that fit in budget
  let usedTokens = 0;
  const kept: OpenRouterMessage[] = [];
  for (let i = chatMessages.length - 1; i >= 0; i--) {
    const msgTokens = estimateTokens(chatMessages[i].content) + 4;
    if (usedTokens + msgTokens > chatBudget) break;
    kept.unshift(chatMessages[i]);
    usedTokens += msgTokens;
  }

  return [...systemMessages, ...kept];
}

/**
 * Replace {{user}}, {{char}}, <user>, <char> macros in text
 */
export function replaceMacros(text: string, charName: string, userName: string = "User"): string {
  return text
    .replace(/\{\{char\}\}/gi, charName)
    .replace(/\{\{user\}\}/gi, userName)
    .replace(/<char>/gi, charName)
    .replace(/<user>/gi, userName);
}

/**
 * Resolve lorebook entries: scan chat history for trigger keywords,
 * return matched content grouped by position (before_char / after_char).
 */
function resolveLorebookEntries(
  book: CharacterBook | undefined,
  chatHistory: { role: string; content: string }[],
): { beforeChar: string[]; afterChar: string[] } {
  const result = { beforeChar: [] as string[], afterChar: [] as string[] };
  if (!book?.entries?.length) return result;

  const enabledEntries = book.entries.filter((e) => e.enabled !== false);
  if (enabledEntries.length === 0) return result;

  const scanDepth = book.scan_depth ?? 50;
  const tokenBudget = book.token_budget ?? 500;

  // Split into constant vs triggered
  const constantEntries = enabledEntries.filter((e) => e.constant === true);
  const triggeredEntries = enabledEntries.filter((e) => e.constant !== true);

  // Scan recent messages for triggered entries
  const recentMessages = chatHistory.slice(-scanDepth);
  const recentTextLower = recentMessages
    .map((m) => m.content)
    .join(" ")
    .toLowerCase();
  const recentTextRaw = recentMessages.map((m) => m.content).join(" ");

  const matchedTriggered = triggeredEntries.filter((entry) => {
    if (!entry.keys?.length) return false;
    const caseSensitive = entry.case_sensitive === true;
    const searchText = caseSensitive ? recentTextRaw : recentTextLower;
    const searchKeys = caseSensitive
      ? entry.keys
      : entry.keys.map((k) => k.toLowerCase());

    // Primary keys: any match triggers
    const primaryMatch = searchKeys.some((key) => searchText.includes(key));

    if (!primaryMatch) return false;

    // If selective, also require at least one secondary key match
    if (entry.selective && entry.secondary_keys?.length) {
      const secondaryKeys = caseSensitive
        ? entry.secondary_keys
        : entry.secondary_keys.map((k) => k.toLowerCase());
      return secondaryKeys.some((key) => searchText.includes(key));
    }

    return true;
  });

  // Combine constant + matched triggered, sort by insertion_order then priority
  const allMatched = [...constantEntries, ...matchedTriggered].sort(
    (a, b) => {
      const orderA = a.insertion_order ?? 0;
      const orderB = b.insertion_order ?? 0;
      if (orderA !== orderB) return orderA - orderB;
      return (b.priority ?? 0) - (a.priority ?? 0);
    },
  );

  // Apply token budget (using estimateTokens for accuracy)
  let usedTokens = 0;
  for (const entry of allMatched) {
    const content = entry.content?.trim();
    if (!content) continue;
    const entryTokens = estimateTokens(content);
    if (usedTokens + entryTokens > tokenBudget) break;

    const target =
      entry.position === "before_char" ? result.beforeChar : result.afterChar;
    target.push(content);
    usedTokens += entryTokens;
  }

  return result;
}

/**
 * Build layered prompt sections inspired by SillyTavern's architecture.
 * Each section is an object with id, content, and order for flexible assembly.
 */
export function buildLayeredPrompt(
  character: CharacterCard,
  userName: string = "User",
  chatHistory: { role: string; content: string }[] = [],
  summary?: string,
  facts?: string[],
): PromptSection[] {
  const sections: PromptSection[] = [];
  let order = 0;

  // 1. Main Prompt (type-specific global system prompt from admin config)
  const cardType = detectCardType(character);
  const typeSpecificPrompt = cardType === "type_b"
    ? getGlobalPromptTypeB()
    : getGlobalPromptTypeA();
  const globalPrompt = typeSpecificPrompt || getGlobalSystemPrompt();
  if (globalPrompt) {
    sections.push({ id: "main_prompt", content: globalPrompt, order: order++ });
  }

  // 2. World Info (before_char)
  const lorebook = resolveLorebookEntries(character.character_book, chatHistory);
  if (lorebook.beforeChar.length > 0) {
    sections.push({
      id: "world_info_before",
      content: "--- WORLD INFO ---\n" + lorebook.beforeChar.join("\n\n"),
      order: order++,
    });
  }

  // 3. User Persona
  const persona = getCachedUserPersona();
  const userInfoParts: string[] = [];
  const identityStr = buildIdentityString(persona.gender, persona.sexuality);
  if (identityStr) userInfoParts.push(identityStr);
  if (persona.userDescription) userInfoParts.push(persona.userDescription);
  if (userInfoParts.length > 0) {
    sections.push({
      id: "user_persona",
      content: "--- USER INFO ---\n" + `[User's Details: ${userInfoParts.join(". ")}]`,
      order: order++,
    });
  }

  // 4. Character Description
  if (character.description) {
    sections.push({
      id: "char_description",
      content: "--- CHARACTER DESCRIPTION ---\n" + character.description,
      order: order++,
    });
  }

  // 5. Character Personality
  if (character.personality) {
    sections.push({
      id: "char_personality",
      content: "--- PERSONALITY ---\n" + character.personality,
      order: order++,
    });
  }

  // 6. Scenario
  const effectiveScenario = character.scenario;
  if (effectiveScenario) {
    sections.push({
      id: "scenario",
      content: "--- SCENARIO ---\n" + effectiveScenario,
      order: order++,
    });
  }

  // 7. World Info (after_char)
  if (lorebook.afterChar.length > 0) {
    sections.push({
      id: "world_info_after",
      content: "--- SUPPLEMENTAL INFO ---\n" + lorebook.afterChar.join("\n\n"),
      order: order++,
    });
  }

  // 9. Rolling Summary (from chat memory system)
  if (summary) {
    sections.push({
      id: "rolling_summary",
      content: "--- ROLLING SUMMARY ---\nCuộc trò chuyện trước đó:\n" + summary,
      order: order++,
    });
  }

  // 10. Key Facts (extracted from chat history)
  if (facts && facts.length > 0) {
    sections.push({
      id: "key_facts",
      content: "--- KEY FACTS ---\n" + facts.map((f) => `- ${f}`).join("\n"),
      order: order++,
    });
  }

  return sections;
}

/**
 * Build the system prompt string from layered sections.
 * Backward-compatible wrapper around buildLayeredPrompt().
 */
export function buildSystemPrompt(
  character: CharacterCard,
  userName: string = "User",
  chatHistory: { role: string; content: string }[] = [],
  summary?: string,
  facts?: string[],
): string {
  const sections = buildLayeredPrompt(character, userName, chatHistory, summary, facts);
  return sections.map((s) => s.content).join("\n\n");
}

/**
 * Parse mes_example into message pairs.
 * Format uses <START> to separate example conversations.
 * Lines starting with {{user}}: are user messages, {{char}}: are assistant messages.
 */
export function parseMesExample(mesExample: string, charName: string, userName: string = "User"): OpenRouterMessage[] {
  if (!mesExample || !mesExample.trim()) return [];

  const messages: OpenRouterMessage[] = [];
  const blocks = mesExample.split(/<START>/gi).filter(b => b.trim());

  for (const block of blocks) {
    const lines = block.trim().split("\n");
    let currentRole: "user" | "assistant" | null = null;
    let currentContent = "";

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const userMatch = trimmed.match(/^\{\{user\}\}:\s*(.*)/i);
      const charMatch = trimmed.match(/^\{\{char\}\}:\s*(.*)/i);

      if (userMatch) {
        if (currentRole && currentContent) {
          messages.push({ role: currentRole, content: currentContent.trim() });
        }
        currentRole = "user";
        currentContent = userMatch[1];
      } else if (charMatch) {
        if (currentRole && currentContent) {
          messages.push({ role: currentRole, content: currentContent.trim() });
        }
        currentRole = "assistant";
        currentContent = charMatch[1];
      } else if (currentRole) {
        currentContent += "\n" + trimmed;
      }
    }

    if (currentRole && currentContent) {
      messages.push({ role: currentRole, content: currentContent.trim() });
    }
  }

  return messages;
}

/**
 * Build the full messages array for OpenRouter API.
 *
 * SillyTavern-style 5-layer architecture combating "Lost in the Middle":
 *   Layer 1: System Core (global prompt + NSFW jailbreak if ON)
 *   Layer 2: Character & User Context (character sheet, user persona, world info)
 *   Layer 3: Dialogue Examples (mes_example as single system block)
 *   Layer 4: Memory & Chat History (memory archive + chat history)
 *   Layer 5: The Anchor (post-history + response style + NSFW gate if OFF + prefill)
 */
export function buildMessages(
  character: CharacterCard,
  chatHistory: { role: "user" | "assistant"; content: string }[],
  userName?: string,
  scenarioOverride?: string,
  summary?: string,
  facts?: string[],
  prefillText?: string,
): OpenRouterMessage[] {
  const persona = getCachedUserPersona();
  const resolvedUserName = userName || persona.displayName || "User";
  const effectiveCharacter = scenarioOverride !== undefined
    ? { ...character, scenario: scenarioOverride }
    : character;

  const messages: OpenRouterMessage[] = [];

  // ═══ LAYER 1: SYSTEM CORE ═══

  // 1a. Global System Prompt (type-specific)
  const cardType = detectCardType(effectiveCharacter);
  const typePrompt = cardType === "type_b"
    ? getGlobalPromptTypeB()
    : getGlobalPromptTypeA();
  const globalPrompt = typePrompt || getGlobalSystemPrompt();
  if (globalPrompt) {
    messages.push({ role: "system", content: globalPrompt });
  }

  // 1b. NSFW Jailbreak (injected at TOP when NSFW is ENABLED)
  const nsfwEnabled = localStorage.getItem("vietrp_nsfw_mode") === "true";
  if (nsfwEnabled) {
    const jailbreak = getNsfwJailbreakPrompt();
    if (jailbreak) messages.push({ role: "system", content: jailbreak });
  }

  // ═══ LAYER 2: CHARACTER & USER CONTEXT ═══

  // 2a. Character Sheet (XML-tagged for better LLM attention)
  const charName = effectiveCharacter.name;
  const charParts: string[] = [];

  charParts.push(`<character_identity>`);
  charParts.push(`Name: ${charName}`);
  if (effectiveCharacter.description) {
    charParts.push(replaceMacros(effectiveCharacter.description, charName, resolvedUserName));
  }
  charParts.push(`</character_identity>`);

  if (effectiveCharacter.personality) {
    charParts.push(`<personality_traits>`);
    charParts.push(replaceMacros(effectiveCharacter.personality, charName, resolvedUserName));
    charParts.push(`</personality_traits>`);
  }

  if (effectiveCharacter.scenario) {
    charParts.push(`<current_scenario>`);
    charParts.push(replaceMacros(effectiveCharacter.scenario, charName, resolvedUserName));
    charParts.push(`</current_scenario>`);
  }

  // Relationship anchor — forces AI to remember the relationship throughout the chat
  charParts.push(`<relationship_with_user>`);
  charParts.push(`Người ${charName} đang nói chuyện là: ${resolvedUserName}`);
  charParts.push(`Mối quan hệ giữa ${charName} và ${resolvedUserName} được định nghĩa trong character_identity và current_scenario ở trên.`);
  charParts.push(`${charName} phải nhớ và thể hiện mối quan hệ này nhất quán trong mọi response — không được hành xử như người lạ nếu lore định nghĩa mối quan hệ thân mật.`);
  charParts.push(`</relationship_with_user>`);

  messages.push({ role: "system", content: charParts.join("\n\n") });

  // 2b. User Persona
  const userInfoParts: string[] = [];
  const identityStr = buildIdentityString(persona.gender, persona.sexuality);
  if (identityStr) userInfoParts.push(identityStr);
  if (persona.userDescription) userInfoParts.push(persona.userDescription);
  if (userInfoParts.length > 0) {
    messages.push({
      role: "system",
      content: `<user_persona>\n${resolvedUserName}: ${userInfoParts.join(". ")}\n</user_persona>`,
    });
  }

  // 2c. World Info (all lorebook entries combined)
  const lorebook = resolveLorebookEntries(effectiveCharacter.character_book, chatHistory);
  const allWorldInfo = [...lorebook.beforeChar, ...lorebook.afterChar];
  if (allWorldInfo.length > 0) {
    messages.push({
      role: "system",
      content: `<world_lore>\n${allWorldInfo.join("\n\n")}\n</world_lore>`,
    });
  }

  // ═══ LAYER 3: DIALOGUE EXAMPLES ═══
  if (effectiveCharacter.mes_example?.trim()) {
    messages.push({
      role: "system",
      content: `[EXAMPLE DIALOGUE]\n${effectiveCharacter.mes_example}`,
    });
  }

  // ═══ LAYER 4: MEMORY & CHAT HISTORY ═══

  // 4a. Memory Archive (summary + facts)
  const memoryParts: string[] = [];
  if (summary) memoryParts.push(`Rolling Summary:\n${summary}`);
  if (facts?.length) memoryParts.push(`Key Facts:\n${facts.map(f => `- ${f}`).join("\n")}`);
  if (memoryParts.length > 0) {
    messages.push({ role: "system", content: `[MEMORY ARCHIVE]\n${memoryParts.join("\n\n")}` });
  }

  // 4b. Chat History (sliding window — already truncated by caller)
  for (const msg of chatHistory) {
    messages.push({ role: msg.role, content: msg.content });
  }

  // ═══ LAYER 5: THE ANCHOR (RECENCY BIAS) ═══
  //
  // CRITICAL: Post-history instructions are NOT injected as a separate
  // {"role":"system"} message.  Strict ChatML/Instruct models (Llama 3,
  // Mistral, Qwen) expect the turn sequence to end with User -> Assistant.
  // A dangling system message between the last user turn and the assistant
  // prefill causes token stuttering / overlapping output.
  //
  // Fix: append the anchor text to the LAST user message's content,
  // wrapped in a [System Note: ...] pseudo-tag.

  const postParts: string[] = [];
  const postHistoryInstructions = cardType === "type_b"
    ? getGlobalPostHistoryTypeB()
    : getGlobalPostHistoryTypeA();
  if (postHistoryInstructions) postParts.push(postHistoryInstructions);

  const stylePrompt = getResponseStylePrompt();
  if (stylePrompt) postParts.push(stylePrompt);

  if (!nsfwEnabled) {
    const nsfwGate = getNsfwGatePrompt();
    if (nsfwGate) postParts.push(nsfwGate);
  }

  if (postParts.length > 0) {
    const anchorText = `\n\n[System Note: ${postParts.join("\n")}]`;
    // Find the last user message in the messages array (search backwards)
    let lastUserIdx = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i].role === "user") { lastUserIdx = i; break; }
    }
    if (lastUserIdx !== -1) {
      messages[lastUserIdx] = {
        ...messages[lastUserIdx],
        content: messages[lastUserIdx].content + anchorText,
      };
    } else {
      // Fallback: no user message exists (e.g. empty chat with first_mes only)
      messages.push({ role: "system", content: postParts.join("\n") });
    }
  }

  // 5b. Assistant Prefill — MUST be the absolute last object in the array.
  // Trim trailing whitespace to avoid confusing the model's token prediction.
  if (prefillText) {
    messages.push({ role: "assistant", content: prefillText.trimEnd() });
  }

  return messages;
}
