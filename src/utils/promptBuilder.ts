import { CharacterCard } from "@/types/character";
import { getCachedUserPersona } from "@/services/profileDb";
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
 * Build the system prompt from character card fields
 */
export function buildSystemPrompt(character: CharacterCard, userName: string = "User"): string {
  const sections: string[] = [];

  // 1. Global base system prompt (from admin config)
  const globalPrompt = getGlobalSystemPrompt();
  if (globalPrompt) {
    sections.push(globalPrompt);
  }

  // 2. Character info section
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

  // 3. User info section
  const persona = getCachedUserPersona();
  if (persona.userDescription) {
    sections.push("--- USER INFO ---\n" + `[User's Details: ${persona.userDescription}]`);
  }

  const combined = sections.join("\n\n");
  return combined;
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

  // 1. System prompt
  messages.push({
    role: "system",
    content: buildSystemPrompt(effectiveCharacter, resolvedUserName),
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
