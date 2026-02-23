
-- Table to store global system prompt (single row)
CREATE TABLE public.global_settings (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  key text NOT NULL UNIQUE,
  value text NOT NULL DEFAULT '',
  updated_at timestamp with time zone NOT NULL DEFAULT now()
);

ALTER TABLE public.global_settings ENABLE ROW LEVEL SECURITY;

-- Anyone can read settings
CREATE POLICY "Anyone can read global settings"
  ON public.global_settings FOR SELECT
  USING (true);

-- Only admins can modify
CREATE POLICY "Admins can insert global settings"
  ON public.global_settings FOR INSERT
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can update global settings"
  ON public.global_settings FOR UPDATE
  USING (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins can delete global settings"
  ON public.global_settings FOR DELETE
  USING (public.has_role(auth.uid(), 'admin'));

-- Seed the global system prompt row
INSERT INTO public.global_settings (key, value) VALUES ('global_system_prompt', '');
