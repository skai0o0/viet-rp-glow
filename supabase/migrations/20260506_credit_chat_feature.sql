-- ============================================================
-- Add chat_message feature to credit_feature_pricing
-- Allows users to spend credits when daily quota is exhausted.
-- ============================================================

INSERT INTO public.credit_feature_pricing (feature_key, feature_name, credits_cost, description, is_active)
VALUES ('chat_message', 'Chat Message', 1, 'Send a chat message using credits when daily quota is exhausted', true)
ON CONFLICT (feature_key) DO UPDATE SET
  credits_cost = EXCLUDED.credits_cost,
  description = EXCLUDED.description,
  is_active = EXCLUDED.is_active;
