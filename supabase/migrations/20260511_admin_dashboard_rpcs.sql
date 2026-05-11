-- ============================================================
-- Admin Dashboard RPCs
-- get_dashboard_stats, get_usage_analytics, get_model_usage_stats,
-- get_top_characters, get_top_pages
-- ============================================================

-- ─── 1. get_dashboard_stats ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_dashboard_stats()
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_today DATE := CURRENT_DATE;
  v_result JSONB;
BEGIN
  SELECT jsonb_build_object(
    'total_characters', (SELECT count(*) FROM characters),
    'public_characters', (SELECT count(*) FROM characters WHERE is_public = true),
    'private_characters', (SELECT count(*) FROM characters WHERE is_public = false),
    'total_users', (SELECT count(*) FROM profiles),
    'total_sessions', (SELECT count(*) FROM chat_sessions),
    'total_messages', (SELECT count(*) FROM chat_messages),
    'total_favorites', (SELECT count(*) FROM user_favorites),
    'total_ratings', (SELECT count(*) FROM character_ratings),
    'avg_rating', COALESCE((SELECT round(avg(value), 1) FROM character_ratings), 0),
    'new_users_today', (SELECT count(*) FROM profiles WHERE created_at >= v_today),
    'new_chars_today', (SELECT count(*) FROM characters WHERE created_at >= v_today),
    'new_sessions_today', (SELECT count(*) FROM chat_sessions WHERE created_at >= v_today),
    'new_messages_today', (SELECT count(*) FROM chat_messages WHERE created_at >= v_today),
    'total_chat_messages_today', COALESCE((SELECT sum(message_count) FROM daily_chat_usage WHERE usage_date = v_today), 0),
    'active_users_today', (SELECT count(DISTINCT user_id) FROM daily_chat_usage WHERE usage_date = v_today),
    'total_page_views_today', 0,
    'unique_visitors_today', 0
  ) INTO v_result;

  RETURN v_result;
END;
$$;

-- ─── 2. get_usage_analytics ──────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_usage_analytics(p_days INTEGER DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start DATE := CURRENT_DATE - p_days;
  v_chat JSONB;
  v_signups JSONB;
  v_sessions JSONB;
BEGIN
  -- Chat usage by day
  SELECT coalesce(jsonb_agg(t ORDER BY t.day), '[]'::jsonb) INTO v_chat
  FROM (
    SELECT usage_date::text AS day,
           sum(message_count) AS messages,
           count(DISTINCT user_id) AS active_users
    FROM daily_chat_usage
    WHERE usage_date >= v_start
    GROUP BY usage_date
  ) t;

  -- Signups by day
  SELECT coalesce(jsonb_agg(t ORDER BY t.day), '[]'::jsonb) INTO v_signups
  FROM (
    SELECT date_trunc('day', created_at)::date::text AS day,
           count(*) AS count
    FROM profiles
    WHERE created_at >= v_start
    GROUP BY 1
  ) t;

  -- Sessions by day
  SELECT coalesce(jsonb_agg(t ORDER BY t.day), '[]'::jsonb) INTO v_sessions
  FROM (
    SELECT date_trunc('day', created_at)::date::text AS day,
           count(*) AS count
    FROM chat_sessions
    WHERE created_at >= v_start
    GROUP BY 1
  ) t;

  RETURN jsonb_build_object(
    'chat_usage', v_chat,
    'signups', v_signups,
    'sessions', v_sessions,
    'page_views', '[]'::jsonb
  );
END;
$$;

-- ─── 3. get_model_usage_stats ────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_model_usage_stats(p_days INTEGER DEFAULT 30)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_start TIMESTAMPTZ := now() - (p_days || ' days')::interval;
  v_by_tier JSONB;
  v_by_day JSONB;
  v_keys JSONB;
BEGIN
  -- Usage by tier from usage_logs metadata
  SELECT coalesce(jsonb_agg(t ORDER BY t.count DESC), '[]'::jsonb) INTO v_by_tier
  FROM (
    SELECT metadata->>'tier_key' AS tier,
           metadata->>'model' AS model,
           count(*) AS count
    FROM usage_logs
    WHERE feature = 'chat' AND created_at >= v_start AND metadata ? 'tier_key'
    GROUP BY metadata->>'tier_key', metadata->>'model'
  ) t;

  -- Usage by day + tier
  SELECT coalesce(jsonb_agg(t ORDER BY t.day), '[]'::jsonb) INTO v_by_day
  FROM (
    SELECT date_trunc('day', created_at)::date::text AS day,
           metadata->>'tier_key' AS tier,
           count(*) AS count
    FROM usage_logs
    WHERE feature = 'chat' AND created_at >= v_start AND metadata ? 'tier_key'
    GROUP BY 1, 2
  ) t;

  -- API key health
  SELECT coalesce(jsonb_agg(t ORDER BY t.key_name), '[]'::jsonb) INTO v_keys
  FROM (
    SELECT key_name, request_count, last_used_at::text, is_active
    FROM platform_api_keys
    ORDER BY key_name
  ) t;

  RETURN jsonb_build_object(
    'by_tier', coalesce(v_by_tier, '[]'::jsonb),
    'by_day', coalesce(v_by_day, '[]'::jsonb),
    'api_key_health', coalesce(v_keys, '[]'::jsonb)
  );
END;
$$;

-- ─── 4. get_top_characters ───────────────────────────────────
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
    ORDER BY coalesce(msg_counts.msg_count, 0) DESC
    LIMIT p_limit
  ) t;

  RETURN v_result;
END;
$$;

-- ─── 5. get_top_pages ────────────────────────────────────────
-- No page_views table exists yet — return empty array
CREATE OR REPLACE FUNCTION public.get_top_pages(p_days INTEGER DEFAULT 7)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN '[]'::jsonb;
END;
$$;
