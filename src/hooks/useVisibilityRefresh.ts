import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Refresh Supabase session when user returns to the tab after screen lock / background.
 * Prevents stale auth state that causes infinite loading on mobile.
 */
export function useVisibilityRefresh() {
  useEffect(() => {
    const handleVisibilityChange = async () => {
      if (document.visibilityState !== "visible") return;

      const { data, error } = await supabase.auth.getSession();
      if (error || !data.session) return;

      // Refresh token if < 5 minutes from expiry
      const expiresAt = data.session.expires_at ?? 0;
      const now = Math.floor(Date.now() / 1000);
      if (expiresAt - now < 300) {
        await supabase.auth.refreshSession();
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);
}
