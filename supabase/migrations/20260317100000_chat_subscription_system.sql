-- ============================================================
-- Chat Subscription System
-- daily_chat_usage table, quota RPCs, subscription plan updates
-- ============================================================

-- ─── 1. Thêm cột daily_messages & allowed_model_tier vào subscription_plans ───
ALTER TABLE public.subscription_plans
  ADD COLUMN IF NOT EXISTS daily_messages INTEGER NOT NULL DEFAULT 20,
  ADD COLUMN IF NOT EXISTS allowed_model_tier TEXT NOT NULL DEFAULT 'free';

-- ─── 2. Bảng daily_chat_usage ─────────────────────────────────
CREATE TABLE IF NOT EXISTS public.daily_chat_usage (
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  message_count INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT pk_daily_chat_usage PRIMARY KEY (user_id, usage_date)
);

ALTER TABLE public.daily_chat_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own daily chat usage"
  ON public.daily_chat_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE INDEX IF NOT EXISTS idx_daily_chat_usage_date
  ON public.daily_chat_usage (usage_date);

-- ─── 3. RPC: check_chat_quota ─────────────────────────────────
CREATE OR REPLACE FUNCTION public.check_chat_quota(p_user_id UUID)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_used INTEGER;
  v_limit INTEGER;
  v_plan_name TEXT;
  v_tier TEXT;
BEGIN
  SELECT sp.daily_messages, sp.name, sp.allowed_model_tier
  INTO v_limit, v_plan_name, v_tier
  FROM user_subscriptions us
  JOIN subscription_plans sp ON sp.id = us.plan_id
  WHERE us.user_id = p_user_id AND us.status = 'active'
  ORDER BY sp.daily_messages DESC
  LIMIT 1;

  IF v_limit IS NULL THEN
    v_limit := 20;
    v_plan_name := 'Free';
    v_tier := 'free';
  END IF;

  SELECT COALESCE(message_count, 0) INTO v_used
  FROM daily_chat_usage
  WHERE user_id = p_user_id AND usage_date = CURRENT_DATE;

  IF NOT FOUND THEN
    v_used := 0;
  END IF;

  RETURN jsonb_build_object(
    'used', v_used,
    'limit', v_limit,
    'remaining', GREATEST(v_limit - v_used, 0),
    'plan_name', v_plan_name,
    'tier', v_tier
  );
END;
$$;

-- ─── 4. RPC: increment_chat_count ─────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_chat_count(p_user_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO daily_chat_usage (user_id, usage_date, message_count)
  VALUES (p_user_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id, usage_date)
  DO UPDATE SET message_count = daily_chat_usage.message_count + 1;
END;
$$;

-- ─── 5. Cập nhật gói Free hiện có ────────────────────────────
UPDATE public.subscription_plans
SET daily_messages = 20, allowed_model_tier = 'free'
WHERE name = 'Free';

-- ─── 6. Seed gói Pro ──────────────────────────────────────────
INSERT INTO public.subscription_plans
  (name, description, price, monthly_credits, perks, daily_messages, allowed_model_tier, sort_order)
VALUES
  ('Pro', 'Gói Pro — 200 tin nhắn/ngày, truy cập tất cả model', 0, 0,
   '["all_models","priority_support"]'::jsonb, 200, 'all', 1)
ON CONFLICT DO NOTHING;
