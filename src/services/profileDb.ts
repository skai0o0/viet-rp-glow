import { supabase } from "@/integrations/supabase/client";

export interface UserProfile {
  id: string;
  user_id: string;
  display_name: string;
  user_description: string;
  nsfw_mode: boolean;
  created_at: string;
  updated_at: string;
}

/** Get current user's profile */
export async function getMyProfile(): Promise<UserProfile | null> {
  const { data, error } = await supabase
    .from("profiles")
    .select("*")
    .single();

  if (error) {
    if (error.code === "PGRST116") return null; // no rows
    throw error;
  }
  return data as UserProfile;
}

/** Upsert (create or update) current user's profile */
export async function upsertProfile(
  userId: string,
  updates: { display_name?: string; user_description?: string; nsfw_mode?: boolean }
): Promise<UserProfile> {
  const { data, error } = await supabase
    .from("profiles")
    .upsert({ user_id: userId, ...updates }, { onConflict: "user_id" })
    .select()
    .single();

  if (error) throw error;
  return data as UserProfile;
}

/** Get display name and description for prompt building (from localStorage cache or DB) */
export function getCachedUserPersona(): { displayName: string; userDescription: string } {
  return {
    displayName: localStorage.getItem("vietrp_display_name") || "User",
    userDescription: localStorage.getItem("vietrp_user_description") || "",
  };
}

export function setCachedUserPersona(displayName: string, userDescription: string) {
  localStorage.setItem("vietrp_display_name", displayName);
  localStorage.setItem("vietrp_user_description", userDescription);
}
