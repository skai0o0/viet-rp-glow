import { CharacterCard } from "@/types/character";
import { CharacterBook } from "@/types/taverncard";
import { getCachedUserPersona, buildIdentityString } from "@/services/profileDb";
import { getGlobalSystemPrompt } from "@/services/globalSettingsDb";
import { getResponseStylePrompt } from "@/components/GenerationSettings";

export interface OpenRouterMessage {
  role: "system" | "user" | "assistant";
  content: string;
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
  const charBudget = tokenBudget * 4; // ~4 chars per token estimate

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

  // Apply token budget
  let usedChars = 0;
  for (const entry of allMatched) {
    const content = entry.content?.trim();
    if (!content) continue;
    if (usedChars + content.length > charBudget) break;

    const target =
      entry.position === "before_char" ? result.beforeChar : result.afterChar;
    target.push(content);
    usedChars += content.length;
  }

  return result;
}

/**
 * Build the system prompt from character card fields
 */
export function buildSystemPrompt(
  character: CharacterCard,
  userName: string = "User",
  chatHistory: { role: string; content: string }[] = [],
): string {
  const sections: string[] = [];

  // 1. Global base system prompt (from admin config)
  const globalPrompt = getGlobalSystemPrompt();
  if (globalPrompt) {
    sections.push(globalPrompt);
  }

  // 2. Lorebook entries with position "before_char"
  const lorebook = resolveLorebookEntries(character.character_book, chatHistory);
  if (lorebook.beforeChar.length > 0) {
    sections.push("--- WORLD INFO ---\n" + lorebook.beforeChar.join("\n\n"));
  }

  // 3. Character info section
  const charParts: string[] = [];
  if (character.description) {
    charParts.push(character.description);
  }
  if (character.personality) {
    charParts.push(`Personality: ${character.personality}`);
  }
  if (character.scenario) {
    charParts.push(`Scenario: ${character.scenario}`);
  }
  const ext = character as any;
  if (ext.system_prompt) {
    charParts.push(ext.system_prompt);
  }
  if (charParts.length > 0) {
    sections.push("--- CHARACTER INFO ---\n" + charParts.join("\n\n"));
  }

  // 4. Lorebook entries with position "after_char" (default)
  if (lorebook.afterChar.length > 0) {
    sections.push(
      "--- SUPPLEMENTAL INFO ---\n" + lorebook.afterChar.join("\n\n"),
    );
  }

  // 5. User info section
  const persona = getCachedUserPersona();
  const userInfoParts: string[] = [];
  const identityStr = buildIdentityString(persona.gender, persona.sexuality);
  if (identityStr) userInfoParts.push(identityStr);
  if (persona.userDescription) userInfoParts.push(persona.userDescription);
  if (userInfoParts.length > 0) {
    sections.push(
      "--- USER INFO ---\n" + `[User's Details: ${userInfoParts.join(". ")}]`,
    );
  }

  return sections.join("\n\n");
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
  scenarioOverride?: string
): OpenRouterMessage[] {
  const persona = getCachedUserPersona();
  const resolvedUserName = userName || persona.displayName || "User";

  // If scenarioOverride provided, use it instead of character.scenario
  const effectiveCharacter = scenarioOverride !== undefined
    ? { ...character, scenario: scenarioOverride }
    : character;

  const messages: OpenRouterMessage[] = [];

  // 1. System prompt (pass chat history for lorebook scanning)
  messages.push({
    role: "system",
    content: buildSystemPrompt(effectiveCharacter, resolvedUserName, chatHistory),
  });

  // 2. Example messages (if any)
  const ext = effectiveCharacter as any;
  if (ext.mes_example) {
    const examples = parseMesExample(ext.mes_example, effectiveCharacter.name, userName);
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
