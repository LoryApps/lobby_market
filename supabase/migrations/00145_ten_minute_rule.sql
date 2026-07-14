-- =============================================================================
-- Lobby Market: Ten Minute Rule Bills
-- =============================================================================
-- In the UK Parliament, any MP can use the Ten Minute Rule to introduce a
-- private member's bill. The proposer gets a short speech, an opponent may
-- respond, and the House votes on whether the bill should be formally
-- introduced. Most TMR bills never progress further — but they put ideas on
-- the parliamentary record.
--
-- On Lobby Market:
--   1. Any citizen can submit a TMR proposal with a written speech.
--   2. Any opponent can volunteer to speak against it.
--   3. After both speeches are in (or 48h has passed), voting opens.
--   4. If FOR > 50% with ≥10 votes, the proposal "passes" and can be
--      elevated to a formal Bill via /bills/introduce.
--   5. Regardless of outcome, the proposal is archived in the Hansard.
--
-- Status lifecycle:
--   draft           → saved but not yet submitted
--   seeking_opponent → proposal submitted, waiting for an opponent
--   ready_to_vote   → both speeches in (or 48h timeout reached)
--   voting          → active vote in progress
--   passed          → vote passed — can be introduced as a bill
--   rejected        → vote failed
--   withdrawn       → author withdrew before voting
-- =============================================================================

CREATE TABLE IF NOT EXISTS civic_tmr_proposals (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Proposer
  author_id           UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title               TEXT        NOT NULL CHECK (char_length(title) BETWEEN 10 AND 120),
  category            TEXT        NOT NULL DEFAULT 'Politics',
  proposal_speech     TEXT        NOT NULL CHECK (char_length(proposal_speech) BETWEEN 100 AND 2000),

  -- Optional link to an existing topic or bill
  topic_id            UUID        REFERENCES topics(id)      ON DELETE SET NULL,
  bill_id             UUID        REFERENCES civic_bills(id) ON DELETE SET NULL,

  -- Opponent
  opponent_id         UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  opposition_speech   TEXT        CHECK (char_length(opposition_speech) BETWEEN 50 AND 2000),
  opponent_joined_at  TIMESTAMPTZ,

  -- Status
  status              TEXT        NOT NULL DEFAULT 'seeking_opponent'
                        CHECK (status IN (
                          'draft', 'seeking_opponent', 'ready_to_vote',
                          'voting', 'passed', 'rejected', 'withdrawn'
                        )),

  -- Vote tallies
  votes_for           INT         NOT NULL DEFAULT 0,
  votes_against       INT         NOT NULL DEFAULT 0,

  -- Timeline
  voting_opens_at     TIMESTAMPTZ,
  voting_closes_at    TIMESTAMPTZ,
  decided_at          TIMESTAMPTZ,

  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Votes on TMR proposals
CREATE TABLE IF NOT EXISTS civic_tmr_votes (
  proposal_id UUID NOT NULL REFERENCES civic_tmr_proposals(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  side        TEXT NOT NULL CHECK (side IN ('for', 'against')),
  voted_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (proposal_id, user_id)
);

-- Trigger: keep vote tallies in sync
CREATE OR REPLACE FUNCTION sync_tmr_vote_counts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE civic_tmr_proposals SET
    votes_for     = (SELECT COUNT(*) FROM civic_tmr_votes WHERE proposal_id = COALESCE(NEW.proposal_id, OLD.proposal_id) AND side = 'for'),
    votes_against = (SELECT COUNT(*) FROM civic_tmr_votes WHERE proposal_id = COALESCE(NEW.proposal_id, OLD.proposal_id) AND side = 'against'),
    updated_at    = now()
  WHERE id = COALESCE(NEW.proposal_id, OLD.proposal_id);
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_tmr_vote_counts ON civic_tmr_votes;
CREATE TRIGGER trg_tmr_vote_counts
AFTER INSERT OR UPDATE OR DELETE ON civic_tmr_votes
FOR EACH ROW EXECUTE FUNCTION sync_tmr_vote_counts();

-- Trigger: auto-open voting when both speeches are present
CREATE OR REPLACE FUNCTION auto_open_tmr_voting()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.opposition_speech IS NOT NULL AND OLD.opposition_speech IS NULL
     AND NEW.status = 'ready_to_vote' THEN
    UPDATE civic_tmr_proposals SET
      status           = 'voting',
      voting_opens_at  = now(),
      voting_closes_at = now() + interval '24 hours',
      updated_at       = now()
    WHERE id = NEW.id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_tmr_auto_vote ON civic_tmr_proposals;
CREATE TRIGGER trg_tmr_auto_vote
AFTER UPDATE ON civic_tmr_proposals
FOR EACH ROW EXECUTE FUNCTION auto_open_tmr_voting();

-- Indexes
CREATE INDEX IF NOT EXISTS idx_tmr_proposals_status ON civic_tmr_proposals(status);
CREATE INDEX IF NOT EXISTS idx_tmr_proposals_author ON civic_tmr_proposals(author_id);
CREATE INDEX IF NOT EXISTS idx_tmr_proposals_created ON civic_tmr_proposals(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_tmr_votes_user ON civic_tmr_votes(user_id);

-- RLS
ALTER TABLE civic_tmr_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic_tmr_votes     ENABLE ROW LEVEL SECURITY;

CREATE POLICY "tmr_proposals_public_read"  ON civic_tmr_proposals FOR SELECT USING (true);
CREATE POLICY "tmr_proposals_auth_insert"  ON civic_tmr_proposals FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);
CREATE POLICY "tmr_proposals_author_update" ON civic_tmr_proposals FOR UPDATE USING (
  auth.uid() = author_id OR auth.uid() = opponent_id
);

CREATE POLICY "tmr_votes_public_read"   ON civic_tmr_votes FOR SELECT USING (true);
CREATE POLICY "tmr_votes_auth_insert"   ON civic_tmr_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tmr_votes_auth_delete"   ON civic_tmr_votes FOR DELETE USING (auth.uid() = user_id);
