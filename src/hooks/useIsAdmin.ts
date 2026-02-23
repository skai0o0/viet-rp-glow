import { useState, useEffect } from "react";
import { useAuth } from "@/contexts/AuthContext";
import { supabase } from "@/integrations/supabase/client";

/**
 * Hook to check if the current user has the admin role.
 * Uses server-side `has_role` RPC — not spoofable via cookies or localStorage.
 */
export function useIsAdmin() {
  const { user } = useAuth();
  const [isAdmin, setIsAdmin] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    if (!user) {
      setIsAdmin(false);
      setChecking(false);
      return;
    }

    const check = async () => {
      try {
        const { data } = await supabase.rpc("has_role", { _user_id: user.id, _role: "admin" } as any);
        setIsAdmin(!!data);
      } catch {
        setIsAdmin(false);
      }
      setChecking(false);
    };
    check();
  }, [user]);

  return { isAdmin, checking };
}
