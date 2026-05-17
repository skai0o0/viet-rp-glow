import { supabase } from "@/integrations/supabase/client";
import { createCharacter, updateCharacter } from "@/services/characterDb";
import type { TavernCardV2 } from "@/types/taverncard";
import type { Json } from "@/integrations/supabase/types";

export type ApprovalAction =
  | "roadmap_add"
  | "roadmap_edit"
  | "roadmap_delete"
  | "roadmap_status_toggle"
  | "model_add"
  | "model_remove"
  | "model_toggle_recommended"
  | "knowledge_add"
  | "knowledge_edit"
  | "knowledge_delete"
  | "chargen_publish"
  | "card_create"
  | "card_edit";

export interface ApprovalPayload {
  action: ApprovalAction;
  target_table: string;
  target_id?: string;
  data: Record<string, unknown>;
}

export const ACTION_LABELS: Record<string, string> = {
  roadmap_add: "Thêm mục Roadmap",
  roadmap_edit: "Sửa mục Roadmap",
  roadmap_delete: "Xoá mục Roadmap",
  roadmap_status_toggle: "Đổi trạng thái Roadmap",
  model_add: "Thêm Model",
  model_remove: "Xoá Model",
  model_toggle_recommended: "Toggle đề xuất Model",
  knowledge_add: "Thêm Knowledge Base",
  knowledge_edit: "Sửa Knowledge Base",
  knowledge_delete: "Xoá Knowledge Base",
  chargen_publish: "Xuất bản nhân vật AI",
  card_create: "Tạo nhân vật mới",
  card_edit: "Chỉnh sửa nhân vật",
};

export async function createApproval(
  userId: string,
  title: string,
  payload: ApprovalPayload,
  approvalType: "admin_edit" | "card_create" | "card_edit" = "admin_edit",
): Promise<void> {
  const { error } = await supabase.from("pending_approvals").insert({
    user_id: userId,
    type: approvalType,
    title,
    payload: payload as unknown as Json,
    status: "pending" as const,
  });
  if (error) throw error;
}

export async function applyApprovalPayload(
  payload: Record<string, unknown>,
): Promise<void> {
  const { action, target_table, target_id, data: rawData } =
    payload as unknown as ApprovalPayload;

  if (!action || !target_table) {
    throw new Error("Payload thiếu action hoặc target_table");
  }

  // data is dynamic — each action branch knows the expected shape at runtime
  const data = rawData as any;

  switch (action) {
    case "roadmap_add": {
      const { error } = await supabase.from("roadmap_items").insert(data);
      if (error) throw error;
      break;
    }
    case "roadmap_edit": {
      if (!target_id) throw new Error("Thiếu target_id");
      const { error } = await supabase
        .from("roadmap_items")
        .update(data)
        .eq("id", target_id);
      if (error) throw error;
      break;
    }
    case "roadmap_delete": {
      if (!target_id) throw new Error("Thiếu target_id");
      const { error } = await supabase
        .from("roadmap_items")
        .delete()
        .eq("id", target_id);
      if (error) throw error;
      break;
    }
    case "roadmap_status_toggle": {
      if (!target_id) throw new Error("Thiếu target_id");
      const { error } = await supabase
        .from("roadmap_items")
        .update(data)
        .eq("id", target_id);
      if (error) throw error;
      break;
    }
    case "model_add": {
      const { error } = await supabase
        .from("allowed_models")
        .insert(data);
      if (error) throw error;
      break;
    }
    case "model_remove": {
      if (!target_id) throw new Error("Thiếu target_id");
      const { error } = await supabase
        .from("allowed_models")
        .delete()
        .eq("id", target_id);
      if (error) throw error;
      break;
    }
    case "model_toggle_recommended": {
      if (!target_id) throw new Error("Thiếu target_id");
      const { error } = await supabase
        .from("allowed_models")
        .update(data)
        .eq("id", target_id);
      if (error) throw error;
      break;
    }
    case "knowledge_add": {
      const { error } = await supabase
        .from("knowledge_base")
        .insert(data);
      if (error) throw error;
      break;
    }
    case "knowledge_edit": {
      if (!target_id) throw new Error("Thiếu target_id");
      const { error } = await supabase
        .from("knowledge_base")
        .update(data)
        .eq("id", target_id);
      if (error) throw error;
      break;
    }
    case "knowledge_delete": {
      if (!target_id) throw new Error("Thiếu target_id");
      const { error } = await supabase
        .from("knowledge_base")
        .delete()
        .eq("id", target_id);
      if (error) throw error;
      break;
    }
    case "chargen_publish":
    case "card_create": {
      const card = normalizeToTavernCard(data.card as Record<string, unknown>);
      const ownerId = data.owner_id as string;
      const isPublic = data.is_public as boolean;
      const avatarUrl = (data.avatar_url as string) || null;
      await createCharacter(card, ownerId, isPublic, undefined, avatarUrl);
      break;
    }
    case "card_edit": {
      if (!target_id) throw new Error("Thiếu target_id");
      const card = normalizeToTavernCard(data.card as Record<string, unknown>);
      const isPublic = data.is_public as boolean;
      const avatarUrl = data.avatar_url as string | null | undefined;
      await updateCharacter(target_id, card, isPublic, undefined, avatarUrl);
      break;
    }
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}

/**
 * Normalize card data to TavernCardV2 format.
 * CreatePage sends flat card data (no .data wrapper),
 * while EditCharacterPage sends full TavernCardV2 { spec, spec_version, data }.
 * This function handles both cases.
 */
function normalizeToTavernCard(raw: Record<string, unknown>): TavernCardV2 {
  // Already in TavernCardV2 format
  if (
    raw &&
    typeof raw.data === "object" &&
    raw.data !== null &&
    "name" in (raw.data as Record<string, unknown>)
  ) {
    return raw as unknown as TavernCardV2;
  }

  // Flat card data — wrap into TavernCardV2
  return {
    spec: "chara_card_v2",
    spec_version: "2.0",
    data: {
      name: (raw.name as string) || "",
      description: (raw.description as string) || "",
      personality: (raw.personality as string) || "",
      scenario: (raw.scenario as string) || "",
      first_mes: (raw.first_mes as string) || "",
      mes_example: (raw.mes_example as string) || "",
      creator_notes: (raw.creator_notes as string) || "",
      system_prompt: (raw.system_prompt as string) || "",
      post_history_instructions: (raw.post_history_instructions as string) || "",
      alternate_greetings: (raw.alternate_greetings as string[]) || [],
      character_book: raw.character_book as TavernCardV2["data"]["character_book"],
      tags: (raw.tags as string[]) || [],
      creator: (raw.creator as string) || "",
      character_version: (raw.character_version as string) || "1.0",
      extensions: (raw.extensions as Record<string, unknown>) || {},
    },
  };
}
