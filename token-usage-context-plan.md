# VietRP — Prompt Cải Thiện Backend: Token Efficiency + Context Quality

> Paste vào Cursor / Claude Code cùng toàn bộ codebase.
> Mục tiêu: tiết kiệm token, AI hiểu context tốt hơn, chat mạch lạc hơn.
> Phạm vi: `chat-proxy-rust/src/`, `src/utils/promptBuilder.ts`, `src/hooks/`, Supabase DB.

---

## PHÂN TÍCH HIỆN TRẠNG (đã đọc code)

### Điểm mạnh hiện có — KHÔNG được phá vỡ:
- `db.rs` → `prepare_chat_context()`: 1 CTE query duy nhất, rất tốt
- `key_pool.rs`: Round-robin in-memory, không cần sửa
- `proxy.rs`: Zero-copy SSE passthrough, giữ nguyên
- `auth.rs`: Local JWT decode, không gọi Supabase Auth, rất tốt

### Vấn đề cần fix (theo thứ tự ưu tiên):

| # | Vấn đề | File | Impact |
|---|---|---|---|
| 1 | `random_key` trong CTE vẫn dùng `ORDER BY random()` — DB hit mỗi request | `db.rs` | Token cost gián tiếp (latency) |
| 2 | Không có token counting → history không bị prune → context tràn | `promptBuilder.ts` | Token waste nghiêm trọng |
| 3 | `message_count` log chỉ đếm số messages, không đếm tokens thực | `proxy.rs` | Không có data để optimize |
| 4 | Subscription check dùng `monthly_chat_limit` nhưng quota check dùng `daily_chat_usage` — mâu thuẫn logic | `db.rs` | Bug tiềm ẩn |
| 5 | Không có prompt caching header cho OpenRouter | `proxy.rs` | Bỏ phí 50-90% token savings |
| 6 | `global_settings` fetch mỗi request thay vì cache | client-side | Latency + DB load |
| 7 | Example messages inject không có token budget | `promptBuilder.ts` | Token waste |
| 8 | Không có conversation summary cho long sessions | missing feature | Context quality |

---

## IMPROVEMENT #1 — HIGH IMPACT: Xóa `ORDER BY random()` khỏi CTE

### Vấn đề
Trong `db.rs`, CTE `random_key` vẫn dùng `ORDER BY random()` dù `KeyPool` đã load keys vào memory. Đây là DB hit thừa trên mỗi request, và key lấy từ DB query bị ignore vì `proxy.rs` đang dùng `state.key_pool.next()` — không phải `ctx.api_key`.

### Fix
Trong `db.rs`, xóa `random_key` CTE ra khỏi `prepare_chat_context()` hoàn toàn. Field `api_key` trong `ChatContext` cũng bỏ luôn:

```rust
// db.rs — ChatContext struct sau khi fix
#[derive(Debug, sqlx::FromRow)]
pub struct ChatContext {
    pub user_id: Uuid,
    pub role: String,
    pub tier_key: String,
    pub model_id: String,
    // Bỏ api_key — lấy từ KeyPool, không cần DB
    pub quota_remaining: i32,
    pub min_subscription: String,
    pub subscription_tier: String, // thêm để fix bug #4
}
```

Query trong `prepare_chat_context()` sau khi bỏ `random_key` CTE:

```sql
WITH user_role AS (
    SELECT COALESCE(
        (SELECT role::text FROM user_roles WHERE user_id = $1 LIMIT 1),
        'user'
    ) AS role
),
plan_info AS (
    SELECT
        sp.daily_chat_limit,   -- đổi sang daily để match daily_chat_usage
        sp.name AS plan_name
    FROM subscription_plans sp
    JOIN user_subscriptions us ON us.plan_id = sp.id
    WHERE us.user_id = $1 AND us.status = 'active'
    ORDER BY sp.daily_chat_limit DESC
    LIMIT 1
),
usage AS (
    SELECT COALESCE(message_count, 0) AS used
    FROM daily_chat_usage
    WHERE user_id = $1 AND usage_date = CURRENT_DATE
),
tier AS (
    SELECT model_id, min_subscription
    FROM model_tiers
    WHERE tier_key = $2 AND is_active = true
    LIMIT 1
)
SELECT
    $1 AS user_id,
    ur.role,
    $2 AS tier_key,
    COALESCE(t.model_id, 'google/gemini-2.0-flash-exp:free') AS model_id,
    CASE
        WHEN ur.role IN ('admin', 'op', 'moderator') THEN 999999
        WHEN pi.daily_chat_limit IS NOT NULL THEN GREATEST(pi.daily_chat_limit - u.used, 0)
        ELSE GREATEST(20 - u.used, 0)
    END AS quota_remaining,
    COALESCE(t.min_subscription, 'free') AS min_subscription,
    COALESCE(pi.plan_name, 'free') AS subscription_tier
FROM user_role ur
CROSS JOIN usage u
LEFT JOIN plan_info pi ON true
LEFT JOIN tier t ON true
```

---

## IMPROVEMENT #2 — CRITICAL: Prompt Caching Header cho OpenRouter

### Vấn đề
OpenRouter hỗ trợ **prompt caching** cho Claude và Gemini models. Khi system prompt + character sheet không thay đổi giữa các turns, provider cache phần đó và charge 10% token cost thay vì 100%. Hiện tại VietRP không gửi bất kỳ caching hint nào → bỏ phí 50-90% token cost trên phần static của prompt.

### Fix trong `proxy.rs`

Thêm `cache_control` markers vào OpenRouterRequest:

```rust
// proxy.rs — thêm field vào struct
#[derive(Serialize)]
struct OpenRouterRequest {
    model: String,
    messages: Vec<serde_json::Value>,
    stream: bool,
    #[serde(skip_serializing_if = "Option::is_none")]
    max_tokens: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    temperature: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    top_p: Option<f32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    top_k: Option<u32>,
    #[serde(skip_serializing_if = "Option::is_none")]
    repetition_penalty: Option<f32>,
}
```

Thêm header `anthropic-beta: prompt-caching-2024-07-31` khi model là Claude:

```rust
// proxy.rs — trong handle_chat(), khi build request tới OpenRouter
let mut or_request_builder = state
    .http_client
    .post("https://openrouter.ai/api/v1/chat/completions")
    .bearer_auth(&api_key)
    .header("HTTP-Referer", "https://vietrp.com")
    .header("X-Title", "VietRP");

// Enable prompt caching cho Claude models
if ctx.model_id.starts_with("anthropic/") {
    or_request_builder = or_request_builder
        .header("anthropic-beta", "prompt-caching-2024-07-31");
}

let or_response = or_request_builder
    .json(&or_req)
    .send()
    .await
    .map_err(|e| AppError::BadGateway(format!("OpenRouter request failed: {}", e)))?;
```

### Fix trong `promptBuilder.ts` (client-side)

Khi build messages array, đánh dấu các message static bằng `cache_control`:

```typescript
// Tầng 1 — Global system prompt (thay đổi rất ít → cache aggressively)
messages.push({
  role: "system",
  content: [
    {
      type: "text",
      text: globalSystemPrompt,
      cache_control: { type: "ephemeral" }  // Claude cache marker
    }
  ]
});

// Tầng 2 — Character Sheet (thay đổi khi đổi char → cache per-character)
messages.push({
  role: "system",
  content: [
    {
      type: "text",
      text: characterSheetContent,
      cache_control: { type: "ephemeral" }
    }
  ]
});

// Tầng 3 trở đi — Chat history: KHÔNG cache (thay đổi mỗi turn)
```

**Lưu ý:** `cache_control` field bị ignore bởi models không hỗ trợ caching — an toàn để gửi cho tất cả models. Chỉ Claude và Gemini 1.5+ thực sự sử dụng.

**Tiết kiệm ước tính:** System prompt ~500-1500 tokens × 10 turns/session = 5000-15000 tokens cached per session → giảm 50-90% cost trên phần static.

---

## IMPROVEMENT #3 — CRITICAL: Token Counting + History Pruning

### Vấn đề
`promptBuilder.ts` không có token counting. Khi history dài (50+ turns với mỗi response ~200-400 tokens), tổng context dễ vượt 8000-16000 tokens. Hậu quả:
- Model bị cắt context → mất thông tin quan trọng
- Cost tăng tuyến tính với số turns
- Model "trôi" character vì attention bị dilute

### Fix: Implement token budget system

```typescript
// src/utils/tokenBudget.ts — file mới

// Approximate token count (bilingual Vietnamese/English)
// Dùng character count thay vì whitespace split cho tiếng Việt
export function estimateTokens(text: string): number {
  if (!text) return 0;
  // Vietnamese avg ~3 chars/token (syllabic), English ~4 chars/token
  // Dùng 3 làm safe lower bound (tránh undercount)
  return Math.ceil(text.length / 3);
}

export interface TokenBudget {
  total: number;           // context window của model
  systemReserved: number;  // cho system prompt + character sheet
  responseReserved: number;// cho AI response (max_tokens)
  historyBudget: number;   // còn lại cho chat history
}

// Context limits theo model — cập nhật khi thêm model mới
export const MODEL_LIMITS: Record<string, number> = {
  "google/gemini-2.0-flash-exp": 32000,    // conservative (actual 1M)
  "google/gemini-2.5-flash-preview": 32000,
  "google/gemini-2.5-pro-preview": 32000,
  "anthropic/claude-3-5-haiku": 50000,
  "anthropic/claude-sonnet-4-5": 50000,
  "gryphe/mythomax-l2-13b": 3800,          // 4096 - safety margin
  "mistralai/mistral-7b-instruct": 7500,
  "default": 7000,
};

export function calculateTokenBudget(
  modelId: string,
  systemTokens: number,
  maxResponseTokens: number = 800
): TokenBudget {
  const total = MODEL_LIMITS[modelId] ?? MODEL_LIMITS["default"];
  const systemReserved = systemTokens + 200; // +200 safety buffer
  const responseReserved = maxResponseTokens;
  const historyBudget = Math.max(
    total - systemReserved - responseReserved,
    500 // minimum — luôn giữ ít nhất vài turns
  );

  return { total, systemReserved, responseReserved, historyBudget };
}

export function pruneHistory(
  history: ChatMessage[],
  budget: TokenBudget,
  charName: string,
  userName: string
): ChatMessage[] {
  if (history.length === 0) return [];

  // Luôn giữ first_message của char (index 0 nếu là assistant)
  const hasFirstMsg = history[0]?.role === "assistant";
  const firstMsg = hasFirstMsg ? history[0] : null;
  const rest = hasFirstMsg ? history.slice(1) : history;

  let used = firstMsg ? estimateTokens(firstMsg.content) : 0;
  const kept: ChatMessage[] = [];

  // Duyệt từ cuối lên — ưu tiên giữ tin nhắn gần nhất
  for (let i = rest.length - 1; i >= 0; i--) {
    const content = replaceMacros(rest[i].content, charName, userName);
    const tokens = estimateTokens(content);

    if (used + tokens > budget.historyBudget) {
      // Log để monitor — không throw error
      console.info(
        `[TokenBudget] Pruned ${rest.length - kept.length} messages, ` +
        `kept ${kept.length + (firstMsg ? 1 : 0)}, ` +
        `budget=${budget.historyBudget}, used=${used}`
      );
      break;
    }

    kept.unshift({ ...rest[i], content });
    used += tokens;
  }

  return firstMsg ? [firstMsg, ...kept] : kept;
}
```

---

## IMPROVEMENT #4 — HIGH: Log Token Usage thực tế từ OpenRouter response

### Vấn đề
`proxy.rs` hiện chỉ log `message_count` (số messages trong request). Không biết được bao nhiêu input tokens, output tokens thực sự được dùng → không thể monitor cost, không thể optimize.

OpenRouter trả về usage data trong SSE stream ở event cuối cùng (hoặc qua response header `openrouter-*`).

### Fix trong `proxy.rs`

Thay vì zero-copy passthrough thuần túy, parse SSE event cuối để extract usage:

```rust
// proxy.rs — thêm usage tracking vào stream

use tokio::sync::oneshot;

pub async fn handle_chat(...) -> Result<Response, AppError> {
    // ... existing auth + quota + key logic ...

    // Channel để nhận usage data từ stream processor
    let (usage_tx, usage_rx) = oneshot::channel::<Option<TokenUsage>>();

    // Wrap stream để intercept [DONE] event và extract usage
    let tracked_stream = track_usage_stream(
        or_response.bytes_stream(),
        usage_tx
    );

    let body = Body::from_stream(tracked_stream);

    // Spawn usage logger — đợi usage data từ stream
    let pool_clone = state.pool.clone();
    let user_id_clone = user_id;
    let model_id = ctx.model_id.clone();
    let tier_key = req.tier_key.clone();

    tokio::spawn(async move {
        // Increment daily count ngay (không cần đợi usage)
        let _ = db::increment_chat_count(&pool_clone, user_id_clone).await;

        // Đợi usage data (timeout 5s)
        let usage = tokio::time::timeout(
            std::time::Duration::from_secs(5),
            usage_rx
        ).await.ok().and_then(|r| r.ok()).flatten();

        let metadata = json!({
            "tier_key": tier_key,
            "model": model_id,
            "message_count": message_count,
            "input_tokens": usage.as_ref().map(|u| u.prompt_tokens),
            "output_tokens": usage.as_ref().map(|u| u.completion_tokens),
            "total_tokens": usage.as_ref().map(|u| u.total_tokens),
        });

        let _ = db::log_usage(&pool_clone, user_id_clone, "chat", credits_used, metadata).await;
    });

    // ... build response với tracked_stream ...
}

#[derive(Debug)]
struct TokenUsage {
    prompt_tokens: u32,
    completion_tokens: u32,
    total_tokens: u32,
}

fn track_usage_stream(
    stream: impl futures_util::Stream<Item = reqwest::Result<bytes::Bytes>> + Send + 'static,
    usage_tx: oneshot::Sender<Option<TokenUsage>>,
) -> impl futures_util::Stream<Item = std::io::Result<bytes::Bytes>> {
    use futures_util::StreamExt;

    let mut usage_tx = Some(usage_tx);
    let mut buffer = String::new();

    stream.map(move |result| {
        match result {
            Err(e) => Err(std::io::Error::new(std::io::ErrorKind::Other, e)),
            Ok(bytes) => {
                // Parse SSE để tìm usage trong [DONE] event
                if let Ok(text) = std::str::from_utf8(&bytes) {
                    buffer.push_str(text);

                    // Tìm usage object trong stream
                    // OpenRouter gửi: data: {"usage":{"prompt_tokens":X,...},"choices":[{"finish_reason":"stop",...}]}
                    if buffer.contains("\"usage\"") && buffer.contains("finish_reason") {
                        if let Some(tx) = usage_tx.take() {
                            let usage = extract_usage_from_buffer(&buffer);
                            let _ = tx.send(usage);
                        }
                    }

                    // Giữ buffer nhỏ — chỉ cần phần cuối
                    if buffer.len() > 4096 {
                        buffer = buffer[buffer.len() - 2048..].to_string();
                    }
                }
                Ok(bytes)
            }
        }
    })
}

fn extract_usage_from_buffer(buffer: &str) -> Option<TokenUsage> {
    // Tìm JSON object chứa "usage"
    for line in buffer.lines() {
        if !line.starts_with("data: ") { continue; }
        let json_str = line.trim_start_matches("data: ");
        if json_str == "[DONE]" { continue; }

        if let Ok(val) = serde_json::from_str::<serde_json::Value>(json_str) {
            if let Some(usage) = val.get("usage") {
                return Some(TokenUsage {
                    prompt_tokens: usage["prompt_tokens"].as_u64().unwrap_or(0) as u32,
                    completion_tokens: usage["completion_tokens"].as_u64().unwrap_or(0) as u32,
                    total_tokens: usage["total_tokens"].as_u64().unwrap_or(0) as u32,
                });
            }
        }
    }
    None
}
```

**Lưu ý quan trọng:** Stream bytes vẫn được forward nguyên vẹn — không modify, không delay. Chỉ peek vào bytes để extract metadata. Zero-copy behavior được giữ nguyên cho phần stream chính.

---

## IMPROVEMENT #5 — HIGH: Global Settings Cache (client-side)

### Vấn đề
`global_settings` (chứa system prompt, sampling params) được fetch từ Supabase mỗi lần user vào chat page. System prompt thay đổi rất hiếm (chỉ khi admin update). Đây là DB call thừa và tăng time-to-first-token.

### Fix trong service layer

```typescript
// src/services/settingsCache.ts — file mới

const CACHE_KEY = "vietrp_global_settings";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 phút

interface CachedSettings {
  data: GlobalSettings;
  fetchedAt: number;
}

export async function getGlobalSettings(
  supabase: SupabaseClient,
  forceRefresh = false
): Promise<GlobalSettings> {
  // Check in-memory cache trước (không dùng localStorage — session only)
  const cached = globalSettingsMemCache;

  if (!forceRefresh && cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  // Fetch từ DB
  const { data, error } = await supabase
    .from("global_settings")
    .select("*")
    .single();

  if (error) throw error;

  // Cache in-memory
  globalSettingsMemCache = { data, fetchedAt: Date.now() };

  return data;
}

// Module-level cache (tồn tại suốt session, reset khi reload)
let globalSettingsMemCache: CachedSettings | null = null;

// Dùng trong admin panel để invalidate cache sau khi update
export function invalidateGlobalSettingsCache() {
  globalSettingsMemCache = null;
}
```

---

## IMPROVEMENT #6 — MEDIUM: Conversation Summarization cho Long Sessions

### Vấn đề
Sessions dài (100+ turns) không thể giữ toàn bộ history trong context. Hiện tại prune đơn giản bằng cách bỏ tin nhắn cũ → mất thông tin quan trọng (sự kiện đã xảy ra, điều đã nói, relationship development).

### Fix: Summary injection cho sessions dài

Thêm column `summary` vào `chat_sessions` table (migration):

```sql
ALTER TABLE chat_sessions 
ADD COLUMN IF NOT EXISTS summary TEXT,
ADD COLUMN IF NOT EXISTS summary_updated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS messages_at_summary INTEGER DEFAULT 0;
```

Trong `promptBuilder.ts`, nếu session có summary và history đã bị prune:

```typescript
function buildMessagesWithSummary(
  history: ChatMessage[],
  summary: string | null,
  prunedCount: number,
  budget: TokenBudget,
  charName: string,
  userName: string
): ApiMessage[] {
  const messages: ApiMessage[] = [];

  // Nếu có summary và đã prune messages
  if (summary && prunedCount > 0) {
    messages.push({
      role: "system",
      content: `[Tóm tắt ${prunedCount} tin nhắn trước đó:\n${summary}\n\nCâu chuyện tiếp tục từ đây:]`
    });
  }

  // Phần history còn lại (đã prune)
  messages.push(...history.map(msg => ({
    role: msg.role,
    content: replaceMacros(msg.content, charName, userName)
  })));

  return messages;
}
```

Trigger tạo summary (trong hook hoặc background job) khi session đạt ngưỡng:

```typescript
const SUMMARY_THRESHOLD = 40; // turns
const SUMMARY_INTERVAL = 20;  // tạo summary mới mỗi 20 turns sau đó

async function maybeGenerateSummary(
  session: ChatSession,
  history: ChatMessage[],
  character: CharacterData
): Promise<void> {
  const turnsSinceLastSummary = history.length - (session.messages_at_summary ?? 0);

  // Chỉ generate nếu đủ turns mới
  if (history.length < SUMMARY_THRESHOLD) return;
  if (turnsSinceLastSummary < SUMMARY_INTERVAL) return;

  // Lấy phần history cần summarize (không include phần đã được summary)
  const toSummarize = history.slice(
    session.messages_at_summary ?? 0,
    history.length - 10  // giữ 10 turns cuối ra ngoài summary
  );

  if (toSummarize.length === 0) return;

  // Gọi AI để tạo summary — dùng model rẻ nhất
  const summaryPrompt = buildSummaryPrompt(
    toSummarize,
    character,
    session.summary // summary cũ nếu có
  );

  // Fire-and-forget — không block chat
  generateSummaryInBackground(session.id, summaryPrompt, history.length);
}

function buildSummaryPrompt(
  messages: ChatMessage[],
  character: CharacterData,
  existingSummary: string | null
): string {
  const historyText = messages
    .map(m => `${m.role === "user" ? "{{user}}" : character.name}: ${m.content}`)
    .join("\n");

  return `Tóm tắt ngắn gọn (tối đa 200 từ) những gì đã xảy ra trong đoạn hội thoại roleplay sau. 
Tập trung vào: sự kiện quan trọng, cảm xúc thay đổi, quyết định đã đưa ra, thông tin về mối quan hệ.
Viết bằng tiếng Việt, ở thì quá khứ, từ góc nhìn người kể chuyện trung lập.
${existingSummary ? `\nTóm tắt trước đó (nối tiếp):\n${existingSummary}\n` : ""}
Đoạn hội thoại cần tóm tắt:
${historyText}

Tóm tắt:`;
}
```

---

## IMPROVEMENT #7 — MEDIUM: Sampling Parameters tối ưu theo character type

### Vấn đề
Hiện tại `temperature`, `top_p`, `repetition_penalty` được gửi thẳng từ client (hoặc dùng model default nếu không có). Không có logic điều chỉnh theo loại nhân vật hay mode chat.

### Fix trong `proxy.rs` hoặc client-side

Thêm preset sampling configs:

```typescript
// src/utils/samplingPresets.ts

interface SamplingParams {
  temperature: number;
  top_p: number;
  repetition_penalty: number;
  max_tokens: number;
}

// Preset theo response style (map với 4 mode hiện có của VietRP)
export const SAMPLING_PRESETS: Record<string, SamplingParams> = {
  // Short response — cần focused, ít hallucinate
  short: {
    temperature: 0.75,
    top_p: 0.85,
    repetition_penalty: 1.15,
    max_tokens: 300,
  },
  // Detailed response — cần creative, phong phú
  detailed: {
    temperature: 0.90,
    top_p: 0.92,
    repetition_penalty: 1.05,
    max_tokens: 800,
  },
  // Match character — balance giữa consistency và creativity
  match_character: {
    temperature: 0.82,
    top_p: 0.90,
    repetition_penalty: 1.10,
    max_tokens: 500,
  },
  // Match user — adapt theo input length của user
  match_user: {
    temperature: 0.80,
    top_p: 0.88,
    repetition_penalty: 1.12,
    max_tokens: 400,
  },
};

// Override theo model family — llama models cần rep_penalty cao hơn
export function adjustForModel(
  params: SamplingParams,
  modelId: string
): SamplingParams {
  if (modelId.includes("mytho") || modelId.includes("llama")) {
    return { ...params, repetition_penalty: Math.min(params.repetition_penalty + 0.05, 1.30) };
  }
  if (modelId.includes("gemini")) {
    // Gemini không dùng repetition_penalty
    return { ...params, repetition_penalty: 1.0 };
  }
  return params;
}
```

---

## DB MIGRATION cần thiết

Tạo file migration mới (sau 14 files hiện có):

```sql
-- migration_015_chat_optimization.sql

-- 1. Thêm summary vào chat_sessions
ALTER TABLE chat_sessions 
ADD COLUMN IF NOT EXISTS summary TEXT,
ADD COLUMN IF NOT EXISTS summary_updated_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS messages_at_summary INTEGER DEFAULT 0;

-- 2. Thêm token usage vào usage_logs (nếu chưa có)
-- usage_logs.metadata là JSONB nên không cần alter — ghi thẳng vào JSON

-- 3. Index cho daily_chat_usage (nếu chưa có)
CREATE INDEX IF NOT EXISTS idx_daily_chat_usage_user_date 
ON daily_chat_usage(user_id, usage_date);

-- 4. Index cho chat_sessions lookup
CREATE INDEX IF NOT EXISTS idx_chat_sessions_user_char 
ON chat_sessions(user_id, character_id);

-- 5. Đổi subscription_plans: monthly_chat_limit → daily_chat_limit
-- CHỈ làm nếu column monthly_chat_limit chưa phản ánh giới hạn daily
-- Kiểm tra trước: SELECT column_name FROM information_schema.columns WHERE table_name = 'subscription_plans';
-- ALTER TABLE subscription_plans ADD COLUMN IF NOT EXISTS daily_chat_limit INTEGER;
-- UPDATE subscription_plans SET daily_chat_limit = 20 WHERE name = 'Free';
-- UPDATE subscription_plans SET daily_chat_limit = 200 WHERE name = 'Pro';
```

---

## CHECKLIST SAU KHI SỬA

### Performance
- [ ] `prepare_chat_context()` không còn `ORDER BY random()` — verify bằng EXPLAIN ANALYZE
- [ ] `global_settings` được cache in-memory — verify chỉ fetch 1 lần mỗi 5 phút
- [ ] Token usage được log trong `usage_logs.metadata` — check vài records sau khi deploy

### Token Efficiency
- [ ] History bị prune đúng khi vượt budget — test với session 50+ turns
- [ ] `cache_control` headers được gửi cho Claude models — verify trong OpenRouter dashboard
- [ ] Gemini models không nhận `repetition_penalty` — check request payload

### Context Quality
- [ ] Sessions có 40+ turns → summary được tạo → inject đúng vào prompt
- [ ] Summary không thay thế hoàn toàn history — 10 turns cuối vẫn full
- [ ] Prune log xuất hiện trong console khi history bị cắt

### Không bị break
- [ ] SSE stream vẫn zero-copy, không delay thêm
- [ ] `KeyPool` vẫn round-robin, không fallback về DB key
- [ ] Tất cả tính năng chat cũ hoạt động: prefill, regen, branch, edit

---

## THỨ TỰ THỰC HIỆN ĐỀ XUẤT

```
Ngày 1: Improvement #2 (Prompt Caching) → update ngay trong Admin panel, test cost
Ngày 1: Improvement #3 (Token Counting) → implement tokenBudget.ts, test với MythoMax
Ngày 2: Improvement #1 (Bỏ random_key CTE) → sửa db.rs, redeploy Rust proxy
Ngày 2: Improvement #5 (Settings Cache) → nhỏ, test nhanh
Ngày 3: Improvement #4 (Token Usage Log) → sửa proxy.rs, verify data trong DB
Ngày 4: DB Migration + Improvement #6 (Summary) → test với long sessions
Ngày 5: Improvement #7 (Sampling Presets) → tune và test từng mode
```

**Ưu tiên tuyệt đối nếu chỉ có 1 ngày:** Làm #2 (Prompt Caching) + #3 (Token Counting) — hai cái này cho ROI cao nhất ngay lập tức.