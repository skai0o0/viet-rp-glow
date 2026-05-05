-- Persist BYOK API keys (encrypted) per user
CREATE TABLE user_api_keys (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  openrouter_key TEXT,       -- AES-GCM encrypted, base64 encoded
  mimo_key TEXT,              -- AES-GCM encrypted, base64 encoded
  mimo_endpoint TEXT,         -- plain text (not sensitive)
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE user_api_keys ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can read own keys" ON user_api_keys
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own keys" ON user_api_keys
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own keys" ON user_api_keys
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own keys" ON user_api_keys
  FOR DELETE USING (auth.uid() = user_id);
