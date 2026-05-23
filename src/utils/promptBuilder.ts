import { CharacterCard, ActiveNPC } from "@/types/character";
import { CharacterBook } from "@/types/taverncard";
import { getCachedUserPersona, buildIdentityString } from "@/services/profileDb";
import {
  getGlobalSystemPrompt,
  getGlobalPromptTypeA,
  getGlobalPromptTypeB,
  getGlobalPostHistoryTypeA,
  getGlobalPostHistoryTypeB,
} from "@/services/globalSettingsDb";
import { countTokens } from "@/utils/tokenizer";

export interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
  /** OpenRouter/Claude prompt caching hint — ignored by models that don't support it. */
  cache_control?: { type: "ephemeral" };
}

export interface PromptSection {
  id: string;
  content: string;
  order: number;
}

/** @deprecated Use `countTokens` from `@/utils/tokenizer` instead. */
export const estimateTokens = countTokens;

// ─── Model-Aware Token Budgets ────────────────────────────────

/**
 * Conservative context window limits per model family.
 * These are intentionally lower than actual limits to leave headroom
 * for tokenizer inaccuracies and provider-side overhead.
 */
const MODEL_CONTEXT_LIMITS: Record<string, number> = {
  "google/gemini-2.0-flash": 32000,
  "google/gemini-2.5-flash": 32000,
  "google/gemini-2.5-pro": 32000,
  "google/gemma": 7000,
  "anthropic/claude-3.5-haiku": 50000,
  "anthropic/claude-sonnet": 50000,
  "anthropic/claude-opus": 50000,
  "gryphe/mythomax": 3800,
  "mistralai/mistral": 7500,
  "nousresearch": 7000,
  "microsoft/phi": 7000,
  "qwen": 7000,
};

/** Default context budget for unknown models. */
const DEFAULT_CONTEXT_BUDGET = 7000;

/**
 * Get the token budget for a model, matching by prefix.
 * Exported so callers can pass the correct budget to truncateMessages.
 */
export function getModelTokenBudget(modelId: string): number {
  const normalized = modelId.toLowerCase();
  for (const [prefix, limit] of Object.entries(MODEL_CONTEXT_LIMITS)) {
    if (normalized.startsWith(prefix)) return limit;
  }
  return DEFAULT_CONTEXT_BUDGET;
}

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
 *
 * @param messages - The full messages array from buildMessages()
 * @param maxTokens - Token budget. If omitted, uses DEFAULT_MAX_CONTEXT_TOKENS.
 * @param modelId - Optional model ID for model-aware budgeting (overrides maxTokens if both provided via getModelTokenBudget).
 */
export function truncateMessages(
  messages: OpenRouterMessage[],
  maxTokens?: number,
  modelId?: string,
): OpenRouterMessage[] {
  const budget = maxTokens ?? (modelId ? getModelTokenBudget(modelId) : DEFAULT_MAX_CONTEXT_TOKENS);

  // Cache token counts to avoid calling expensive WASM countTokens multiple times per message
  const tokenCache = new Map<string, number>();
  const getTokens = (content: string): number => {
    let cached = tokenCache.get(content);
    if (cached === undefined) {
      cached = estimateTokens(content) + 4; // +4 for role overhead
      tokenCache.set(content, cached);
    }
    return cached;
  };

  // Count total tokens (single pass)
  let totalTokens = 0;
  for (const msg of messages) {
    totalTokens += getTokens(msg.content);
  }

  if (totalTokens <= budget) return messages;

  // Separate system messages from chat messages
  const systemMessages: OpenRouterMessage[] = [];
  const chatMessages: OpenRouterMessage[] = [];

  for (const msg of messages) {
    if (msg.role === "system") {
      systemMessages.push(msg);
    } else {
      chatMessages.push(msg);
    }
  }

  // Calculate system token budget (max 35% of context for system, 65% for chat)
  const systemBudget = Math.floor(budget * 0.35);
  const chatBudget = budget - systemBudget;

  // Truncate system messages if they exceed budget — drop from the middle
  // (keep Layer 1 at top and Layer 5 at bottom for primacy/recency)
  let systemTokens = systemMessages.reduce((sum, m) => sum + getTokens(m.content), 0);
  if (systemTokens > systemBudget) {
    while (systemMessages.length > 2 && systemTokens > systemBudget) {
      // Remove the second-to-last system message (middle of the prompt)
      const removed = systemMessages.splice(systemMessages.length - 2, 1)[0];
      systemTokens -= getTokens(removed.content);
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
    const msgTokens = getTokens(chatMessages[i].content);
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
 * Auto-replace Vietnamese/English keywords with {{user}} and {{char}} macros.
 * Uses word-boundary matching to avoid partial replacements.
 */
export function replaceMacroKeywords(text: string): string {
  // Keywords → {{user}} (case-insensitive, word boundary)
  const userPattern = /\b(tôi|tao|mình|tớ|bạn|user|người dùng)\b/gi;
  // Keywords → {{char}}
  const charPattern = /\b(char|nhân vật|cô ấy|anh ấy|cậu ấy|hắn|nàng|chàng)\b/gi;

  return text
    .replace(userPattern, "{{user}}")
    .replace(charPattern, "{{char}}");
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
  activeNPCs?: ActiveNPC[],
): PromptSection[] {
  const sections: PromptSection[] = [];
  let order = 0;

  // 1. Main Prompt (type-specific global system prompt from admin config)
  const hasActiveNPCs = activeNPCs && activeNPCs.length > 0;
  const cardType = hasActiveNPCs ? "type_b" : detectCardType(character);
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

  // 6b. Active NPCs
  if (hasActiveNPCs) {
    const npcLines = activeNPCs!.map((npc) => {
      let line = `--- [${npc.name}] ---`;
      if (npc.description) line += `\n${npc.description}`;
      if (npc.personality) line += `\nPersonality: ${npc.personality}`;
      return line;
    });
    sections.push({
      id: "active_npcs",
      content: "--- ACTIVE NPCs ---\n" + npcLines.join("\n\n"),
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

// ─── SillyTavern-Style Assembly ──────────────────────────────

/**
 * Build a single consolidated system prompt (~900 tokens).
 * Flowing prose, no XML tags, no headers. Vietnamese format rules.
 */
export function buildSystemPrompt(
  character: CharacterCard,
  userName: string = "User",
  chatHistory: { role: string; content: string }[] = [],
  summary?: string,
  facts?: string[],
  activeNPCs?: ActiveNPC[],
  settings?: { nsfw?: boolean },
): string {
  const charName = character.name;
  const nsfw = settings?.nsfw ?? (localStorage.getItem("vietrp_nsfw_mode") === "true");
  const parts: string[] = [];

  // Global admin prompt (if configured in Supabase)
  const hasActiveNPCs = activeNPCs && activeNPCs.length > 0;
  const cardType = hasActiveNPCs ? "type_b" : detectCardType(character);
  const typePrompt = cardType === "type_b" ? getGlobalPromptTypeB() : getGlobalPromptTypeA();
  const globalPrompt = typePrompt || getGlobalSystemPrompt();
  if (globalPrompt) {
    parts.push(globalPrompt);
  }

  // Character prose (description + personality merged)
  const charProse: string[] = [];
  charProse.push(`${charName}: ${replaceMacros(character.description || "No description.", charName, userName)}`);
  if (character.personality) {
    charProse.push(`Tính cách: ${replaceMacros(character.personality, charName, userName)}`);
  }
  parts.push(charProse.join(" "));

  // Relationship
  parts.push(`Người ${charName} đang nói chuyện là ${userName}. Mối quan hệ giữa họ được định nghĩa bởi bối cảnh và tính cách của ${charName}.`);

  // Scenario
  if (character.scenario) {
    parts.push(`Bối cảnh hiện tại: ${replaceMacros(character.scenario, charName, userName)}`);
  }

  // World lore (lorebook entries)
  const lorebook = resolveLorebookEntries(character.character_book, chatHistory);
  const allLore = [...lorebook.beforeChar, ...lorebook.afterChar];
  if (allLore.length > 0) {
    parts.push(`Thông tin thế giới:\n${allLore.join("\n")}`);
  }

  // Active NPCs
  if (hasActiveNPCs) {
    const npcLines = activeNPCs!.map((npc) => {
      let line = `- ${npc.name}`;
      if (npc.description) line += `: ${npc.description}`;
      if (npc.personality) line += ` (Tính cách: ${npc.personality})`;
      return line;
    });
    parts.push(`NPC đang có mặt:\n${npcLines.join("\n")}`);
  }

  // User persona (1 sentence, merged)
  const persona = getCachedUserPersona();
  const userInfoParts: string[] = [];
  const identityStr = buildIdentityString(persona.gender, persona.sexuality);
  if (identityStr) userInfoParts.push(identityStr);
  if (persona.userDescription) userInfoParts.push(persona.userDescription);
  if (userInfoParts.length > 0) {
    parts.push(`Thông tin về ${userName}: ${userInfoParts.join(". ")}.`);
  }

  // Character system_prompt override
  if (character.system_prompt?.trim()) {
    parts.push(replaceMacros(character.system_prompt.trim(), charName, userName));
  }

  // Dialogue examples (condensed, placeholders replaced)
  if (character.mes_example?.trim()) {
    parts.push(`Ví dụ hội thoại:\n${replaceMacros(character.mes_example.trim(), charName, userName)}`);
  }

  // Memory (summary + facts)
  if (summary) {
    parts.push(`Tóm tắt cuộc trò chuyện trước: ${summary}`);
  }
  if (facts?.length) {
    parts.push(`Thông tin quan trọng: ${facts.join("; ")}.`);
  }

  // Format rules
  const nsfwRule = nsfw
    ? "- Cho phép nội dung 18+, bạo lực, ngôn ngữ mạnh khi phù hợp với bối cảnh."
    : "- Giữ nội dung phù hợp, không quá bạo lực hoặc tình dục.";
  parts.push(
    `- Xưng hô: dùng "${userName}" để gọi người chơi.\n` +
    `- Format: (Suy nghĩ) *Hành động* "Lời thoại"\n` +
    `- Không bao giờ nói, suy nghĩ, hoặc hành động thay ${userName}.\n` +
    `- Tối đa 1-3 thành phần mỗi phản hồi.\n` +
    `- Ngôn ngữ: tiếng Việt, giọng văn tự nhiên, không cliché.\n` +
    nsfwRule
  );

  return parts.join("\n\n");
}

/**
 * Trim chat history to fit within token budget.
 * Always keeps first 2 messages (persona trick pair).
 * Removes oldest messages from the middle (keeps most recent).
 */
export function trimHistory(
  messages: { role: "user" | "assistant"; content: string }[],
  maxTokens?: number,
  modelId?: string,
): { role: "user" | "assistant"; content: string }[] {
  const budget = maxTokens ?? 4000;
  const estimate = (text: string) => Math.ceil(text.length / 4);

  let total = 0;
  for (const msg of messages) total += estimate(msg.content) + 4;
  if (total <= budget) return messages;

  // Always keep first 2 messages (persona trick pair)
  const fixed: typeof messages = [];
  const rest: typeof messages = [];
  for (let i = 0; i < messages.length; i++) {
    if (i < 2) fixed.push(messages[i]);
    else rest.push(messages[i]);
  }

  // Keep most recent messages that fit
  const kept: typeof messages = [];
  let used = 0;
  for (let i = rest.length - 1; i >= 0; i--) {
    const cost = estimate(rest[i].content) + 4;
    if (used + cost > budget) break;
    kept.unshift(rest[i]);
    used += cost;
  }

  return [...fixed, ...kept];
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
 * SillyTavern-style 5-block assembly:
 *   [0]  System: single consolidated prompt (~900 tokens)
 *   [1]  User:   "[Bắt đầu roleplay]"  (persona trick)
 *   [2]  Asst:   character.first_mes
 *   [3+] User/Asst: trimmed chat history
 *   [-4] System: mid-conversation reminder (if > 10 msgs)
 *   Last: current user message (clean, no injection)
 *   Last: assistant prefill (optional)
 */
export function buildMessages(
  character: CharacterCard,
  chatHistory: { role: "user" | "assistant"; content: string }[],
  userName?: string,
  scenarioOverride?: string,
  summary?: string,
  facts?: string[],
  prefillText?: string,
  activeNPCs?: ActiveNPC[],
  cmdInstructions?: string[],
  modelId?: string,
): OpenRouterMessage[] {
  const persona = getCachedUserPersona();
  const resolvedUserName = userName || persona.displayName || "User";
  const effectiveCharacter = scenarioOverride !== undefined
    ? { ...character, scenario: scenarioOverride }
    : character;

  const messages: OpenRouterMessage[] = [];

  // ── BLOCK 1: Single consolidated system message ──
  const systemContent = buildSystemPrompt(
    effectiveCharacter, resolvedUserName, chatHistory, summary, facts, activeNPCs,
  );
  const isAnthropic = modelId?.startsWith("anthropic/") ?? false;
  messages.push({
    role: "system",
    content: systemContent,
    ...(isAnthropic ? { cache_control: { type: "ephemeral" } } : {}),
  });

  // ── BLOCK 2: Persona trick ──
  const rawFirstMes = effectiveCharacter.first_mes?.trim();
  const firstMesContent = rawFirstMes ? replaceMacros(rawFirstMes, effectiveCharacter.name, resolvedUserName) : `*${effectiveCharacter.name} xuất hiện.*`;
  messages.push({ role: "user", content: "[Bắt đầu roleplay]" });
  messages.push({ role: "assistant", content: firstMesContent });

  // ── BLOCK 3: Trimmed chat history ──
  const hasFirstMesInHistory = rawFirstMes
    && chatHistory.length > 0
    && chatHistory[0].role === "assistant"
    && chatHistory[0].content.trim() === rawFirstMes;

  if (chatHistory.length > 0) {
    const historyToAdd = hasFirstMesInHistory ? chatHistory.slice(1) : chatHistory;
    for (const msg of historyToAdd) {
      messages.push({ role: msg.role, content: msg.content });
    }
  }

  // ── BLOCK 4: Reminder (inject before last user message if history > 6) ──
  if (chatHistory.length > 6) {
    const pronounReminder = effectiveCharacter.personality?.split(/[.\n]/)[0]?.trim() || "";
    const reminderParts = [`Nhớ: mày là ${effectiveCharacter.name}.`];
    if (pronounReminder) reminderParts.push(`${pronounReminder}.`);
    reminderParts.push(`Format: (Suy nghĩ) *Hành động* "Lời thoại". Không nói thay người chơi.`);
    const reminder = reminderParts.join(" ");
    // Insert before the last user message
    const insertIdx = Math.max(2, messages.length - 1);
    messages.splice(insertIdx, 0, { role: "system", content: reminder });
  }

  // ── BLOCK 5: Current user message (clean, no injection) ──
  // The last message in chatHistory is the current user message.
  // It's already added in BLOCK 3, so no extra handling needed.
  // cmdInstructions are NOT injected — they were handled in the caller.

  // Assistant prefill — MUST be the absolute last object in the array.
  if (prefillText) {
    messages.push({ role: "assistant", content: prefillText.trimEnd() });
  }

  return messages;
}
