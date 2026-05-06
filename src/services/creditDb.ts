import { supabase } from "@/integrations/supabase/client";

export interface UserCreditBalance {
  user_id: string;
  balance: number;
  updated_at: string;
}

export interface CreditTransaction {
  id: string;
  user_id: string;
  amount: number;
  type: string;
  description: string;
  balance_after: number;
  created_at: string;
}

export interface UserWithCredits {
  user_id: string;
  display_name: string;
  balance: number;
  role: string;
}

/** Fetch current user's credit balance */
export async function fetchUserBalance(userId?: string): Promise<number> {
  let uid = userId;
  if (!uid) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return 0;
    uid = session.user.id;
  }

  const { data, error } = await supabase
    .from("user_credits")
    .select("balance")
    .eq("user_id", uid)
    .single();

  if (error || !data) return 0;
  return data.balance;
}

/** Fetch credit transaction history for a user */
export async function fetchCreditHistory(
  userId?: string,
  limit = 20,
): Promise<CreditTransaction[]> {
  let uid = userId;
  if (!uid) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session) return [];
    uid = session.user.id;
  }

  const { data, error } = await supabase
    .from("credit_transactions")
    .select("*")
    .eq("user_id", uid)
    .order("created_at", { ascending: false })
    .limit(limit);

  if (error || !data) return [];
  return data as CreditTransaction[];
}

/** Use (deduct) credits for a feature. Returns true if successful, false if insufficient balance. */
export async function useCredits(feature: string, credits: number): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) return false;

  const { data, error } = await supabase.rpc("use_credits", {
    p_user_id: session.user.id,
    p_feature: feature,
    p_credits: credits,
  } as any);

  if (error) return false;
  return data as boolean;
}

export interface CreditPackage {
  id: string;
  name: string;
  description: string;
  credits: number;
  price: number;
  discount_percent: number;
}

/** Fetch active credit packages for purchase */
export async function fetchCreditPackages(): Promise<CreditPackage[]> {
  const { data, error } = await supabase
    .from("credit_packages")
    .select("id, name, description, credits, price, discount_percent")
    .eq("is_active", true)
    .order("sort_order", { ascending: true });

  if (error || !data) return [];
  return data as CreditPackage[];
}

/** Grant credits to a target user (admin/op only) */
export async function grantCredits(
  targetUserId: string,
  amount: number,
  description = "Admin grant",
): Promise<{ success: boolean; newBalance?: number; error?: string }> {
  const { data, error } = await supabase.rpc("grant_credits", {
    p_user_id: targetUserId,
    p_amount: amount,
    p_description: description,
  } as any);

  if (error) {
    return { success: false, error: error.message };
  }
  return { success: true, newBalance: data as number };
}

/** Fetch all users with their credit balances and roles (admin view) */
export async function fetchUserListWithCredits(): Promise<UserWithCredits[]> {
  // Get all profiles with credits
  const { data: profiles, error: profileError } = await supabase
    .from("profiles")
    .select("id, display_name");

  if (profileError || !profiles) return [];

  // Get all credit balances
  const { data: credits } = await supabase
    .from("user_credits")
    .select("user_id, balance");

  const creditMap = new Map<string, number>();
  (credits ?? []).forEach((c) => creditMap.set(c.user_id, c.balance));

  // Get all roles
  const { data: roles } = await supabase
    .from("user_roles")
    .select("user_id, role");

  const roleMap = new Map<string, string>();
  (roles ?? []).forEach((r) => {
    const existing = roleMap.get(r.user_id);
    // Keep highest role (admin > op > moderator > user)
    const priority: Record<string, number> = { admin: 1, op: 2, moderator: 3, user: 4 };
    if (!existing || (priority[r.role] ?? 99) < (priority[existing] ?? 99)) {
      roleMap.set(r.user_id, r.role);
    }
  });

  return profiles.map((p) => ({
    user_id: p.id,
    display_name: p.display_name || "Unknown",
    balance: creditMap.get(p.id) ?? 0,
    role: roleMap.get(p.id) ?? "user",
  }));
}
