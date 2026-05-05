import { lazy, type ComponentType } from "react";

/**
 * lazy() wrapper that retries the import on failure.
 * Handles stale chunk errors ("Importing a module script failed")
 * common with Vite dev server HMR + code splitting.
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

        // Only retry on module script / chunk load errors
        const isChunkError =
          error instanceof TypeError &&
          (error.message.includes("Failed to fetch") ||
            error.message.includes("Importing a module script failed") ||
            error.message.includes("dynamically imported module") ||
            error.message.includes("Loading chunk"));

        if (!isChunkError || attempt === retries) {
          throw error;
        }

        // Wait before retrying
        await new Promise((resolve) => setTimeout(resolve, delay * (attempt + 1)));
      }
    }

    throw lastError;
  });
}
