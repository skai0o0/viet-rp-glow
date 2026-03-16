import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

/**
 * Polls pending_approvals count every 30s.
 * Only runs when `enabled` is true (admin/op).
 */
export function usePendingApprovalCount(enabled: boolean): number {
  const [count, setCount] = useState(0);

  const fetchCount = useCallback(async () => {
    const { count: c } = await supabase
      .from("pending_approvals")
      .select("*", { count: "exact", head: true })
      .eq("status", "pending");
    setCount(c ?? 0);
  }, []);

  useEffect(() => {
    if (!enabled) return;
    fetchCount();
    const interval = setInterval(fetchCount, 30000);
    return () => clearInterval(interval);
  }, [enabled, fetchCount]);

  return count;
}
