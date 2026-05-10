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
  getMimoEndpoint,
  type Provider,
} from "./openRouter";
import { getCachedSamplingParameters } from "./globalSettingsDb";

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

async function nonStreamChat(
  messages: { role: string; content: string }[],
  options: {
    provider: Provider;
    signal?: AbortSignal;
    maxTokens?: number;
    temperature?: number;
  },
): Promise<string> {
  const { provider, signal, maxTokens = 16384, temperature } = options;
  const apiKey = getApiKeyForProvider(provider);
  if (!apiKey) throw new Error("Chưa nhập API Key. Vào Cài đặt để thêm.");

  const model = getModel();
  const samplingParams = getCachedSamplingParameters();

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
  const content: string = json.choices?.[0]?.message?.content ?? "";
  if (!content) throw new Error("AI trả về phản hồi trống.");
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
        ...userMessages,
      ];
      draftProfile = await nonStreamChat(brainstormMessages, {
        provider,
        signal,
        maxTokens: 16384,
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
