export interface Token {
  type: "dialogue" | "action" | "thought" | "text";
  content: string;
}

export interface RichSegment {
  type: "text" | "code" | "table";
  content: string;
  language?: string;
}

export function tokenize(text: string): Token[] {
  const regex = /("(?:[^"\\]|\\.)*"|“[^”]*”)|(\*(?:[^*\\]|\\.)*\*)|(\([^)]*\))/g;
  const tokens: Token[] = [];
  let lastIndex = 0;

  let match: RegExpExecArray | null;
  while ((match = regex.exec(text)) !== null) {
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

export function extractTableSegments(text: string): RichSegment[] {
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

export function extractRichSegments(text: string): RichSegment[] {
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

export function parseMarkdownTable(tableText: string): { headers: string[]; rows: string[][] } {
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

export function parseCommandPrefix(content: string): { badge: string; badgeColor: string; rest: string } | null {
  if (content.startsWith("/cmd ")) {
    const afterCmd = content.slice(5).trim();
    const sepMatch = afterCmd.match(/^(.{1,}?)(?:\s{2,}|\t)(.+)$/s);
    if (sepMatch) {
      return { badge: "/cmd", badgeColor: "bg-neon-purple/20 text-neon-purple border-neon-purple/30", rest: sepMatch[2].trim() };
    }
    return { badge: "/cmd", badgeColor: "bg-neon-purple/20 text-neon-purple border-neon-purple/30", rest: afterCmd };
  }
  if (content.startsWith("/debug ")) {
    const afterDebug = content.slice(7).trim();
    return { badge: "/debug", badgeColor: "bg-yellow-500/20 text-yellow-400 border-yellow-500/30", rest: afterDebug };
  }
  return null;
}
