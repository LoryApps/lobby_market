-- =============================================================================
-- Lobby Market: Civic Time Capsules
-- =============================================================================
-- Users write time-locked messages or predictions linked to topics.
-- On the reveal date, predictions are auto-scored against the topic's outcome.
-- Correct predictions earn Clout via gift_clout().
-- =============================================================================

CREATE TABLE IF NOT EXISTS civic_capsules (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- The message itself (1–500 characters)
  message          TEXT        NOT NULL
                               CHECK (char_length(message) >= 1 AND char_length(message) <= 500),

  -- Optional link to a topic for prediction-style capsules
  topic_id         UUID        REFERENCES topics(id) ON DELETE SET NULL,

  -- If linked to a topic, whether the user predicts it will pass or fail
  prediction_side  TEXT        CHECK (prediction_side IN ('pass', 'fail')),

  -- When this capsule can be opened (must be in the future at creation time)
  reveal_at        TIMESTAMPTZ NOT NULL,

  -- Whether the capsule has been revealed (flipped to true when reveal_at passes)
  is_revealed      BOOLEAN     NOT NULL DEFAULT false,

  -- Cached outcome once revealed (null until revealed)
  -- 'correct' | 'wrong' | 'pending' (topic not resolved yet) | null (no prediction)
  outcome          TEXT        CHECK (outcome IN ('correct', 'wrong', 'pending')),

  -- Clout awarded on reveal (non-null if outcome = 'correct')
  clout_awarded    INTEGER,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_civic_capsules_user_id
  ON civic_capsules (user_id, reveal_at DESC);

CREATE INDEX IF NOT EXISTS idx_civic_capsules_topic_id
  ON civic_capsules (topic_id)
  WHERE topic_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_civic_capsules_pending_reveal
  ON civic_capsules (reveal_at)
  WHERE is_revealed = false;

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE civic_capsules ENABLE ROW LEVEL SECURITY;

-- Owners can read their own capsules (pending messages stay hidden from others)
CREATE POLICY "civic_capsules_owner_select"
  ON civic_capsules FOR SELECT
  USING (auth.uid() = user_id);

-- Authenticated users can insert their own capsules
CREATE POLICY "civic_capsules_owner_insert"
  ON civic_capsules FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Owners can update their own capsules (for reveal logic)
CREATE POLICY "civic_capsules_owner_update"
  ON civic_capsules FOR UPDATE
  USING (auth.uid() = user_id);

-- Owners can delete unrevealed capsules
CREATE POLICY "civic_capsules_owner_delete"
  ON civic_capsules FOR DELETE
  USING (auth.uid() = user_id AND is_revealed = false);
