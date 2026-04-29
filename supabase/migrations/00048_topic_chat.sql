-- Topic Live Chat: real-time discussion rooms per debate topic
-- Raw, ephemeral conversation — distinct from Arguments (structured + upvoted)
-- and Lobby Board (coalition posts). No threads, no upvotes.

CREATE TABLE IF NOT EXISTS topic_chat_messages (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id   UUID        NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content    TEXT        NOT NULL
             CHECK (char_length(content) >= 1 AND char_length(content) <= 300),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_chat_topic_created
  ON topic_chat_messages(topic_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_chat_user
  ON topic_chat_messages(user_id, created_at DESC);

ALTER TABLE topic_chat_messages ENABLE ROW LEVEL SECURITY;

-- All authenticated users can read any topic's chat
CREATE POLICY "chat_read"
  ON topic_chat_messages FOR SELECT
  TO authenticated
  USING (true);

-- Users can insert messages attributed to themselves
CREATE POLICY "chat_insert"
  ON topic_chat_messages FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can delete only their own messages
CREATE POLICY "chat_delete"
  ON topic_chat_messages FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
