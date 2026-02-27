-- ============================================================
-- PATCH: Bổ sung các bảng, cột, RPC bị thiếu so với migration gốc
-- Chạy toàn bộ file này trong Supabase SQL Editor
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. Bảng characters: thêm cột message_count và rating
-- ────────────────────────────────────────────────────────────
ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS message_count INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS rating NUMERIC NOT NULL DEFAULT 0;

-- ────────────────────────────────────────────────────────────
-- 2. Bảng character_ratings (hoàn toàn mới)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.character_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  character_id UUID NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  value INTEGER NOT NULL CHECK (value BETWEEN 1 AND 5),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, character_id)
);

ALTER TABLE public.character_ratings ENABLE ROW LEVEL SECURITY;

-- Users can read their own ratings
CREATE POLICY "Users can read own ratings"
  ON public.character_ratings FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own ratings
CREATE POLICY "Users can insert own ratings"
  ON public.character_ratings FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own ratings
CREATE POLICY "Users can update own ratings"
  ON public.character_ratings FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own ratings
CREATE POLICY "Users can delete own ratings"
  ON public.character_ratings FOR DELETE
  USING (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- 3. Bảng user_favorites (hoàn toàn mới)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.user_favorites (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  character_id UUID NOT NULL REFERENCES public.characters(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, character_id)
);

ALTER TABLE public.user_favorites ENABLE ROW LEVEL SECURITY;

-- Users can read their own favorites
CREATE POLICY "Users can read own favorites"
  ON public.user_favorites FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own favorites
CREATE POLICY "Users can insert own favorites"
  ON public.user_favorites FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own favorites
CREATE POLICY "Users can delete own favorites"
  ON public.user_favorites FOR DELETE
  USING (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- 4. Bảng knowledge_base (hoàn toàn mới)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.knowledge_base (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  content TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.knowledge_base ENABLE ROW LEVEL SECURITY;

-- Anyone can read knowledge_base
CREATE POLICY "Anyone can read knowledge base"
  ON public.knowledge_base FOR SELECT
  USING (true);

-- Only admins can insert
CREATE POLICY "Admins can insert knowledge base"
  ON public.knowledge_base FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

-- Only admins can update
CREATE POLICY "Admins can update knowledge base"
  ON public.knowledge_base FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Only admins can delete
CREATE POLICY "Admins can delete knowledge base"
  ON public.knowledge_base FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

-- Trigger for updated_at
CREATE TRIGGER update_knowledge_base_updated_at
  BEFORE UPDATE ON public.knowledge_base
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ────────────────────────────────────────────────────────────
-- 5. RPC: increment_character_message_count
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_character_message_count(char_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.characters
  SET message_count = message_count + 1
  WHERE id = char_id;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 5b. RPC: increment_character_message_count_fallback
--     Fallback atomic increment (same as main, used when RPC name resolution fails)
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.increment_character_message_count_fallback(char_id UUID)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.characters
  SET message_count = message_count + 1
  WHERE id = char_id;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 5c. RPC: decrement_character_message_count
--     Giảm message_count, không bao giờ xuống dưới 0
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.decrement_character_message_count(char_id UUID, amount INTEGER DEFAULT 1)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.characters
  SET message_count = GREATEST(message_count - amount, 0)
  WHERE id = char_id;
END;
$$;

-- ────────────────────────────────────────────────────────────
-- 6. RPC: get_weekly_trending
--    Trả về top characters theo số tin nhắn trong 7 ngày qua
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_weekly_trending(lim INTEGER DEFAULT 10)
RETURNS TABLE(character_id UUID, msg_count BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT cs.character_id, COUNT(cm.id) AS msg_count
  FROM public.chat_messages cm
  JOIN public.chat_sessions cs ON cs.id = cm.session_id
  WHERE cm.created_at >= now() - INTERVAL '7 days'
    AND cm.role = 'assistant'
  GROUP BY cs.character_id
  ORDER BY msg_count DESC
  LIMIT lim;
$$;

-- ────────────────────────────────────────────────────────────
-- 7. RPC: get_most_favorited
--    Trả về top characters được yêu thích nhiều nhất
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_most_favorited(lim INTEGER DEFAULT 10)
RETURNS TABLE(character_id UUID, fav_count BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT character_id, COUNT(*) AS fav_count
  FROM public.user_favorites
  GROUP BY character_id
  ORDER BY fav_count DESC
  LIMIT lim;
$$;

-- ────────────────────────────────────────────────────────────
-- 8. Index bổ sung để tăng hiệu năng
-- ────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_character_ratings_character
  ON public.character_ratings(character_id);

CREATE INDEX IF NOT EXISTS idx_user_favorites_user
  ON public.user_favorites(user_id);

CREATE INDEX IF NOT EXISTS idx_user_favorites_character
  ON public.user_favorites(character_id);

CREATE INDEX IF NOT EXISTS idx_characters_message_count
  ON public.characters(message_count DESC);

CREATE INDEX IF NOT EXISTS idx_characters_public_created
  ON public.characters(is_public, created_at DESC);

-- ────────────────────────────────────────────────────────────
-- 9. RPC: exec_sql (Admin-only SQL Editor)
--    Cho phép admin chạy SQL tùy ý từ giao diện Admin Hub
-- ────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.exec_sql(query text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
  affected int;
  is_select boolean;
BEGIN
  -- Admin-only check via has_role
  IF NOT (SELECT public.has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  is_select := lower(trim(query)) ~ '^(select|with|explain)';

  IF is_select THEN
    EXECUTE format(
      'SELECT COALESCE(json_agg(row_to_json(t)), ''[]''::json) FROM (%s) t',
      query
    ) INTO result;
  ELSE
    EXECUTE query;
    GET DIAGNOSTICS affected = ROW_COUNT;
    result := json_build_object('affected_rows', affected, 'status', 'ok');
  END IF;

  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('error', SQLERRM, 'detail', SQLSTATE);
END;
$$;
