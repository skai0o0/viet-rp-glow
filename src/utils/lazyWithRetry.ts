import { lazy, type ComponentType } from "react";

/**
 * lazy() wrapper that retries the import on failure.
 * Handles stale chunk errors ("Importing a module script failed")
 * common with Vite code splitting after deployments.
 *
 * After exhausting retries on a chunk error, forces a full page reload
 * to pick up fresh chunk hashes from the server.
 */
export function lazyWithRetry<T extends ComponentType<any>>(
  factory: () => Promise<{ default: T }>,
  retries = 2,
  delay = 1000
): React.LazyExoticComponent<T> {
  return lazy(async () => {
    let lastError: unknown;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await factory();
      } catch (error) {
        lastError = error;

        // Broad detection for chunk/module load failures
        const msg = error instanceof Error ? error.message : String(error);
        const isChunkError =
          (error instanceof TypeError || error instanceof DOMException || error instanceof Error) &&
          (msg.includes("Failed to fetch") ||
            msg.includes("Importing a module script failed") ||
            msg.includes("dynamically imported module") ||
            msg.includes("Loading chunk") ||
            msg.includes("Loading CSS chunk") ||
            msg.includes("NetworkError") ||
            msg.includes("Failed to load") ||
            msg.includes("Unexpected token")); // HTML served instead of JS (404 fallback)

        if (!isChunkError) {
          throw error;
        }

        if (attempt === retries) {
          // Final attempt failed on a chunk error — force reload to get fresh hashes.
          // Use replace() to avoid adding stale URL to history.
          console.error(`[lazyWithRetry] Chunk load failed after ${retries + 1} attempts, forcing reload:`, error);
          window.location.replace(window.location.href);
          // Return a promise that never resolves (page will unmount on reload)
          return new Promise(() => {});
        }

        // Wait before retrying with exponential-ish backoff
        await new Promise((resolve) => setTimeout(resolve, delay * (attempt + 1)));
      }
    }

    throw lastError;
  });
}
