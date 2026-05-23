import React from "react";
import { replaceMacros } from "@/utils/promptBuilder";
import { tokenize, extractRichSegments, parseMarkdownTable, type Token } from "@/utils/messageParser";
import { cn } from "@/lib/utils";

const styleMap: Record<Token["type"], string> = {
  dialogue: "text-neon-blue font-medium",
  action: "text-muted-foreground italic",
  thought: "text-yellow-600/80 italic",
  text: "text-neon-blue",
};

export interface RoleplayMessageProps extends React.HTMLAttributes<HTMLSpanElement> {
  text: string;
  charName?: string;
  userName?: string;
}

const RoleplayMessage = React.memo(
  React.forwardRef<HTMLSpanElement, RoleplayMessageProps>(
    ({ text, charName, userName, className, ...props }, ref) => {
      const resolvedText = charName ? replaceMacros(text, charName, userName || "User") : text;
      const segments = extractRichSegments(resolvedText);

      const renderTokenizedText = (content: string, keyPrefix: string) => {
        const tokens = tokenize(content);
        return (
          <>
            {tokens.map((token, i) => {
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
        <span ref={ref} className={cn(className)} {...props}>
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
        </span>
      );
    }
  )
);

RoleplayMessage.displayName = "RoleplayMessage";

export default RoleplayMessage;
