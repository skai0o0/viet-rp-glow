-- Seed 50 public cards for UI testing
-- Safe to run: only inserts cards that do not already exist by name pattern.

WITH base_user AS (
  SELECT id
  FROM auth.users
  ORDER BY created_at ASC
  LIMIT 1
),
seed AS (
  SELECT generate_series(1, 50) AS i
),
rows_to_insert AS (
  SELECT
    bu.id AS user_id,
    ('Seed Public Card #' || s.i)::text AS name,
    ('Card test hiển thị #' || s.i)::text AS short_summary,
    ('Mô tả giả lập cho card #' || s.i)::text AS description,
    'Thân thiện, phản hồi nhanh'::text AS personality,
    'Bối cảnh test UI danh sách card'::text AS scenario,
    ('Xin chào, mình là card test #' || s.i || '!')::text AS first_mes,
    ('User: Hello\nAI: Đây là phản hồi mẫu cho card #' || s.i)::text AS mes_example,
    'Bạn là nhân vật dùng để test giao diện.'::text AS system_prompt,
    'Auto-generated for UI testing'::text AS creator_notes,
    'Giữ phản hồi ngắn gọn.'::text AS post_history_instructions,
    'QA Seeder'::text AS creator,
    'v1'::text AS character_version,
    ARRAY['test','seed','public']::text[] AS tags,
    true AS is_public,
    0::numeric AS rating,
    0::integer AS message_count
  FROM seed s
  CROSS JOIN base_user bu
)
INSERT INTO public.characters (
  user_id,
  name,
  short_summary,
  description,
  personality,
  scenario,
  first_mes,
  mes_example,
  system_prompt,
  creator_notes,
  post_history_instructions,
  creator,
  character_version,
  tags,
  is_public,
  rating,
  message_count
)
SELECT
  r.user_id,
  r.name,
  r.short_summary,
  r.description,
  r.personality,
  r.scenario,
  r.first_mes,
  r.mes_example,
  r.system_prompt,
  r.creator_notes,
  r.post_history_instructions,
  r.creator,
  r.character_version,
  r.tags,
  r.is_public,
  r.rating,
  r.message_count
FROM rows_to_insert r
WHERE NOT EXISTS (
  SELECT 1
  FROM public.characters c
  WHERE c.name = r.name
);
