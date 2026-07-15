-- =============================================================================
-- Lobby Market: Confidence Votes
-- =============================================================================
-- Westminster parliamentary procedure: a formal vote of confidence or no
-- confidence in a civic body (coalition, committee, council, etc.).
--
-- Two-phase process:
--   1. Tabling: a citizen proposes the motion; 10 citizens must second it
--      within 7 days for it to advance to a formal division.
--   2. Division: once seconded, a 48-hour vote opens. Citizens cast Aye
--      (support the motion) or No (oppose it). Majority of ballots cast wins.
--
-- Motion types:
--   no_confidence  — body must stand down / lose legitimacy if carried
--   confidence     — reaffirms a body's mandate if carried
--   censure        — formal rebuke; binding but not dismissal
-- =============================================================================

CREATE TABLE IF NOT EXISTS confidence_votes (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  motion_type       TEXT        NOT NULL CHECK (motion_type IN ('no_confidence','confidence','censure')),

  -- The civic body being targeted
  target_name       TEXT        NOT NULL CHECK (char_length(target_name) BETWEEN 3 AND 120),
  target_type       TEXT        NOT NULL DEFAULT 'coalition'
                                CHECK (target_type IN ('coalition','committee','elder','council','officer')),

  proposer_id       UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  reason            TEXT        NOT NULL CHECK (char_length(reason) BETWEEN 30 AND 1000),
  context_note      TEXT        CHECK (char_length(context_note) <= 500),

  -- Phase 1: tabling
  seconds_required  INT         NOT NULL DEFAULT 10,
  seconds_count     INT         NOT NULL DEFAULT 0,

  -- Phase 2: division
  ayes              INT         NOT NULL DEFAULT 0,
  noes              INT         NOT NULL DEFAULT 0,
  abstentions       INT         NOT NULL DEFAULT 0,

  status            TEXT        NOT NULL DEFAULT 'tabling'
                                CHECK (status IN ('tabling','open','closed','withdrawn')),

  outcome           TEXT        CHECK (outcome IN ('carried','defeated','withdrawn')),

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  seconds_deadline  TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  closes_at         TIMESTAMPTZ
);

-- Who seconded each motion (phase 1)
CREATE TABLE IF NOT EXISTS confidence_vote_seconds (
  confidence_vote_id UUID        NOT NULL REFERENCES confidence_votes(id) ON DELETE CASCADE,
  user_id            UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (confidence_vote_id, user_id)
);

-- Division ballots (phase 2)
CREATE TABLE IF NOT EXISTS confidence_vote_ballots (
  confidence_vote_id UUID        NOT NULL REFERENCES confidence_votes(id) ON DELETE CASCADE,
  user_id            UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  ballot             TEXT        NOT NULL CHECK (ballot IN ('aye','no','abstain')),
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (confidence_vote_id, user_id)
);

-- ── Indexes ────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_cv_status_created  ON confidence_votes(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_cv_proposer        ON confidence_votes(proposer_id);
CREATE INDEX IF NOT EXISTS idx_cv_seconds_user    ON confidence_vote_seconds(user_id);
CREATE INDEX IF NOT EXISTS idx_cv_ballots_user    ON confidence_vote_ballots(user_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE confidence_votes         ENABLE ROW LEVEL SECURITY;
ALTER TABLE confidence_vote_seconds  ENABLE ROW LEVEL SECURITY;
ALTER TABLE confidence_vote_ballots  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cv_select"         ON confidence_votes         FOR SELECT USING (true);
CREATE POLICY "cv_insert"         ON confidence_votes         FOR INSERT WITH CHECK (auth.uid() = proposer_id);
CREATE POLICY "cv_seconds_select" ON confidence_vote_seconds  FOR SELECT USING (true);
CREATE POLICY "cv_seconds_insert" ON confidence_vote_seconds  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "cv_seconds_delete" ON confidence_vote_seconds  FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "cv_ballots_select" ON confidence_vote_ballots  FOR SELECT USING (true);
CREATE POLICY "cv_ballots_insert" ON confidence_vote_ballots  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- ── Function: close expired tabling periods ───────────────────────────────────
CREATE OR REPLACE FUNCTION expire_confidence_votes()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  -- Expire tabling motions that didn't get enough seconds
  UPDATE confidence_votes
  SET status = 'closed', outcome = 'defeated'
  WHERE status = 'tabling'
    AND seconds_deadline < now()
    AND seconds_count < seconds_required;

  -- Close open divisions that passed their deadline
  UPDATE confidence_votes
  SET
    status  = 'closed',
    outcome = CASE WHEN ayes > noes THEN 'carried' ELSE 'defeated' END
  WHERE status = 'open'
    AND closes_at < now();
END;
$$;

-- ── Seed: a few example motions ───────────────────────────────────────────────
-- (These are illustrative; they reference no real user IDs.)
-- Real data flows in via the UI.
