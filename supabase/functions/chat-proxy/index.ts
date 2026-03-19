import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return jsonError("Missing or invalid authorization header", 401);
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabaseAdmin = createClient(supabaseUrl, serviceRoleKey);

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

    // 0. Check if user has a privileged role (admin / op / moderator) → unlimited quota.
    //    One DB round-trip per request is acceptable at current scale; move to JWT
    //    claims if this becomes a performance bottleneck.
    const { data: userRole } = await supabaseAdmin
      .from("user_roles")
      .select("role")
      .eq("user_id", user.id)
      .in("role", ["admin", "op", "moderator"])
      .maybeSingle();

    const isPrivileged = userRole !== null;

    // 1. Check quota (skip for privileged roles)
    const { data: quota, error: quotaError } = await supabaseAdmin.rpc(
      "check_chat_quota",
      { p_user_id: user.id },
    );

    if (quotaError) {
      console.error("Quota check failed:", quotaError);
      return jsonError("Could not check quota", 500);
    }

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
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 2. Resolve tier → actual model ID + access check
    //    Privileged users bypass subscription restrictions and may use any active tier.
    let resolvedModel: string;
    if (isPrivileged) {
      const { data: tierData, error: tierFetchError } = await supabaseAdmin
        .from("model_tiers")
        .select("model_id")
        .eq("tier_key", tier_key)
        .eq("is_active", true)
        .maybeSingle();

      if (tierFetchError || !tierData) {
        return jsonError("Tier không tồn tại", 400);
      }
      resolvedModel = tierData.model_id as string;
    } else {
      const { data: tierResult, error: tierError } = await supabaseAdmin.rpc(
        "resolve_model_tier",
        { p_tier_key: tier_key, p_user_id: user.id },
      );

      if (tierError) {
        console.error("Tier resolve failed:", tierError);
        return jsonError("Could not resolve model tier", 500);
      }

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
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      resolvedModel = tierResult.model_id as string;
    }

    // 3. Pick a random API key from the pool
    const { data: apiKey, error: keyError } = await supabaseAdmin.rpc(
      "pick_random_api_key",
    );

    if (keyError || !apiKey) {
      console.error("No API key available:", keyError);
      return jsonError(
        "Không có API key nào khả dụng. Liên hệ admin.",
        500,
      );
    }

    // 4. Proxy to OpenRouter
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
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    // 5. Increment usage (fire-and-forget)
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

    // 6. Stream SSE response back to client
    return new Response(orResponse.body, {
      headers: {
        ...corsHeaders,
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
  return new Response(JSON.stringify({ error: message, message }), {
    status,
    headers: {
      ...corsHeaders,
      "Content-Type": "application/json",
    },
  });
}
