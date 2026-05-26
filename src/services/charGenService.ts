/**
 * Character Generation Service — 2-step Chain-of-Thought pipeline.
 *
 * Step 1 (Brainstorming): Free-form character profile in Vietnamese.
 * Step 2 (Formatting): Convert profile to strict TavernCardV2 JSON.
 *
 * Both steps use non-streaming API calls.
 */

import type { TavernCardV2 } from "@/types/taverncard";
import { extractCardJson } from "@/utils/extractCardJson";
import {
  getApiKeyForProvider,
  getModel,
  parsePrefixedModelId,
  getMimoEndpoint,
  type Provider,
} from "./openRouter";
import { getCachedSamplingParameters } from "./globalSettingsDb";
import { getCharGenBudget } from "./globalSettingsDb";

// ── Budget config builder ─────────────────────────────────────────────────

/**
 * Build a config block injected into system messages so the AI knows
 * exact field limits without hardcoding numbers in the prompt itself.
 *
 * mode "brainstorm" → limits for the free-form profile (Step 1)
 * mode "format"     → limits for the JSON output (Step 2)
 */
function buildBudgetConfig(mode: "brainstorm" | "format"): string {
  const B = getCharGenBudget();

  if (mode === "brainstorm") {
    return [
      "---",
      "FIELD TARGETS (do not output this section):",
      `- description: ${B.description.maxTokens} tokens (~${B.description.maxChars} chars), 4 paragraphs`,
      `- personality: ${B.personality.maxTokens} tokens (~${B.personality.maxChars} chars)`,
      `- scenario: ${B.scenario.maxTokens} tokens (~${B.scenario.maxChars} chars)`,
      `- first_mes: ${B.first_mes.maxTokens} tokens (~${B.first_mes.maxChars} chars)`,
      `- mes_example: exactly ${B.mes_example.idealPairs} dialogue pairs with <START> markers`,
      `- system_prompt: ${B.system_prompt.maxTokens} tokens (~${B.system_prompt.maxChars} chars)`,
      `- creator_notes: ~${B.creator_notes.maxChars} chars`,
      "---",
    ].join("\n");
  }

  // format mode
  return [
    "---",
    "FIELD LIMITS (enforce strictly):",
    `- description: max ${B.description.maxTokens} tokens`,
    `- personality: max ${B.personality.maxTokens} tokens`,
    `- scenario: max ${B.scenario.maxTokens} tokens`,
    `- first_mes: max ${B.first_mes.maxTokens} tokens`,
    `- mes_example: ${B.mes_example.idealPairs} dialogue pairs (min ${B.mes_example.minPairs}, max ${B.mes_example.maxPairs})`,
    `- system_prompt: max ${B.system_prompt.maxTokens} tokens`,
    `- tags: max ${B.tags.maxItems} items, must include "tiếng-việt" and "vietrp"`,
    "---",
  ].join("\n");
}

// ── Types ──────────────────────────────────────────────────────────────────

export type CharGenPhase = "idle" | "brainstorming" | "formatting" | "success";

export interface CharGenCallbacks {
  onPhaseChange: (phase: CharGenPhase) => void;
  onDraftReady: (draft: string) => void;
  onSuccess: (card: TavernCardV2) => void;
  onError: (error: string, failedStep: "brainstorming" | "formatting") => void;
}

export interface CharGenOptions {
  userMessages: { role: "user" | "assistant"; content: string }[];
  brainstormSystemPrompt: string;
  formatSystemPrompt: string;
  provider: Provider;
  signal?: AbortSignal;
  /** Clone mode: user's input is already a structured profile, skip Step 1 */
  skipBrainstorm?: boolean;
}

// ── Non-streaming fetch helper ─────────────────────────────────────────────

export async function nonStreamChat(
  messages: { role: string; content: string }[],
  options: {
    provider: Provider;
    signal?: AbortSignal;
    maxTokens?: number;
    temperature?: number;
    model?: string;
  },
): Promise<string> {
  const { provider: optProvider, signal, maxTokens = 8192, temperature, model: modelOverride } = options;

  // Parse prefixed model ID if no explicit model override
  const storedModel = getModel();
  const parsed = parsePrefixedModelId(modelOverride ?? storedModel);
  const provider = optProvider ?? parsed.provider;
  const model = parsed.modelId;

  const apiKey = getApiKeyForProvider(provider);
  if (!apiKey) throw new Error("Chưa nhập API Key. Vào Cài đặt để thêm.");
  const samplingParams = getCachedSamplingParameters();

  // ─── Google GenAI: different API format ───
  if (provider === "google_genai") {
    const { getGoogleGenaiEndpoint } = await import("@/services/openRouter");
    const endpoint = getGoogleGenaiEndpoint();
    const apiUrl = `${endpoint}/models/${model}:generateContent?key=${apiKey}`;

    const contents = messages
      .filter((m) => m.role !== "system")
      .map((m) => ({
        role: m.role === "assistant" ? "model" : "user",
        parts: [{ text: m.content }],
      }));

    const sysMsg = messages.find((m) => m.role === "system");
    const body: Record<string, any> = {
      contents,
      generationConfig: {
        maxOutputTokens: maxTokens,
        temperature: temperature ?? samplingParams.temperature,
        topP: samplingParams.top_p,
        topK: samplingParams.top_k,
      },
    };
    if (sysMsg) body.systemInstruction = { parts: [{ text: sysMsg.content }] };

    const response = await fetch(apiUrl, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
      signal,
    });

    if (!response.ok) {
      if (response.status === 400 || response.status === 403) throw new Error("API Key không hợp lệ.");
      if (response.status === 404) throw new Error(`Model "${model}" không tồn tại trên Google GenAI.`);
      if (response.status === 429) throw new Error("Đã vượt quá giới hạn yêu cầu.");
      const errText = await response.text().catch(() => "unknown");
      throw new Error(`Lỗi từ Google GenAI: ${response.status}. ${errText}`);
    }

    const json = await response.json();
    const content: string = json.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
    if (!content) throw new Error("AI trả về phản hồi trống.");
    return content;
  }

  // ─── OpenRouter / Mimo: OpenAI-compatible format ───
  const isOpenRouter = provider !== "mimo";
  const apiUrl = isOpenRouter
    ? "https://openrouter.ai/api/v1/chat/completions"
    : `${getMimoEndpoint()}/chat/completions`;

  const headers: Record<string, string> = {
    Authorization: `Bearer ${apiKey}`,
    "Content-Type": "application/json",
  };
  if (isOpenRouter) {
    headers["HTTP-Referer"] = "https://vietrp.com";
    headers["X-Title"] = "VietRP CharGen";
  }

  const response = await fetch(apiUrl, {
    method: "POST",
    headers,
    body: JSON.stringify({
      model,
      messages,
      stream: false,
      max_tokens: maxTokens,
      temperature: temperature ?? samplingParams.temperature,
      top_p: samplingParams.top_p,
      top_k: samplingParams.top_k,
      repetition_penalty: samplingParams.repetition_penalty,
    }),
    signal,
  });

  if (!response.ok) {
    if (response.status === 401) throw new Error("API Key không hợp lệ.");
    if (response.status === 404) throw new Error(`Model "${model}" không tồn tại.`);
    if (response.status === 429) throw new Error("Đã vượt quá giới hạn yêu cầu.");
    if (response.status === 402) throw new Error("Tài khoản hết credits.");
    const errText = await response.text().catch(() => "unknown");
    throw new Error(`Lỗi từ AI: ${response.status}. ${errText}`);
  }

  const json = await response.json();
  const choice = json.choices?.[0];
  const content: string = choice?.message?.content ?? "";
  if (!content) throw new Error("AI trả về phản hồi trống.");

  const finishReason = choice?.finish_reason;
  if (finishReason === "length") {
    throw new Error(
      "AI đã dừng giữa chừng vì hết token output. " +
      "Hãy rút gọn mô tả nhân vật hoặc chọn model có giới hạn output cao hơn.",
    );
  }

  return content;
}

// ── 2-Step Pipeline ────────────────────────────────────────────────────────

export async function runCharGenPipeline(
  options: CharGenOptions,
  callbacks: CharGenCallbacks,
): Promise<void> {
  const {
    userMessages,
    brainstormSystemPrompt,
    formatSystemPrompt,
    provider,
    signal,
    skipBrainstorm,
  } = options;

  let currentStep: "brainstorming" | "formatting" = "brainstorming";

  try {
    // ── Step 1: Brainstorming ──
    callbacks.onPhaseChange("brainstorming");

    let draftProfile: string;

    if (!skipBrainstorm) {
      const brainstormMessages = [
        { role: "system", content: brainstormSystemPrompt },
        { role: "system", content: buildBudgetConfig("brainstorm") },
        ...userMessages,
      ];
      draftProfile = await nonStreamChat(brainstormMessages, {
        provider,
        signal,
        maxTokens: 8192,
      });
      console.log("[CharGen Step 1] Draft Profile:", draftProfile);
    } else {
      draftProfile = userMessages[userMessages.length - 1]?.content ?? "";
      console.log("[CharGen Step 1 SKIP] Using pasted profile:", draftProfile);
    }

    callbacks.onDraftReady(draftProfile);

    // ── Step 2: Formatting ──
    currentStep = "formatting";
    callbacks.onPhaseChange("formatting");

    const formatMessages = [
      { role: "system", content: formatSystemPrompt },
      { role: "system", content: buildBudgetConfig("format") },
      {
        role: "user",
        content: `Convert the following character profile into a valid chara_card_v2 JSON object:\n\n${draftProfile}`,
      },
    ];
    const jsonOutput = await nonStreamChat(formatMessages, {
      provider,
      signal,
      maxTokens: 16384,
      temperature: 0.3,
    });

    console.log("[CharGen Step 2] Raw JSON output:", jsonOutput);

    const card = extractCardJson(jsonOutput);
    if (!card) {
      throw new Error("Không thể phân tích JSON từ bước 2. Dữ liệu JSON không hợp lệ.");
    }

    console.log("[CharGen Step 2] Parsed card:", card);
    callbacks.onSuccess(card);
    callbacks.onPhaseChange("success");
  } catch (err: any) {
    if (err.name === "AbortError") {
      callbacks.onPhaseChange("idle");
      return;
    }
    console.error(`[CharGen] Error in step ${currentStep}:`, err);
    callbacks.onError(
      err.message || "Có lỗi xảy ra trong quá trình tạo nhân vật.",
      currentStep,
    );
    callbacks.onPhaseChange("idle");
  }
}
