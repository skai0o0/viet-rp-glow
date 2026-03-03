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

export type UserGender = "" | "nam" | "nữ";
export type UserSexuality = "" | "dị" | "đồng" | "song" | "tự yêu";

export interface CachedPersona {
  displayName: string;
  userDescription: string;
  gender: UserGender;
  sexuality: UserSexuality;
}

/** Get display name and description for prompt building (from localStorage cache or DB) */
export function getCachedUserPersona(): CachedPersona {
  return {
    displayName: localStorage.getItem("vietrp_display_name") || "User",
    userDescription: localStorage.getItem("vietrp_user_description") || "",
    gender: (localStorage.getItem("vietrp_gender") || "") as UserGender,
    sexuality: (localStorage.getItem("vietrp_sexuality") || "") as UserSexuality,
  };
}

export function setCachedUserPersona(
  displayName: string,
  userDescription: string,
  gender?: UserGender,
  sexuality?: UserSexuality
) {
  localStorage.setItem("vietrp_display_name", displayName);
  localStorage.setItem("vietrp_user_description", userDescription);
  if (gender !== undefined) localStorage.setItem("vietrp_gender", gender);
  if (sexuality !== undefined) localStorage.setItem("vietrp_sexuality", sexuality);
}

/** Check if user profile is missing required fields */
export function isProfileIncomplete(): { incomplete: boolean; missing: string[] } {
  const persona = getCachedUserPersona();
  const missing: string[] = [];
  if (!persona.displayName || persona.displayName === "User") missing.push("Tên hiển thị");
  if (!persona.gender) missing.push("Giới tính");
  if (!persona.sexuality) missing.push("Xu hướng tính dục");
  if (!persona.userDescription) missing.push("Mô tả bản thân");
  return { incomplete: missing.length > 0, missing };
}

/** Build a human-readable identity string from gender + sexuality for prompt injection */
export function buildIdentityString(gender: UserGender, sexuality: UserSexuality): string {
  const parts: string[] = [];
  if (gender) parts.push(`Giới tính: ${gender}`);
  if (sexuality) {
    const labels: Record<string, string> = {
      "dị": "dị tính (thích người khác giới)",
      "đồng": "đồng tính (thích người cùng giới)",
      "song": "song tính (thích cả hai giới)",
      "tự yêu": "tự luyến (yêu bản thân / narcissist)",
    };
    parts.push(`Xu hướng tính dục: ${labels[sexuality] || sexuality}`);
  }
  return parts.join(". ");
}
