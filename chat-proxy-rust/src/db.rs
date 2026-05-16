use chrono::Utc;
use sqlx::PgPool;
use uuid::Uuid;

use crate::error::AppError;

/// Combined context fetched in a single DB round-trip.
#[derive(Debug, sqlx::FromRow)]
pub struct ChatContext {
    pub user_id: Uuid,
    pub role: String,
    pub tier_key: String,
    pub model_id: String,
    pub quota_remaining: i32,
    pub min_subscription: String,
    pub subscription_tier: String,
}

/// Single query that resolves user role, quota, model tier, and picks an API key.
/// Mirrors the Supabase `prepare_chat_context` RPC.
pub async fn prepare_chat_context(
    pool: &PgPool,
    user_id: Uuid,
    tier_key: &str,
) -> Result<ChatContext, AppError> {
    let row = sqlx::query_as::<_, ChatContext>(
        r#"
        WITH user_role AS (
            SELECT COALESCE(
                (SELECT role::text FROM user_roles WHERE user_id = $1 LIMIT 1),
                'user'
            ) AS role
        ),
        plan_info AS (
            SELECT
                sp.monthly_chat_limit,
                sp.name AS plan_name
            FROM subscription_plans sp
            JOIN user_subscriptions us ON us.plan_id = sp.id
            WHERE us.user_id = $1 AND us.status = 'active'
            ORDER BY sp.monthly_chat_limit DESC
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
            COALESCE(t.model_id, 'google/gemma-3-12b-it:free') AS model_id,
            CASE
                WHEN ur.role IN ('admin', 'op') THEN 999999
                WHEN pi.monthly_chat_limit IS NOT NULL THEN GREATEST(pi.monthly_chat_limit - u.used, 0)
                ELSE GREATEST(20 - u.used, 0)
            END AS quota_remaining,
            COALESCE(t.min_subscription, 'free') AS min_subscription,
            COALESCE(pi.plan_name, 'free') AS subscription_tier
        FROM user_role ur
        CROSS JOIN usage u
        LEFT JOIN plan_info pi ON true
        LEFT JOIN tier t ON true
        "#,
    )
    .bind(user_id)
    .bind(tier_key)
    .fetch_one(pool)
    .await?;

    Ok(row)
}

/// Upsert daily chat usage counter.
pub async fn increment_chat_count(pool: &PgPool, user_id: Uuid) -> Result<(), AppError> {
    sqlx::query(
        r#"
        INSERT INTO daily_chat_usage (user_id, usage_date, message_count)
        VALUES ($1, CURRENT_DATE, 1)
        ON CONFLICT (user_id, usage_date)
        DO UPDATE SET message_count = daily_chat_usage.message_count + 1
        "#,
    )
    .bind(user_id)
    .execute(pool)
    .await?;

    Ok(())
}

/// Async usage log insert — fire-and-forget.
pub async fn log_usage(
    pool: &PgPool,
    user_id: Uuid,
    feature: &str,
    credits_used: i32,
    metadata: serde_json::Value,
) -> Result<(), AppError> {
    sqlx::query(
        r#"
        INSERT INTO usage_logs (user_id, feature, credits_used, metadata, created_at)
        VALUES ($1, $2, $3, $4, $5)
        "#,
    )
    .bind(user_id)
    .bind(feature)
    .bind(credits_used)
    .bind(metadata)
    .bind(Utc::now())
    .execute(pool)
    .await?;

    Ok(())
}
