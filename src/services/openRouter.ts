import { OpenRouterMessage } from "@/utils/promptBuilder";
import { getCachedSamplingParameters } from "@/services/globalSettingsDb";
import { supabase } from "@/integrations/supabase/client";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const OPENROUTER_MODELS_URL = "https://openrouter.ai/api/v1/models";
const STORAGE_KEY_API = "vietrp_openrouter_key";
const STORAGE_KEY_MODEL = "vietrp_openrouter_model";
const STORAGE_KEY_VERIFIED = "vietrp_key_verified";
const STORAGE_KEY_TIER = "vietrp_selected_tier";

// ─── Xiaomi Mimo provider ───
const MIMO_DEFAULT_BASE = "https://token-plan-sgp.xiaomimimo.com/v1";
const MIMO_STORAGE_KEY_API = "vietrp_mimo_key";
const MIMO_STORAGE_KEY_VERIFIED = "vietrp_mimo_key_verified";
const MIMO_STORAGE_KEY_ENDPOINT = "vietrp_mimo_endpoint";
const STORAGE_KEY_PROVIDER = "vietrp_active_provider";

export function getMimoEndpoint(): string {
  return localStorage.getItem(MIMO_STORAGE_KEY_ENDPOINT) || MIMO_DEFAULT_BASE;
}

export function setMimoEndpoint(endpoint: string) {
  const trimmed = endpoint.trim().replace(/\/+$/, ""); // strip trailing slashes
  if (trimmed && trimmed !== MIMO_DEFAULT_BASE) {
    localStorage.setItem(MIMO_STORAGE_KEY_ENDPOINT, trimmed);
  } else {
    localStorage.removeItem(MIMO_STORAGE_KEY_ENDPOINT); // revert to default
  }
}

export type Provider = "openrouter" | "mimo";

// ─── Secure storage helpers (sessionStorage + obfuscation) ───
// Migrate old localStorage keys to sessionStorage on first load
(function migrateSensitiveKeys() {
  try {
    const oldKey = localStorage.getItem(STORAGE_KEY_API);
    if (oldKey) {
      sessionStorage.setItem(STORAGE_KEY_API, oldKey);
      localStorage.removeItem(STORAGE_KEY_API);
    }
    const oldVerified = localStorage.getItem(STORAGE_KEY_VERIFIED);
    if (oldVerified) {
      sessionStorage.setItem(STORAGE_KEY_VERIFIED, oldVerified);
      localStorage.removeItem(STORAGE_KEY_VERIFIED);
    }
  } catch { /* ignore */ }
})();

// ─── Provider selection ───
export function getActiveProvider(): Provider {
  const stored = localStorage.getItem(STORAGE_KEY_PROVIDER);
  if (stored === "mimo") return "mimo";
  return "openrouter";
}

export function setActiveProvider(provider: Provider) {
  localStorage.setItem(STORAGE_KEY_PROVIDER, provider);
}

/** Simple XOR-based obfuscation for sessionStorage (not crypto-secure, but prevents casual DevTools reading) */
function obfuscate(value: string): string {
  const mask = "vietrp";
  let result = "";
  for (let i = 0; i < value.length; i++) {
    result += String.fromCharCode(value.charCodeAt(i) ^ mask.charCodeAt(i % mask.length));
  }
  return btoa(result);
}

function deobfuscate(encoded: string): string {
  try {
    const masked = atob(encoded);
    const mask = "vietrp";
    let result = "";
    for (let i = 0; i < masked.length; i++) {
      result += String.fromCharCode(masked.charCodeAt(i) ^ mask.charCodeAt(i % mask.length));
    }
    return result;
  } catch {
    return "";
  }
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL as string;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY as string;
const CHAT_PROXY_URL = `${SUPABASE_URL}/functions/v1/chat-proxy`;

// Fallback models if admin allowed_models list is empty
export const AVAILABLE_MODELS = [
  { id: "google/gemini-2.0-flash-001", label: "Gemini 2.0 Flash" },
  { id: "google/gemini-2.5-flash", label: "Gemini 2.5 Flash" },
  { id: "anthropic/claude-3.5-haiku", label: "Claude 3.5 Haiku" },
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
  const stored = sessionStorage.getItem(STORAGE_KEY_API);
  if (!stored) return "";
  return deobfuscate(stored);
}

export function setApiKey(key: string) {
  const old = getApiKey();
  if (key) {
    sessionStorage.setItem(STORAGE_KEY_API, obfuscate(key));
  } else {
    sessionStorage.removeItem(STORAGE_KEY_API);
  }
  if (key !== old) sessionStorage.removeItem(STORAGE_KEY_VERIFIED);
}

export function isKeyVerified(): boolean {
  return sessionStorage.getItem(STORAGE_KEY_VERIFIED) === "true";
}

export function markKeyVerified() {
  sessionStorage.setItem(STORAGE_KEY_VERIFIED, "true");
}

// ─── Xiaomi Mimo key management ───
export function getMimoApiKey(): string {
  const stored = sessionStorage.getItem(MIMO_STORAGE_KEY_API);
  if (!stored) return "";
  return deobfuscate(stored);
}

export function setMimoApiKey(key: string) {
  const old = getMimoApiKey();
  if (key) {
    sessionStorage.setItem(MIMO_STORAGE_KEY_API, obfuscate(key));
  } else {
    sessionStorage.removeItem(MIMO_STORAGE_KEY_API);
  }
  if (key !== old) sessionStorage.removeItem(MIMO_STORAGE_KEY_VERIFIED);
}

export function isMimoKeyVerified(): boolean {
  return sessionStorage.getItem(MIMO_STORAGE_KEY_VERIFIED) === "true";
}

export function markMimoKeyVerified() {
  sessionStorage.setItem(MIMO_STORAGE_KEY_VERIFIED, "true");
}

/** Get the API key for the active provider */
export function getApiKeyForProvider(provider?: Provider): string {
  const p = provider ?? getActiveProvider();
  return p === "mimo" ? getMimoApiKey() : getApiKey();
}

const DEPRECATED_MODELS = [
  "nousresearch/nous-hermes-2-mixtral-8x7b-dpo",
  "google/gemini-pro",
];

export function getModel(): string {
  const stored = localStorage.getItem(STORAGE_KEY_MODEL);
  if (stored && !DEPRECATED_MODELS.includes(stored)) return stored;
  if (stored) localStorage.removeItem(STORAGE_KEY_MODEL);
  return AVAILABLE_MODELS[0].id;
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

// ─── Xiaomi Mimo API functions ───

/** Verify Xiaomi Mimo API key by calling /models endpoint */
export async function verifyMimoApiKey(key: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch(`${getMimoEndpoint()}/models`, {
      headers: { "Authorization": `Bearer ${key}` },
    });
    if (res.ok) return { valid: true };
    if (res.status === 401) return { valid: false, error: "API Key không hợp lệ." };
    return { valid: false, error: `Lỗi: ${res.status}` };
  } catch {
    return { valid: false, error: "Không thể kết nối tới Xiaomi Mimo." };
  }
}

/** Fetch all available models from Xiaomi Mimo */
export async function fetchMimoModels(): Promise<OpenRouterModel[]> {
  const key = getMimoApiKey();
  if (!key) return [];
  try {
    const res = await fetch(`${getMimoEndpoint()}/models`, {
      headers: { "Authorization": `Bearer ${key}` },
    });
    if (!res.ok) return [];
    const json = await res.json();
    const models: OpenRouterModel[] = (json.data || []).map((m: any) => ({
      id: m.id,
      name: m.name || m.id,
      pricing: m.pricing,
    }));
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

/** Parse an SSE stream from a ReadableStream, calling callbacks for each delta. */
async function parseSSEStream(body: ReadableStream<Uint8Array>, callbacks: StreamCallbacks) {
  const reader = body.getReader();
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
}

/**
 * Stream chat completions via SSE (supports OpenRouter and Xiaomi Mimo)
 */
export async function streamChat(
  messages: OpenRouterMessage[],
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
  maxTokensOverride?: number,
  provider?: Provider,
) {
  const activeProvider = provider ?? getActiveProvider();
  const apiKey = getApiKeyForProvider(activeProvider);
  if (!apiKey) {
    const providerLabel = activeProvider === "mimo" ? "Xiaomi Mimo" : "OpenRouter";
    callbacks.onError(`Vui lòng nhập API Key của ${providerLabel} trong phần Cài Đặt.`);
    return;
  }

  const apiUrl = activeProvider === "mimo" ? `${getMimoEndpoint()}/chat/completions` : OPENROUTER_API_URL;
  const model = getModel();
  const maxTokens = maxTokensOverride ?? parseInt(localStorage.getItem("vietrp_max_tokens") || "800", 10);

  try {
    // Get sampling parameters from global settings
    const samplingParams = getCachedSamplingParameters();

    const headers: Record<string, string> = {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
    // OpenRouter-specific headers
    if (activeProvider === "openrouter") {
      headers["HTTP-Referer"] = "https://vietrp.com";
      headers["X-Title"] = "VietRP";
    }

    const response = await fetch(apiUrl, {
      method: "POST",
      headers,
      body: JSON.stringify({
        model,
        messages,
        stream: true,
        max_tokens: maxTokens,
        temperature: samplingParams.temperature,
        top_p: samplingParams.top_p,
        top_k: samplingParams.top_k,
        repetition_penalty: samplingParams.repetition_penalty,
        reasoning: { effort: "high", exclude: true },
      }),
      signal,
    });

    if (!response.ok) {
      const providerLabel = activeProvider === "mimo" ? "Xiaomi Mimo" : "OpenRouter";
      if (response.status === 401) {
        callbacks.onError("API Key không hợp lệ. Vui lòng kiểm tra lại trong Cài Đặt.");
        return;
      }
      if (response.status === 404) {
        callbacks.onError(`Model "${model}" không tồn tại trên ${providerLabel}. Vui lòng chọn model khác.`);
        return;
      }
      if (response.status === 429) {
        callbacks.onError("Đã vượt quá giới hạn yêu cầu. Vui lòng thử lại sau.");
        return;
      }
      if (response.status === 402) {
        callbacks.onError(`Tài khoản ${providerLabel} hết credits. Vui lòng nạp thêm.`);
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

    await parseSSEStream(response.body, callbacks);
  } catch (err: any) {
    if (err.name === "AbortError") return;
    console.error("Stream error:", err);
    const providerLabel = activeProvider === "mimo" ? "Xiaomi Mimo" : "OpenRouter";
    callbacks.onError(`Lỗi kết nối tới ${providerLabel}. Vui lòng kiểm tra API Key và kết nối mạng. (${err.message || "unknown"})`);
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
    return { used: 0, limit: 20, remaining: 20, plan_name: "Free", tier: "free" };
  }
  return data as unknown as ChatQuota;
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
      callbacks.onError(errBody.message || `Lỗi từ AI: ${response.status}`);
      return;
    }

    if (!response.body) {
      callbacks.onError("Không nhận được phản hồi từ AI.");
      return;
    }

    await parseSSEStream(response.body, callbacks);
  } catch (err: any) {
    if (err.name === "AbortError") return;
    console.error("Proxy stream error:", err);
    callbacks.onError(`Lỗi kết nối tới Chat Proxy. Vui lòng kiểm tra mạng và thử lại. (${err.message || "unknown"})`);
  }
}
