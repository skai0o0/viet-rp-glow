-- Add Google GenAI columns to user_api_keys table
ALTER TABLE user_api_keys
  ADD COLUMN IF NOT EXISTS google_genai_key TEXT,
  ADD COLUMN IF NOT EXISTS google_genai_endpoint TEXT;
