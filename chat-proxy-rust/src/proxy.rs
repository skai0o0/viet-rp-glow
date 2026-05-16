use axum::body::Body;
use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use axum::response::Response;
use axum::Json;
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use serde_json::json;
use tokio::sync::oneshot;

use crate::db;
use crate::error::AppError;
use crate::AppState;

/// Token usage data extracted from OpenRouter SSE stream.
#[derive(Debug, Clone)]
struct TokenUsage {
    prompt_tokens: u32,
    completion_tokens: u32,
    total_tokens: u32,
}

#[derive(Debug, Deserialize)]
pub struct ChatRequest {
    pub messages: Vec<serde_json::Value>,
    #[serde(default)]
    pub max_tokens: Option<u32>,
    #[serde(default)]
    pub temperature: Option<f32>,
    #[serde(default)]
    pub top_p: Option<f32>,
    #[serde(default)]
    pub top_k: Option<u32>,
    #[serde(default)]
    pub repetition_penalty: Option<f32>,
    #[serde(default = "default_tier")]
    pub tier_key: String,
}

fn default_tier() -> String {
    "free".to_string()
}

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

/// POST /v1/chat/completions
/// Proxies the request to OpenRouter with SSE streaming.
pub async fn handle_chat(
    State(state): State<AppState>,
    headers: HeaderMap,
    Json(req): Json<ChatRequest>,
) -> Result<Response, AppError> {
    // 1. Extract and validate JWT from Authorization header
    let token = headers
        .get("authorization")
        .and_then(|v| v.to_str().ok())
        .and_then(|v| v.strip_prefix("Bearer "))
        .ok_or(AppError::Unauthorized)?;

    let claims = crate::auth::validate_jwt(token, &state.jwt_secret)?;
    let user_id = crate::auth::extract_user_id(&claims)?;

    // 2. Single batched DB query for role, quota, model, key
    let ctx = db::prepare_chat_context(&state.pool, user_id, &req.tier_key).await?;

    // 3. Check quota
    if ctx.quota_remaining <= 0 {
        // Check if user wants to spend a credit
        let use_credit = headers
            .get("x-use-credit")
            .and_then(|v| v.to_str().ok())
            .map(|v| v == "true")
            .unwrap_or(false);

        if !use_credit {
            return Err(AppError::Forbidden("Daily quota exceeded".to_string()));
        }
    }

    // 4. Check tier access
    let user_sub_level = match claims.role.as_deref() {
        Some("admin") | Some("op") => "unlimited",
        _ => "free", // TODO: derive from user's actual subscription
    };
    if !tier_access_allowed(user_sub_level, &ctx.min_subscription) {
        return Err(AppError::Forbidden(format!(
            "Tier '{}' requires '{}' subscription or higher",
            req.tier_key, ctx.min_subscription
        )));
    }

    // 5. Get API key from in-memory pool (no DB hit)
    let api_key = state.key_pool.next().await;
    if api_key.is_empty() {
        return Err(AppError::Internal("No API keys available".to_string()));
    }

    // 6. Build OpenRouter request
    let message_count = req.messages.len() as i32;
    let or_req = OpenRouterRequest {
        model: ctx.model_id.clone(),
        messages: req.messages,
        stream: true,
        max_tokens: req.max_tokens,
        temperature: req.temperature,
        top_p: req.top_p,
        top_k: req.top_k,
        repetition_penalty: req.repetition_penalty,
    };

    // 7. Call OpenRouter with streaming
    let mut or_request_builder = state
        .http_client
        .post("https://openrouter.ai/api/v1/chat/completions")
        .bearer_auth(&api_key)
        .header("HTTP-Referer", "https://vietrp.com")
        .header("X-Title", "VietRP");

    // Enable prompt caching for Claude models
    if ctx.model_id.starts_with("anthropic/") {
        or_request_builder = or_request_builder
            .header("anthropic-beta", "prompt-caching-2024-07-31");
    }

    let or_response = or_request_builder
        .json(&or_req)
        .send()
        .await
        .map_err(|e| AppError::BadGateway(format!("OpenRouter request failed: {}", e)))?;

    if !or_response.status().is_success() {
        let status = or_response.status();
        let body = or_response.text().await.unwrap_or_default();
        tracing::error!("OpenRouter returned {}: {}", status, body);
        return Err(AppError::BadGateway(format!(
            "OpenRouter error: {}",
            status
        )));
    }

    // 8. Set up usage tracking + fire-and-forget logging
    let (usage_tx, usage_rx) = oneshot::channel::<Option<TokenUsage>>();
    let pool_clone = state.pool.clone();
    let user_id_clone = user_id;
    let use_credit = headers
        .get("x-use-credit")
        .and_then(|v| v.to_str().ok())
        .map(|v| v == "true")
        .unwrap_or(false);
    let credits_used = if use_credit { 1 } else { 0 };
    let tier_key = req.tier_key.clone();
    let model_id = ctx.model_id.clone();

    tokio::spawn(async move {
        // Increment daily chat count
        if let Err(e) = db::increment_chat_count(&pool_clone, user_id_clone).await {
            tracing::error!("Failed to increment chat count: {}", e);
        }

        // Wait for usage data from stream (timeout 10s — stream may end before usage arrives)
        let usage = tokio::time::timeout(
            std::time::Duration::from_secs(10),
            usage_rx,
        )
        .await
        .ok()
        .and_then(|r| r.ok())
        .flatten();

        let metadata = json!({
            "tier_key": tier_key,
            "model": model_id,
            "message_count": message_count,
            "input_tokens": usage.as_ref().map(|u| u.prompt_tokens),
            "output_tokens": usage.as_ref().map(|u| u.completion_tokens),
            "total_tokens": usage.as_ref().map(|u| u.total_tokens),
        });
        if let Err(e) = db::log_usage(&pool_clone, user_id_clone, "chat", credits_used, metadata).await {
            tracing::error!("Failed to log usage: {}", e);
        }
    });

    // 9. SSE passthrough with usage extraction: peek at bytes for token usage, forward unchanged
    let stream = track_usage_stream(or_response.bytes_stream(), usage_tx);

    let body = Body::from_stream(stream);

    let response = Response::builder()
        .status(StatusCode::OK)
        .header("Content-Type", "text/event-stream")
        .header("Cache-Control", "no-cache")
        .header("Connection", "keep-alive")
        .header("X-Accel-Buffering", "no")
        .body(body)
        .unwrap();

    Ok(response)
}

/// Simple tier access check.
fn tier_access_allowed(user_level: &str, required: &str) -> bool {
    let levels = ["free", "basic", "pro", "vip", "unlimited"];
    let user_idx = levels.iter().position(|&l| l == user_level).unwrap_or(0);
    let required_idx = levels.iter().position(|&l| l == required).unwrap_or(0);
    user_idx >= required_idx
}

/// Wrap an SSE byte stream to extract token usage from the final event.
/// Bytes are forwarded unchanged — zero-copy behavior is preserved.
fn track_usage_stream(
    stream: impl futures_util::Stream<Item = reqwest::Result<bytes::Bytes>> + Send + 'static,
    usage_tx: oneshot::Sender<Option<TokenUsage>>,
) -> impl futures_util::Stream<Item = std::io::Result<bytes::Bytes>> {
    use std::sync::{Arc, Mutex};

    let state = Arc::new(Mutex::new(TrackingState {
        usage_tx: Some(usage_tx),
        buffer: String::new(),
    }));

    stream.map(move |result| {
        match result {
            Err(e) => Err(std::io::Error::new(std::io::ErrorKind::Other, e)),
            Ok(bytes) => {
                // Peek at bytes to extract usage — does not modify or delay the stream
                if let Ok(text) = std::str::from_utf8(&bytes) {
                    let mut st = state.lock().unwrap();
                    st.buffer.push_str(text);

                    // Look for usage data in SSE events
                    if st.usage_tx.is_some() && st.buffer.contains("\"usage\"") {
                        if let Some(usage) = extract_usage_from_sse(&st.buffer) {
                            if let Some(tx) = st.usage_tx.take() {
                                let _ = tx.send(Some(usage));
                            }
                        }
                    }

                    // Keep buffer from growing unbounded — only need recent tail
                    if st.buffer.len() > 8192 {
                        let keep = st.buffer.len() - 4096;
                        st.buffer.drain(..keep);
                    }
                }
                Ok(bytes)
            }
        }
    })
}

/// Extract token usage from SSE buffer text.
fn extract_usage_from_sse(buffer: &str) -> Option<TokenUsage> {
    for line in buffer.lines().rev() {
        let line = line.trim();
        if !line.starts_with("data: ") {
            continue;
        }
        let json_str = line.strip_prefix("data: ").unwrap_or(line);
        if json_str == "[DONE]" {
            continue;
        }
        if let Ok(val) = serde_json::from_str::<serde_json::Value>(json_str) {
            if let Some(usage) = val.get("usage") {
                return Some(TokenUsage {
                    prompt_tokens: usage.get("prompt_tokens").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
                    completion_tokens: usage.get("completion_tokens").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
                    total_tokens: usage.get("total_tokens").and_then(|v| v.as_u64()).unwrap_or(0) as u32,
                });
            }
        }
    }
    None
}

/// Internal state for the usage tracking stream wrapper.
struct TrackingState {
    usage_tx: Option<oneshot::Sender<Option<TokenUsage>>>,
    buffer: String,
}
