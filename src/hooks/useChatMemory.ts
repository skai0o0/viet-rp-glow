import { useState, useCallback, useRef } from "react";
import type { ChatMessage } from "@/types/character";
import { getMemoryContext, summarizeIfNeeded } from "@/services/chatSummarizer";

interface ChatMemoryState {
  summary: string | undefined;
  facts: string[] | undefined;
  isSummarizing: boolean;
}

/**
 * Hook to manage chat memory (rolling summary + key facts).
 * Loads memory on session change and triggers summarization after messages.
 */
export function useChatMemory() {
  const [memory, setMemory] = useState<ChatMemoryState>({
    summary: undefined,
    facts: undefined,
    isSummarizing: false,
  });
  const lastSessionIdRef = useRef<string | null>(null);

  /** Load memory context for a session (call on session load) */
  const loadMemory = useCallback(async (sessionId: string) => {
    lastSessionIdRef.current = sessionId;
    try {
      const ctx = await getMemoryContext(sessionId);
      setMemory((prev) => ({
        ...prev,
        summary: ctx.summary,
        facts: ctx.facts,
      }));
    } catch {
      // Memory load failure should not block chat
    }
  }, []);

  /** Clear memory state (call on new chat / session change) */
  const clearMemory = useCallback(() => {
    lastSessionIdRef.current = null;
    setMemory({ summary: undefined, facts: undefined, isSummarizing: false });
  }, []);

  /**
   * Trigger summarization if conditions are met.
   * Call after each AI response is saved.
   * Runs in background — does not block chat.
   */
  const triggerSummarize = useCallback(
    async (sessionId: string, messages: ChatMessage[]) => {
      if (lastSessionIdRef.current !== sessionId) return;
      if (memory.isSummarizing) return;

      setMemory((prev) => ({ ...prev, isSummarizing: true }));
      try {
        const result = await summarizeIfNeeded(sessionId, messages);
        if (result && lastSessionIdRef.current === sessionId) {
          setMemory((prev) => ({
            ...prev,
            summary: result.summary,
            facts: result.facts,
            isSummarizing: false,
          }));
        } else {
          setMemory((prev) => ({ ...prev, isSummarizing: false }));
        }
      } catch {
        setMemory((prev) => ({ ...prev, isSummarizing: false }));
      }
    },
    [memory.isSummarizing],
  );

  return {
    summary: memory.summary,
    facts: memory.facts,
    isSummarizing: memory.isSummarizing,
    loadMemory,
    clearMemory,
    triggerSummarize,
  };
}
