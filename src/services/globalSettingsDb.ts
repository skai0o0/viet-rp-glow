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

// ─── Allowed Models ─────────────────────────────────────────

export type AllowedModel = {
  id: string;
  model_id: string;
  model_name: string;
  provider: string;
  description: string;
  is_free: boolean;
  is_recommended: boolean;
  sort_order: number;
  created_at: string;
};

let cachedAllowedModels: AllowedModel[] | null = null;

/** Fetch all admin-curated allowed models */
export async function fetchAllowedModels(): Promise<AllowedModel[]> {
  const { data, error } = await supabase
    .from("allowed_models")
    .select("*")
    .order("sort_order", { ascending: true })
    .order("model_name", { ascending: true });
  if (error) {
    console.warn("[globalSettingsDb] fetchAllowedModels error:", error.message);
    return cachedAllowedModels ?? [];
  }
  cachedAllowedModels = (data ?? []) as AllowedModel[];
  return cachedAllowedModels;
}

/** Synchronous getter – returns cached value or empty array */
export function getCachedAllowedModels(): AllowedModel[] {
  return cachedAllowedModels ?? [];
}

/** Add a model to the allowed list */
export async function addAllowedModel(model: {
  model_id: string;
  model_name: string;
  provider: string;
  description?: string;
  is_free?: boolean;
  is_recommended?: boolean;
  sort_order?: number;
}): Promise<AllowedModel> {
  const { data, error } = await supabase
    .from("allowed_models")
    .insert({
      model_id: model.model_id,
      model_name: model.model_name,
      provider: model.provider,
      description: model.description || "",
      is_free: model.is_free ?? false,
      is_recommended: model.is_recommended ?? false,
      sort_order: model.sort_order ?? 0,
    })
    .select()
    .single();
  if (error) throw error;
  return data as AllowedModel;
}

/** Remove a model from the allowed list */
export async function removeAllowedModel(id: string): Promise<void> {
  const { error } = await supabase
    .from("allowed_models")
    .delete()
    .eq("id", id);
  if (error) throw error;
}

/** Toggle recommended status */
export async function toggleModelRecommended(id: string, isRecommended: boolean): Promise<void> {
  const { error } = await supabase
    .from("allowed_models")
    .update({ is_recommended: isRecommended })
    .eq("id", id);
  if (error) throw error;
}

/** Update sort order */
export async function updateModelSortOrder(id: string, sortOrder: number): Promise<void> {
  const { error } = await supabase
    .from("allowed_models")
    .update({ sort_order: sortOrder })
    .eq("id", id);
  if (error) throw error;
}
