-- =============================================================================
-- Lobby Market: Post-Debate "Who Won?" Community Poll
-- =============================================================================
-- After a debate ends, any authenticated user (including non-participants)
-- can cast one vote on which side argued more convincingly — independent
-- of their FOR/AGAINST stance on the underlying topic.
-- =============================================================================

CREATE TABLE IF NOT EXISTS debate_winner_polls (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id   uuid        NOT NULL REFERENCES debates(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  winner      text        NOT NULL CHECK (winner IN ('blue', 'red', 'tie')),
  created_at  timestamptz NOT NULL DEFAULT now(),

  UNIQUE (debate_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_dwp_debate ON debate_winner_polls (debate_id);
CREATE INDEX IF NOT EXISTS idx_dwp_user   ON debate_winner_polls (user_id);

-- ── Row-level security ────────────────────────────────────────────────────────

ALTER TABLE debate_winner_polls ENABLE ROW LEVEL SECURITY;

-- Anyone can read the aggregate (no personal data exposed)
CREATE POLICY "dwp_select"
  ON debate_winner_polls FOR SELECT
  USING (true);

-- Authenticated users can insert their own vote
CREATE POLICY "dwp_insert"
  ON debate_winner_polls FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users cannot update or delete their own vote once cast
-- (parity with the main voting mechanic)
