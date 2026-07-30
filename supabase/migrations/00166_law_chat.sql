-- Law Discussion Chat
-- Real-time discussion rooms per established law.
-- Distinct from Amendments (formal proposals + voting) and Community hub.
-- Casual, ephemeral civic conversation about law implications and effects.

CREATE TABLE IF NOT EXISTS law_chat_messages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  law_id     UUID        NOT NULL REFERENCES laws(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content    TEXT        NOT NULL
             CHECK (char_length(content) >= 1 AND char_length(content) <= 300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_law_chat_law_created
  ON law_chat_messages(law_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_law_chat_user
  ON law_chat_messages(user_id, created_at DESC);

ALTER TABLE law_chat_messages ENABLE ROW LEVEL SECURITY;

CREATE POLICY "law_chat_read"
  ON law_chat_messages FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "law_chat_insert"
  ON law_chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "law_chat_delete"
  ON law_chat_messages FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE law_chat_messages IS
  'Ephemeral real-time discussion per established law. Max 300 chars per message.';
