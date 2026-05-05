-- Migration: Security hardening + schema fixes
-- S1: Block CTE injection in exec_sql
-- S2: Add 'op' to app_role enum
-- S3: Tighten banners RLS to admin/op only
-- F5: Add gender/sexuality columns to profiles

-- ─── S1: Fix exec_sql — block WITH (CTE can do DML) ──────────
CREATE OR REPLACE FUNCTION exec_sql(query text)
RETURNS json
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  result json;
  trimmed text;
BEGIN
  -- Admin-only check
  IF NOT (SELECT has_role(auth.uid(), 'admin')) THEN
    RAISE EXCEPTION 'Unauthorized: Admin access required';
  END IF;

  trimmed := lower(trim(query));

  -- Only allow SELECT or EXPLAIN (block WITH — CTEs can execute DML)
  IF NOT (trimmed ~ '^(select|explain)') THEN
    RAISE EXCEPTION 'Chỉ cho phép SELECT hoặc EXPLAIN. WITH/CTE bị chặn vì lý do bảo mật.';
  END IF;

  -- Additional safety: block common DML keywords anywhere in the query
  IF trimmed ~ '\b(insert|update|delete|drop|alter|create|truncate|grant|revoke)\b' THEN
    RAISE EXCEPTION 'Truy vấn chứa từ khóa ghi dữ liệu bị cấm.';
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

-- ─── S2: Add 'op' to app_role enum ──────────────────────────
-- Check if 'op' already exists before adding
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_enum
    WHERE enumlabel = 'op'
    AND enumtypid = (SELECT oid FROM pg_type WHERE typname = 'app_role')
  ) THEN
    ALTER TYPE public.app_role ADD VALUE 'op';
  END IF;
END $$;

-- ─── S3: Tighten banners RLS — admin/op only ────────────────
-- Drop permissive policies
DROP POLICY IF EXISTS "Authenticated users can insert banners" ON public.banners;
DROP POLICY IF EXISTS "Authenticated users can update banners" ON public.banners;
DROP POLICY IF EXISTS "Authenticated users can delete banners" ON public.banners;

-- Admin/op-only write policies
CREATE POLICY "Admin/op can insert banners"
ON public.banners FOR INSERT
WITH CHECK (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'op'))
);

CREATE POLICY "Admin/op can update banners"
ON public.banners FOR UPDATE
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'op'))
);

CREATE POLICY "Admin/op can delete banners"
ON public.banners FOR DELETE
USING (
  EXISTS (SELECT 1 FROM public.user_roles WHERE user_id = auth.uid() AND role IN ('admin', 'op'))
);

-- ─── F5: Add gender/sexuality columns to profiles ───────────
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'gender'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN gender TEXT NOT NULL DEFAULT '';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'profiles' AND column_name = 'sexuality'
  ) THEN
    ALTER TABLE public.profiles ADD COLUMN sexuality TEXT NOT NULL DEFAULT '';
  END IF;
END $$;
