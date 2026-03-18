import { useState, useEffect, useCallback } from "react";
import { fetchChatQuota, type ChatQuota } from "@/services/openRouter";
import { useAuth } from "@/contexts/AuthContext";

const DEFAULT_QUOTA: ChatQuota = {
  used: 0,
  limit: 20,
  remaining: 20,
  plan_name: "Free",
  tier: "free",
};

export function useChatQuota() {
  const { user } = useAuth();
  const [quota, setQuota] = useState<ChatQuota>(DEFAULT_QUOTA);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setQuota(DEFAULT_QUOTA);
      setLoading(false);
      return;
    }
    try {
      const q = await fetchChatQuota();
      setQuota(q);
    } catch {
      /* keep current value */
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { quota, loading, refresh };
}
