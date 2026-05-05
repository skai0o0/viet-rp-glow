import { supabase } from "@/integrations/supabase/client";

// ─── Types ───

export interface ChatSummary {
  id: string;
  session_id: string;
  summary: string;
  messages_up_to: number;
  token_count: number;
  created_at: string;
}

export interface ChatFact {
  id: string;
  session_id: string;
  fact: string;
  category: string;
  message_index: number;
  created_at: string;
}

// ─── Summaries ───

/** Get the most recent summary for a session */
export async function getLatestSummary(sessionId: string): Promise<ChatSummary | null> {
  const { data, error } = await supabase
    .from("chat_summaries")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) throw error;
  return data as ChatSummary | null;
}

/** Get all summaries for a session (oldest first) */
export async function getAllSummaries(sessionId: string): Promise<ChatSummary[]> {
  const { data, error } = await supabase
    .from("chat_summaries")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ChatSummary[];
}

/** Save a new summary for a session */
export async function saveSummary(
  sessionId: string,
  summary: string,
  messagesUpTo: number,
  tokenCount: number = 0,
): Promise<void> {
  const { error } = await supabase.from("chat_summaries").insert({
    session_id: sessionId,
    summary,
    messages_up_to: messagesUpTo,
    token_count: tokenCount,
  });

  if (error) throw error;
}

/** Delete all summaries for a session (used when chat is cleared) */
export async function clearSummaries(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from("chat_summaries")
    .delete()
    .eq("session_id", sessionId);

  if (error) throw error;
}

// ─── Facts ───

/** Get all facts for a session */
export async function getFacts(sessionId: string): Promise<ChatFact[]> {
  const { data, error } = await supabase
    .from("chat_facts")
    .select("*")
    .eq("session_id", sessionId)
    .order("message_index", { ascending: true });

  if (error) throw error;
  return (data ?? []) as ChatFact[];
}

/** Save extracted facts for a session */
export async function saveFacts(
  sessionId: string,
  facts: { fact: string; category: string; messageIndex: number }[],
): Promise<void> {
  if (facts.length === 0) return;

  const { error } = await supabase.from("chat_facts").insert(
    facts.map((f) => ({
      session_id: sessionId,
      fact: f.fact,
      category: f.category,
      message_index: f.messageIndex,
    })),
  );

  if (error) throw error;
}

/** Clear all facts for a session */
export async function clearFacts(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from("chat_facts")
    .delete()
    .eq("session_id", sessionId);

  if (error) throw error;
}
