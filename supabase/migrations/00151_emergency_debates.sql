-- =============================================================================
-- Lobby Market: Emergency Debates
-- =============================================================================
-- In Westminster Parliament, an emergency debate (Standing Order 24) lets any
-- MP apply to debate a specific matter of urgent public importance. The Speaker
-- decides whether to grant it; if granted, the House debates for 3 hours.
--
-- On Lobby Market:
--   1. Any citizen may propose an emergency debate (1 per user per 24h).
--   2. The proposal must state an urgency justification (why now).
--   3. Other citizens "second" the proposal; 10+ seconds → "granted" status.
--   4. Granted debates auto-create a timed debate room (60 min) visible on
--      the homepage banner and the /emergency-debates page.
--   5. Proposals expire after 24 hours if not granted.
--   6. The Speaker (any elder/admin) can grant or deny independently.
-- =============================================================================

CREATE TABLE IF NOT EXISTS emergency_debates (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  proposer_id       UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Proposal content
  title             TEXT        NOT NULL CHECK (char_length(title) BETWEEN 10 AND 200),
  urgency_statement TEXT        NOT NULL CHECK (char_length(urgency_statement) BETWEEN 50 AND 1000),
  topic_id          UUID        REFERENCES topics(id) ON DELETE SET NULL,

  -- Status lifecycle
  status            TEXT        NOT NULL DEFAULT 'proposed'
                               CHECK (status IN ('proposed','granted','denied','expired','concluded')),

  -- Endorsement mechanics
  endorsement_count INT         NOT NULL DEFAULT 0,
  endorsement_target INT        NOT NULL DEFAULT 10,

  -- Speaker decision
  speaker_decision  TEXT        CHECK (char_length(speaker_decision) <= 500),
  speaker_id        UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  decided_at        TIMESTAMPTZ,

  -- Auto-created debate link (when granted)
  debate_id         UUID        REFERENCES debates(id) ON DELETE SET NULL,

  -- Timing
  proposed_at       TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at        TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '24 hours'),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Endorsements (seconds)
CREATE TABLE IF NOT EXISTS emergency_debate_endorsements (
  debate_id   UUID NOT NULL REFERENCES emergency_debates(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (debate_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_emergency_debates_status
  ON emergency_debates(status, proposed_at DESC);

CREATE INDEX IF NOT EXISTS idx_emergency_debates_proposer
  ON emergency_debates(proposer_id, proposed_at DESC);

CREATE INDEX IF NOT EXISTS idx_emergency_debate_endorsements_debate
  ON emergency_debate_endorsements(debate_id);

-- RLS
ALTER TABLE emergency_debates ENABLE ROW LEVEL SECURITY;
ALTER TABLE emergency_debate_endorsements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Public read emergency debates"
  ON emergency_debates FOR SELECT USING (true);

CREATE POLICY "Authenticated users can propose emergency debates"
  ON emergency_debates FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = proposer_id);

CREATE POLICY "Elders and admins can update status"
  ON emergency_debates FOR UPDATE
  USING (
    auth.uid() IS NOT NULL AND (
      EXISTS (
        SELECT 1 FROM profiles
        WHERE id = auth.uid() AND role IN ('elder', 'admin')
      )
    )
  );

CREATE POLICY "Public read endorsements"
  ON emergency_debate_endorsements FOR SELECT USING (true);

CREATE POLICY "Authenticated users can endorse"
  ON emergency_debate_endorsements FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "Users can remove their own endorsement"
  ON emergency_debate_endorsements FOR DELETE
  USING (auth.uid() = user_id);

-- Function: auto-expire stale proposals
CREATE OR REPLACE FUNCTION expire_emergency_debates()
RETURNS void LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE emergency_debates
  SET status = 'expired'
  WHERE status = 'proposed'
    AND expires_at < NOW();
END;
$$;

COMMENT ON TABLE emergency_debates IS
  'Standing Order 24 emergency debate proposals — fast-tracked debates on urgent civic matters.';
