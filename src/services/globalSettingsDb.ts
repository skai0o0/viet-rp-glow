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

// ─── Subscription Plan Board ────────────────────────────────

export type PlanPhaseStatus = "planned" | "in-progress" | "done";

export interface PlanPhase {
  id: number;
  title: string;
  description: string;
  status: PlanPhaseStatus;
  details: string[];
}

const DEFAULT_PLAN: PlanPhase[] = [
  {
    id: 1,
    title: "Database & Roles",
    description: "Mở rộng role (op), bảng subscriptions, usage_logs, subscription_plans",
    status: "planned",
    details: [
      "ALTER TYPE app_role ADD VALUE 'op'",
      "Bảng subscriptions: user_id, plan, credits, expires_at",
      "Bảng usage_logs: tracking token & cost",
      "Bảng subscription_plans: admin định nghĩa gói",
      "Platform API key trong global_settings (encrypted)",
    ],
  },
  {
    id: 2,
    title: "Backend Proxy (Edge Function)",
    description: "Edge Function chat-proxy xử lý subscription, rate limit, streaming",
    status: "planned",
    details: [
      "Supabase Edge Function 'chat-proxy'",
      "Check credits → gọi OpenRouter bằng platform key",
      "Trừ credits + log usage sau mỗi request",
      "Rate limit theo plan",
      "Forward SSE stream về client",
    ],
  },
  {
    id: 3,
    title: "Frontend: BYOK vs Subscription",
    description: "Phân luồng streamChat(), SettingsPage, ChatPage theo role",
    status: "planned",
    details: [
      "Hook useUserRole() trả role + subscription info",
      "streamChat() phân nhánh: user→proxy, op/admin→BYOK",
      "SettingsPage: user ẩn API key, hiện gói + credits",
      "ChatPage badge BYOK/Sub, toast hết credits",
    ],
  },
  {
    id: 4,
    title: "Role Operator (op)",
    description: "Role op: xem admin read-only, dùng BYOK",
    status: "planned",
    details: [
      "op được truy cập Admin Hub (read-only)",
      "op dùng BYOK giống admin",
      "useIsAdmin → useUserRole trả 3 role",
      "Nút chỉnh sửa chỉ hiện cho admin",
      "NavigationRail hiện Admin Hub cho op (màu khác)",
    ],
  },
  {
    id: 5,
    title: "Subscription Management UI",
    description: "Trang /subscription cho user, admin quản lý subscribers",
    status: "planned",
    details: [
      "Trang /subscription: xem gói, credits, lịch sử",
      "Admin: Subscription Manager trong Admin Hub",
      "Tặng/trừ credits, thay đổi plan",
      "Tích hợp thanh toán (MoMo/VNPAY) hoặc manual",
    ],
  },
  {
    id: 6,
    title: "Polish & Monitoring",
    description: "Dashboard chi phí, budget alert, UX polish",
    status: "planned",
    details: [
      "Dashboard chi phí realtime cho admin",
      "Budget alert trên OpenRouter",
      "Giới hạn model theo plan",
      "UX polish cho flow subscription",
    ],
  },
];

export async function fetchSubscriptionPlan(): Promise<PlanPhase[]> {
  const { data } = await supabase
    .from("global_settings")
    .select("value")
    .eq("key", "subscription_plan")
    .single();
  if (data?.value) {
    try {
      return JSON.parse(data.value) as PlanPhase[];
    } catch {
      return DEFAULT_PLAN;
    }
  }
  return DEFAULT_PLAN;
}

export async function saveSubscriptionPlan(plan: PlanPhase[]): Promise<void> {
  const value = JSON.stringify(plan);
  // Upsert: try update first, if no row then insert
  const { data } = await supabase
    .from("global_settings")
    .select("key")
    .eq("key", "subscription_plan")
    .single();
  if (data) {
    const { error } = await supabase
      .from("global_settings")
      .update({ value, updated_at: new Date().toISOString() })
      .eq("key", "subscription_plan");
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("global_settings")
      .insert({ key: "subscription_plan", value });
    if (error) throw error;
  }
}

// ─── Sampling Parameters ────────────────────────────────────

export interface SamplingParameters {
  temperature: number;
  top_p: number;
  top_k: number;
  repetition_penalty: number;
}

const DEFAULT_SAMPLING_PARAMS: SamplingParameters = {
  temperature: 0.7,
  top_p: 0.9,
  top_k: 40,
  repetition_penalty: 1.0,
};

let cachedSamplingParams: SamplingParameters | null = null;

export async function fetchSamplingParameters(): Promise<SamplingParameters> {
  const { data } = await supabase
    .from("global_settings")
    .select("value")
    .eq("key", "sampling_parameters")
    .single();
  const value = data?.value ? JSON.parse(data.value) : DEFAULT_SAMPLING_PARAMS;
  cachedSamplingParams = value;
  return value;
}

export function getCachedSamplingParameters(): SamplingParameters {
  return cachedSamplingParams ?? DEFAULT_SAMPLING_PARAMS;
}

export async function saveSamplingParameters(params: SamplingParameters): Promise<void> {
  const value = JSON.stringify(params);
  const { data } = await supabase
    .from("global_settings")
    .select("key")
    .eq("key", "sampling_parameters")
    .single();
  if (data) {
    const { error } = await supabase
      .from("global_settings")
      .update({ value, updated_at: new Date().toISOString() })
      .eq("key", "sampling_parameters");
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("global_settings")
      .insert({ key: "sampling_parameters", value });
    if (error) throw error;
  }
  cachedSamplingParams = params;
}
