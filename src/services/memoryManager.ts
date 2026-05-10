/**
 * Memory Manager — rolling summarisation for long-term roleplay.
 *
 * Design:
 *   - Triggers every USER_MESSAGE_THRESHOLD user messages (not total messages).
 *   - Keeps the most recent RECENT_KEPT messages out of the summarisation window
 *     so the model still has immediate conversational context.
 *   - Feeds the previous summary + unsummarised messages into a cheap model
 *     using the **Archivist Prompt** which captures relationship milestones,
 *     emotional/physical boundaries, and key plot points.
 *   - Persists the compressed summary to `chat_summaries` (for history) and
 *     denormalises it onto `chat_sessions.rolling_summary` (for fast reads).
 *
 * This module is intentionally fire-and-forget: every public function swallows
 * its own errors so a summarisation failure never blocks the chat stream.
 */

import type { ChatMessage } from "@/types/character";
import { countTokens } from "@/utils/tokenizer";
import {
  getLatestSummary,
  saveSummary,
  getFacts,
  saveFacts,
  clearFacts,
} from "./chatMemoryDb";
import { updateSessionRollingSummary } from "./chatDb";
import { supabase } from "@/integrations/supabase/client";
import {
  getApiKeyForProvider,
  getActiveProvider,
  getModel,
  getMimoEndpoint,
} from "./openRouter";

// ── Tuning knobs ────────────────────────────────────────────────────────────

/** Trigger summarisation after this many *user* messages since the last summary. */
const USER_MESSAGE_THRESHOLD = 10;

/**
 * Number of recent messages to keep OUT of the summarisation window.
 * The AI still has these in its direct context, so summarising them is wasteful.
 */
const RECENT_KEPT = 5;

// ── Archivist Prompt (the heart of the RP memory system) ────────────────────

const ARCHIVIST_PROMPT = `You are a Roleplay Memory Archivist. Your job is to read a roleplay log and create a highly compressed, factual, and chronological summary of the relationship and events.

You MUST capture the following critical elements:
1. RELATIONSHIP MILESTONES: Note specific shifts in intimacy (e.g., "they had their first kiss", "they had sex for the first time", "they confessed love", "User discovered Char's secret").
2. PHYSICAL/EMOTIONAL BOUNDARIES: How comfortable are they with each other right now? (e.g., "Char is no longer shy about physical touch", "User is acting dominant", "They are currently hostile").
3. KEY PLOT POINTS: What actually happened, locations visited, promises made, or items acquired.

Format the output strictly as a bulleted list. Be concise but do not omit emotional tension or NSFW relationship developments.`;

// ── Types ────────────────────────────────────────────────────────────────────

export interface MemorySnapshot {
  summary: string;
  facts: string[];
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Check whether summarisation should fire, and if so, run it in the
 * background.  Returns `true` if a summarisation was kicked off.
 *
 * Call this after every assistant message is persisted.
 * It is safe to call with the full message list — the function counts
 * user messages internally and compares against the last summary checkpoint.
 */
export async function triggerRollingSummary(
  sessionId: string,
  messages: ChatMessage[],
): Promise<boolean> {
  try {
    const userMessages = messages.filter((m) => m.role === "user");
    if (userMessages.length < USER_MESSAGE_THRESHOLD) return false;

    const latestSummary = await getLatestSummary(sessionId);
    const lastSummarizedAt = latestSummary?.messages_up_to ?? 0;
    const newUserMessages = messages
      .slice(lastSummarizedAt)
      .filter((m) => m.role === "user");

    if (newUserMessages.length < USER_MESSAGE_THRESHOLD) return false;

    // Build the window: everything since last checkpoint, minus the tail
    const windowEnd = messages.length - RECENT_KEPT;
    if (windowEnd <= lastSummarizedAt) return false;

    const messagesToSummarize = messages.slice(lastSummarizedAt, windowEnd);

    // Fire and forget — caller should not await this
    runArchivist(sessionId, messages, messagesToSummarize, latestSummary?.summary).catch(
      (err) => console.warn("[memoryManager] Background summarisation failed:", err),
    );

    return true;
  } catch (err) {
    console.warn("[memoryManager] triggerRollingSummary failed:", err);
    return false;
  }
}

/**
 * Load the combined memory context (summary + facts) for prompt injection.
 * Identical interface to the old chatSummarizer.getMemoryContext.
 */
export async function getMemoryContext(
  sessionId: string,
): Promise<{ summary?: string; facts?: string[] }> {
  const [latestSummary, facts] = await Promise.all([
    getLatestSummary(sessionId),
    getFacts(sessionId),
  ]);

  return {
    summary: latestSummary?.summary ?? undefined,
    facts: facts.length > 0 ? facts.map((f) => f.fact) : undefined,
  };
}

/**
 * Force-generate a summary using the user's current BYOK model and API key.
 * Unlike `triggerRollingSummary` (which uses the platform summarize edge function),
 * this calls the AI directly with the user's own credentials — intended for
 * admin/op/mod manual trigger from the UI.
 *
 * Returns the new summary string, or `null` on failure.
 */
export async function forceGenerateSummary(
  sessionId: string,
  currentMessages: ChatMessage[],
  currentSummary: string | null,
): Promise<string | null> {
  const provider = getActiveProvider();
  const apiKey = getApiKeyForProvider(provider);
  if (!apiKey) throw new Error("No API key configured. Please set your API key in Settings.");

  const model = getModel();

  // Build the window: all messages minus the tail (keep recent context)
  const windowEnd = currentMessages.length - RECENT_KEPT;
  const messagesToSummarize = windowEnd > 0
    ? currentMessages.slice(0, windowEnd)
    : currentMessages;

  if (messagesToSummarize.length === 0) {
    throw new Error("Not enough messages to summarize.");
  }

  const userPrompt = buildArchivistUserPrompt(messagesToSummarize, currentSummary ?? undefined);

  // Determine API endpoint
  const isOpenRouter = provider !== "mimo";
  const apiUrl = isOpenRouter
    ? "https://openrouter.ai/api/v1/chat/completions"
    : `${getMimoEndpoint()}/chat/completions`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (isOpenRouter) {
    headers["HTTP-Referer"] = "https://vietrp.com";
    headers["X-Title"] = "VietRP Force Summarize";
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: ARCHIVIST_PROMPT },
        { role: "user", content: userPrompt },
      ],
      stream: false,
      max_tokens: 800,
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errText = await response.text().catch(() => "unknown");
    throw new Error(`AI returned ${response.status}: ${errText}`);
  }

  const json = await response.json();
  const content: string = json.choices?.[0]?.message?.content ?? "";
  if (!content) throw new Error("AI returned empty response.");

  const { summary, facts } = parseArchivistResponse(content);
  if (!summary) throw new Error("Failed to parse summary from AI response.");

  // Persist to chat_summaries table
  const tokenCount = countTokens(summary);
  await saveSummary(sessionId, summary, currentMessages.length, tokenCount);

  // Persist facts
  await clearFacts(sessionId);
  if (facts.length > 0) {
    await saveFacts(
      sessionId,
      facts.map((fact, i) => ({
        fact,
        category: "archivist",
        messageIndex: i,
      })),
    );
  }

  // Denormalise onto chat_sessions.rolling_summary
  await persistRollingSummaryToSession(sessionId, summary);

  return summary;
}

// ── Internals ────────────────────────────────────────────────────────────────

/**
 * Run the Archivist model: build the prompt, call the edge function,
 * parse the response, persist summary + facts.
 */
async function runArchivist(
  sessionId: string,
  allMessages: ChatMessage[],
  messagesToSummarize: ChatMessage[],
  previousSummary?: string,
): Promise<void> {
  const userPrompt = buildArchivistUserPrompt(messagesToSummarize, previousSummary);
  const responseText = await callSummarizeAPI(userPrompt);
  if (!responseText) return;

  // The archivist returns a bulleted list — treat the whole thing as the summary.
  // We also try to extract individual facts for the key-facts system.
  const { summary, facts } = parseArchivistResponse(responseText);
  if (!summary) return;

  // Persist to chat_summaries table
  const tokenCount = countTokens(summary);
  await saveSummary(sessionId, summary, allMessages.length, tokenCount);

  // Persist facts
  await clearFacts(sessionId);
  if (facts.length > 0) {
    await saveFacts(
      sessionId,
      facts.map((fact, i) => ({
        fact,
        category: "archivist",
        messageIndex: allMessages.length - messagesToSummarize.length + i,
      })),
    );
  }

  // Denormalise onto chat_sessions.rolling_summary for fast reads
  await persistRollingSummaryToSession(sessionId, summary);
}

/**
 * Build the user-facing prompt that accompanies the Archivist system prompt.
 */
function buildArchivistUserPrompt(
  messages: ChatMessage[],
  previousSummary?: string,
): string {
  const parts: string[] = [];

  if (previousSummary) {
    parts.push("=== PREVIOUS SUMMARY (continue from here) ===");
    parts.push(previousSummary);
    parts.push("");
    parts.push("=== NEW MESSAGES TO PROCESS ===");
  } else {
    parts.push("=== ROLEPLAY LOG (summarise from the beginning) ===");
  }

  for (const msg of messages) {
    const role = msg.role === "user" ? "User" : "Assistant";
    parts.push(`${role}: ${msg.content}`);
  }

  parts.push("");
  parts.push("Produce the compressed summary now.");

  return parts.join("\n");
}

/**
 * Call the Supabase `summarize` edge function with the Archivist system prompt.
 */
async function callSummarizeAPI(userPrompt: string): Promise<string | null> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) return null;

  const supabaseUrl = import.meta.env.VITE_SUPABASE_URL as string;
  const supabaseAnonKey = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;

  const response = await fetch(`${supabaseUrl}/functions/v1/summarize`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${session.access_token}`,
      apikey: supabaseAnonKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      prompt: userPrompt,
      systemPrompt: ARCHIVIST_PROMPT,
    }),
  });

  if (!response.ok) return null;

  const json = await response.json();
  return (json.content as string) ?? null;
}

/**
 * Parse the Archivist response into summary + facts.
 *
 * The Archivist returns a bulleted list.  The entire list is the summary.
 * We also extract each top-level bullet as a standalone "fact" for the
 * key-facts prompt section, which gives the main model granular recall.
 */
function parseArchivistResponse(text: string): {
  summary: string;
  facts: string[];
} {
  const trimmed = text.trim();
  if (!trimmed) return { summary: "", facts: [] };

  // Extract bullet points as facts
  const facts: string[] = [];
  const lines = trimmed.split("\n");
  for (const line of lines) {
    const cleaned = line.replace(/^\s*[-•*]\s*/, "").trim();
    if (cleaned) facts.push(cleaned);
  }

  // The full text IS the summary (already compressed by the Archivist)
  return { summary: trimmed, facts };
}

/**
 * Denormalise the rolling summary onto `chat_sessions.rolling_summary`.
 * Non-critical — failure is silently ignored.
 */
async function persistRollingSummaryToSession(
  sessionId: string,
  summary: string,
): Promise<void> {
  try {
    await updateSessionRollingSummary(sessionId, summary);
  } catch {
    // Column may not exist yet — that's fine, the chat_summaries table is the source of truth
  }
}
