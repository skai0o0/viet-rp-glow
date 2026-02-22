import React from "react";

interface Token {
  type: "dialogue" | "action" | "thought" | "text";
  content: string;
}

function tokenize(text: string): Token[] {
  // Match: "..." or "..." (dialogue), *...* (action), (...) (thought)
  const regex = /("(?:[^"\\]|\\.)*"|"[^"]*")|(\*(?:[^*\\]|\\.)*\*)|(\([^)]*\))/g;
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

const styleMap: Record<Token["type"], string> = {
  dialogue: "text-neon-blue font-medium",
  action: "text-muted-foreground italic",
  thought: "text-yellow-600/80 italic",
  text: "text-foreground/90",
};

interface RoleplayMessageProps {
  text: string;
}

const RoleplayMessage = ({ text }: RoleplayMessageProps) => {
  const tokens = tokenize(text);

  return (
    <>
      {tokens.map((token, i) => {
        // Split by newlines to insert <br />
        const parts = token.content.split("\n");
        return (
          <span key={i} className={styleMap[token.type]}>
            {parts.map((part, j) => (
              <React.Fragment key={j}>
                {j > 0 && <br />}
                {part}
              </React.Fragment>
            ))}
          </span>
        );
      })}
    </>
  );
};

export default RoleplayMessage;
