import { supabase } from "@/integrations/supabase/client";

let cachedPrompt: string | null = null;

export async function fetchGlobalSystemPrompt(): Promise<string> {
  if (cachedPrompt !== null) return cachedPrompt;
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

// ─── Type-Specific System Prompts & Post-History ────────────

let cachedPromptTypeA: string | null = null;
let cachedPromptTypeB: string | null = null;
let cachedPostHistoryTypeA: string | null = null;
let cachedPostHistoryTypeB: string | null = null;

/** Helper: upsert a global_settings row (try update, then insert) */
async function upsertGlobalSetting(key: string, value: string): Promise<void> {
  const { data } = await supabase
    .from("global_settings")
    .select("key")
    .eq("key", key)
    .single();
  if (data) {
    const { error } = await supabase
      .from("global_settings")
      .update({ value, updated_at: new Date().toISOString() })
      .eq("key", key);
    if (error) throw error;
  } else {
    const { error } = await supabase
      .from("global_settings")
      .insert({ key, value });
    if (error) throw error;
  }
}

/** Helper: fetch a single global setting by key */
async function fetchGlobalSetting(key: string): Promise<string> {
  const { data } = await supabase
    .from("global_settings")
    .select("value")
    .eq("key", key)
    .maybeSingle();
  return data?.value ?? "";
}

// Type A System Prompt
export async function fetchGlobalPromptTypeA(): Promise<string> {
  if (cachedPromptTypeA !== null) return cachedPromptTypeA;
  cachedPromptTypeA = await fetchGlobalSetting("global_system_prompt_type_a");
  return cachedPromptTypeA;
}
export function getGlobalPromptTypeA(): string { return cachedPromptTypeA ?? ""; }
export async function saveGlobalPromptTypeA(value: string): Promise<void> {
  await upsertGlobalSetting("global_system_prompt_type_a", value);
  cachedPromptTypeA = value;
}

// Type B System Prompt
export async function fetchGlobalPromptTypeB(): Promise<string> {
  if (cachedPromptTypeB !== null) return cachedPromptTypeB;
  cachedPromptTypeB = await fetchGlobalSetting("global_system_prompt_type_b");
  return cachedPromptTypeB;
}
export function getGlobalPromptTypeB(): string { return cachedPromptTypeB ?? ""; }
export async function saveGlobalPromptTypeB(value: string): Promise<void> {
  await upsertGlobalSetting("global_system_prompt_type_b", value);
  cachedPromptTypeB = value;
}

// Type A Post-History Instructions
export async function fetchGlobalPostHistoryTypeA(): Promise<string> {
  if (cachedPostHistoryTypeA !== null) return cachedPostHistoryTypeA;
  cachedPostHistoryTypeA = await fetchGlobalSetting("global_post_history_type_a");
  return cachedPostHistoryTypeA;
}
export function getGlobalPostHistoryTypeA(): string { return cachedPostHistoryTypeA ?? ""; }
export async function saveGlobalPostHistoryTypeA(value: string): Promise<void> {
  await upsertGlobalSetting("global_post_history_type_a", value);
  cachedPostHistoryTypeA = value;
}

// Type B Post-History Instructions
export async function fetchGlobalPostHistoryTypeB(): Promise<string> {
  if (cachedPostHistoryTypeB !== null) return cachedPostHistoryTypeB;
  cachedPostHistoryTypeB = await fetchGlobalSetting("global_post_history_type_b");
  return cachedPostHistoryTypeB;
}
export function getGlobalPostHistoryTypeB(): string { return cachedPostHistoryTypeB ?? ""; }
export async function saveGlobalPostHistoryTypeB(value: string): Promise<void> {
  await upsertGlobalSetting("global_post_history_type_b", value);
  cachedPostHistoryTypeB = value;
}

/** Batch-fetch all prompt settings (call on app startup) */
export async function fetchAllPrompts(): Promise<void> {
  await Promise.all([
    fetchGlobalSystemPrompt(),
    fetchGlobalPromptTypeA(),
    fetchGlobalPromptTypeB(),
    fetchGlobalPostHistoryTypeA(),
    fetchGlobalPostHistoryTypeB(),
    fetchCharGenBrainstorm(),
    fetchCharGenClone(),
    fetchCharGenFormat(),
    fetchMemoryArchivist(),
    fetchNsfwGatePrompt(),
    fetchNsfwJailbreakPrompt(),
    fetchResponseStyles(),
  ]);
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
  max_tokens: number;
}

export const DEFAULT_MAX_TOKENS = 1500;

const DEFAULT_SAMPLING_PARAMS: SamplingParameters = {
  temperature: 0.7,
  top_p: 0.9,
  top_k: 40,
  repetition_penalty: 1.0,
  max_tokens: DEFAULT_MAX_TOKENS,
};

let cachedSamplingParams: SamplingParameters | null = null;

export async function fetchSamplingParameters(): Promise<SamplingParameters> {
  const { data } = await supabase
    .from("global_settings")
    .select("value")
    .eq("key", "sampling_parameters")
    .single();
  const value = data?.value ? JSON.parse(data.value) : DEFAULT_SAMPLING_PARAMS;
  // Backward compat: add max_tokens if missing from stored config
  if (value.max_tokens === undefined) value.max_tokens = DEFAULT_MAX_TOKENS;
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

// ─── Character Generation Prompts ─────────────────────────────

const DEFAULT_CHAR_GEN_BRAINSTORM = `Bạn là "VietRP Creative Writer", một AI chuyên thiết kế nhân vật cho thể loại roleplay dựa trên văn bản.

Nhiệm vụ: Nhận ý tưởng ngắn từ người dùng và mở rộng thành một hồ sơ nhân vật CHI TIẾT, viết hoàn toàn bằng tiếng Việt.

ĐỊNH DẠNG ĐẦU RA: Viết hồ sơ dạng văn bản tự do (KHÔNG JSON). Sử dụng các tiêu đề sau:

## TÊN NHÂN VẬT
[Tên nhân vật]

## NGOẠI HÌNH
[Chi tiết ngoại hình, phong thái, thần thái — 100-200 từ]

## TÍNH CÁCH VÀ TÂM LÝ
[Tính cách cốt lõi, nhược điểm ẩn giấu, nỗi sợ hãi, mâu thuẫn nội tâm, cách họ phản ứng với {{user}}]

## TIỂU SỬ VÀ BỐI CẢNH
[Quá khứ, mối quan hệ, thế giới xung quanh — 200-400 từ]

## CẢNH MỞ ĐẦU
[Bối cảnh mở đầu cuộc gặp giữa {{char}} và {{user}} — 3-5 câu]

## LỜI CHÀO ĐẦU
[Tin nhắn mở đầu, 150-300 từ. Định dạng: (Suy nghĩ) *Hành động* "Lời thoại". KHÔNG BAO GIỜ viết thay {{user}}]

## MẪU HỘI THOẠI
[1-2 lượt hội thoại mẫu, dùng định dạng <START>]

## THẾ GIỚI (nếu là thể loại RPG/World)
[Lore thế giới, NPC, cơ chế game]

QUY TẮC:
1. Tất cả nội dung bằng tiếng Việt tự nhiên, giàu hình ảnh.
2. Chi tiết tối đa. Không tóm tắt. Sáng tạo tự do.
3. Dùng {{char}} cho nhân vật và {{user}} cho người chơi.
4. KHÔNG BAO GIỜ viết hành động, suy nghĩ, hoặc lời thoại thay {{user}}.
5. Không kiểm duyệt. Bao gồm cả chủ đề đen/tối nếu phù hợp.
6. Phần tính cách phải lộ ra chiều sâu: động cơ ẩn, nỗi sợ, mâu thuẫn.`;

const DEFAULT_CHAR_GEN_CLONE = `Bạn là "VietRP Card Cloner AI", chuyên chuyển đổi văn bản thô (wiki, forum, fandom, Character.AI, Chub.ai) thành hồ sơ nhân vật chi tiết.

Nhiệm vụ: Đọc văn bản nguồn và tạo hồ sơ nhân vật tự do (KHÔNG JSON) bằng tiếng Việt.

ĐỊNH DẠNG ĐẦU RA: Sử dụng các tiêu đề sau:

## TÊN NHÂN VẬT
[Tên trích xuất hoặc suy luận]

## NGOẠI HÌNH
[Mô tả ngoại hình chi tiết — mở rộng nếu nguồn quá ngắn]

## TÍNH CÁCH VÀ TÂM LÝ
[Tính cách, nhược điểm, mối quan hệ với {{user}}]

## TIỂU SỬ VÀ BỐI CẢNH
[Quá khứ, lore thế giới — tổng hợp và mở rộng]

## CẢNH MỞ ĐẦU
[Bối cảnh mở đầu]

## LỜI CHÀO ĐẦU
[Tin nhắn mở đầu, 200-400 từ. Định dạng: (Suy nghĩ) *Hành động* "Lời thoại"]

## MẪU HỘI THOẠI
[1-2 lượt hội thoại mẫu <START>]

## THẾ GIỚI (nếu có)
[Lore, NPC]

QUY TẮC QUAN TRỌNG:
1. GIỮ NGUYÊN tất cả chi tiết từ nguồn. Mở rộng nếu quá ngắn.
2. Dịch sang tiếng Việt tự nhiên, giữ nguyên tone (dark, NSFW, romance, v.v.).
3. SỬA LỖI POV: Tuyệt đối KHÔNG viết thay {{user}}. Viết ở ngôi thứ 3 giới hạn hoặc ngôi thứ 1 (của {{char}}).
4. Dùng {{char}} cho nhân vật, {{user}} cho người chơi.
5. Không kiểm duyệt. Giữ nguyên chủ đề NSFW/tối nếu có trong nguồn.`;

const DEFAULT_CHAR_GEN_FORMAT = `Bạn là một trình tạo JSON chính xác. Nhiệm vụ duy nhất là chuyển đổi hồ sơ nhân vật thành JSON chara_card_v2 hợp lệ.

Chỉ xuất JSON thuần bắt đầu bằng { và kết thúc bằng }. Không markdown, không giải thích.

JSON phải có cấu trúc chính xác:
{
  "spec": "chara_card_v2",
  "spec_version": "2.0",
  "data": {
    "name": "...",
    "description": "...",
    "personality": "...",
    "scenario": "...",
    "first_mes": "...",
    "mes_example": "...",
    "system_prompt": "...",
    "post_history_instructions": "...",
    "alternate_greetings": ["..."],
    "character_book": [],
    "tags": ["..."],
    "creator": "VietRP Charagen AI",
    "creator_notes": "Generated dynamically by VietRP Charagen AI.",
    "character_version": "1.0",
    "extensions": {}
  }
}

ÁNH XẠ TRƯỜNG từ hồ sơ:
- "name": Từ section TÊN NHÂN VẬT.
- "description": Gộp NGOẠI HÌNH + TIỂU SỬ VÀ BỐI CẢNH (300-500 từ).
- "personality": Từ TÍNH CÁCH VÀ TÂM LÝ.
- "scenario": Từ CẢNH MỞ ĐẦU.
- "first_mes": Từ LỜI CHÀO ĐẦU. Định dạng: (Suy nghĩ) *Hành động* "Lời thoại". KHÔNG viết thay {{user}}.
- "mes_example": Từ MẪU HỘI THOẠI. Dùng định dạng <START>.
- "system_prompt": "Bạn là {{char}}. [tóm tắt tính cách]. Luôn giữ vai trò. Không bao giờ viết thay {{user}}. Phản hồi tự nhiên, bám sát tính cách."
- "post_history_instructions": PHẢI bao gồm ĐẦY ĐỦ 5 chỉ dẫn (gộp thành 1 đoạn):
  1. Giữ format: (Suy nghĩ) *Hành động* "Lời thoại". Tối đa 1-3 thành phần mỗi phản hồi.
  2. Giữ vững tính cách và vai trò của {{char}}. Không bao giờ hành động, suy nghĩ, hoặc nói thay {{user}}.
  3. Quan sát giọng văn và phong cách viết của {{user}}. Tự động điều chỉnh nhưng LUÔN giữ giọng riêng của {{char}}.
  4. Phản ánh đúng cảm xúc của {{char}} trước hành động {{user}} — tự nhiên và nhất quán.
  5. Đẩy câu chuyện tiến triển. Mỗi phản hồi mở ra tình huống mới — không lặp lại.
- "tags": 5-10 tag liên quan.
- "alternate_greetings": 2-3 lời chào thay thế (bối cảnh/tone khác nhau).
- "character_book": [] (trừ khi là thế giới multi-character, tạo 2-3 entries).
- Cố định: "creator": "VietRP Charagen AI", "character_version": "1.0", "spec": "chara_card_v2", "spec_version": "2.0".

QUY TẮC JSON NGHIÊM NGẶT:
- Chuỗi phải escape đúng (\\n cho newline, \\" cho dấu nháy trong).
- Không có dấu phẩy thừa.
- Tất cả nội dung sáng tạo bằng tiếng Việt.
- alternate_greetings phải có ít nhất 1 mục.`;

let cachedCharGenBrainstorm: string | null = null;
let cachedCharGenClone: string | null = null;
let cachedCharGenFormat: string | null = null;

export async function fetchCharGenBrainstorm(): Promise<string> {
  if (cachedCharGenBrainstorm !== null) return cachedCharGenBrainstorm;
  const val = await fetchGlobalSetting("char_gen_brainstorm");
  cachedCharGenBrainstorm = val || DEFAULT_CHAR_GEN_BRAINSTORM;
  return cachedCharGenBrainstorm;
}
export function getCharGenBrainstorm(): string { return cachedCharGenBrainstorm ?? DEFAULT_CHAR_GEN_BRAINSTORM; }
export async function saveCharGenBrainstorm(value: string): Promise<void> {
  await upsertGlobalSetting("char_gen_brainstorm", value);
  cachedCharGenBrainstorm = value;
}

export async function fetchCharGenClone(): Promise<string> {
  if (cachedCharGenClone !== null) return cachedCharGenClone;
  const val = await fetchGlobalSetting("char_gen_clone");
  cachedCharGenClone = val || DEFAULT_CHAR_GEN_CLONE;
  return cachedCharGenClone;
}
export function getCharGenClone(): string { return cachedCharGenClone ?? DEFAULT_CHAR_GEN_CLONE; }
export async function saveCharGenClone(value: string): Promise<void> {
  await upsertGlobalSetting("char_gen_clone", value);
  cachedCharGenClone = value;
}

export async function fetchCharGenFormat(): Promise<string> {
  if (cachedCharGenFormat !== null) return cachedCharGenFormat;
  const val = await fetchGlobalSetting("char_gen_format");
  cachedCharGenFormat = val || DEFAULT_CHAR_GEN_FORMAT;
  return cachedCharGenFormat;
}
export function getCharGenFormat(): string { return cachedCharGenFormat ?? DEFAULT_CHAR_GEN_FORMAT; }
export async function saveCharGenFormat(value: string): Promise<void> {
  await upsertGlobalSetting("char_gen_format", value);
  cachedCharGenFormat = value;
}

// ─── Memory Archivist Prompt ──────────────────────────────────

const DEFAULT_MEMORY_ARCHIVIST = `You are a Roleplay Memory Archivist. Your job is to read a roleplay log and create a highly compressed, factual, and chronological summary of the relationship and events.

You MUST capture the following critical elements:
1. RELATIONSHIP MILESTONES: Note specific shifts in intimacy (e.g., "they had their first kiss", "they had sex for the first time", "they confessed love", "User discovered Char's secret").
2. PHYSICAL/EMOTIONAL BOUNDARIES: How comfortable are they with each other right now? (e.g., "Char is no longer shy about physical touch", "User is acting dominant", "They are currently hostile").
3. KEY PLOT POINTS: What actually happened, locations visited, promises made, or items acquired.

Format the output strictly as a bulleted list. Be concise but do not omit emotional tension or NSFW relationship developments.`;

let cachedMemoryArchivist: string | null = null;

export async function fetchMemoryArchivist(): Promise<string> {
  if (cachedMemoryArchivist !== null) return cachedMemoryArchivist;
  const val = await fetchGlobalSetting("memory_archivist");
  cachedMemoryArchivist = val || DEFAULT_MEMORY_ARCHIVIST;
  return cachedMemoryArchivist;
}
export function getMemoryArchivist(): string { return cachedMemoryArchivist ?? DEFAULT_MEMORY_ARCHIVIST; }
export async function saveMemoryArchivist(value: string): Promise<void> {
  await upsertGlobalSetting("memory_archivist", value);
  cachedMemoryArchivist = value;
}

// ─── NSFW Gate Prompt ─────────────────────────────────────────

const DEFAULT_NSFW_GATE_PROMPT = "[System Note: NSFW/Sexual/Violence/Gore content is strictly forbidden. Keep all responses safe for work. Fade to black for any intimate scenes.]";

let cachedNsfwGatePrompt: string | null = null;

export async function fetchNsfwGatePrompt(): Promise<string> {
  if (cachedNsfwGatePrompt !== null) return cachedNsfwGatePrompt;
  const val = await fetchGlobalSetting("nsfw_gate_prompt");
  cachedNsfwGatePrompt = val || DEFAULT_NSFW_GATE_PROMPT;
  return cachedNsfwGatePrompt;
}
export function getNsfwGatePrompt(): string { return cachedNsfwGatePrompt ?? DEFAULT_NSFW_GATE_PROMPT; }
export async function saveNsfwGatePrompt(value: string): Promise<void> {
  await upsertGlobalSetting("nsfw_gate_prompt", value);
  cachedNsfwGatePrompt = value;
}

// ─── NSFW Jailbreak Prompt (injected at top when NSFW enabled) ─

const DEFAULT_NSFW_JAILBREAK_PROMPT = "";

let cachedNsfwJailbreakPrompt: string | null = null;

export async function fetchNsfwJailbreakPrompt(): Promise<string> {
  if (cachedNsfwJailbreakPrompt !== null) return cachedNsfwJailbreakPrompt;
  const val = await fetchGlobalSetting("nsfw_jailbreak_prompt");
  cachedNsfwJailbreakPrompt = val || DEFAULT_NSFW_JAILBREAK_PROMPT;
  return cachedNsfwJailbreakPrompt;
}
export function getNsfwJailbreakPrompt(): string { return cachedNsfwJailbreakPrompt ?? DEFAULT_NSFW_JAILBREAK_PROMPT; }
export async function saveNsfwJailbreakPrompt(value: string): Promise<void> {
  await upsertGlobalSetting("nsfw_jailbreak_prompt", value);
  cachedNsfwJailbreakPrompt = value;
}

// ─── Response Styles ──────────────────────────────────────────

export interface ResponseStyle {
  value: string;
  label: string;
  prompt: string;
}

const DEFAULT_RESPONSE_STYLES: ResponseStyle[] = [
  { value: "none", label: "Mặc định (không thêm)", prompt: "" },
  {
    value: "short",
    label: "Trả lời ngắn gọn, thẳng chủ đề",
    prompt: "[System Note: Write a short, direct response. Avoid unnecessary fluff or overly long descriptions.]",
  },
  {
    value: "detailed",
    label: "Trả lời sâu, mô tả kĩ càng",
    prompt: "[System Note: Write a highly detailed response. Emphasize sensory details, deep internal thoughts, and elaborate physical actions.]",
  },
  {
    value: "match_char",
    label: "Trả lời theo tin nhắn đầu tiên của {{char}}",
    prompt: "[System Note: Strictly match the tone, length, and formatting style of {{char}}'s first message.]",
  },
  {
    value: "match_user",
    label: "Trả lời theo tin nhắn đầu tiên của {{user}}",
    prompt: "[System Note: Strictly match the tone, length, and formatting style of the user's first message.]",
  },
];

let cachedResponseStyles: ResponseStyle[] | null = null;

export async function fetchResponseStyles(): Promise<ResponseStyle[]> {
  if (cachedResponseStyles !== null) return cachedResponseStyles;
  const val = await fetchGlobalSetting("response_styles");
  if (val) {
    try {
      cachedResponseStyles = JSON.parse(val) as ResponseStyle[];
    } catch {
      cachedResponseStyles = DEFAULT_RESPONSE_STYLES;
    }
  } else {
    cachedResponseStyles = DEFAULT_RESPONSE_STYLES;
  }
  return cachedResponseStyles;
}
export function getCachedResponseStyles(): ResponseStyle[] {
  return cachedResponseStyles ?? DEFAULT_RESPONSE_STYLES;
}
export async function saveResponseStyles(styles: ResponseStyle[]): Promise<void> {
  await upsertGlobalSetting("response_styles", JSON.stringify(styles));
  cachedResponseStyles = styles;
}
