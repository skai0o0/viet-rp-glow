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

/** Fetch public characters (summary only, for the Hub) */
export async function getPublicCharacters(): Promise<CharacterSummary[]> {
  const { data, error } = await supabase
    .from("characters")
    .select("id, name, avatar_url, short_summary, tags, description, message_count, rating")
    .eq("is_public", true)
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as CharacterSummary[];
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
    .select("id, name, avatar_url, short_summary, tags, description, message_count, rating")
    .eq("is_public", true)
    .order("created_at", { ascending: false })
    .range(from, to);

  if (error) throw error;
  const items = (data ?? []) as CharacterSummary[];
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
  return data as DbCharacter;
}

/** Fetch all characters owned by current user */
export async function getMyCharacters(): Promise<CharacterSummary[]> {
  const { data, error } = await supabase
    .from("characters")
    .select("id, name, avatar_url, short_summary, tags, description, message_count, rating")
    .order("created_at", { ascending: false });

  if (error) throw error;
  return (data ?? []) as CharacterSummary[];
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

/** Atomically increment message_count for a character (fire-and-forget) */
export function incrementMessageCount(characterId: string) {
  supabase.rpc("increment_character_message_count", { char_id: characterId });
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
