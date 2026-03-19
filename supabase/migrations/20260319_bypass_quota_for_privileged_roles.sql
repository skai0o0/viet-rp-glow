-- ============================================================
-- Bypass chat quota for privileged roles (admin / op / moderator)
-- These roles use the platform proxy without any message limit.
-- ============================================================

CREATE OR REPLACE FUNCTION public.check_chat_quota(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_used    INTEGER;
  v_limit   INTEGER;
  v_plan_name TEXT;
  v_tier    TEXT;
  v_is_privileged BOOLEAN;
BEGIN
  -- Privileged roles (admin / op / moderator) have unlimited quota
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_user_id
      AND role IN ('admin', 'op', 'moderator')
  ) INTO v_is_privileged;

  IF v_is_privileged THEN
    -- Return a practically-unlimited quota (INT max) for privileged roles
    RETURN jsonb_build_object(
      'used',      0,
      'limit',     2147483647,  -- INT max → effectively unlimited
      'remaining', 2147483647,
      'plan_name', 'Admin',
      'tier',      'all'
    );
  END IF;

  -- Regular users: check subscription plan
  SELECT sp.daily_messages, sp.name, sp.allowed_model_tier
  INTO v_limit, v_plan_name, v_tier
  FROM user_subscriptions us
  JOIN subscription_plans sp ON sp.id = us.plan_id
  WHERE us.user_id = p_user_id AND us.status = 'active'
  ORDER BY sp.daily_messages DESC
  LIMIT 1;

  IF v_limit IS NULL THEN
    v_limit     := 20;
    v_plan_name := 'Free';
    v_tier      := 'free';
  END IF;

  SELECT COALESCE(message_count, 0) INTO v_used
  FROM daily_chat_usage
  WHERE user_id = p_user_id AND usage_date = CURRENT_DATE;

  IF NOT FOUND THEN
    v_used := 0;
  END IF;

  RETURN jsonb_build_object(
    'used',      v_used,
    'limit',     v_limit,
    'remaining', GREATEST(v_limit - v_used, 0),
    'plan_name', v_plan_name,
    'tier',      v_tier
  );
END;
$$;
