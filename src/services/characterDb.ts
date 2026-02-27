import { supabase } from "@/integrations/supabase/client";
import { TavernCardV2 } from "@/types/taverncard";

export type DbCharacter = {
  id: string;
  user_id: string;
  is_public: boolean;
  avatar_url: string | null;
  name: string;
  short_summary: string | null;
  tags: string[];
  description: string;
  personality: string;
  scenario: string;
  first_mes: string;
  mes_example: string;
  system_prompt: string;
  post_history_instructions: string;
  creator_notes: string;
  alternate_greetings: string[];
  character_book: Record<string, any> | null;
  extensions: Record<string, any>;
  creator: string;
  character_version: string;
  message_count: number;
  rating: number;
  created_at: string;
  updated_at: string;
};

export type CharacterSummary = Pick<
  DbCharacter,
  "id" | "name" | "avatar_url" | "short_summary" | "tags" | "description" | "message_count" | "rating"
>;

/** Create a new character from TavernCardV2 form data */
export async function createCharacter(
  card: TavernCardV2,
  userId: string,
  isPublic: boolean = false,
  shortSummary?: string,
  avatarUrl?: string | null
) {
  const d = card.data;
  const { data, error } = await supabase
    .from("characters")
    .insert({
      user_id: userId,
      is_public: isPublic,
      avatar_url: avatarUrl || null,
      name: d.name,
      short_summary: shortSummary || d.description.slice(0, 200),
      tags: d.tags,
      description: d.description,
      personality: d.personality,
      scenario: d.scenario,
      first_mes: d.first_mes,
      mes_example: d.mes_example,
      system_prompt: d.system_prompt,
      post_history_instructions: d.post_history_instructions,
      creator_notes: d.creator_notes,
      alternate_greetings: d.alternate_greetings,
      character_book: d.character_book as any,
      extensions: d.extensions as any,
      creator: d.creator,
      character_version: d.character_version,
    })
    .select()
    .single();

  if (error) throw error;
  return data as DbCharacter;
}

const SUMMARY_COLS_FULL = "id, name, avatar_url, short_summary, tags, description, message_count, rating";
const SUMMARY_COLS_BASE = "id, name, avatar_url, short_summary, tags, description";

function withStatDefaults(rows: any[]): CharacterSummary[] {
  return rows.map(r => ({
    ...r,
    message_count: r.message_count ?? 0,
    rating: r.rating ?? 0,
  }));
}

/** Fetch public characters (summary only, for the Hub) */
export async function getPublicCharacters(): Promise<CharacterSummary[]> {
  const { data, error } = await supabase
    .from("characters")
    .select(SUMMARY_COLS_FULL)
    .eq("is_public", true)
    .order("created_at", { ascending: false });

  if (!error) return withStatDefaults(data ?? []);

  const fb = await supabase
    .from("characters")
    .select(SUMMARY_COLS_BASE)
    .eq("is_public", true)
    .order("created_at", { ascending: false });
  if (fb.error) throw fb.error;
  return withStatDefaults(fb.data ?? []);
}

const PAGE_SIZE = 20;

/** Fetch public characters with pagination (for infinite scroll) */
export async function getPublicCharactersPaginated(
  page: number
): Promise<{ data: CharacterSummary[]; hasMore: boolean }> {
  const from = page * PAGE_SIZE;
  const to = from + PAGE_SIZE - 1;

  const { data, error } = await supabase
    .from("characters")
    .select(SUMMARY_COLS_FULL)
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (!error) {
    const items = withStatDefaults(data ?? []);
    return { data: items, hasMore: items.length === PAGE_SIZE };
  }

  const fb = await supabase
    .from("characters")
    .select(SUMMARY_COLS_BASE)
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .range(from, to);
  if (fb.error) throw fb.error;
  const items = withStatDefaults(fb.data ?? []);
  return { data: items, hasMore: items.length === PAGE_SIZE };
}

/** Fetch full character data by ID (for chat session) */
export async function getCharacterById(id: string): Promise<DbCharacter> {
  const { data, error } = await supabase
    .from("characters")
    .select("*")
    .eq("id", id)
    .single();

  if (error) throw error;
  return { message_count: 0, rating: 0, ...data } as DbCharacter;
}

/** Fetch all characters owned by current user */
export async function getMyCharacters(): Promise<CharacterSummary[]> {
  const { data, error } = await supabase
    .from("characters")
    .select(SUMMARY_COLS_FULL)
    .order("created_at", { ascending: false });

  if (!error) return withStatDefaults(data ?? []);

  const fb = await supabase
    .from("characters")
    .select(SUMMARY_COLS_BASE)
    .order("created_at", { ascending: false });
  if (fb.error) throw fb.error;
  return withStatDefaults(fb.data ?? []);
}

/** Update an existing character */
export async function updateCharacter(
  id: string,
  card: TavernCardV2,
  isPublic: boolean,
  shortSummary?: string,
  avatarUrl?: string | null
) {
  const d = card.data;
  const updatePayload: Record<string, any> = {
    is_public: isPublic,
    name: d.name,
    short_summary: shortSummary || d.description.slice(0, 200),
    tags: d.tags,
    description: d.description,
    personality: d.personality,
    scenario: d.scenario,
    first_mes: d.first_mes,
    mes_example: d.mes_example,
    system_prompt: d.system_prompt,
    post_history_instructions: d.post_history_instructions,
    creator_notes: d.creator_notes,
    alternate_greetings: d.alternate_greetings,
    character_book: d.character_book as any,
    extensions: d.extensions as any,
    creator: d.creator,
    character_version: d.character_version,
  };
  if (avatarUrl !== undefined) {
    updatePayload.avatar_url = avatarUrl;
  }

  const { data, error } = await supabase
    .from("characters")
    .update(updatePayload)
    .eq("id", id)
    .select()
    .single();

  if (error) throw error;
  return data as DbCharacter;
}

/** Increment message_count for a character (fire-and-forget, safe if RPC not yet created) */
export async function incrementMessageCount(characterId: string) {
  try {
    const { error } = await supabase.rpc("increment_character_message_count", {
      char_id: characterId,
    });
    if (error) {
      console.warn("[characterDb] RPC increment failed, trying direct update:", error.message);
      // Atomic increment via fallback RPC to avoid race conditions
      const { error: rpcErr } = await supabase.rpc("increment_character_message_count_fallback", {
        char_id: characterId,
      });
      if (rpcErr) {
        console.warn("[characterDb] Fallback RPC also failed:", rpcErr.message);
      }
    }
  } catch (e) {
    console.warn("[characterDb] incrementMessageCount failed:", e);
  }
}

/** Decrement message_count for a character (fire-and-forget, never goes below 0) */
export async function decrementMessageCount(characterId: string, count: number = 1) {
  try {
    const { error } = await supabase.rpc("decrement_character_message_count", {
      char_id: characterId,
      amount: count,
    });
    if (error) {
      console.warn("[characterDb] decrement RPC failed:", error.message);
    }
  } catch (e) {
    console.warn("[characterDb] decrementMessageCount failed:", e);
  }
}

/** Fetch top characters by message_count (trending) */
export async function getTrendingCharacters(limit = 10): Promise<CharacterSummary[]> {
  const { data, error } = await supabase
    .from("characters")
    .select(SUMMARY_COLS_FULL)
    .eq("is_public", true)
    .order("message_count", { ascending: false })
    .limit(limit);

  if (!error) return withStatDefaults(data ?? []);

  const fb = await supabase
    .from("characters")
    .select(SUMMARY_COLS_BASE)
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .limit(limit);
  if (fb.error) return [];
  return withStatDefaults(fb.data ?? []);
}

/** Fetch characters trending in last 7 days (by recent message volume) */
export async function getWeeklyTrendingCharacters(limit = 10): Promise<CharacterSummary[]> {
  try {
    const { data, error } = await supabase.rpc("get_weekly_trending", { lim: limit });
    if (error || !data) return [];
    const ids: string[] = data.map((r: any) => r.character_id);
    if (ids.length === 0) return [];

    const { data: chars, error: cErr } = await supabase
      .from("characters")
      .select(SUMMARY_COLS_FULL)
      .eq("is_public", true)
      .in("id", ids);

    if (cErr || !chars) return [];
    const sorted = ids
      .map((id) => chars.find((c: any) => c.id === id))
      .filter(Boolean);
    return withStatDefaults(sorted);
  } catch {
    return [];
  }
}

/** Fetch most favorited characters (all time) */
export async function getMostFavoritedCharacters(limit = 10): Promise<CharacterSummary[]> {
  try {
    const { data, error } = await supabase.rpc("get_most_favorited", { lim: limit });
    if (error || !data) return [];
    const ids: string[] = data.map((r: any) => r.character_id);
    if (ids.length === 0) return [];

    const { data: chars, error: cErr } = await supabase
      .from("characters")
      .select(SUMMARY_COLS_FULL)
      .eq("is_public", true)
      .in("id", ids);

    if (cErr || !chars) return [];
    const sorted = ids
      .map((id) => chars.find((c: any) => c.id === id))
      .filter(Boolean);
    return withStatDefaults(sorted);
  } catch {
    return [];
  }
}

/** Convert a DbCharacter back to CharacterCard format for chat */
export function dbCharToCard(char: DbCharacter) {
  return {
    name: char.name,
    description: char.description,
    personality: char.personality,
    first_mes: char.first_mes,
    scenario: char.scenario,
    avatar: char.avatar_url || char.name.charAt(0).toUpperCase(),
    tags: char.tags,
    system_prompt: char.system_prompt,
    mes_example: char.mes_example,
    post_history_instructions: char.post_history_instructions,
  };
}
