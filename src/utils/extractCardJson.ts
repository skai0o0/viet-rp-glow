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
 * Try to auto-complete truncated JSON by closing open braces/brackets/strings.
 * Returns the completed string, or null if the input doesn't look like JSON.
 */
function autoCompleteJson(s: string): string | null {
  const trimmed = s.trim();
  if (!trimmed.startsWith("{")) return null;

  // Track open braces/brackets
  let depth = 0;
  let inString = false;
  let escape = false;
  for (const ch of trimmed) {
    if (escape) { escape = false; continue; }
    if (ch === "\\") { escape = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === "{" || ch === "[") depth++;
    if (ch === "}" || ch === "]") depth--;
  }

  let suffix = "";
  // Close any open string
  if (inString) suffix += '"';
  // Close open arrays/braces (in reverse order we'd need to close)
  const stack: string[] = [];
  let inStr2 = false;
  let esc2 = false;
  for (const ch of trimmed) {
    if (esc2) { esc2 = false; continue; }
    if (ch === "\\") { esc2 = true; continue; }
    if (ch === '"') { inStr2 = !inStr2; continue; }
    if (inStr2) continue;
    if (ch === "[") stack.push("]");
    if (ch === "{") stack.push("}");
    if (ch === "]" || ch === "}") stack.pop();
  }
  suffix += stack.reverse().join("");

  // Remove trailing incomplete string value (e.g., "key": "incomplete...)
  // Find the last complete key-value pair and truncate
  let result = trimmed + suffix;

  // Try parse as-is first
  try { JSON5.parse(result); return result; } catch { /* continue */ }

  // Try truncating at the last complete value
  // Find last occurrence of a value-ending character (", }, ])
  const lastValid = Math.max(
    result.lastIndexOf('",'),
    result.lastIndexOf("'}," ),
    result.lastIndexOf('",'),
    result.lastIndexOf("}"),
    result.lastIndexOf("]"),
  );
  if (lastValid > 0) {
    const truncated = result.slice(0, lastValid + 1);
    // Re-close braces after truncation
    const retried = autoCompleteJson(truncated);
    if (retried) {
      try { JSON5.parse(retried); return retried; } catch { /* continue */ }
    }
  }

  return result; // return best effort
}

/**
 * Extract a TavernCardV2 from LLM response text.
 * Handles: raw JSON, markdown fenced blocks, JSON embedded in prose, truncated responses.
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

  // 4) Truncated response: find ```json block without closing fence
  const truncatedFenceMatch = raw.match(/```(?:json5?|JSON5?)?\s*\n?([\s\S]*?)$/);
  if (truncatedFenceMatch?.[1]) {
    const completed = autoCompleteJson(truncatedFenceMatch[1].trim());
    if (completed) {
      const result = tryParse(completed);
      if (result) return result;
    }
  }

  // 5) Truncated raw JSON: find first { and try to auto-complete
  const firstBrace = raw.indexOf("{");
  if (firstBrace >= 0) {
    const candidate = raw.slice(firstBrace);
    const completed = autoCompleteJson(candidate);
    if (completed) {
      const result = tryParse(completed);
      if (result) return result;
    }
  }

  return null;
}
