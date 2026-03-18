import { useEffect, useRef } from "react";
import { useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

let browserSessionId: string | null = null;
function getSessionId() {
  if (!browserSessionId) {
    browserSessionId =
      sessionStorage.getItem("_vietrp_sid") ??
      crypto.randomUUID();
    sessionStorage.setItem("_vietrp_sid", browserSessionId);
  }
  return browserSessionId;
}

export function usePageTracking() {
  const location = useLocation();
  const prevPath = useRef<string>("");

  useEffect(() => {
    const path = location.pathname;
    if (path === prevPath.current) return;
    prevPath.current = path;

    supabase.rpc("log_page_view", {
      p_path: path,
      p_referrer: document.referrer || null,
      p_session_id: getSessionId(),
    }).then(({ error }) => {
      if (error) console.debug("[PageTracking] log error:", error.message);
    });
  }, [location.pathname]);
}
