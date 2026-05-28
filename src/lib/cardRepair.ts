import { TavernCardV2Data } from "@/types/taverncard";
import { nonStreamChat } from "@/services/charGenService";
import { getActiveProvider } from "@/services/openRouter";
import type { Issue } from "./cardValidator";

function buildRepairPrompt(card: TavernCardV2Data, issue: Issue): string | null {
  const startCount = (card.mes_example?.match(/<START>/gi) || []).length;

  const prompts: Record<string, string> = {
    FIRST_MES_IS_GREETING: `Rewrite this first_mes as an in-scene opener (NOT a greeting).
Character: ${card.name}
Current first_mes: ${card.first_mes}

Rules:
- Start in the middle of a scene, not with a greeting
- Include: (Suy nghĩ) *Hành động* "Lời thoại"
- Vietnamese only
- Max 200 words
- Do NOT start with greetings like "Xin chào", "Chào", "Hello"

Return ONLY the new first_mes text, nothing else.`,

    MES_EXAMPLE_TOO_FEW: `Generate ${Math.max(8 - startCount, 4)} additional dialogue examples for this character.
Character: ${card.name}
Personality: ${card.personality}
Existing examples:
${card.mes_example}

Rules:
- Each block starts with <START>
- Format: {{user}}: [trigger] then {{char}}: (Suy nghĩ) *Hành động* "Lời thoại"
- Cover different emotional states (happy, angry, sad, curious, surprised)
- Vietnamese only, match existing tone exactly
- Each exchange should be 2-4 lines

Return ONLY the new <START> blocks, nothing else.`,

    MES_EXAMPLE_NO_ACTIONS: `Reformat these dialogue examples to include *actions* and (thoughts).
Current mes_example:
${card.mes_example}

Rules:
- Keep all existing dialogue content unchanged
- Add *hành động* where natural
- Add (Suy nghĩ) where it reveals character depth
- Format per response: (Suy nghĩ) *Hành động* "Lời thoại"
- Keep {{user}} and {{char}} placeholders

Return ONLY the reformatted mes_example, nothing else.`,

    DESCRIPTION_TOO_LONG: `Shorten this character description to under 350 tokens while keeping all key info.
Character: ${card.name}
Current description:
${card.description}

Rules:
- Keep all personality traits, background, and key details
- Remove redundancy and flowery language
- Keep {{char}} and {{user}} placeholders
- Vietnamese only
- Must stay under 350 tokens

Return ONLY the shortened description, nothing else.`,

    PERSONALITY_TOO_LONG: `Condense this personality field to under 130 tokens.
Character: ${card.name}
Current personality:
${card.personality}

Rules:
- Keep only core traits (3-5 bullet points max)
- Remove examples and explanations
- Keep {{char}} placeholder
- Vietnamese only

Return ONLY the condensed personality, nothing else.`,

    FIRST_MES_TOO_LONG: `Shorten this first message to under 450 tokens while keeping the scene intact.
Character: ${card.name}
Current first_mes: ${card.first_mes}

Rules:
- Keep the core scene and character voice
- Trim excessive description
- Keep (Suy nghĩ) *Hành động* "Lời thoại" format
- Vietnamese only

Return ONLY the shortened first_mes, nothing else.`,

    SYSTEM_PROMPT_TOO_LONG: `Shorten this system prompt to under 180 tokens while keeping key instructions.
Current system_prompt:
${card.system_prompt}

Rules:
- Keep only the most critical behavioral instructions
- Remove redundant format instructions (they're handled elsewhere)
- Vietnamese only

Return ONLY the shortened system_prompt, nothing else.`,
  };

  return prompts[issue.code] ?? null;
}

/**
 * Use AI to repair a specific card field that can't be auto-fixed.
 * Returns a partial card with only the repaired field, or empty if unsupported.
 */
export async function repairCardField(
  card: TavernCardV2Data,
  issue: Issue,
  signal?: AbortSignal,
): Promise<Partial<TavernCardV2Data>> {
  const prompt = buildRepairPrompt(card, issue);
  if (!prompt) return {};

  const provider = getActiveProvider();
  const result = await nonStreamChat(
    [{ role: "user", content: prompt }],
    { provider, maxTokens: 4096, signal },
  );

  if (!result?.trim()) return {};

  return { [issue.field]: result.trim() } as Partial<TavernCardV2Data>;
}
