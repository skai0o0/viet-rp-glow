import React from "react";
import { replaceMacros } from "@/utils/promptBuilder";

interface Token {
  type: "dialogue" | "action" | "thought" | "text";
  content: string;
}

interface RichSegment {
  type: "text" | "code" | "table";
  content: string;
  language?: string;
}

function tokenize(text: string): Token[] {
  // Match: "..." or \u201c...\u201d (dialogue), *...* (action), (...) (thought)
  const regex = /("(?:[^"\\]|\\.)*"|\u201c[^\u201d]*\u201d)|(\*(?:[^*\\]|\\.)*\*)|(\([^)]*\))/g;
  const tokens: Token[] = [];
  let lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
    // Push preceding plain text
    if (match.index > lastIndex) {
      tokens.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }

    if (match[1]) {
      tokens.push({ type: "dialogue", content: match[1] });
    } else if (match[2]) {
      tokens.push({ type: "action", content: match[2] });
    } else if (match[3]) {
      tokens.push({ type: "thought", content: match[3] });
    }

    lastIndex = regex.lastIndex;
  }

  // Remaining plain text
  if (lastIndex < text.length) {
    tokens.push({ type: "text", content: text.slice(lastIndex) });
  }

  return tokens;
}

function isTableSeparatorRow(line: string): boolean {
  return /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(line.trim());
}

function isMarkdownTableBlock(block: string): boolean {
  const lines = block
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  if (lines.length < 3) return false;
  if (!lines[0].includes("|")) return false;
  if (!isTableSeparatorRow(lines[1])) return false;

  return lines.slice(2).every((line) => line.includes("|"));
}

function extractTableSegments(text: string): RichSegment[] {
  // Regex picks candidate markdown table blocks (validated after matching)
  const tableBlockRegex = /((?:^\|.*\|\s*(?:\r?\n|$)){2,})/gm;
  const segments: RichSegment[] = [];
  let lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = tableBlockRegex.exec(text)) !== null) {
    const block = match[1];

    if (!isMarkdownTableBlock(block)) continue;

    if (match.index > lastIndex) {
      segments.push({ type: "text", content: text.slice(lastIndex, match.index) });
    }

    segments.push({ type: "table", content: block.trimEnd() });
    lastIndex = tableBlockRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push({ type: "text", content: text.slice(lastIndex) });
  }

  return segments;
}

function extractRichSegments(text: string): RichSegment[] {
  // Regex for fenced code blocks: ```lang\n...```
  const codeBlockRegex = /```([a-zA-Z0-9_+-]*)?\n?([\s\S]*?)```/g;
  const segments: RichSegment[] = [];
  let lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = codeBlockRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      segments.push(...extractTableSegments(text.slice(lastIndex, match.index)));
    }

    segments.push({
      type: "code",
      language: match[1] || undefined,
      content: (match[2] || "").trimEnd(),
    });

    lastIndex = codeBlockRegex.lastIndex;
  }

  if (lastIndex < text.length) {
    segments.push(...extractTableSegments(text.slice(lastIndex)));
  }

  return segments;
}

function parseMarkdownTable(tableText: string): { headers: string[]; rows: string[][] } {
  const lines = tableText
    .split("\n")
    .map((l) => l.trim())
    .filter(Boolean);

  const splitRow = (row: string) =>
    row
      .replace(/^\|\s*/, "")
      .replace(/\s*\|$/, "")
      .split("|")
      .map((c) => c.trim());

  const headers = splitRow(lines[0] || "");
  const rows = lines.slice(2).map(splitRow);

  return { headers, rows };
}

const styleMap: Record<Token["type"], string> = {
  dialogue: "text-neon-blue font-medium",
  action: "text-muted-foreground italic",
  thought: "text-yellow-600/80 italic",
  text: "text-neon-blue font-medium",
};

interface RoleplayMessageProps {
  text: string;
  charName?: string;
  userName?: string;
}

const RoleplayMessage = ({ text, charName, userName }: RoleplayMessageProps) => {
  // Replace {{user}} and {{char}} macros before rendering
  const resolvedText = charName ? replaceMacros(text, charName, userName || "User") : text;
  const segments = extractRichSegments(resolvedText);

  const renderTokenizedText = (content: string, keyPrefix: string) => {
    const tokens = tokenize(content);
    return (
      <>
        {tokens.map((token, i) => {
          // Support inline code in text tokens: `...`
          const inlineCodeRegex = /(`[^`\n]+`)/g;
          const chunks = token.content.split(inlineCodeRegex);

          return (
            <span key={`${keyPrefix}-token-${i}`} className={styleMap[token.type]}>
              {chunks.map((chunk, j) => {
                const parts = chunk.split("\n");
                const isInlineCode = /^`[^`\n]+`$/.test(chunk);

                if (isInlineCode) {
                  return (
                    <code
                      key={`${keyPrefix}-chunk-${i}-${j}`}
                      className="px-1.5 py-0.5 rounded bg-oled-elevated border border-oled-border text-neon-blue font-mono text-[0.9em]"
                    >
                      {chunk.slice(1, -1)}
                    </code>
                  );
                }

                return (
                  <React.Fragment key={`${keyPrefix}-chunk-${i}-${j}`}>
                    {parts.map((part, k) => (
                      <React.Fragment key={`${keyPrefix}-part-${i}-${j}-${k}`}>
                        {k > 0 && <br />}
                        {part}
                      </React.Fragment>
                    ))}
                  </React.Fragment>
                );
              })}
            </span>
          );
        })}
      </>
    );
  };

  return (
    <>
      {segments.map((segment, i) => {
        if (segment.type === "code") {
          return (
            <div key={`seg-code-${i}`} className="my-2 rounded-lg border border-oled-border bg-oled-elevated overflow-hidden">
              {segment.language && (
                <div className="px-3 py-1.5 text-[10px] uppercase tracking-wider text-muted-foreground border-b border-oled-border">
                  {segment.language}
                </div>
              )}
              <pre className="p-3 overflow-x-auto text-xs leading-relaxed text-neon-blue font-mono">
                <code>{segment.content}</code>
              </pre>
            </div>
          );
        }

        if (segment.type === "table") {
          const { headers, rows } = parseMarkdownTable(segment.content);
          return (
            <div key={`seg-table-${i}`} className="my-2 overflow-x-auto rounded-lg border border-oled-border">
              <table className="w-full text-xs border-collapse">
                <thead className="bg-oled-elevated">
                  <tr>
                    {headers.map((header, hIdx) => (
                      <th
                        key={`th-${i}-${hIdx}`}
                        className="px-3 py-2 text-left text-neon-blue font-semibold border-b border-oled-border"
                      >
                        {header}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {rows.map((row, rIdx) => (
                    <tr key={`tr-${i}-${rIdx}`} className="border-b border-oled-border/60 last:border-b-0">
                      {row.map((cell, cIdx) => (
                        <td key={`td-${i}-${rIdx}-${cIdx}`} className="px-3 py-2 text-neon-blue font-medium">
                          {cell}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          );
        }

        return <React.Fragment key={`seg-text-${i}`}>{renderTokenizedText(segment.content, `seg-${i}`)}</React.Fragment>;
      })}
    </>
  );
};

export default RoleplayMessage;
