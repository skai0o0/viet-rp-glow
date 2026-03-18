-- ============================================================
-- Platform API Key Pool + Model Tier System
-- Admin nhập tay nhiều OpenRouter keys, Edge Function xoay vòng.
-- User chọn "tier" thay vì model cụ thể.
-- ============================================================

-- ─── 1. Bảng platform_api_keys ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.platform_api_keys (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key_name TEXT NOT NULL,
  api_key TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  request_count BIGINT NOT NULL DEFAULT 0,
  last_used_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.platform_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Only admins can manage platform keys"
  ON public.platform_api_keys FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  );

-- ─── 2. Bảng model_tiers ──────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.model_tiers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tier_key TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  model_id TEXT NOT NULL,
  min_subscription TEXT NOT NULL DEFAULT 'free',
  sort_order INTEGER NOT NULL DEFAULT 0,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.model_tiers ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active model tiers"
  ON public.model_tiers FOR SELECT
  USING (true);

CREATE POLICY "Only admins can manage model tiers"
  ON public.model_tiers FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  );

CREATE TRIGGER update_model_tiers_updated_at
  BEFORE UPDATE ON public.model_tiers
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── 3. Seed model tiers mặc định ─────────────────────────────
INSERT INTO public.model_tiers (tier_key, display_name, description, model_id, min_subscription, sort_order)
VALUES
  ('free',  'VietRP Free',  'Model cơ bản, tốc độ nhanh',           'google/gemma-3-12b-it:free',            'free', 0),
  ('pro',   'VietRP Pro',   'Model mạnh, trả lời chi tiết hơn',     'google/gemini-2.0-flash-001',           'pro',  1),
  ('ultra', 'VietRP Ultra', 'Model cao cấp nhất, roleplay xuất sắc', 'anthropic/claude-3.5-sonnet',          'pro',  2)
ON CONFLICT (tier_key) DO NOTHING;

-- ─── 4. RPC: pick_random_api_key ───────────────────────────────
CREATE OR REPLACE FUNCTION public.pick_random_api_key()
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_key TEXT;
  v_id UUID;
BEGIN
  SELECT id, api_key INTO v_id, v_key
  FROM platform_api_keys
  WHERE is_active = true
  ORDER BY random()
  LIMIT 1;

  IF v_id IS NOT NULL THEN
    UPDATE platform_api_keys
    SET request_count = request_count + 1, last_used_at = now()
    WHERE id = v_id;
  END IF;

  RETURN v_key;
END;
$$;

-- ─── 5. RPC: resolve_model_tier ────────────────────────────────
CREATE OR REPLACE FUNCTION public.resolve_model_tier(
  p_tier_key TEXT,
  p_user_id UUID
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tier RECORD;
  v_user_plan TEXT;
BEGIN
  SELECT * INTO v_tier
  FROM model_tiers
  WHERE tier_key = p_tier_key AND is_active = true;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('error', 'tier_not_found');
  END IF;

  -- Determine user plan tier
  SELECT sp.allowed_model_tier INTO v_user_plan
  FROM user_subscriptions us
  JOIN subscription_plans sp ON sp.id = us.plan_id
  WHERE us.user_id = p_user_id AND us.status = 'active'
  ORDER BY sp.daily_messages DESC
  LIMIT 1;

  IF v_user_plan IS NULL THEN
    v_user_plan := 'free';
  END IF;

  -- Check access: 'all' plan can use everything, 'free' can only use 'free' tiers
  IF v_user_plan != 'all' AND v_tier.min_subscription != 'free' THEN
    RETURN jsonb_build_object('error', 'tier_restricted', 'message', 'Tier này yêu cầu gói Pro.');
  END IF;

  RETURN jsonb_build_object(
    'model_id', v_tier.model_id,
    'tier_key', v_tier.tier_key,
    'display_name', v_tier.display_name
  );
END;
$$;
