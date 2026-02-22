import { CharacterCard } from "@/types/character";
import { getCachedUserPersona } from "@/services/profileDb";

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
  const parts: string[] = [];

  if (character.description) {
    parts.push(character.description);
  }
  if (character.personality) {
    parts.push(`Personality: ${character.personality}`);
  }
  if (character.scenario) {
    parts.push(`Scenario: ${character.scenario}`);
  }

  // If the character has extended fields (from TavernCardV2), include system_prompt
  const ext = character as any;
  if (ext.system_prompt) {
    parts.push(ext.system_prompt);
  }

  // Append user persona description
  const persona = getCachedUserPersona();
  if (persona.userDescription) {
    parts.push(`[User's Details: ${persona.userDescription}]`);
  }

  const combined = parts.join("\n\n");
  return replaceMacros(combined, character.name, userName);
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
          messages.push({ role: currentRole, content: replaceMacros(currentContent.trim(), charName, userName) });
        }
        currentRole = "user";
        currentContent = userMatch[1];
      } else if (charMatch) {
        if (currentRole && currentContent) {
          messages.push({ role: currentRole, content: replaceMacros(currentContent.trim(), charName, userName) });
        }
        currentRole = "assistant";
        currentContent = charMatch[1];
      } else if (currentRole) {
        currentContent += "\n" + trimmed;
      }
    }

    if (currentRole && currentContent) {
      messages.push({ role: currentRole, content: replaceMacros(currentContent.trim(), charName, userName) });
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
  userName?: string
): OpenRouterMessage[] {
  const persona = getCachedUserPersona();
  const resolvedUserName = userName || persona.displayName || "User";
  const messages: OpenRouterMessage[] = [];

  // 1. System prompt
  messages.push({
    role: "system",
    content: buildSystemPrompt(character, resolvedUserName),
  });

  // 2. Example messages (if any)
  const ext = character as any;
  if (ext.mes_example) {
    const examples = parseMesExample(ext.mes_example, character.name, userName);
    messages.push(...examples);
  }

  // 3. Chat history
  for (const msg of chatHistory) {
    messages.push({
      role: msg.role,
      content: msg.content,
    });
  }

  return messages;
}
