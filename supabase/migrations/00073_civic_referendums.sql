-- =============================================================================
-- Lobby Market: Civic Referendums
-- =============================================================================
-- Platform-governance meta-voting. Any citizen (person+) can propose a
-- referendum on a civic question, platform feature request, community
-- guideline change, or new category. Once a referendum reaches quorum and
-- closes, it either PASSES (≥55% for) or FAILS. Elders/moderators can veto.
--
-- Distinct from:
--   civic_polls    — quick 4-option community polls (arbitrary questions)
--   topic_votes    — formal FOR/AGAINST policy topic voting
--   debate_winner_polls — who-won polls on completed debates
-- =============================================================================

CREATE TABLE IF NOT EXISTS civic_referendums (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  proposer_id       UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  question          TEXT        NOT NULL CHECK (char_length(question) BETWEEN 10 AND 200),
  description       TEXT        CHECK (char_length(description) <= 1500),
  category          TEXT        NOT NULL DEFAULT 'community'
                    CHECK (category IN ('governance','features','community','policy','other')),
  status            TEXT        NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','passed','failed','vetoed')),
  quorum_required   INT         NOT NULL DEFAULT 25,
  for_votes         INT         NOT NULL DEFAULT 0,
  against_votes     INT         NOT NULL DEFAULT 0,
  closes_at         TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE civic_referendums ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read referendums"
  ON civic_referendums FOR SELECT USING (true);

CREATE POLICY "Auth users can propose referendums"
  ON civic_referendums FOR INSERT
  WITH CHECK (auth.uid() = proposer_id);

-- Elders and troll_catchers can close/veto referendums
CREATE POLICY "Moderators can update referendum status"
  ON civic_referendums FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('elder', 'troll_catcher')
    )
  );

-- ── Votes ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS referendum_votes (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  referendum_id   UUID        NOT NULL REFERENCES civic_referendums(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vote            TEXT        NOT NULL CHECK (vote IN ('for', 'against')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (referendum_id, user_id)
);

ALTER TABLE referendum_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read referendum votes"
  ON referendum_votes FOR SELECT USING (true);

CREATE POLICY "Auth users can vote on referendums"
  ON referendum_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can change their referendum vote"
  ON referendum_votes FOR DELETE
  USING (auth.uid() = user_id);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_referendums_status     ON civic_referendums (status);
CREATE INDEX IF NOT EXISTS idx_referendums_closes_at  ON civic_referendums (closes_at DESC);
CREATE INDEX IF NOT EXISTS idx_referendums_proposer   ON civic_referendums (proposer_id);
CREATE INDEX IF NOT EXISTS idx_referendum_votes_ref   ON referendum_votes (referendum_id);
CREATE INDEX IF NOT EXISTS idx_referendum_votes_user  ON referendum_votes (user_id);

-- ── RPC: cast_referendum_vote ─────────────────────────────────────────────────
-- Atomically inserts vote, updates counters, and auto-closes if quorum + deadline met.

CREATE OR REPLACE FUNCTION cast_referendum_vote(
  p_referendum_id UUID,
  p_vote          TEXT   -- 'for' | 'against'
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id       UUID;
  v_status        TEXT;
  v_closes_at     TIMESTAMPTZ;
  v_quorum        INT;
  v_for_votes     INT;
  v_against_votes INT;
  v_total         INT;
  v_for_pct       NUMERIC;
BEGIN
  -- Auth check
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('error', 'not_authenticated');
  END IF;

  -- Load referendum
  SELECT status, closes_at, quorum_required, for_votes, against_votes
    INTO v_status, v_closes_at, v_quorum, v_for_votes, v_against_votes
    FROM civic_referendums
   WHERE id = p_referendum_id;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'not_found');
  END IF;

  IF v_status <> 'open' THEN
    RETURN json_build_object('error', 'referendum_closed');
  END IF;

  IF v_closes_at < NOW() THEN
    RETURN json_build_object('error', 'referendum_expired');
  END IF;

  -- Delete any existing vote (allows changing vote)
  DELETE FROM referendum_votes
   WHERE referendum_id = p_referendum_id AND user_id = v_user_id;

  -- Cast new vote
  INSERT INTO referendum_votes (referendum_id, user_id, vote)
  VALUES (p_referendum_id, v_user_id, p_vote);

  -- Recount from scratch for accuracy
  SELECT
    COUNT(*) FILTER (WHERE vote = 'for'),
    COUNT(*) FILTER (WHERE vote = 'against')
  INTO v_for_votes, v_against_votes
  FROM referendum_votes
  WHERE referendum_id = p_referendum_id;

  v_total := v_for_votes + v_against_votes;
  v_for_pct := CASE WHEN v_total > 0 THEN (v_for_votes::NUMERIC / v_total) * 100 ELSE 0 END;

  UPDATE civic_referendums
     SET for_votes = v_for_votes,
         against_votes = v_against_votes
   WHERE id = p_referendum_id;

  -- Auto-close if quorum met AND close window has passed
  IF v_total >= v_quorum AND v_closes_at <= NOW() THEN
    UPDATE civic_referendums
       SET status = CASE WHEN v_for_pct >= 55 THEN 'passed' ELSE 'failed' END
     WHERE id = p_referendum_id;
  END IF;

  RETURN json_build_object(
    'ok',           true,
    'for_votes',    v_for_votes,
    'against_votes', v_against_votes,
    'total',        v_total,
    'for_pct',      round(v_for_pct, 1),
    'user_vote',    p_vote
  );
END;
$$;
