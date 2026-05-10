use std::sync::atomic::{AtomicUsize, Ordering};
use std::sync::Arc;
use tokio::sync::RwLock;
use sqlx::PgPool;

/// In-memory round-robin API key pool.
/// Loads keys from `platform_api_keys` at startup and refreshes periodically.
#[derive(Clone)]
pub struct KeyPool {
    inner: Arc<KeyPoolInner>,
}

struct KeyPoolInner {
    keys: RwLock<Vec<String>>,
    index: AtomicUsize,
}

impl KeyPool {
    /// Load all active API keys from the database.
    pub async fn new(pool: &PgPool) -> Self {
        let keys = Self::fetch_keys(pool).await;
        tracing::info!("Loaded {} platform API keys", keys.len());

        Self {
            inner: Arc::new(KeyPoolInner {
                keys: RwLock::new(keys),
                index: AtomicUsize::new(0),
            }),
        }
    }

    /// Get the next key via round-robin.
    /// Falls back to empty string if pool is empty (caller should handle).
    pub async fn next(&self) -> String {
        let keys = self.inner.keys.read().await;
        if keys.is_empty() {
            tracing::warn!("API key pool is empty!");
            return String::new();
        }
        let idx = self.inner.index.fetch_add(1, Ordering::Relaxed) % keys.len();
        keys[idx].clone()
    }

    /// Reload keys from the database. Call periodically (e.g. every 5 minutes).
    pub async fn refresh(&self, pool: &PgPool) {
        let new_keys = Self::fetch_keys(pool).await;
        let mut keys = self.inner.keys.write().await;
        *keys = new_keys;
        tracing::info!("Refreshed API key pool: {} keys", keys.len());
    }

    async fn fetch_keys(pool: &PgPool) -> Vec<String> {
        sqlx::query_scalar::<_, String>(
            "SELECT api_key FROM platform_api_keys WHERE is_active = true ORDER BY created_at",
        )
        .fetch_all(pool)
        .await
        .unwrap_or_default()
    }
}

/// Spawn a background task that refreshes the key pool every 5 minutes.
pub fn spawn_refresh_task(key_pool: KeyPool, pool: PgPool) {
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(std::time::Duration::from_secs(300));
        loop {
            interval.tick().await;
            key_pool.refresh(&pool).await;
        }
    });
}
