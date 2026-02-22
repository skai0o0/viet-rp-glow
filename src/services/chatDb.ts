import { supabase } from "@/integrations/supabase/client";

export type DbChatSession = {
  id: string;
  user_id: string;
  character_id: string;
  title: string;
  created_at: string;
  updated_at: string;
};

export type DbChatMessage = {
  id: string;
  session_id: string;
  role: "user" | "assistant";
  content: string;
  created_at: string;
};

/** Get all sessions for a user, optionally filtered by character */
export async function getUserSessions(characterId?: string): Promise<DbChatSession[]> {
  let query = supabase
    .from("chat_sessions")
    .select("*")
    .order("updated_at", { ascending: false });

  if (characterId) {
    query = query.eq("character_id", characterId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data ?? []) as DbChatSession[];
}

/** Create a new chat session */
export async function createSession(
  userId: string,
  characterId: string,
  title: string = ""
): Promise<DbChatSession> {
  const { data, error } = await supabase
    .from("chat_sessions")
    .insert({ user_id: userId, character_id: characterId, title })
    .select()
    .single();
  if (error) throw error;
  return data as DbChatSession;
}

/** Delete a session (cascades messages) */
export async function deleteSession(sessionId: string): Promise<void> {
  const { error } = await supabase
    .from("chat_sessions")
    .delete()
    .eq("id", sessionId);
  if (error) throw error;
}

/** Get all messages for a session */
export async function getSessionMessages(sessionId: string): Promise<DbChatMessage[]> {
  const { data, error } = await supabase
    .from("chat_messages")
    .select("*")
    .eq("session_id", sessionId)
    .order("created_at", { ascending: true });
  if (error) throw error;
  return (data ?? []) as DbChatMessage[];
}

/** Add a message to a session */
export async function addMessage(
  sessionId: string,
  role: "user" | "assistant",
  content: string
): Promise<DbChatMessage> {
  const { data, error } = await supabase
    .from("chat_messages")
    .insert({ session_id: sessionId, role, content })
    .select()
    .single();
  if (error) throw error;

  // Touch session updated_at
  await supabase
    .from("chat_sessions")
    .update({ updated_at: new Date().toISOString() })
    .eq("id", sessionId);

  return data as DbChatMessage;
}

/** Update a message's content (for regen) */
export async function updateMessage(messageId: string, content: string): Promise<void> {
  const { error } = await supabase
    .from("chat_messages")
    .update({ content })
    .eq("id", messageId);
  if (error) throw error;
}

/** Delete a message */
export async function deleteMessage(messageId: string): Promise<void> {
  const { error } = await supabase
    .from("chat_messages")
    .delete()
    .eq("id", messageId);
  if (error) throw error;
}

/** Delete the last assistant message in a session (for regen) */
export async function deleteLastAssistantMessage(sessionId: string): Promise<void> {
  const { data } = await supabase
    .from("chat_messages")
    .select("id")
    .eq("session_id", sessionId)
    .eq("role", "assistant")
    .order("created_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (data) {
    await deleteMessage(data.id);
  }
}

/** Update session title */
export async function updateSessionTitle(sessionId: string, title: string): Promise<void> {
  const { error } = await supabase
    .from("chat_sessions")
    .update({ title })
    .eq("id", sessionId);
  if (error) throw error;
}
