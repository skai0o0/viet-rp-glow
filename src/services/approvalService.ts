import { supabase } from "@/integrations/supabase/client";
import { createCharacter } from "@/services/characterDb";
import type { TavernCardV2 } from "@/types/taverncard";

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
  | "card_create";

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
    payload: payload as unknown as Record<string, unknown>,
    status: "pending" as const,
  });
  if (error) throw error;
}

export async function applyApprovalPayload(
  payload: Record<string, unknown>,
): Promise<void> {
  const { action, target_table, target_id, data } =
    payload as unknown as ApprovalPayload;

  if (!action || !target_table) {
    throw new Error("Payload thiếu action hoặc target_table");
  }

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
      const card = data.card as unknown as TavernCardV2;
      const ownerId = data.owner_id as string;
      const isPublic = data.is_public as boolean;
      const avatarUrl = (data.avatar_url as string) || null;
      await createCharacter(card, ownerId, isPublic, undefined, avatarUrl);
      break;
    }
    default:
      throw new Error(`Unknown action: ${action}`);
  }
}
