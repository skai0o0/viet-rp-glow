import { useState, useCallback, useRef } from "react";
import type { ChatMessage } from "@/types/character";
import { getMemoryContext, triggerRollingSummary } from "@/services/memoryManager";

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
      console.log("[useChatMemory] Loaded memory for session:", sessionId, ctx);
      setMemory((prev) => ({
        ...prev,
        summary: ctx.summary,
        facts: ctx.facts,
      }));
    } catch (err) {
      console.error("[useChatMemory] Failed to load memory:", err);
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
        await triggerRollingSummary(sessionId, messages);
        // The archivist runs in the background; when it finishes the summary
        // will be loaded on the next loadMemory() call (e.g. session switch).
        // We clear isSummarizing immediately since the actual work is fire-and-forget.
        setMemory((prev) => ({ ...prev, isSummarizing: false }));
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
