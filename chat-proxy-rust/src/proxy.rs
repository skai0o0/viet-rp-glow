use axum::body::Body;
use axum::extract::State;
use axum::http::{HeaderMap, StatusCode};
use axum::response::{IntoResponse, Response};
use axum::Json;
use futures_util::StreamExt;
use serde::{Deserialize, Serialize};
use serde_json::json;
use uuid::Uuid;

use crate::auth::Claims;
use crate::db;
use crate::error::AppError;
use crate::AppState;

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
    let or_response = state
        .http_client
        .post("https://openrouter.ai/api/v1/chat/completions")
        .bearer_auth(&api_key)
        .header("HTTP-Referer", "https://vietrp.com")
        .header("X-Title", "VietRP")
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

    // 8. Fire-and-forget: async logging (does NOT block the response)
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
    let message_count = req.messages.len() as i32;

    tokio::spawn(async move {
        // Increment daily chat count
        if let Err(e) = db::increment_chat_count(&pool_clone, user_id_clone).await {
            tracing::error!("Failed to increment chat count: {}", e);
        }
        // Log usage
        let metadata = json!({
            "tier_key": tier_key,
            "model": model_id,
            "message_count": message_count,
        });
        if let Err(e) = db::log_usage(&pool_clone, user_id_clone, "chat", credits_used, metadata).await {
            tracing::error!("Failed to log usage: {}", e);
        }
    });

    // 9. Zero-copy SSE passthrough: pipe bytes directly from reqwest → Axum response
    let stream = or_response.bytes_stream().map(|result| {
        result.map_err(|e| std::io::Error::new(std::io::ErrorKind::Other, e))
    });

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
