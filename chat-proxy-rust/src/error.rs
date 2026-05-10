use axum::http::StatusCode;
use axum::response::{IntoResponse, Response};
use serde_json::json;

#[derive(Debug)]
pub enum AppError {
    Unauthorized,
    Forbidden(String),
    Internal(String),
    BadGateway(String),
}

impl IntoResponse for AppError {
    fn into_response(self) -> Response {
        let (status, message) = match self {
            AppError::Unauthorized => (StatusCode::UNAUTHORIZED, "Invalid or expired token".to_string()),
            AppError::Forbidden(msg) => (StatusCode::FORBIDDEN, msg),
            AppError::Internal(msg) => (StatusCode::INTERNAL_SERVER_ERROR, msg),
            AppError::BadGateway(msg) => (StatusCode::BAD_GATEWAY, msg),
        };

        let body = axum::Json(json!({ "error": message }));
        (status, body).into_response()
    }
}

impl From<sqlx::Error> for AppError {
    fn from(e: sqlx::Error) -> Self {
        tracing::error!("Database error: {}", e);
        AppError::Internal("Database error".to_string())
    }
}

impl From<reqwest::Error> for AppError {
    fn from(e: reqwest::Error) -> Self {
        tracing::error!("HTTP error: {}", e);
        AppError::BadGateway(format!("Upstream error: {}", e))
    }
}
