use jsonwebtoken::{decode, Algorithm, DecodingKey, Validation};
use serde::{Deserialize, Serialize};
use uuid::Uuid;

use crate::error::AppError;

#[derive(Debug, Serialize, Deserialize, Clone)]
pub struct Claims {
    /// Subject — the Supabase user UUID
    pub sub: String,
    /// JWT issued-at timestamp
    pub iat: Option<u64>,
    /// JWT expiry timestamp
    pub exp: Option<u64>,
    /// Supabase app_metadata.role (e.g. "admin", "op", "moderator")
    pub role: Option<String>,
    /// Supabase user_metadata
    pub user_metadata: Option<serde_json::Value>,
    /// Supabase app_metadata
    pub app_metadata: Option<serde_json::Value>,
}

/// Validate a Supabase JWT locally using the JWT secret.
/// No HTTP call to Supabase Auth — pure HS256 decode + expiry check.
pub fn validate_jwt(token: &str, jwt_secret: &[u8]) -> Result<Claims, AppError> {
    let mut validation = Validation::new(Algorithm::HS256);
    // Supabase tokens use "authenticated" as the aud claim
    validation.set_audience(&["authenticated"]);
    // Don't require specific issuer — Supabase uses the project URL
    validation.validate_exp = true;

    let key = DecodingKey::from_secret(jwt_secret);
    let token_data = decode::<Claims>(token, &key, &validation)
        .map_err(|e| {
            tracing::warn!("JWT validation failed: {}", e);
            AppError::Unauthorized
        })?;

    Ok(token_data.claims)
}

/// Extract the user UUID from validated claims.
pub fn extract_user_id(claims: &Claims) -> Result<Uuid, AppError> {
    Uuid::parse_str(&claims.sub).map_err(|_| AppError::Unauthorized)
}
