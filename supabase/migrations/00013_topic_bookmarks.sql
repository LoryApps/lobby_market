-- Topic bookmarks (saved topics)
-- Allows users to bookmark / save topics for later reference.

CREATE TABLE IF NOT EXISTS topic_bookmarks (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  topic_id    UUID        NOT NULL REFERENCES topics(id)   ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, topic_id)
);

CREATE INDEX IF NOT EXISTS idx_topic_bookmarks_user  ON topic_bookmarks(user_id);
CREATE INDEX IF NOT EXISTS idx_topic_bookmarks_topic ON topic_bookmarks(topic_id);

-- Row-level security
ALTER TABLE topic_bookmarks ENABLE ROW LEVEL SECURITY;

-- Users can only see their own bookmarks
CREATE POLICY "topic_bookmarks_select"
  ON topic_bookmarks FOR SELECT
  USING (auth.uid() = user_id);

-- Users can only insert their own bookmarks
CREATE POLICY "topic_bookmarks_insert"
  ON topic_bookmarks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can only delete their own bookmarks
CREATE POLICY "topic_bookmarks_delete"
  ON topic_bookmarks FOR DELETE
  USING (auth.uid() = user_id);
