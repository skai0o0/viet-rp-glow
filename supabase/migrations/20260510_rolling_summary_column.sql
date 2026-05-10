-- Add rolling_summary column to chat_sessions for fast denormalised reads.
-- The source of truth is still chat_summaries; this column is updated
-- by the memory manager after each summarisation pass.

ALTER TABLE chat_sessions
ADD COLUMN IF NOT EXISTS rolling_summary text;
