-- ============================================================
-- Filter private characters from all showcase / hall-of-fame RPCs
-- ============================================================

-- ─── 1. get_weekly_trending: only public characters ──────────
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
  JOIN public.characters c ON c.id = cs.character_id
  WHERE cm.created_at >= now() - INTERVAL '7 days'
    AND c.is_public = true
  GROUP BY cs.character_id
  ORDER BY msg_count DESC
  LIMIT lim;
$$;

-- ─── 2. get_most_favorited: only public characters ───────────
CREATE OR REPLACE FUNCTION public.get_most_favorited(lim INTEGER DEFAULT 10)
RETURNS TABLE(character_id UUID, fav_count BIGINT)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT uf.character_id, COUNT(*) AS fav_count
  FROM public.user_favorites uf
  JOIN public.characters c ON c.id = uf.character_id
  WHERE c.is_public = true
  GROUP BY uf.character_id
  ORDER BY fav_count DESC
  LIMIT lim;
$$;

-- ─── 3. get_top_characters: only public characters ───────────
CREATE OR REPLACE FUNCTION public.get_top_characters(p_limit INTEGER DEFAULT 10)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_result JSONB;
BEGIN
  SELECT coalesce(jsonb_agg(t), '[]'::jsonb) INTO v_result
  FROM (
    SELECT
      c.id::text,
      c.name,
      c.avatar_url,
      c.is_public,
      coalesce(msg_counts.msg_count, 0) AS message_count,
      coalesce(avg_ratings.avg_rating, 0) AS rating,
      coalesce(c.tags, '{}') AS tags,
      coalesce(fav_counts.fav_count, 0) AS fav_count,
      coalesce(session_counts.session_count, 0) AS session_count
    FROM characters c
    LEFT JOIN (
      SELECT cs.character_id, count(*) AS msg_count
      FROM chat_messages cm
      JOIN chat_sessions cs ON cs.id = cm.session_id
      GROUP BY cs.character_id
    ) msg_counts ON msg_counts.character_id = c.id
    LEFT JOIN (
      SELECT character_id, round(avg(value), 1) AS avg_rating
      FROM character_ratings
      GROUP BY character_id
    ) avg_ratings ON avg_ratings.character_id = c.id
    LEFT JOIN (
      SELECT character_id, count(*) AS fav_count
      FROM user_favorites
      GROUP BY character_id
    ) fav_counts ON fav_counts.character_id = c.id
    LEFT JOIN (
      SELECT character_id, count(*) AS session_count
      FROM chat_sessions
      GROUP BY character_id
    ) session_counts ON session_counts.character_id = c.id
    WHERE c.is_public = true
    ORDER BY coalesce(msg_counts.msg_count, 0) DESC
    LIMIT p_limit
  ) t;

  RETURN v_result;
END;
$$;
