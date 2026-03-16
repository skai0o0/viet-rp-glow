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
    description: "Mở rộng role (op), bảng credits, approval, usage_logs, subscription_plans",
    status: "done",
    details: [
      "ALTER TYPE app_role ADD VALUE 'op'",
      "Bảng user_credits: user_id, balance, updated_at",
      "Bảng credit_transactions: user_id, amount, type (purchase/subscription/usage/admin_grant), description",
      "Bảng subscription_plans: id, name, price, monthly_credits, perks (JSON), is_active",
      "Bảng user_subscriptions: user_id, plan_id, status, current_period_start, current_period_end",
      "Bảng credit_packages: id, name, credits, price, is_active (gói credit mua lẻ)",
      "Bảng usage_logs: user_id, feature, credits_used, metadata, created_at",
      "Bảng pending_approvals: id, user_id, type (card_create/admin_edit), payload (JSON), status (pending/approved/rejected), reviewer_id, created_at",
      "User tự quản lý API key riêng (lưu localStorage) — KHÔNG cần platform API key",
    ],
  },
  {
    id: 2,
    title: "Phân quyền Admin Hub",
    description: "Admin có toàn quyền, Operator xem + chỉnh sửa nhưng cần admin duyệt",
    status: "done",
    details: [
      "[Admin] Toàn quyền chỉnh sửa mọi thứ trong Admin Hub",
      "[Operator] Truy cập Admin Hub, xem tất cả dữ liệu",
      "[Operator] Có thể chỉnh sửa nhưng khi submit → tạo pending_approval",
      "[Admin] Nhận thông báo (badge) + duyệt/từ chối + auto-apply yêu cầu từ Operator",
      "Trang Approval Queue trong Admin Hub (admin thấy tất cả, op thấy của mình)",
      "NavigationRail hiện Admin Hub cho op (màu khác biệt) + badge pending count",
      "useUserRole() trả 4 role: user, moderator, op, admin",
      "approvalService: createApproval + applyApprovalPayload cho 11 loại action",
    ],
  },
  {
    id: 3,
    title: "BYOK Chat — Tất cả User",
    description: "Mọi user tự nhập API Key OpenRouter để chat, tự do tài chính, dùng model free/paid",
    status: "done",
    details: [
      "User nhập OpenRouter API key trong Settings → lưu localStorage",
      "streamChat() gọi trực tiếp OpenRouter bằng API key của user",
      "Admin quản lý danh sách allowed_models (đã có sẵn)",
      "User có thể dùng model miễn phí (free tier) → chat không tốn tiền",
      "Hướng dẫn step-by-step tạo API key OpenRouter trong Settings (collapsible guide)",
      "Validate API key trước khi cho phép chat (auto-verify on first send + cached)",
      "Key verified state lưu localStorage, tự reset khi đổi key",
    ],
  },
  {
    id: 4,
    title: "Card Creation & Hệ thống duyệt",
    description: "User tạo tối đa 3 cards/ngày → gửi duyệt, Operator & Admin duyệt",
    status: "planned",
    details: [
      "[User] Tạo card thủ công: tối đa 3 cards/ngày (reset 00:00)",
      "[User] Card sau khi tạo → trạng thái 'pending' → gửi duyệt",
      "[Operator + Admin] Xem danh sách card pending, duyệt/từ chối + lý do",
      "[User] Lorebook: sử dụng tự do, không giới hạn",
      "Bảng daily_card_usage: user_id, date, count (tracking giới hạn ngày)",
      "Card được duyệt → public trên Hub, bị từ chối → thông báo + cho sửa lại",
    ],
  },
  {
    id: 5,
    title: "Hệ thống Credit & Tính năng Premium",
    description: "Credit dùng cho tính năng AI cao cấp — không liên quan đến chat",
    status: "planned",
    details: [
      "🔮 Tạo card bằng AI (chuyển từ Admin Hub → user, tốn credit/lần)",
      "🔮 Clone card bằng AI — tạo biến thể nhân vật từ card có sẵn (credit/lần)",
      "🔮 AI ghi chú diễn biến chat — tự động tóm tắt sự kiện quan trọng (sắp có)",
      "🔮 Tóm tắt cuộc chat bằng AI — khi chat quá dài, AI bắt đầu quên (credit/lần, sắp có)",
      "Edge Function xử lý tính năng tốn credit → check balance → thực hiện → trừ credit + log",
      "Bảng giá credit mỗi tính năng (admin cấu hình trong global_settings)",
      "Toast thông báo khi hết credit, hiện nút mua thêm",
      "Lịch sử sử dụng credit chi tiết (theo tính năng)",
    ],
  },
  {
    id: 6,
    title: "Subscription & Mua Credit",
    description: "Subscription = credit hàng tháng + quyền lợi. Mua credit lẻ riêng biệt.",
    status: "planned",
    details: [
      "Gói Free: 0 credit/tháng, giới hạn cơ bản",
      "Gói Basic / Pro: monthly_credits + perks (badge, ưu tiên duyệt card, v.v.)",
      "Tự động cấp credit hàng tháng khi subscription active (cron/webhook)",
      "Credit packages mua lẻ: VD 100cr = 20k, 500cr = 80k (tiết kiệm hơn)",
      "Tích hợp thanh toán (MoMo/VNPAY/chuyển khoản) hoặc admin duyệt manual",
      "Credit không hết hạn, cộng dồn từ subscription + mua lẻ",
      "~[Pro/VIP — pending] Nâng giới hạn tạo card: 5–10 cards/ngày",
      "~[Pro/VIP — pending] Badge đặc biệt hiển thị trên profile & chat",
      "~[Pro/VIP — pending] Ưu tiên duyệt card (duyệt nhanh hơn)",
      "~[Pro/VIP — pending] Truy cập sớm tính năng mới (early access)",
      "~[Pro/VIP — pending] Giảm giá credit khi mua lẻ (VD: -10% cho Pro, -20% VIP)",
      "~[Pro/VIP — pending] Model premium exclusive (nếu có)",
    ],
  },
  {
    id: 7,
    title: "Frontend — Phân quyền & UI theo Role",
    description: "Hook useUserRole(), useUserCredits(), UI phân quyền đầy đủ",
    status: "planned",
    details: [
      "Hook useUserRole() → trả role + subscription info",
      "Hook useUserCredits() → trả credit balance, lịch sử",
      "Settings: API key (BYOK) + credit balance + gói subscription",
      "[User] Navbar cơ bản: Home, Hub, Chat, Create, Profile, Settings",
      "[Op] Navbar thêm: Admin Hub (màu khác), Approval Queue",
      "[Admin] Navbar đầy đủ + toàn quyền",
      "ChatPage: badge model, toast khi API key invalid",
      "CreatePage: hiện đếm số card còn lại trong ngày",
    ],
  },
  {
    id: 8,
    title: "Subscription & Credit Management UI",
    description: "Trang /subscription cho user, admin quản lý subscribers & credit",
    status: "planned",
    details: [
      "Trang /subscription: xem gói hiện tại, credit balance, lịch sử giao dịch",
      "Mua gói subscription hoặc credit lẻ tại trang này",
      "Admin Hub: Subscription Manager — quản lý gói, xem subscribers",
      "Admin Hub: Credit Manager — tặng/trừ credit, xem lịch sử",
      "Admin Hub: Credit Packages — tạo/sửa gói credit mua lẻ",
      "Admin Hub: Approval Dashboard — duyệt card + chỉnh sửa từ Operator",
      "Notification khi subscription sắp hết hạn hoặc credit thấp",
    ],
  },
  {
    id: 9,
    title: "Polish & Monitoring",
    description: "Dashboard, analytics, UX polish",
    status: "planned",
    details: [
      "Dashboard doanh thu: subscription + credit purchases",
      "Thống kê credit usage theo tính năng (AI gen, tóm tắt, v.v.)",
      "Thống kê card approval rate, thời gian duyệt trung bình",
      "UX polish: onboarding BYOK, credit purchase flow, approval flow",
      "Webhook/cron tự động gia hạn subscription + cấp credit",
      "~[Pro/VIP — pending] Trang Pro/VIP showcase với perks chi tiết",
      "~[Pro/VIP — pending] So sánh gói Free vs Pro vs VIP",
    ],
  },
  {
    id: 10,
    title: "World System & Lorebook Orchestration",
    description: "Thêm World với Rule cứng, lorebook bật/tắt theo World, card trực thuộc có context mặc định",
    status: "planned",
    details: [
      "World = context cứng theo bộ Rule (always-on), đóng vai trò hệ luật nền",
      "Mỗi World có danh sách Lorebook attach sẵn và bật/tắt theo toggle",
      "Card trực thuộc World có context mặc định kế thừa từ World + override riêng của card",
      "User vẫn có quyền thêm/bớt Lorebook khi chat và lưu preset cá nhân",
      "Cho phép chuyển card sang World khác (map lại Rule/Lorebook mặc định, giữ bản override an toàn)",
      "Thiết kế xung đột ưu tiên context: Card override > User session override > World Rule",
      "Admin Hub: CRUD World, quản lý Rule, quản lý pool Lorebook theo từng World",
      "Migration dự kiến: worlds, world_rules, world_lorebooks, character_world_links",
      "Theo dõi analytics: tỉ lệ bật/tắt lorebook, hiệu quả theo World, retention theo World",
    ],
  },
];

const REQUIRED_WORLD_PHASE: PlanPhase = {
  id: 10,
  title: "World System & Lorebook Orchestration",
  description: "Thêm World với Rule cứng, lorebook bật/tắt theo World, card trực thuộc có context mặc định",
  status: "planned",
  details: [
    "World = context cứng theo bộ Rule (always-on), đóng vai trò hệ luật nền",
    "Mỗi World có danh sách Lorebook attach sẵn và bật/tắt theo toggle",
    "Card trực thuộc World có context mặc định kế thừa từ World + override riêng của card",
    "User vẫn có quyền thêm/bớt Lorebook khi chat và lưu preset cá nhân",
    "Cho phép chuyển card sang World khác (map lại Rule/Lorebook mặc định, giữ bản override an toàn)",
    "Thiết kế xung đột ưu tiên context: Card override > User session override > World Rule",
    "Admin Hub: CRUD World, quản lý Rule, quản lý pool Lorebook theo từng World",
    "Migration dự kiến: worlds, world_rules, world_lorebooks, character_world_links",
    "Theo dõi analytics: tỉ lệ bật/tắt lorebook, hiệu quả theo World, retention theo World",
  ],
};

function ensureWorldPhase(plan: PlanPhase[]): PlanPhase[] {
  const hasWorld = plan.some((phase) => {
    const t = phase.title.toLowerCase();
    return t.includes("world") || t.includes("lorebook");
  });

  if (hasWorld) return plan;

  const maxId = plan.reduce((max, phase) => Math.max(max, phase.id), 0);
  return [...plan, { ...REQUIRED_WORLD_PHASE, id: Math.max(maxId + 1, REQUIRED_WORLD_PHASE.id) }];
}

export async function fetchSubscriptionPlan(): Promise<PlanPhase[]> {
  const { data } = await supabase
    .from("global_settings")
    .select("value")
    .eq("key", "subscription_plan")
    .single();
  if (data?.value) {
    try {
      return ensureWorldPhase(JSON.parse(data.value) as PlanPhase[]);
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
