-- Chat Summarization & Key Facts System
-- Inspired by SillyTavern's Summarize extension

-- ============================================================
-- 1. chat_summaries: stores rolling summaries of chat sessions
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_summaries (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  summary TEXT NOT NULL,
  messages_up_to INT NOT NULL DEFAULT 0,  -- số tin nhắn đã được tóm tắt (inclusive)
  token_count INT NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_summaries_session
  ON chat_summaries(session_id, created_at DESC);

ALTER TABLE chat_summaries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own summaries" ON chat_summaries
  FOR SELECT USING (
    session_id IN (SELECT id FROM chat_sessions WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert own summaries" ON chat_summaries
  FOR INSERT WITH CHECK (
    session_id IN (SELECT id FROM chat_sessions WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete own summaries" ON chat_summaries
  FOR DELETE USING (
    session_id IN (SELECT id FROM chat_sessions WHERE user_id = auth.uid())
  );

-- Service role can manage all (for server-side summarization)
CREATE POLICY "Service role full access on summaries" ON chat_summaries
  FOR ALL USING (auth.role() = 'service_role');

-- ============================================================
-- 2. chat_facts: stores key facts extracted from conversations
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_facts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id UUID NOT NULL REFERENCES chat_sessions(id) ON DELETE CASCADE,
  fact TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'general',  -- relationship, event, item, location, general
  message_index INT NOT NULL,                -- tin nhắn thứ mấy khi fact xảy ra
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chat_facts_session
  ON chat_facts(session_id, created_at);

ALTER TABLE chat_facts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own facts" ON chat_facts
  FOR SELECT USING (
    session_id IN (SELECT id FROM chat_sessions WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can insert own facts" ON chat_facts
  FOR INSERT WITH CHECK (
    session_id IN (SELECT id FROM chat_sessions WHERE user_id = auth.uid())
  );

CREATE POLICY "Users can delete own facts" ON chat_facts
  FOR DELETE USING (
    session_id IN (SELECT id FROM chat_sessions WHERE user_id = auth.uid())
  );

CREATE POLICY "Service role full access on facts" ON chat_facts
  FOR ALL USING (auth.role() = 'service_role');
