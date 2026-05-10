-- Seed 4 new global_settings keys for type-specific system prompts
-- and post-history instructions.  ON CONFLICT makes this idempotent.

INSERT INTO public.global_settings (key, value)
VALUES
  ('global_system_prompt_type_a', ''),
  ('global_system_prompt_type_b', ''),
  ('global_post_history_type_a', ''),
  ('global_post_history_type_b', '')
ON CONFLICT (key) DO NOTHING;
