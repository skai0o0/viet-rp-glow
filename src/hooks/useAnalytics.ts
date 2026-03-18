import { useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import type { Json } from "@/integrations/supabase/types";

export function useAnalytics() {
  const track = useCallback(
    (eventName: string, eventData: Record<string, unknown> = {}) => {
      supabase
        .rpc("log_site_event", {
          p_event_name: eventName,
          p_event_data: eventData as Json,
        })
        .then(({ error }) => {
          if (error) console.debug("[Analytics] log error:", error.message);
        });
    },
    [],
  );

  return { track };
}

export type TrackFn = ReturnType<typeof useAnalytics>["track"];
