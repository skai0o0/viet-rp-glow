-- Migration: Server-side rating average + get_user_role fix
-- 1. get_average_rating RPC — replaces client-side avg calculation
-- 2. Ensure get_user_role exists and is efficient

-- ─── 1. get_average_rating RPC ────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_average_rating(p_character_id UUID)
RETURNS NUMERIC
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_avg NUMERIC;
BEGIN
  SELECT COALESCE(ROUND(AVG(value)::numeric, 1), 0)
  INTO v_avg
  FROM character_ratings
  WHERE character_id = p_character_id;

  RETURN v_avg;
END;
$$;

-- ─── 2. Ensure get_user_role is optimal ───────────────────────
-- This function already exists but let's make sure it returns
-- the highest role in a single query without fallback chain
CREATE OR REPLACE FUNCTION public.get_user_role(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_role TEXT;
BEGIN
  SELECT role INTO v_role
  FROM user_roles
  WHERE user_id = p_user_id
  ORDER BY CASE role
    WHEN 'admin' THEN 1
    WHEN 'op' THEN 2
    WHEN 'moderator' THEN 3
    WHEN 'user' THEN 4
    ELSE 5
  END
  LIMIT 1;

  RETURN COALESCE(v_role, 'user');
END;
$$;
