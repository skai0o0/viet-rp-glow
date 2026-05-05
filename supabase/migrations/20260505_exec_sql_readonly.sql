-- Migration: Restrict exec_sql to read-only (SELECT/WITH/EXPLAIN only)
-- This prevents accidental or malicious data modification through the in-app SQL editor.
-- All write operations should be done via Supabase Dashboard or migrations.

CREATE OR REPLACE FUNCTION exec_sql(query text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
BEGIN
  -- Admin-only check via has_role
  IF NOT (SELECT has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  -- Read-only: only allow SELECT, WITH, EXPLAIN
  IF NOT (lower(trim(query)) ~ '^(select|with|explain)') THEN
    RAISE EXCEPTION 'Chỉ cho phép truy vấn đọc (SELECT/WITH/EXPLAIN). Sử dụng Supabase Dashboard cho thao tác ghi.';
  END IF;

  EXECUTE format(
    'SELECT COALESCE(json_agg(row_to_json(t)), ''[]''::json) FROM (%s) t',
    query
  ) INTO result;

  RETURN result;
EXCEPTION
  WHEN OTHERS THEN
    RETURN json_build_object('error', SQLERRM, 'detail', SQLSTATE);
END;
$$;
