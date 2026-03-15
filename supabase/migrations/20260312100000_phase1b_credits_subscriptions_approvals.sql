-- ============================================================
-- Phase 1b: Hệ thống credit, subscription, approval
-- (Chạy sau khi 'op' đã commit vào enum)
-- ============================================================

-- ─── 1. Bảng user_credits ───────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT uq_user_credits_user UNIQUE (user_id)
);

ALTER TABLE public.user_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own credits"
  ON public.user_credits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Service role can manage credits"
  ON public.user_credits FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  );

CREATE TRIGGER update_user_credits_updated_at
  BEFORE UPDATE ON public.user_credits
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── 2. Bảng credit_transactions ────────────────────────────
CREATE TYPE public.credit_transaction_type AS ENUM (
  'purchase',
  'subscription',
  'usage',
  'admin_grant',
  'refund'
);

CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  amount INTEGER NOT NULL,
  type public.credit_transaction_type NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  reference_id UUID,
  balance_after INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own transactions"
  ON public.credit_transactions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage transactions"
  ON public.credit_transactions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  );

CREATE INDEX idx_credit_transactions_user ON public.credit_transactions (user_id, created_at DESC);

-- ─── 3. Bảng subscription_plans ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.subscription_plans (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  price INTEGER NOT NULL DEFAULT 0,
  monthly_credits INTEGER NOT NULL DEFAULT 0,
  perks JSONB NOT NULL DEFAULT '[]'::jsonb,
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.subscription_plans ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active plans"
  ON public.subscription_plans FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage plans"
  ON public.subscription_plans FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  );

CREATE TRIGGER update_subscription_plans_updated_at
  BEFORE UPDATE ON public.subscription_plans
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

INSERT INTO public.subscription_plans (name, description, price, monthly_credits, perks, sort_order)
VALUES ('Free', 'Gói miễn phí cơ bản', 0, 0, '["basic"]'::jsonb, 0)
ON CONFLICT DO NOTHING;

-- ─── 4. Bảng user_subscriptions ─────────────────────────────
CREATE TYPE public.subscription_status AS ENUM (
  'active',
  'expired',
  'cancelled',
  'pending'
);

CREATE TABLE IF NOT EXISTS public.user_subscriptions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plan_id UUID NOT NULL REFERENCES public.subscription_plans(id) ON DELETE RESTRICT,
  status public.subscription_status NOT NULL DEFAULT 'pending',
  current_period_start TIMESTAMPTZ NOT NULL DEFAULT now(),
  current_period_end TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.user_subscriptions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own subscriptions"
  ON public.user_subscriptions FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can manage subscriptions"
  ON public.user_subscriptions FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  );

CREATE TRIGGER update_user_subscriptions_updated_at
  BEFORE UPDATE ON public.user_subscriptions
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_user_subscriptions_user ON public.user_subscriptions (user_id, status);

-- ─── 5. Bảng credit_packages ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.credit_packages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  credits INTEGER NOT NULL CHECK (credits > 0),
  price INTEGER NOT NULL CHECK (price > 0),
  discount_percent INTEGER NOT NULL DEFAULT 0 CHECK (discount_percent >= 0 AND discount_percent <= 100),
  is_active BOOLEAN NOT NULL DEFAULT true,
  sort_order INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_packages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read active packages"
  ON public.credit_packages FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage packages"
  ON public.credit_packages FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  );

CREATE TRIGGER update_credit_packages_updated_at
  BEFORE UPDATE ON public.credit_packages
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- ─── 6. Bảng usage_logs ─────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.usage_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  feature TEXT NOT NULL,
  credits_used INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.usage_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own usage logs"
  ON public.usage_logs FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Admins can read all usage logs"
  ON public.usage_logs FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  );

CREATE INDEX idx_usage_logs_user ON public.usage_logs (user_id, created_at DESC);
CREATE INDEX idx_usage_logs_feature ON public.usage_logs (feature, created_at DESC);

-- ─── 7. Bảng pending_approvals ──────────────────────────────
CREATE TYPE public.approval_type AS ENUM (
  'card_create',
  'card_edit',
  'admin_edit'
);

CREATE TYPE public.approval_status AS ENUM (
  'pending',
  'approved',
  'rejected'
);

CREATE TABLE IF NOT EXISTS public.pending_approvals (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  type public.approval_type NOT NULL,
  title TEXT NOT NULL DEFAULT '',
  payload JSONB NOT NULL DEFAULT '{}'::jsonb,
  status public.approval_status NOT NULL DEFAULT 'pending',
  reviewer_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  reviewer_note TEXT NOT NULL DEFAULT '',
  reviewed_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.pending_approvals ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own approvals"
  ON public.pending_approvals FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can create approvals"
  ON public.pending_approvals FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Admins and operators can read all approvals"
  ON public.pending_approvals FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'op')
    )
  );

CREATE POLICY "Admins and operators can update approvals"
  ON public.pending_approvals FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role IN ('admin', 'op')
    )
  );

CREATE POLICY "Admins can delete approvals"
  ON public.pending_approvals FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  );

CREATE TRIGGER update_pending_approvals_updated_at
  BEFORE UPDATE ON public.pending_approvals
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE INDEX idx_pending_approvals_status ON public.pending_approvals (status, created_at DESC);
CREATE INDEX idx_pending_approvals_user ON public.pending_approvals (user_id, created_at DESC);

-- ─── 8. Bảng daily_card_usage ───────────────────────────────
CREATE TABLE IF NOT EXISTS public.daily_card_usage (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  usage_date DATE NOT NULL DEFAULT CURRENT_DATE,
  card_count INTEGER NOT NULL DEFAULT 1,
  CONSTRAINT uq_daily_card_usage UNIQUE (user_id, usage_date)
);

ALTER TABLE public.daily_card_usage ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own daily usage"
  ON public.daily_card_usage FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own daily usage"
  ON public.daily_card_usage FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own daily usage"
  ON public.daily_card_usage FOR UPDATE
  USING (auth.uid() = user_id);

-- ─── 9. Bảng credit_feature_pricing ────────────────────────
CREATE TABLE IF NOT EXISTS public.credit_feature_pricing (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  feature_key TEXT NOT NULL UNIQUE,
  feature_name TEXT NOT NULL,
  credits_cost INTEGER NOT NULL DEFAULT 1 CHECK (credits_cost >= 0),
  description TEXT NOT NULL DEFAULT '',
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.credit_feature_pricing ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read feature pricing"
  ON public.credit_feature_pricing FOR SELECT
  USING (true);

CREATE POLICY "Admins can manage feature pricing"
  ON public.credit_feature_pricing FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_roles.user_id = auth.uid()
        AND user_roles.role = 'admin'
    )
  );

CREATE TRIGGER update_credit_feature_pricing_updated_at
  BEFORE UPDATE ON public.credit_feature_pricing
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

INSERT INTO public.credit_feature_pricing (feature_key, feature_name, credits_cost, description) VALUES
  ('ai_char_gen', 'Tạo nhân vật bằng AI', 5, 'Tạo card nhân vật mới hoàn toàn bằng AI'),
  ('ai_char_clone', 'Clone nhân vật bằng AI', 3, 'Tạo biến thể nhân vật từ card có sẵn'),
  ('chat_summary', 'Tóm tắt cuộc chat', 2, 'AI tóm tắt nội dung cuộc chat dài'),
  ('ai_chat_notes', 'AI ghi chú diễn biến', 2, 'AI tự động ghi chú sự kiện quan trọng')
ON CONFLICT (feature_key) DO NOTHING;

-- ─── 10. RPC: Tiêu credit an toàn ──────────────────────────
CREATE OR REPLACE FUNCTION public.use_credits(
  p_user_id UUID,
  p_feature TEXT,
  p_credits INTEGER,
  p_metadata JSONB DEFAULT '{}'::jsonb
)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_balance INTEGER;
  v_new_balance INTEGER;
BEGIN
  SELECT balance INTO v_balance
  FROM user_credits
  WHERE user_id = p_user_id
  FOR UPDATE;

  IF NOT FOUND THEN
    INSERT INTO user_credits (user_id, balance) VALUES (p_user_id, 0);
    v_balance := 0;
  END IF;

  IF v_balance < p_credits THEN
    RETURN FALSE;
  END IF;

  v_new_balance := v_balance - p_credits;

  UPDATE user_credits SET balance = v_new_balance WHERE user_id = p_user_id;

  INSERT INTO credit_transactions (user_id, amount, type, description, balance_after)
  VALUES (p_user_id, -p_credits, 'usage', 'Sử dụng: ' || p_feature, v_new_balance);

  INSERT INTO usage_logs (user_id, feature, credits_used, metadata)
  VALUES (p_user_id, p_feature, p_credits, p_metadata);

  RETURN TRUE;
END;
$$;

-- ─── 11. RPC: Admin cấp credit ──────────────────────────────
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
BEGIN
  INSERT INTO user_credits (user_id, balance)
  VALUES (p_user_id, GREATEST(p_amount, 0))
  ON CONFLICT (user_id)
  DO UPDATE SET balance = user_credits.balance + p_amount;

  SELECT balance INTO v_new_balance FROM user_credits WHERE user_id = p_user_id;

  INSERT INTO credit_transactions (user_id, amount, type, description, balance_after)
  VALUES (p_user_id, p_amount, 'admin_grant', p_description, v_new_balance);

  RETURN v_new_balance;
END;
$$;

-- ─── 12. RPC: Kiểm tra giới hạn tạo card/ngày ─────────────
CREATE OR REPLACE FUNCTION public.check_daily_card_limit(
  p_user_id UUID,
  p_max_cards INTEGER DEFAULT 3
)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_count INTEGER;
BEGIN
  SELECT card_count INTO v_count
  FROM daily_card_usage
  WHERE user_id = p_user_id AND usage_date = CURRENT_DATE;

  IF NOT FOUND THEN
    v_count := 0;
  END IF;

  RETURN jsonb_build_object(
    'used', v_count,
    'limit', p_max_cards,
    'remaining', GREATEST(p_max_cards - v_count, 0),
    'can_create', v_count < p_max_cards
  );
END;
$$;

-- ─── 13. RPC: Tăng đếm card/ngày ───────────────────────────
CREATE OR REPLACE FUNCTION public.increment_daily_card_count(
  p_user_id UUID
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO daily_card_usage (user_id, usage_date, card_count)
  VALUES (p_user_id, CURRENT_DATE, 1)
  ON CONFLICT (user_id, usage_date)
  DO UPDATE SET card_count = daily_card_usage.card_count + 1;
END;
$$;

-- ─── 14. Cập nhật handle_new_user: auto-tạo user_credits ───
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO public.profiles (id, display_name)
  VALUES (NEW.id, COALESCE(NEW.raw_user_meta_data->>'display_name', ''))
  ON CONFLICT (id) DO NOTHING;

  INSERT INTO public.user_credits (user_id, balance)
  VALUES (NEW.id, 0)
  ON CONFLICT (user_id) DO NOTHING;

  RETURN NEW;
END;
$$;

-- ─── 15. Seed credit cho existing users ─────────────────────
INSERT INTO public.user_credits (user_id, balance)
SELECT id, 0 FROM auth.users
WHERE id NOT IN (SELECT user_id FROM public.user_credits)
ON CONFLICT (user_id) DO NOTHING;
