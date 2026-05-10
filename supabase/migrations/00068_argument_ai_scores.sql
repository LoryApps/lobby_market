-- =============================================================================
-- Lobby Market: Persistent AI Critique Scores on Arguments
-- =============================================================================
-- Adds ai_score (1–10) and ai_grade (A/B/C/D/F) to topic_arguments so that
-- when a user runs the inline AI critique, the result is saved and rendered
-- as a quality badge on the argument card for all to see.
-- =============================================================================

ALTER TABLE topic_arguments
  ADD COLUMN IF NOT EXISTS ai_score SMALLINT NULL CHECK (ai_score BETWEEN 1 AND 10),
  ADD COLUMN IF NOT EXISTS ai_grade TEXT    NULL CHECK (ai_grade IN ('A', 'B', 'C', 'D', 'F'));

-- Only the argument author can update their own score
CREATE POLICY "owner_update_ai_score"
  ON topic_arguments FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Index to power the top-arguments leaderboard
CREATE INDEX IF NOT EXISTS idx_topic_arguments_ai_score
  ON topic_arguments (ai_score DESC NULLS LAST, upvotes DESC, created_at DESC);
