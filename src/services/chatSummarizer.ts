import type { ChatMessage } from "@/types/character";
import { estimateTokens } from "@/utils/promptBuilder";
import { getLatestSummary, saveSummary, getFacts, saveFacts, clearFacts } from "./chatMemoryDb";
import { supabase } from "@/integrations/supabase/client";

const SUMMARIZE_THRESHOLD = 15; // summarize every N new messages

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const SUMMARIZE_URL = `${SUPABASE_URL}/functions/v1/summarize`;

interface SummarizeResult {
  summary: string;
  facts: string[];
}

/**
 * Check if summarization is needed and perform it.
 * Uses the summarize edge function (platform key, free for user).
 * Returns the new summary+facts if summarized, null otherwise.
 */
export async function summarizeIfNeeded(
  sessionId: string,
  messages: ChatMessage[],
): Promise<SummarizeResult | null> {
  if (messages.length < SUMMARIZE_THRESHOLD) return null;

  // Check how many messages since last summary
  const latestSummary = await getLatestSummary(sessionId);
  const lastSummarizedAt = latestSummary?.messages_up_to ?? 0;
  const newMessageCount = messages.length - lastSummarizedAt;

  if (newMessageCount < SUMMARIZE_THRESHOLD) return null;

  // Get messages to summarize (the ones since last summary)
  const messagesToSummarize = messages.slice(lastSummarizedAt);

  // Build summarization prompt
  const summaryPrompt = buildSummarizePrompt(messagesToSummarize, latestSummary?.summary);

  try {
    // Call AI to summarize via edge function (platform key, free for user)
    const result = await callSummarizeAPI(summaryPrompt);
    if (!result) return null;

    // Persist summary and facts
    await saveSummary(sessionId, result.summary, messages.length, estimateTokens(result.summary));

    // Replace all facts with new set
    await clearFacts(sessionId);
    if (result.facts.length > 0) {
      await saveFacts(
        sessionId,
        result.facts.map((fact, i) => ({
          fact,
          category: "general",
          messageIndex: messages.length - messagesToSummarize.length + i,
        })),
      );
    }

    return result;
  } catch (err) {
    // Summarization failure should not block chat
    console.warn("[chatSummarizer] Summarization failed:", err);
    return null;
  }
}

/**
 * Get the combined memory context (summary + facts) for prompt injection.
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
 * Build the summarization prompt for the AI.
 */
function buildSummarizePrompt(
  messages: ChatMessage[],
  previousSummary?: string,
): string {
  const chatText = messages
    .map((m) => {
      const role = m.role === "user" ? "User" : "Assistant";
      return `${role}: ${m.content}`;
    })
    .join("\n");

  const parts: string[] = [];

  if (previousSummary) {
    parts.push("Tóm tắt cuộc trò chuyện trước đó:");
    parts.push(previousSummary);
    parts.push("");
    parts.push("Tiếp tục tóm tắt các tin nhắn mới sau:");
  } else {
    parts.push("Tóm tắt cuộc hội thoại sau thành 2-3 đoạn ngắn gọn.");
  }

  parts.push("");
  parts.push("Giữ lại:");
  parts.push("- Bối cảnh và địa điểm hiện tại");
  parts.push("- Mối quan hệ giữa các nhân vật");
  parts.push("- Sự kiện quan trọng đã xảy ra");
  parts.push("- Cảm xúc và trạng thái hiện tại");
  parts.push("- Vật phẩm hoặc thông tin quan trọng");
  parts.push("");
  parts.push("---CHAT---");
  parts.push(chatText);
  parts.push("---END---");
  parts.push("");
  parts.push("Trả lời đúng format sau:");
  parts.push("---SUMMARY---");
  parts.push("[tóm tắt ở đây]");
  parts.push("---FACTS---");
  parts.push("[fact 1]");
  parts.push("[fact 2]");
  parts.push("...");

  return parts.join("\n");
}

/**
 * Call the summarize edge function (uses platform key, free for user).
 */
async function callSummarizeAPI(prompt: string): Promise<SummarizeResult | null> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return null;

  const response = await fetch(SUMMARIZE_URL, {
    method: "POST",
    headers: {
      "Authorization": `Bearer ${session.access_token}`,
      "apikey": SUPABASE_ANON_KEY,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ prompt }),
  });

  if (!response.ok) return null;

  const json = await response.json();
  const content: string = json.content ?? "";
  if (!content) return null;

  return parseSummaryResponse(content);
}

/**
 * Parse the AI response into summary and facts.
 * Expected format:
 * ---SUMMARY---
 * ...
 * ---FACTS---
 * ...
 */
function parseSummaryResponse(text: string): SummarizeResult | null {
  const summaryMatch = text.match(/---SUMMARY---\s*([\s\S]*?)(?=---FACTS---|$)/);
  const factsMatch = text.match(/---FACTS---\s*([\s\S]*?)$/);

  const summary = summaryMatch?.[1]?.trim();
  if (!summary) return null;

  const facts: string[] = [];
  if (factsMatch?.[1]) {
    const lines = factsMatch[1].trim().split("\n");
    for (const line of lines) {
      const cleaned = line.replace(/^[-•*]\s*/, "").trim();
      if (cleaned) facts.push(cleaned);
    }
  }

  return { summary, facts };
}
