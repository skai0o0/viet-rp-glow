import { OpenRouterMessage } from "@/utils/promptBuilder";

const OPENROUTER_API_URL = "https://openrouter.ai/api/v1/chat/completions";
const STORAGE_KEY_API = "vietrp_openrouter_key";
const STORAGE_KEY_MODEL = "vietrp_openrouter_model";

export const AVAILABLE_MODELS = [
  { id: "nousresearch/nous-hermes-2-mixtral-8x7b-dpo", label: "Nous Hermes 2 Mixtral 8x7B" },
  { id: "anthropic/claude-3-haiku", label: "Claude 3 Haiku" },
  { id: "google/gemini-pro", label: "Gemini Pro" },
  { id: "gryphe/mythomax-l2-13b", label: "MythoMax L2 13B" },
] as const;

export function getApiKey(): string {
  return localStorage.getItem(STORAGE_KEY_API) || "";
}

export function setApiKey(key: string) {
  localStorage.setItem(STORAGE_KEY_API, key);
}

export function getModel(): string {
  return localStorage.getItem(STORAGE_KEY_MODEL) || AVAILABLE_MODELS[0].id;
}

export function setModel(model: string) {
  localStorage.setItem(STORAGE_KEY_MODEL, model);
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
  signal?: AbortSignal
) {
  const apiKey = getApiKey();
  if (!apiKey) {
    callbacks.onError("Vui lòng nhập API Key của OpenRouter trong phần Cài Đặt.");
    return;
  }

  const model = getModel();

  try {
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
          // Partial JSON, put back and wait
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
