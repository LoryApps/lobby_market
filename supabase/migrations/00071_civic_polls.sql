-- =============================================================================
-- Lobby Market: Civic Quick Polls
-- =============================================================================
-- Lightweight community polling: up to 4 options, time-limited, linked
-- optionally to a topic. One vote per user per poll. Results visible after
-- voting. Distinct from topic_votes (formal FOR/AGAINST policy mechanism).
-- =============================================================================

CREATE TABLE IF NOT EXISTS civic_polls (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  question    TEXT        NOT NULL CHECK (char_length(question) BETWEEN 5 AND 200),
  options     JSONB       NOT NULL,   -- array of { id: string, label: string }
  topic_id    UUID        REFERENCES topics(id) ON DELETE SET NULL,
  category    TEXT,                   -- mirrors topic category taxonomy
  expires_at  TIMESTAMPTZ NOT NULL,
  is_closed   BOOLEAN     NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE civic_polls ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read polls"
  ON civic_polls FOR SELECT USING (true);

CREATE POLICY "Auth users can create polls"
  ON civic_polls FOR INSERT
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Author can close poll"
  ON civic_polls FOR UPDATE
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

-- ── Poll votes ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS civic_poll_votes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id     UUID        NOT NULL REFERENCES civic_polls(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  option_id   TEXT        NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (poll_id, user_id)
);

ALTER TABLE civic_poll_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read poll votes"
  ON civic_poll_votes FOR SELECT USING (true);

CREATE POLICY "Auth users can vote once per poll"
  ON civic_poll_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_polls_author    ON civic_polls (author_id);
CREATE INDEX IF NOT EXISTS idx_polls_topic     ON civic_polls (topic_id);
CREATE INDEX IF NOT EXISTS idx_polls_expires   ON civic_polls (expires_at DESC);
CREATE INDEX IF NOT EXISTS idx_poll_votes_poll ON civic_poll_votes (poll_id);
CREATE INDEX IF NOT EXISTS idx_poll_votes_user ON civic_poll_votes (user_id);
