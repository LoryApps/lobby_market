-- =============================================================================
-- Lobby Market: Argument Replies
-- =============================================================================
--
-- Adds a threaded reply layer beneath top-level topic arguments.
-- Unlike the parent topic_arguments table (one argument per user per topic),
-- replies have no uniqueness constraint — a user can post multiple replies
-- to different arguments, or even the same one.
--
-- Schema:
--   argument_replies
--     id            UUID PK
--     argument_id   FK → topic_arguments.id CASCADE
--     topic_id      FK → topics.id CASCADE  (denormalized for fast per-topic queries)
--     user_id       FK → profiles.id CASCADE
--     content       TEXT 1–300 chars
--     created_at    TIMESTAMPTZ
--
-- RLS:
--   SELECT  — public (anon + authenticated)
--   INSERT  — authenticated only (own user_id enforced)
--   DELETE  — own rows only
-- =============================================================================

-- ── 1. Table ──────────────────────────────────────────────────────────────────

CREATE TABLE argument_replies (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  argument_id   UUID         NOT NULL REFERENCES topic_arguments(id) ON DELETE CASCADE,
  topic_id      UUID         NOT NULL REFERENCES topics(id)          ON DELETE CASCADE,
  user_id       UUID         NOT NULL REFERENCES profiles(id)        ON DELETE CASCADE,
  content       TEXT         NOT NULL CHECK (char_length(content) BETWEEN 1 AND 300),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ── 2. Indexes ────────────────────────────────────────────────────────────────

-- Primary access pattern: fetch all replies for a given argument (in order)
CREATE INDEX idx_argument_replies_argument
  ON argument_replies(argument_id, created_at ASC);

-- Secondary: fetch all replies in a topic (useful for moderation)
CREATE INDEX idx_argument_replies_topic
  ON argument_replies(topic_id, created_at DESC);

COMMENT ON TABLE argument_replies IS
  'Short reply threads beneath individual FOR/AGAINST arguments on topics';

-- ── 3. RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE argument_replies ENABLE ROW LEVEL SECURITY;

-- Anyone can read replies
CREATE POLICY "replies_select_public"
  ON argument_replies FOR SELECT
  USING (true);

-- Authenticated users can insert their own replies
CREATE POLICY "replies_insert_own"
  ON argument_replies FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own replies
CREATE POLICY "replies_delete_own"
  ON argument_replies FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);
