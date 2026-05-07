-- =============================================================================
-- Lobby Market: User Tag Follows
-- =============================================================================
-- Allows users to subscribe to topic tags.
-- When a user follows a tag, topics with that tag appear in their
-- personalised "My Tags" feed.
-- =============================================================================

-- ── 1. user_tag_follows table ─────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS user_tag_follows (
  user_id    UUID    NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tag        TEXT    NOT NULL CHECK (char_length(tag) BETWEEN 1 AND 60),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, tag)
);

ALTER TABLE user_tag_follows ENABLE ROW LEVEL SECURITY;

-- Users manage their own follows
CREATE POLICY "Users manage own tag follows"
  ON user_tag_follows FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Anyone can read counts (for the follow-count badge)
CREATE POLICY "Public read tag follow counts"
  ON user_tag_follows FOR SELECT
  USING (TRUE);

-- ── 2. Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_user_tag_follows_user_id ON user_tag_follows(user_id);
CREATE INDEX IF NOT EXISTS idx_user_tag_follows_tag     ON user_tag_follows(tag);

-- ── 3. Helper function — follower count per tag ───────────────────────────────

CREATE OR REPLACE FUNCTION get_tag_follower_count(p_tag TEXT)
RETURNS BIGINT AS $$
  SELECT COUNT(*) FROM user_tag_follows WHERE tag = p_tag;
$$ LANGUAGE sql STABLE SECURITY DEFINER;
