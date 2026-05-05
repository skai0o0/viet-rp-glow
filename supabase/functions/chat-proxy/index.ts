import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const ALLOWED_ORIGINS = [
  "https://vietrp.com",
  "https://www.vietrp.com",
  "http://localhost:5173",
  "http://localhost:3000",
];

const corsHeaders = (origin: string | null) => ({
  "Access-Control-Allow-Origin": ALLOWED_ORIGINS.includes(origin ?? "") ? origin! : ALLOWED_ORIGINS[0],
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
});

// Reuse Supabase client across requests (module-level singleton)
const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

Deno.serve(async (req) => {
  const origin = req.headers.get("Origin");
  const headers = corsHeaders(origin);

  if (req.method === "OPTIONS") {
    return new Response("ok", { headers });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonError("Missing or invalid authorization header", 401);
    }

    // Call 1: Auth (required — cannot be combined)
    const token = authHeader.replace("Bearer ", "");
    const {
      data: { user },
      error: authError,
    } = await supabaseAdmin.auth.getUser(token);

    if (authError || !user) {
      return jsonError("Invalid or expired token", 401);
    }

    const body = await req.json();
    const {
      tier_key,
      messages,
      max_tokens = 800,
      temperature = 0.7,
      top_p = 0.9,
      top_k = 40,
      repetition_penalty = 1.0,
    } = body;

    if (!tier_key || !messages?.length) {
      return jsonError("Missing tier_key or messages", 400);
    }

    // Call 2: Combined RPC — role + quota + tier + API key in ONE call
    const { data: ctx, error: ctxError } = await supabaseAdmin.rpc(
      "prepare_chat_context",
      { p_user_id: user.id, p_tier_key: tier_key },
    );

    if (ctxError) {
      console.error("prepare_chat_context failed:", ctxError);
      return jsonError("Could not prepare chat context", 500);
    }

    const isPrivileged = ctx.is_privileged as boolean;
    const quota = ctx.quota;
    const tierResult = ctx.tier;
    const apiKey = ctx.api_key as string | null;

    // Check quota (skip for privileged roles)
    if (!isPrivileged && quota.remaining <= 0) {
      return new Response(
        JSON.stringify({
          error: "quota_exceeded",
          message:
            "Đã hết lượt chat hôm nay. Nâng cấp Pro để chat không giới hạn!",
          quota,
        }),
        {
          status: 403,
          headers: { ...headers, "Content-Type": "application/json" },
        },
      );
    }

    // Check tier errors
    if (tierResult.error === "tier_not_found") {
      return jsonError("Tier không tồn tại", 400);
    }

    if (tierResult.error === "tier_restricted") {
      return new Response(
        JSON.stringify({
          error: "tier_restricted",
          message:
            tierResult.message ||
            "Tier này yêu cầu gói Pro. Vui lòng nâng cấp.",
          quota,
        }),
        {
          status: 403,
          headers: { ...headers, "Content-Type": "application/json" },
        },
      );
    }

    const resolvedModel = tierResult.model_id as string;

    // Check API key availability
    if (!apiKey) {
      console.error("No API key available in pool");
      return jsonError(
        "Không có API key nào khả dụng. Liên hệ admin.",
        500,
      );
    }

    // Proxy to OpenRouter
    const orResponse = await fetch(
      "https://openrouter.ai/api/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "HTTP-Referer": "https://vietrp.com",
          "X-Title": "VietRP",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: resolvedModel,
          messages,
          stream: true,
          max_tokens,
          temperature,
          top_p,
          top_k,
          repetition_penalty,
          reasoning: { effort: "high", exclude: true },
        }),
      },
    );

    if (!orResponse.ok) {
      const errText = await orResponse.text();
      const status = orResponse.status;
      console.error(`OpenRouter error ${status}:`, errText);
      return new Response(
        JSON.stringify({
          error: `openrouter_${status}`,
          message:
            status === 429
              ? "Quá nhiều yêu cầu, vui lòng thử lại sau."
              : status === 402
                ? "Platform hết credits. Liên hệ admin."
                : `Lỗi từ AI: ${status}`,
        }),
        {
          status: status === 429 ? 429 : status === 402 ? 402 : 502,
          headers: { ...headers, "Content-Type": "application/json" },
        },
      );
    }

    // Fire-and-forget: increment usage + log
    supabaseAdmin
      .rpc("increment_chat_count", { p_user_id: user.id })
      .then(({ error }) => {
        if (error) console.error("increment_chat_count error:", error);
      });

    supabaseAdmin
      .from("usage_logs")
      .insert({
        user_id: user.id,
        feature: "chat",
        credits_used: 0,
        metadata: {
          tier_key,
          model: resolvedModel,
          message_count: messages.length,
        },
      })
      .then(({ error }) => {
        if (error) console.error("usage_log insert error:", error);
      });

    // Stream SSE response back to client
    return new Response(orResponse.body, {
      headers: {
        ...headers,
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
      },
    });
  } catch (err) {
    console.error("chat-proxy error:", err);
    return jsonError(
      err instanceof Error ? err.message : "Internal server error",
      500,
    );
  }
});

function jsonError(message: string, status: number) {
  return new Response(JSON.stringify({ error: message }), {
    status,
    headers: {
      ...headers,
      "Content-Type": "application/json",
    },
  });
}
