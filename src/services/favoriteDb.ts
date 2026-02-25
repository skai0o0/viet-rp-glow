import { supabase } from "@/integrations/supabase/client";
import { CharacterSummary } from "./characterDb";

/** Get all character IDs the current user has favorited */
export async function getFavoritedIds(): Promise<Set<string>> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Set();

  const { data, error } = await supabase
    .from("user_favorites")
    .select("character_id")
    .eq("user_id", user.id);

  if (error || !data) return new Set();
  return new Set(data.map((r) => r.character_id));
}

/** Toggle favorite status. Returns the new favorited state. */
export async function toggleFavorite(characterId: string): Promise<boolean> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const { data: existing } = await supabase
    .from("user_favorites")
    .select("id")
    .eq("user_id", user.id)
    .eq("character_id", characterId)
    .maybeSingle();

  if (existing) {
    await supabase.from("user_favorites").delete().eq("id", existing.id);
    return false;
  } else {
    await supabase
      .from("user_favorites")
      .insert({ user_id: user.id, character_id: characterId });
    return true;
  }
}

/** Get full character data for all favorites (for profile page) */
export async function getMyFavorites(): Promise<CharacterSummary[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("user_favorites")
    .select("character_id, characters:character_id(id, name, avatar_url, short_summary, tags, description, message_count, rating)")
    .eq("user_id", user.id)
    .order("created_at", { ascending: false });

  if (error || !data) return [];

  return data
    .map((r: any) => r.characters)
    .filter(Boolean)
    .map((c: any) => ({
      ...c,
      message_count: c.message_count ?? 0,
      rating: c.rating ?? 0,
    }));
}
