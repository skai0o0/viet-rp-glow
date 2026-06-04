import { OpenRouterMessage } from "@/utils/promptBuilder";
import { getCachedSamplingParameters, DEFAULT_MAX_TOKENS } from "@/services/globalSettingsDb";
import { supabase } from "@/integrations/supabase/client";
import { loadUserApiKeys, saveUserApiKeys } from "@/services/userApiKeys";

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

// ─── Google GenAI provider ───
const GOOGLE_GENAI_DEFAULT_BASE = "https://generativelanguage.googleapis.com/v1beta";
const GOOGLE_GENAI_STORAGE_KEY_API = "vietrp_google_genai_key";
const GOOGLE_GENAI_STORAGE_KEY_VERIFIED = "vietrp_google_genai_key_verified";
const GOOGLE_GENAI_STORAGE_KEY_ENDPOINT = "vietrp_google_genai_endpoint";

export function getMimoEndpoint(): string {
  return localStorage.getItem(MIMO_STORAGE_KEY_ENDPOINT) || MIMO_DEFAULT_BASE;
}

export function setMimoEndpoint(endpoint: string, userId?: string) {
  const trimmed = endpoint.trim().replace(/\/+$/, ""); // strip trailing slashes
  if (trimmed && trimmed !== MIMO_DEFAULT_BASE) {
    localStorage.setItem(MIMO_STORAGE_KEY_ENDPOINT, trimmed);
  } else {
    localStorage.removeItem(MIMO_STORAGE_KEY_ENDPOINT); // revert to default
  }
  // Persist to Supabase if userId provided
  if (userId) {
    saveUserApiKeys(userId, { mimo_endpoint: trimmed }).catch((e) =>
      console.error("[BYOK] Failed to sync Mimo endpoint to Supabase:", e)
    );
  }
}

// ─── Google GenAI endpoint management ───
export function getGoogleGenaiEndpoint(): string {
  return localStorage.getItem(GOOGLE_GENAI_STORAGE_KEY_ENDPOINT) || GOOGLE_GENAI_DEFAULT_BASE;
}

export function setGoogleGenaiEndpoint(endpoint: string, userId?: string) {
  const trimmed = endpoint.trim().replace(/\/+$/, "");
  if (trimmed && trimmed !== GOOGLE_GENAI_DEFAULT_BASE) {
    localStorage.setItem(GOOGLE_GENAI_STORAGE_KEY_ENDPOINT, trimmed);
  } else {
    localStorage.removeItem(GOOGLE_GENAI_STORAGE_KEY_ENDPOINT);
  }
  if (userId) {
    saveUserApiKeys(userId, { google_genai_endpoint: trimmed }).catch((e) =>
      console.error("[BYOK] Failed to sync Google GenAI endpoint to Supabase:", e)
    );
  }
}

export type Provider = "openrouter" | "mimo" | "google_genai";

// ─── Secure storage helpers (localStorage + obfuscation) ───
// Migrate old sessionStorage keys back to localStorage (revert ephemeral storage)
(function migrateFromSessionStorage() {
  try {
    const sessionKey = sessionStorage.getItem(STORAGE_KEY_API);
    if (sessionKey && !localStorage.getItem(STORAGE_KEY_API)) {
      localStorage.setItem(STORAGE_KEY_API, sessionKey);
      sessionStorage.removeItem(STORAGE_KEY_API);
    }
    const sessionVerified = sessionStorage.getItem(STORAGE_KEY_VERIFIED);
    if (sessionVerified && !localStorage.getItem(STORAGE_KEY_VERIFIED)) {
      localStorage.setItem(STORAGE_KEY_VERIFIED, sessionVerified);
      sessionStorage.removeItem(STORAGE_KEY_VERIFIED);
    }
    const sessionMimo = sessionStorage.getItem(MIMO_STORAGE_KEY_API);
    if (sessionMimo && !localStorage.getItem(MIMO_STORAGE_KEY_API)) {
      localStorage.setItem(MIMO_STORAGE_KEY_API, sessionMimo);
      sessionStorage.removeItem(MIMO_STORAGE_KEY_API);
    }
    const sessionMimoVerified = sessionStorage.getItem(MIMO_STORAGE_KEY_VERIFIED);
    if (sessionMimoVerified && !localStorage.getItem(MIMO_STORAGE_KEY_VERIFIED)) {
      localStorage.setItem(MIMO_STORAGE_KEY_VERIFIED, sessionMimoVerified);
      sessionStorage.removeItem(MIMO_STORAGE_KEY_VERIFIED);
    }
    const sessionGoogle = sessionStorage.getItem(GOOGLE_GENAI_STORAGE_KEY_API);
    if (sessionGoogle && !localStorage.getItem(GOOGLE_GENAI_STORAGE_KEY_API)) {
      localStorage.setItem(GOOGLE_GENAI_STORAGE_KEY_API, sessionGoogle);
      sessionStorage.removeItem(GOOGLE_GENAI_STORAGE_KEY_API);
    }
    const sessionGoogleVerified = sessionStorage.getItem(GOOGLE_GENAI_STORAGE_KEY_VERIFIED);
    if (sessionGoogleVerified && !localStorage.getItem(GOOGLE_GENAI_STORAGE_KEY_VERIFIED)) {
      localStorage.setItem(GOOGLE_GENAI_STORAGE_KEY_VERIFIED, sessionGoogleVerified);
      sessionStorage.removeItem(GOOGLE_GENAI_STORAGE_KEY_VERIFIED);
    }
  } catch { /* ignore */ }
})();

// ─── Provider selection ───
export function getActiveProvider(): Provider {
  const stored = localStorage.getItem(STORAGE_KEY_PROVIDER);
  if (stored === "mimo") return "mimo";
  if (stored === "google_genai") return "google_genai";
  return "openrouter";
}

export function setActiveProvider(provider: Provider) {
  localStorage.setItem(STORAGE_KEY_PROVIDER, provider);
}

/** Simple XOR-based obfuscation for localStorage (not crypto-secure, but prevents casual DevTools reading) */
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
  const stored = localStorage.getItem(STORAGE_KEY_API);
  if (!stored) return "";
  return deobfuscate(stored);
}

export function setApiKey(key: string, userId?: string) {
  const old = getApiKey();
  if (key) {
    localStorage.setItem(STORAGE_KEY_API, obfuscate(key));
  } else {
    localStorage.removeItem(STORAGE_KEY_API);
  }
  if (key !== old) localStorage.removeItem(STORAGE_KEY_VERIFIED);
  // Persist to Supabase if userId provided
  if (userId) {
    saveUserApiKeys(userId, { openrouter_key: key }).catch((e) =>
      console.error("[BYOK] Failed to save OpenRouter key to Supabase:", e)
    );
  }
}

export function isKeyVerified(): boolean {
  return localStorage.getItem(STORAGE_KEY_VERIFIED) === "true";
}

export function markKeyVerified() {
  localStorage.setItem(STORAGE_KEY_VERIFIED, "true");
}

// ─── Xiaomi Mimo key management ───
export function getMimoApiKey(): string {
  const stored = localStorage.getItem(MIMO_STORAGE_KEY_API);
  if (!stored) return "";
  return deobfuscate(stored);
}

export function setMimoApiKey(key: string, userId?: string) {
  const old = getMimoApiKey();
  if (key) {
    localStorage.setItem(MIMO_STORAGE_KEY_API, obfuscate(key));
  } else {
    localStorage.removeItem(MIMO_STORAGE_KEY_API);
  }
  if (key !== old) localStorage.removeItem(MIMO_STORAGE_KEY_VERIFIED);
  // Persist to Supabase if userId provided
  if (userId) {
    saveUserApiKeys(userId, { mimo_key: key }).catch((e) =>
      console.error("[BYOK] Failed to save Mimo key to Supabase:", e)
    );
  }
}

export function isMimoKeyVerified(): boolean {
  return localStorage.getItem(MIMO_STORAGE_KEY_VERIFIED) === "true";
}

export function markMimoKeyVerified() {
  localStorage.setItem(MIMO_STORAGE_KEY_VERIFIED, "true");
}

// ─── Google GenAI key management ───
export function getGoogleGenaiApiKey(): string {
  const stored = localStorage.getItem(GOOGLE_GENAI_STORAGE_KEY_API);
  if (!stored) return "";
  return deobfuscate(stored);
}

export function setGoogleGenaiApiKey(key: string, userId?: string) {
  const old = getGoogleGenaiApiKey();
  if (key) {
    localStorage.setItem(GOOGLE_GENAI_STORAGE_KEY_API, obfuscate(key));
  } else {
    localStorage.removeItem(GOOGLE_GENAI_STORAGE_KEY_API);
  }
  if (key !== old) localStorage.removeItem(GOOGLE_GENAI_STORAGE_KEY_VERIFIED);
  if (userId) {
    saveUserApiKeys(userId, { google_genai_key: key }).catch((e) =>
      console.error("[BYOK] Failed to save Google GenAI key to Supabase:", e)
    );
  }
}

export function isGoogleGenaiKeyVerified(): boolean {
  return localStorage.getItem(GOOGLE_GENAI_STORAGE_KEY_VERIFIED) === "true";
}

export function markGoogleGenaiKeyVerified() {
  localStorage.setItem(GOOGLE_GENAI_STORAGE_KEY_VERIFIED, "true");
}

/**
 * Sync BYOK keys from Supabase into localStorage.
 * Called on app init / login so user doesn't have to re-enter keys.
 */
export async function syncKeysFromSupabase(userId: string): Promise<void> {
  try {
    const keys = await loadUserApiKeys(userId);
    if (keys.openrouter_key && !getApiKey()) {
      localStorage.setItem(STORAGE_KEY_API, obfuscate(keys.openrouter_key));
    }
    if (keys.mimo_key && !getMimoApiKey()) {
      localStorage.setItem(MIMO_STORAGE_KEY_API, obfuscate(keys.mimo_key));
    }
    if (keys.mimo_endpoint) {
      localStorage.setItem(MIMO_STORAGE_KEY_ENDPOINT, keys.mimo_endpoint);
    }
    if (keys.google_genai_key && !getGoogleGenaiApiKey()) {
      localStorage.setItem(GOOGLE_GENAI_STORAGE_KEY_API, obfuscate(keys.google_genai_key));
    }
    if (keys.google_genai_endpoint) {
      localStorage.setItem(GOOGLE_GENAI_STORAGE_KEY_ENDPOINT, keys.google_genai_endpoint);
    }
  } catch (e) {
    console.error("[BYOK] Failed to sync keys from Supabase:", e);
    throw e;
  }
}

/** Get the API key for the active provider */
export function getApiKeyForProvider(provider?: Provider): string {
  const p = provider ?? getActiveProvider();
  if (p === "mimo") return getMimoApiKey();
  if (p === "google_genai") return getGoogleGenaiApiKey();
  return getApiKey();
}

const DEPRECATED_MODELS = [
  "nousresearch/nous-hermes-2-mixtral-8x7b-dpo",
  "google/gemini-pro",
];

// ─── Prefixed model ID helpers ─────────────────────────────
// Format: "provider::model_id" (e.g., "mimo::gpt-4o", "google_genai::gemini-2.0-flash")
// Plain model_id = OpenRouter (backward compatible)

export function formatPrefixedModelId(provider: Provider, modelId: string): string {
  if (provider === "openrouter") return modelId;
  return `${provider}::${modelId}`;
}

export function parsePrefixedModelId(prefixed: string): { provider: Provider | undefined; modelId: string } {
  const sep = prefixed.indexOf("::");
  if (sep === -1) {
    if (prefixed.startsWith("anthropic/") || prefixed.startsWith("gryphe/") || prefixed.startsWith("mistralai/") || prefixed.startsWith("nousresearch/") || prefixed.startsWith("meta/")) {
      return { provider: "openrouter", modelId: prefixed };
    }
    return { provider: undefined, modelId: prefixed };
  }
  let provider = prefixed.slice(0, sep) as Provider;
  if ((provider as string) === "google") {
    provider = "google_genai";
  }
  if (provider === "mimo" || provider === "google_genai") {
    return { provider, modelId: prefixed.slice(sep + 2) };
  }
  return { provider: "openrouter", modelId: prefixed };
}

export function getModel(): string {
  const stored = localStorage.getItem(STORAGE_KEY_MODEL);
  if (stored && !DEPRECATED_MODELS.includes(stored)) return stored;
  if (stored) localStorage.removeItem(STORAGE_KEY_MODEL);
  return AVAILABLE_MODELS[0].id;
}

/** Get the raw model ID (stripped of provider prefix) for API calls */
export function getRawModelId(prefixed?: string): string {
  const id = prefixed ?? getModel();
  return parsePrefixedModelId(id).modelId;
}

/** Get the provider implied by the prefixed model ID */
export function getModelProvider(prefixed?: string): Provider {
  const id = prefixed ?? getModel();
  return parsePrefixedModelId(id).provider ?? "openrouter";
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

// ─── Google GenAI API functions ───

/** Verify Google GenAI API key by calling /models endpoint */
export async function verifyGoogleGenaiApiKey(key: string): Promise<{ valid: boolean; error?: string }> {
  try {
    const res = await fetch(`${getGoogleGenaiEndpoint()}/models?key=${key}`);
    if (res.ok) return { valid: true };
    if (res.status === 400 || res.status === 403) return { valid: false, error: "API Key không hợp lệ." };
    return { valid: false, error: `Lỗi: ${res.status}` };
  } catch {
    return { valid: false, error: "Không thể kết nối tới Google GenAI." };
  }
}

/** Fetch all available models from Google GenAI */
export async function fetchGoogleGenaiModels(): Promise<OpenRouterModel[]> {
  const key = getGoogleGenaiApiKey();
  if (!key) return [];
  try {
    const res = await fetch(`${getGoogleGenaiEndpoint()}/models?key=${key}`);
    if (!res.ok) return [];
    const json = await res.json();
    const models: OpenRouterModel[] = (json.models || [])
      .filter((m: any) => m.supportedGenerationMethods?.includes("generateContent"))
      .map((m: any) => ({
        id: m.name.replace("models/", ""),
        name: m.displayName || m.name.replace("models/", ""),
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

/** Parse Google GenAI SSE stream (different response format) */
async function parseGoogleGenaiSSEStream(body: ReadableStream<Uint8Array>, callbacks: StreamCallbacks) {
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

      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.candidates?.[0]?.content?.parts?.[0]?.text as string | undefined;
        if (content) callbacks.onDelta(content);
      } catch {
        buffer = line + "\n" + buffer;
        break;
      }
    }
  }

  if (buffer.trim()) {
    for (let raw of buffer.split("\n")) {
      if (!raw) continue;
      if (raw.endsWith("\r")) raw = raw.slice(0, -1);
      if (raw.startsWith(":") || raw.trim() === "") continue;
      if (!raw.startsWith("data: ")) continue;
      const jsonStr = raw.slice(6).trim();
      try {
        const parsed = JSON.parse(jsonStr);
        const content = parsed.candidates?.[0]?.content?.parts?.[0]?.text as string | undefined;
        if (content) callbacks.onDelta(content);
      } catch { /* ignore */ }
    }
  }

  callbacks.onDone();
}

/** Convert OpenRouter messages to Google GenAI contents format */
function convertToGoogleGenaiMessages(messages: OpenRouterMessage[]) {
  const contents: { role: string; parts: { text: string }[] }[] = [];
  for (const msg of messages) {
    if (msg.role === "system") continue;
    contents.push({
      role: msg.role === "assistant" ? "model" : "user",
      parts: [{ text: msg.content }],
    });
  }
  return contents;
}

function getSystemInstruction(messages: OpenRouterMessage[]) {
  const sysMsg = messages.find((m) => m.role === "system");
  return sysMsg ? { parts: [{ text: sysMsg.content }] } : undefined;
}

function getProviderLabel(provider: Provider): string {
  if (provider === "mimo") return "Xiaomi Mimo";
  if (provider === "google_genai") return "Google GenAI";
  return "OpenRouter";
}

/**
 * Stream chat completions via SSE (supports OpenRouter, Xiaomi Mimo, and Google GenAI)
 */
export async function streamChat(
  messages: OpenRouterMessage[],
  callbacks: StreamCallbacks,
  signal?: AbortSignal,
  maxTokensOverride?: number,
  provider?: Provider,
) {
  // Parse prefixed model ID to determine provider + raw model
  const storedModel = getModel();
  const parsed = parsePrefixedModelId(storedModel);
  const activeProvider = provider ?? parsed.provider ?? getActiveProvider();
  const model = parsed.modelId;
  const apiKey = getApiKeyForProvider(activeProvider);
  if (!apiKey) {
    callbacks.onError(`Vui lòng nhập API Key của ${getProviderLabel(activeProvider)} trong phần Cài Đặt.`);
    return;
  }
  const maxTokens = maxTokensOverride ?? (parseInt(localStorage.getItem("vietrp_max_tokens") || "") || getCachedSamplingParameters().max_tokens || DEFAULT_MAX_TOKENS);
  const samplingParams = getCachedSamplingParameters();

  try {
    // ─── Google GenAI: different API format ───
    if (activeProvider === "google_genai") {
      const endpoint = getGoogleGenaiEndpoint();
      let cleanModel = model;
      if (cleanModel.startsWith("google/")) {
        cleanModel = cleanModel.replace("google/", "");
      }
      const apiUrl = `${endpoint}/models/${cleanModel}:streamGenerateContent?key=${apiKey}&alt=sse`;

      const body: Record<string, any> = {
        contents: convertToGoogleGenaiMessages(messages),
        generationConfig: {
          maxOutputTokens: maxTokens,
          temperature: samplingParams.temperature,
          topP: samplingParams.top_p,
          topK: samplingParams.top_k,
        },
      };

      const systemInstruction = getSystemInstruction(messages);
      if (systemInstruction) body.systemInstruction = systemInstruction;

      const response = await fetch(apiUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
        signal,
      });

      if (!response.ok) {
        if (response.status === 400 || response.status === 403) {
          callbacks.onError("API Key không hợp lệ. Vui lòng kiểm tra lại trong Cài Đặt.");
          return;
        }
        if (response.status === 404) {
          callbacks.onError(`Model "${model}" không tồn tại trên Google GenAI. Vui lòng chọn model khác.`);
          return;
        }
        if (response.status === 429) {
          callbacks.onError("Đã vượt quá giới hạn yêu cầu. Vui lòng thử lại sau.");
          return;
        }
        const errorText = await response.text();
        console.error("Google GenAI error:", response.status, errorText);
        callbacks.onError(`Lỗi từ Google GenAI: ${response.status}. Vui lòng thử lại.`);
        return;
      }

      if (!response.body) {
        callbacks.onError("Không nhận được phản hồi từ AI.");
        return;
      }

      await parseGoogleGenaiSSEStream(response.body, callbacks);
      return;
    }

    // ─── OpenRouter / Mimo: OpenAI-compatible format ───
    const apiUrl = activeProvider === "mimo" ? `${getMimoEndpoint()}/chat/completions` : OPENROUTER_API_URL;

    const headers: Record<string, string> = {
      "Authorization": `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    };
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
      const providerLabel = getProviderLabel(activeProvider);
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
    callbacks.onError(`Lỗi kết nối tới ${getProviderLabel(activeProvider)}. Vui lòng kiểm tra API Key và kết nối mạng. (${err.message || "unknown"})`);
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
  useCredit?: boolean,
) {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) {
    callbacks.onError("Vui lòng đăng nhập để chat.");
    return;
  }

  const tierKey = getSelectedTier();
  const maxTokens = maxTokensOverride ?? (parseInt(localStorage.getItem("vietrp_max_tokens") || "") || getCachedSamplingParameters().max_tokens || DEFAULT_MAX_TOKENS);
  const samplingParams = getCachedSamplingParameters();

  try {
    const response = await fetch(CHAT_PROXY_URL, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${session.access_token}`,
        "apikey": SUPABASE_ANON_KEY,
        "Content-Type": "application/json",
        ...(useCredit ? { "x-use-credit": "true" } : {}),
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
