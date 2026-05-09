import JSON5 from "json5";
import { TavernCardV2 } from "@/types/taverncard";

function normalize(obj: any): TavernCardV2 | null {
  if (obj?.spec === "chara_card_v2" && obj?.data?.name) {
    const d = obj.data;
    return {
      spec: "chara_card_v2",
      spec_version: "2.0",
      data: {
        name: d.name || "",
        description: d.description || "",
        personality: d.personality || "",
        scenario: d.scenario || "",
        first_mes: d.first_mes || "",
        mes_example: d.mes_example || "",
        creator_notes: d.creator_notes || "Tạo bởi VietRP AI Generator.",
        system_prompt: d.system_prompt || "",
        post_history_instructions: d.post_history_instructions || "",
        alternate_greetings: Array.isArray(d.alternate_greetings) ? d.alternate_greetings : [],
        character_book: d.character_book || undefined,
        tags: Array.isArray(d.tags) ? d.tags : [],
        creator: d.creator || "VietRP Charagen AI",
        character_version: d.character_version || "1.0",
        extensions: d.extensions || {},
      },
    };
  }
  return null;
}

function tryParse(s: string): TavernCardV2 | null {
  try { return normalize(JSON5.parse(s)); } catch { return null; }
}

/** Extract all top-level brace-balanced substrings from text */
function extractBraceBlocks(text: string): string[] {
  const results: string[] = [];
  let depth = 0;
  let start = -1;
  for (let i = 0; i < text.length; i++) {
    if (text[i] === "{") {
      if (depth === 0) start = i;
      depth++;
    } else if (text[i] === "}") {
      depth--;
      if (depth === 0 && start >= 0) {
        results.push(text.slice(start, i + 1));
        start = -1;
      }
    }
  }
  return results.filter((b) => b.includes('"spec"') || b.includes('"name"'));
}

/**
 * Extract a TavernCardV2 from LLM response text.
 * Handles: raw JSON, markdown fenced blocks, JSON embedded in prose.
 */
export function extractCardJson(raw: string): TavernCardV2 | null {
  // 1) Direct parse — entire response is raw JSON
  const direct = tryParse(raw);
  if (direct) return direct;

  // 2) Markdown fenced code blocks: ```json ... ``` or ``` ... ```
  const fencePatterns = [
    /```(?:json5?|JSON5?)?\s*\n?([\s\S]*?)```/g,
    /~~~(?:json5?|JSON5?)?\s*\n?([\s\S]*?)~~~/g,
  ];
  for (const pat of fencePatterns) {
    let m: RegExpExecArray | null;
    while ((m = pat.exec(raw)) !== null) {
      const result = tryParse(m[1].trim());
      if (result) return result;
    }
  }

  // 3) Brace-matching: find outermost {…} blocks that contain "spec" or "name"
  const braceResults = extractBraceBlocks(raw);
  for (const block of braceResults) {
    const result = tryParse(block);
    if (result) return result;
  }

  return null;
}
