import { CharacterCard } from "@/types/character";
import { CharacterBook } from "@/types/taverncard";
import { getCachedUserPersona, buildIdentityString } from "@/services/profileDb";
import { getGlobalSystemPrompt } from "@/services/globalSettingsDb";
import { getResponseStylePrompt } from "@/components/GenerationSettings";

export interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
}

export interface PromptSection {
  id: string;
  content: string;
  order: number;
}

/**
 * Estimate token count for a string.
 * ~4 chars/token for Latin, ~2 chars/token for CJK/Vietnamese diacritics.
 * Good enough for budget enforcement without a real tokenizer.
 */
export function estimateTokens(text: string): number {
  if (!text) return 0;
  let count = 0;
  for (let i = 0; i < text.length; i++) {
    const code = text.charCodeAt(i);
    // CJK + Vietnamese diacritics range → ~2 chars/token
    if (code > 0x02ff) {
      count += 0.5;
    } else {
      count += 0.25;
    }
  }
  return Math.ceil(count);
}

/** Default max context tokens (conservative for most models) */
const DEFAULT_MAX_CONTEXT_TOKENS = 8000;

/**
 * Truncate messages array to fit within token budget.
 * Strategy: keep system prompt + last N messages that fit.
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

  // Keep system message(s) from the front, truncate from chat history
  const systemMessages: OpenRouterMessage[] = [];
  const otherMessages: OpenRouterMessage[] = [];

  for (const msg of messages) {
    if (msg.role === "system" && systemMessages.length === 0) {
      systemMessages.push(msg);
    } else {
      otherMessages.push(msg);
    }
  }

  // Calculate system token budget (max 40% of context for system)
  const systemBudget = Math.floor(maxTokens * 0.4);
  const chatBudget = maxTokens - systemBudget;

  // Truncate system prompt if needed
  const systemTokens = estimateTokens(systemMessages[0]?.content || "") + 4;
  if (systemTokens > systemBudget && systemMessages[0]) {
    const maxChars = systemBudget * 4;
    systemMessages[0] = {
      ...systemMessages[0],
      content: systemMessages[0].content.slice(0, maxChars) + "\n[...truncated...]",
    };
  }

  // Keep last N messages that fit in chat budget
  let usedTokens = 0;
  const kept: OpenRouterMessage[] = [];
  for (let i = otherMessages.length - 1; i >= 0; i--) {
    const msgTokens = estimateTokens(otherMessages[i].content) + 4;
    if (usedTokens + msgTokens > chatBudget) break;
    kept.unshift(otherMessages[i]);
    usedTokens += msgTokens;
  }

  return [...systemMessages, ...kept];
}

/**
 * Replace {{user}} and {{char}} macros in text
 */
export function replaceMacros(text: string, charName: string, userName: string = "User"): string {
  return text
    .replace(/\{\{user\}\}/gi, userName)
    .replace(/\{\{char\}\}/gi, charName);
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
  const recentText = recentMessages
    .map((m) => m.content)
    .join(" ")
    .toLowerCase();

  const matchedTriggered = triggeredEntries.filter((entry) => {
    if (!entry.keys?.length) return false;
    const caseSensitive = entry.case_sensitive === true;
    const searchText = caseSensitive ? recentText : recentText;
    const searchKeys = caseSensitive
      ? entry.keys
      : entry.keys.map((k) => k.toLowerCase());

    // Primary keys: any match triggers
    const primaryMatch = searchKeys.some((key) =>
      caseSensitive
        ? recentMessages.some((m) => m.content.includes(key))
        : searchText.includes(key),
    );

    if (!primaryMatch) return false;

    // If selective, also require at least one secondary key match
    if (entry.selective && entry.secondary_keys?.length) {
      const secondaryKeys = caseSensitive
        ? entry.secondary_keys
        : entry.secondary_keys.map((k) => k.toLowerCase());
      return secondaryKeys.some((key) =>
        caseSensitive
          ? recentMessages.some((m) => m.content.includes(key))
          : searchText.includes(key),
      );
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

  // 1. Main Prompt (global system prompt from admin config)
  const globalPrompt = getGlobalSystemPrompt();
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

  // 7. Character System Prompt (custom instructions)
  if (character.system_prompt) {
    sections.push({
      id: "char_system_prompt",
      content: character.system_prompt,
      order: order++,
    });
  }

  // 8. World Info (after_char)
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
 * Build the full messages array for OpenRouter API
 */
export function buildMessages(
  character: CharacterCard,
  chatHistory: { role: "user" | "assistant"; content: string }[],
  userName?: string,
  scenarioOverride?: string,
  summary?: string,
  facts?: string[],
): OpenRouterMessage[] {
  const persona = getCachedUserPersona();
  const resolvedUserName = userName || persona.displayName || "User";

  // If scenarioOverride provided, use it instead of character.scenario
  const effectiveCharacter = scenarioOverride !== undefined
    ? { ...character, scenario: scenarioOverride }
    : character;

  const messages: OpenRouterMessage[] = [];

  // 1. System prompt (pass chat history for lorebook scanning + memory)
  messages.push({
    role: "system",
    content: buildSystemPrompt(effectiveCharacter, resolvedUserName, chatHistory, summary, facts),
  });

  // 2. Example messages (if any)
  if (effectiveCharacter.mes_example) {
    const examples = parseMesExample(effectiveCharacter.mes_example, effectiveCharacter.name, userName);
    messages.push(...examples);
  }

  // 3. Chat history
  for (const msg of chatHistory) {
    messages.push({
      role: msg.role,
      content: msg.content,
    });
  }

  // 4. Post-history instructions (response style + NSFW gate)
  const postParts: string[] = [];

  const stylePrompt = getResponseStylePrompt();
  if (stylePrompt) {
    postParts.push(stylePrompt);
  }

  // NSFW mode gate
  const nsfwEnabled = localStorage.getItem("vietrp_nsfw_mode") === "true";
  if (!nsfwEnabled) {
    postParts.push(
      "[System Note: NSFW/Sexual/Violence/Gore content is strictly forbidden. Keep all responses safe for work. Fade to black for any intimate scenes.]"
    );
  }

  if (postParts.length > 0) {
    messages.push({ role: "system", content: postParts.join("\n") });
  }

  return messages;
}
