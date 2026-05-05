-- Migration: Role-based credit system
-- 1. prepare_chat_context: moderator is NOT privileged (uses proxy + credits)
-- 2. grant_credits: add role check (only admin/op can grant)

-- ─── 1. Fix prepare_chat_context: moderator → proxy ──────────
CREATE OR REPLACE FUNCTION public.prepare_chat_context(
  p_user_id UUID,
  p_tier_key TEXT
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_is_privileged BOOLEAN;
  v_used INTEGER;
  v_limit INTEGER;
  v_plan_name TEXT;
  v_plan_tier TEXT;
  v_tier RECORD;
  v_api_key TEXT;
  v_key_id UUID;
  v_quota JSONB;
  v_tier_result JSONB;
BEGIN
  -- 1. Check privileged role (admin / op ONLY — moderator uses proxy)
  SELECT EXISTS (
    SELECT 1 FROM user_roles
    WHERE user_id = p_user_id
      AND role IN ('admin', 'op')
  ) INTO v_is_privileged;

  -- 2. Check quota
  IF v_is_privileged THEN
    v_quota := jsonb_build_object(
      'used', 0,
      'limit', 2147483647,
      'remaining', 2147483647,
      'plan_name', 'Admin',
      'tier', 'all'
    );
  ELSE
    -- Get subscription plan
    SELECT sp.daily_messages, sp.name, sp.allowed_model_tier
    INTO v_limit, v_plan_name, v_plan_tier
    FROM user_subscriptions us
    JOIN subscription_plans sp ON sp.id = us.plan_id
    WHERE us.user_id = p_user_id AND us.status = 'active'
    ORDER BY sp.daily_messages DESC
    LIMIT 1;

    IF v_limit IS NULL THEN
      v_limit := 20;
      v_plan_name := 'Free';
      v_plan_tier := 'free';
    END IF;

    -- Get daily usage
    SELECT COALESCE(message_count, 0) INTO v_used
    FROM daily_chat_usage
    WHERE user_id = p_user_id AND usage_date = CURRENT_DATE;

    IF NOT FOUND THEN
      v_used := 0;
    END IF;

    v_quota := jsonb_build_object(
      'used', v_used,
      'limit', v_limit,
      'remaining', GREATEST(v_limit - v_used, 0),
      'plan_name', v_plan_name,
      'tier', v_plan_tier
    );
  END IF;

  -- 3. Resolve tier → model ID
  SELECT * INTO v_tier
  FROM model_tiers
  WHERE tier_key = p_tier_key AND is_active = true;

  IF NOT FOUND THEN
    v_tier_result := jsonb_build_object('error', 'tier_not_found');
  ELSE
    -- Check tier access for non-privileged users
    IF NOT v_is_privileged THEN
      IF v_plan_tier IS NULL THEN
        v_plan_tier := 'free';
      END IF;
      IF v_plan_tier != 'all' AND v_tier.min_subscription != 'free' THEN
        v_tier_result := jsonb_build_object('error', 'tier_restricted', 'message', 'Tier này yêu cầu gói Pro.');
      END IF;
    END IF;

    IF v_tier_result IS NULL THEN
      v_tier_result := jsonb_build_object(
        'model_id', v_tier.model_id,
        'tier_key', v_tier.tier_key,
        'display_name', v_tier.display_name
      );
    END IF;
  END IF;

  -- 4. Pick a random API key from the pool
  SELECT id, api_key INTO v_key_id, v_api_key
  FROM platform_api_keys
  WHERE is_active = true
  ORDER BY random()
  LIMIT 1;

  IF v_key_id IS NOT NULL THEN
    UPDATE platform_api_keys
    SET request_count = request_count + 1, last_used_at = now()
    WHERE id = v_key_id;
  END IF;

  -- 5. Return combined result
  RETURN jsonb_build_object(
    'is_privileged', v_is_privileged,
    'quota', v_quota,
    'tier', v_tier_result,
    'api_key', v_api_key
  );
END;
$$;

-- ─── 2. Fix grant_credits: add admin/op role check ───────────
CREATE OR REPLACE FUNCTION public.grant_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_description TEXT DEFAULT 'Admin grant'
)
RETURNS INTEGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_balance INTEGER;
  v_caller_role TEXT;
BEGIN
  -- Only admin or op can grant credits
  SELECT role INTO v_caller_role
  FROM user_roles
  WHERE user_id = auth.uid()
  ORDER BY CASE role
    WHEN 'admin' THEN 1
    WHEN 'op' THEN 2
    ELSE 3
  END
  LIMIT 1;

  IF v_caller_role NOT IN ('admin', 'op') THEN
    RAISE EXCEPTION 'Permission denied: only admin or operator can grant credits';
  END IF;

  IF p_amount <= 0 THEN
    RAISE EXCEPTION 'Grant amount must be positive';
  END IF;

  INSERT INTO user_credits (user_id, balance)
  VALUES (p_user_id, p_amount)
  ON CONFLICT (user_id)
  DO UPDATE SET balance = user_credits.balance + p_amount;

  SELECT balance INTO v_new_balance FROM user_credits WHERE user_id = p_user_id;

  INSERT INTO credit_transactions (user_id, amount, type, description, balance_after)
  VALUES (p_user_id, p_amount, 'admin_grant', p_description, v_new_balance);

  RETURN v_new_balance;
END;
$$;
