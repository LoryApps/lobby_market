-- =============================================================================
-- Lobby Market: Debate Challenges (1-on-1 civic duels)
-- =============================================================================
-- Allows any user to challenge another user to a debate on a specific topic.
-- The challenged user can accept or decline within the expiry window.
-- Accepted challenges link back to a debates row so the duel can proceed.
-- =============================================================================

CREATE TABLE IF NOT EXISTS debate_challenges (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  challenger_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  challenged_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  topic_id      UUID        NOT NULL REFERENCES topics(id)   ON DELETE CASCADE,
  message       TEXT        CHECK (message IS NULL OR (char_length(message) >= 1 AND char_length(message) <= 280)),
  status        TEXT        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'accepted', 'declined', 'cancelled', 'expired')),
  debate_id     UUID        REFERENCES debates(id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT NOW() + INTERVAL '7 days',
  responded_at  TIMESTAMPTZ,

  CONSTRAINT no_self_challenge CHECK (challenger_id != challenged_id)
);

-- Indexes for inbox queries
CREATE INDEX IF NOT EXISTS idx_dc_challenged
  ON debate_challenges(challenged_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dc_challenger
  ON debate_challenges(challenger_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_dc_pending
  ON debate_challenges(status, expires_at)
  WHERE status = 'pending';

-- RLS
ALTER TABLE debate_challenges ENABLE ROW LEVEL SECURITY;

-- Participants see their own challenges
CREATE POLICY "dc_select"
  ON debate_challenges FOR SELECT
  TO authenticated
  USING (challenger_id = auth.uid() OR challenged_id = auth.uid());

-- Any authenticated user can create a challenge (must be the challenger)
CREATE POLICY "dc_insert"
  ON debate_challenges FOR INSERT
  TO authenticated
  WITH CHECK (challenger_id = auth.uid());

-- Only participants can update status
CREATE POLICY "dc_update"
  ON debate_challenges FOR UPDATE
  TO authenticated
  USING  (challenger_id = auth.uid() OR challenged_id = auth.uid())
  WITH CHECK (challenger_id = auth.uid() OR challenged_id = auth.uid());

-- Only the challenger can delete (cancel)
CREATE POLICY "dc_delete"
  ON debate_challenges FOR DELETE
  TO authenticated
  USING (challenger_id = auth.uid());
