import { useState, useEffect, useCallback } from "react";
import { fetchUserBalance } from "@/services/creditDb";
import { useAuth } from "@/contexts/AuthContext";

export function useUserCredits() {
  const { user } = useAuth();
  const [balance, setBalance] = useState(0);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setBalance(0);
      setLoading(false);
      return;
    }
    try {
      const b = await fetchUserBalance();
      setBalance(b);
    } catch {
      /* keep current value */
    }
    setLoading(false);
  }, [user]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  return { balance, loading, refresh };
}
