import { supabase } from "@/integrations/supabase/client";

/** Upsert a rating (1-5) for a character. Returns the new average. */
export async function rateCharacter(
  characterId: string,
  value: number,
): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Not authenticated");

  const clamped = Math.max(1, Math.min(5, Math.round(value)));

  const { data: existing } = await supabase
    .from("character_ratings")
    .select("id")
    .eq("user_id", user.id)
    .eq("character_id", characterId)
    .maybeSingle();

  if (existing) {
    const { error } = await supabase
      .from("character_ratings")
      .update({ value: clamped })
      .eq("id", existing.id);
    if (error) {
      console.error("[ratingDb] update error:", error);
      throw error;
    }
  } else {
    const { error } = await supabase
      .from("character_ratings")
      .insert({ user_id: user.id, character_id: characterId, value: clamped });
    if (error) {
      console.error("[ratingDb] insert error:", error);
      throw error;
    }
  }

  return getAverageRating(characterId);
}

/** Get the current user's rating for a character (0 = not rated) */
export async function getMyRating(characterId: string): Promise<number> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return 0;

  const { data } = await supabase
    .from("character_ratings")
    .select("value")
    .eq("user_id", user.id)
    .eq("character_id", characterId)
    .maybeSingle();

  return data?.value ?? 0;
}

/** Get the average rating for a character (server-side via RPC) */
export async function getAverageRating(characterId: string): Promise<number> {
  const { data, error } = await supabase.rpc("get_average_rating", {
    p_character_id: characterId,
  } as any);

  if (error || data === null || data === undefined) return 0;
  return Number(data);
}
