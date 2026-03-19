import { OpenRouterMessage } from "@/utils/promptBuilder";
import { getCachedSamplingParameters } from "@/services/globalSettingsDb";
import { supabase } from "@/integrations/supabase/client";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
const STORAGE_KEY_API = "vietrp_openrouter_key";
const STORAGE_KEY_MODEL = "vietrp_openrouter_model";
const STORAGE_KEY_VERIFIED = "vietrp_key_verified";
const STORAGE_KEY_TIER = "vietrp_selected_tier";

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const CHAT_PROXY_URL = `${SUPABASE_URL}/functions/v1/chat-proxy`;

// Fallback models if API fetch fails
export const AVAILABLE_MODELS = [
  { id: "nousresearch/nous-hermes-2-mixtral-8x7b-dpo", label: "Nous Hermes 2 Mixtral 8x7B" },
  { id: "anthropic/claude-3-haiku", label: "Claude 3 Haiku" },
  { id: "google/gemini-pro", label: "Gemini Pro" },
  { id: "gryphe/mythomax-l2-13b", label: "MythoMax L2 13B" },
] as const;

export interface OpenRouterModel {
  id: string;
  name: string;
  pricing?: {
    prompt?: string;
    completion?: string;
  };
}

export function getApiKey(): string {
  return localStorage.getItem(STORAGE_KEY_API) || "";
}

export function setApiKey(key: string) {
  const old = localStorage.getItem(STORAGE_KEY_API);
  localStorage.setItem(STORAGE_KEY_API, key);
  if (key !== old) localStorage.removeItem(STORAGE_KEY_VERIFIED);
}

export function isKeyVerified(): boolean {
  return localStorage.getItem(STORAGE_KEY_VERIFIED) === "true";
}

export function markKeyVerified() {
  localStorage.setItem(STORAGE_KEY_VERIFIED, "true");
}

export function getModel(): string {
  return localStorage.getItem(STORAGE_KEY_MODEL) || AVAILABLE_MODELS[0].id;
}

export function setModel(model: string) {
  localStorage.setItem(STORAGE_KEY_MODEL, model);
}

// ─── Tier selection (for subscription users) ────────────────

export interface ModelTier {
  id: string;
  tier_key: string;
  display_name: string;
  description: string;
  model_id: string;
  min_subscription: string;
  sort_order: number;
  is_active: boolean;
}

export function getSelectedTier(): string {
  return localStorage.getItem(STORAGE_KEY_TIER) || "free";
}

export function setSelectedTier(tier: string) {
  localStorage.setItem(STORAGE_KEY_TIER, tier);
}

let cachedTiers: ModelTier[] | null = null;

export async function fetchModelTiers(): Promise<ModelTier[]> {
  const { data, error } = await supabase
    .from("model_tiers")
    .select("*")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });
  if (error) {
    console.warn("fetchModelTiers error:", error.message);
    return cachedTiers ?? [];
  }
  cachedTiers = (data ?? []) as ModelTier[];
  return cachedTiers;
}

export function getCachedModelTiers(): ModelTier[] {
  return cachedTiers ?? [];
}

/** Verify API key by calling OpenRouter's /auth/key endpoint */
export async function verifyApiKey(key: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch("https://openrouter.ai/api/v1/auth/key", {
      headers: {
        "Authorization": `Bearer ${key}`,
      },
    });
    if (res.ok) {
      return { valid: true };
    }
    if (res.status === 401) {
      return { valid: false, error: "API Key không hợp lệ." };
    }
    return { valid: false, error: `Lỗi: ${res.status}` };
  } catch {
    return { valid: false, error: "Không thể kết nối tới OpenRouter." };
  }
}

/** Fetch all available models from OpenRouter */
export async function fetchOpenRouterModels(): Promise<OpenRouterModel[]> {
  try {
    const res = await fetch(OPENROUTER_MODELS_URL);
    if (!res.ok) return [];
    const json = await res.json();
    const models: OpenRouterModel[] = (json.data || []).map((m: any) => ({
      id: m.id,
      name: m.name || m.id,
      pricing: m.pricing,
    }));
    // Sort by name
    models.sort((a, b) => a.name.localeCompare(b.name));
    return models;
  } catch {
    return [];
  }
}

export interface StreamCallbacks {
  onDelta: (text: string) => void;
  onDone: () => void;
  onError: (error: string) => void;
}

/**
 * Stream chat completions from OpenRouter via SSE
 */
export async function streamChat(
  messages: OpenRouterMessage[],
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
  maxTokensOverride?: number
) {
  const apiKey = getApiKey();
  if (!apiKey) {
    callbacks.onError("Vui lòng nhập API Key của OpenRouter trong phần Cài Đặt.");
    return;
  }

  const model = getModel();
  const maxTokens = maxTokensOverride ?? parseInt(localStorage.getItem("vietrp_max_tokens") || "800", 10);

  try {
    // Get sampling parameters from global settings
    const samplingParams = getCachedSamplingParameters();

    const response = await fetch(OPENROUTER_API_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${apiKey}`,
        "HTTP-Referer": "https://vietrp.com",
        "X-Title": "VietRP",
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        max_tokens: maxTokens,
        temperature: samplingParams.temperature,
        top_p: samplingParams.top_p,
        top_k: samplingParams.top_k,
        repetition_penalty: samplingParams.repetition_penalty,
      }),
      signal,
    });

    if (!response.ok) {
      if (response.status === 401) {
        callbacks.onError("API Key không hợp lệ. Vui lòng kiểm tra lại trong Cài Đặt.");
        return;
      }
      if (response.status === 429) {
        callbacks.onError("Đã vượt quá giới hạn yêu cầu. Vui lòng thử lại sau.");
        return;
      }
      if (response.status === 402) {
        callbacks.onError("Tài khoản OpenRouter hết credits. Vui lòng nạp thêm.");
        return;
      }
      const errorText = await response.text();
      console.error("OpenRouter error:", response.status, errorText);
      callbacks.onError(`Lỗi từ AI: ${response.status}. Vui lòng thử lại.`);
      return;
    }

    if (!response.body) {
      callbacks.onError("Không nhận được phản hồi từ AI.");
      return;
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);

        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") {
          callbacks.onDone();
          return;
        }

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) callbacks.onDelta(content);
        } catch {
          buffer = line + "\n" + buffer;
          break;
        }
      }
    }

    // Flush remaining buffer
    if (buffer.trim()) {
      for (let raw of buffer.split("\n")) {
        if (!raw) continue;
        if (raw.endsWith("\r")) raw = raw.slice(0, -1);
        if (raw.startsWith(":") || raw.trim() === "") continue;
        if (!raw.startsWith("data: ")) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) callbacks.onDelta(content);
        } catch { /* ignore */ }
      }
    }

    callbacks.onDone();
  } catch (err: any) {
    if (err.name === "AbortError") return;
    console.error("Stream error:", err);
    callbacks.onError("Lỗi kết nối. Vui lòng kiểm tra mạng và thử lại.");
  }
}

// ─── Subscription-based proxy chat ──────────────────────────

export interface ChatQuota {
  used: number;
  limit: number;
  remaining: number;
  plan_name: string;
  tier: string;
}

export async function fetchChatQuota(): Promise<ChatQuota> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    return { used: 0, limit: 20, remaining: 20, plan_name: "Free", tier: "free" };
  }
  const { data, error } = await supabase.rpc("check_chat_quota", {
    p_user_id: session.user.id,
  } as any);
  if (error || !data) {
    console.warn("fetchChatQuota error:", error?.message);
    return { used: 0, limit: 20, remaining: 20, plan_name: "Free", tier: "free" };
  }
  return data as ChatQuota;
}

/**
 * Stream chat via Supabase Edge Function proxy (platform key).
 * Used for regular user chat; admin CharGen still uses streamChat (BYOK).
 */
export async function streamChatViaProxy(
  messages: OpenRouterMessage[],
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
  maxTokensOverride?: number,
) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    callbacks.onError("Vui lòng đăng nhập để chat.");
    return;
  }

  const tierKey = getSelectedTier();
  const maxTokens = maxTokensOverride ?? parseInt(localStorage.getItem("vietrp_max_tokens") || "800", 10);
  const samplingParams = getCachedSamplingParameters();

  try {
    const response = await fetch(CHAT_PROXY_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${session.access_token}`,
        "apikey": SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        tier_key: tierKey,
        messages,
        max_tokens: maxTokens,
        temperature: samplingParams.temperature,
        top_p: samplingParams.top_p,
        top_k: samplingParams.top_k,
        repetition_penalty: samplingParams.repetition_penalty,
      }),
      signal,
    });

    if (!response.ok) {
      const errBody = await response.json().catch(() => ({ error: "unknown" }));

      if (errBody.error === "quota_exceeded") {
        callbacks.onError("__QUOTA_EXCEEDED__");
        return;
      }
      if (errBody.error === "model_restricted" || errBody.error === "tier_restricted") {
        callbacks.onError("Tier này yêu cầu gói Pro. Vui lòng chọn tier miễn phí hoặc nâng cấp.");
        return;
      }
      if (response.status === 401) {
        callbacks.onError("Phiên đăng nhập hết hạn. Vui lòng đăng nhập lại.");
        return;
      }
      if (response.status === 429) {
        callbacks.onError("Quá nhiều yêu cầu. Vui lòng thử lại sau.");
        return;
      }
      callbacks.onError(errBody.message || errBody.error || `Lỗi từ AI: ${response.status}`);
      return;
    }

    if (!response.body) {
      callbacks.onError("Không nhận được phản hồi từ AI.");
      return;
    }

    // SSE parsing (same logic as streamChat)
    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      let newlineIndex: number;
      while ((newlineIndex = buffer.indexOf("\n")) !== -1) {
        let line = buffer.slice(0, newlineIndex);
        buffer = buffer.slice(newlineIndex + 1);

        if (line.endsWith("\r")) line = line.slice(0, -1);
        if (line.startsWith(":") || line.trim() === "") continue;
        if (!line.startsWith("data: ")) continue;

        const jsonStr = line.slice(6).trim();
        if (jsonStr === "[DONE]") {
          callbacks.onDone();
          return;
        }

        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) callbacks.onDelta(content);
        } catch {
          buffer = line + "\n" + buffer;
          break;
        }
      }
    }

    // Flush remaining buffer
    if (buffer.trim()) {
      for (let raw of buffer.split("\n")) {
        if (!raw) continue;
        if (raw.endsWith("\r")) raw = raw.slice(0, -1);
        if (raw.startsWith(":") || raw.trim() === "") continue;
        if (!raw.startsWith("data: ")) continue;
        const jsonStr = raw.slice(6).trim();
        if (jsonStr === "[DONE]") continue;
        try {
          const parsed = JSON.parse(jsonStr);
          const content = parsed.choices?.[0]?.delta?.content as string | undefined;
          if (content) callbacks.onDelta(content);
        } catch { /* ignore */ }
      }
    }

    callbacks.onDone();
  } catch (err: any) {
    if (err.name === "AbortError") return;
    console.error("Proxy stream error:", err);
    callbacks.onError("Lỗi kết nối. Vui lòng kiểm tra mạng và thử lại.");
  }
}
