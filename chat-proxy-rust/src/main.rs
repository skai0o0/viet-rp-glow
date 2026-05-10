mod auth;
mod db;
mod error;
mod key_pool;
mod proxy;

use axum::routing::post;
use axum::Router;
use sqlx::postgres::PgPoolOptions;
use tower_http::cors::{Any, CorsLayer};

/// Shared application state.
#[derive(Clone)]
pub struct AppState {
    pub pool: sqlx::PgPool,
    pub jwt_secret: Vec<u8>,
    pub http_client: reqwest::Client,
    pub key_pool: key_pool::KeyPool,
}

#[tokio::main]
async fn main() -> anyhow::Result<()> {
    // Initialize tracing
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "chat_proxy=info,tower_http=info".into()),
        )
        .init();

    // Load .env
    dotenvy::dotenv().ok();

    let database_url =
        std::env::var("DATABASE_URL").expect("DATABASE_URL must be set");
    let jwt_secret =
        std::env::var("SUPABASE_JWT_SECRET").expect("SUPABASE_JWT_SECRET must be set");
    let port: u16 = std::env::var("PORT")
        .unwrap_or_else(|_| "3001".to_string())
        .parse()
        .expect("PORT must be a valid u16");

    // Create database connection pool
    let pool = PgPoolOptions::new()
        .max_connections(10)
        .connect(&database_url)
        .await?;

    tracing::info!("Connected to database");

    // Initialize API key pool from DB
    let key_pool = key_pool::KeyPool::new(&pool).await;

    // Spawn background key refresh (every 5 minutes)
    key_pool::spawn_refresh_task(key_pool.clone(), pool.clone());

    // HTTP client for OpenRouter
    let http_client = reqwest::Client::builder()
        .timeout(std::time::Duration::from_secs(120))
        .build()?;

    let state = AppState {
        pool,
        jwt_secret: jwt_secret.into_bytes(),
        http_client,
        key_pool,
    };

    // CORS — allow requests from any origin (adjust for production)
    let cors = CorsLayer::new()
        .allow_origin(Any)
        .allow_methods(Any)
        .allow_headers(Any);

    // Build router
    let app = Router::new()
        .route("/v1/chat/completions", post(proxy::handle_chat))
        .with_state(state)
        .layer(cors);

    // Start server
    let addr = format!("0.0.0.0:{}", port);
    tracing::info!("Chat proxy listening on {}", addr);

    let listener = tokio::net::TcpListener::bind(&addr).await?;
    axum::serve(listener, app).await?;

    Ok(())
}
