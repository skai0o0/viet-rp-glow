import { supabase } from "@/integrations/supabase/client";

let cachedPrompt: string | null = null;

export async function fetchGlobalSystemPrompt(): Promise<string> {
  const { data } = await supabase
    .from("global_settings")
    .select("value")
    .eq("key", "global_system_prompt")
    .single();
  const value = data?.value ?? "";
  cachedPrompt = value;
  return value;
}

/** Synchronous getter – returns cached value or empty string */
export function getGlobalSystemPrompt(): string {
  return cachedPrompt ?? "";
}

export async function saveGlobalSystemPrompt(value: string): Promise<void> {
  const { error } = await supabase
    .from("global_settings")
    .update({ value, updated_at: new Date().toISOString() })
    .eq("key", "global_system_prompt");
  if (error) throw error;
  cachedPrompt = value;
}
