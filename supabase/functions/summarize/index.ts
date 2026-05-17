import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ALLOWED_ORIGINS = [
  "https://vietrp.com",
  "https://www.vietrp.com",
  "https://vietrp.site",
  "https://www.vietrp.site",
  "http://localhost:5173",
  "http://localhost:3000",
];

const corsHeaders = (origin: string | null) => ({
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin ?? "") ? origin! : ALLOWED_ORIGINS[0],
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
});

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const openrouterKey = Deno.env.get("OPENROUTER_API_KEY")!;
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

const SUMMARIZE_MODEL = "google/gemini-2.0-flash-001";

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const headers = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonResponse({ error: "Unauthorized" }, 401, headers);
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
    if (authError || !user) {
      return jsonResponse({ error: "Invalid token" }, 401, headers);
    }

    const { prompt, systemPrompt } = await req.json();
    if (!prompt || typeof prompt !== "string") {
      return jsonResponse({ error: "Missing prompt" }, 400, headers);
    }

    // Allow client to pass a custom system prompt (e.g. the Archivist Prompt).
    // Fall back to the generic Vietnamese summariser if not provided.
    const effectiveSystemPrompt =
      typeof systemPrompt === "string" && systemPrompt.trim()
        ? systemPrompt
        : "Bạn là trợ lý tóm tắt. Luôn trả lời bằng tiếng Việt. Chỉ tóm tắt, không thêm bình luận.";

    // Call OpenRouter with platform key (free for user)
    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${openrouterKey}`,
        "Content-Type": "application/json",
        "HTTP-Referer": "https://vietrp.com",
        "X-Title": "VietRP Summarizer",
      },
      body: JSON.stringify({
        model: SUMMARIZE_MODEL,
        messages: [
          { role: "system", content: effectiveSystemPrompt },
          { role: "user", content: prompt },
        ],
        stream: false,
        max_tokens: 800,
        temperature: 0.3,
      }),
    });

    if (!response.ok) {
      const errText = await response.text();
      console.error("[summarize] OpenRouter error:", response.status, errText);
      return jsonResponse({ error: "Summarization failed" }, 502, headers);
    }

    const json = await response.json();
    const content = json.choices?.[0]?.message?.content ?? "";

    return jsonResponse({ content }, 200, headers);
  } catch (err) {
    console.error("[summarize] Error:", err);
    return jsonResponse({ error: "Internal error" }, 500, headers);
  }
});

function jsonResponse(body: Record<string, unknown>, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, "Content-Type": "application/json" },
  });
}
