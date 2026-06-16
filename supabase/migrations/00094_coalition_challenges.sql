-- =============================================================================
-- Lobby Market: Coalition Challenges — formal inter-coalition debate challenges
-- =============================================================================
-- A coalition (the challenger) can formally challenge another coalition
-- (the challenged) to publicly debate a specific active topic.  The challenged
-- coalition's leader/officers have 7 days to accept or decline.
--
-- Once accepted:
--   • Both coalitions officially declare their stance on the topic.
--   • Members who argue on that topic earn bonus coalition influence points.
--   • When the topic resolves the coalition whose stance matched the final
--     outcome is declared the winner; wins/losses on both coalitions are updated.
--
-- Distinct from:
--   debate_challenges   — 1-on-1 user debate challenges
--   coalition_stances   — declared positions without a formal opponent
-- =============================================================================

CREATE TABLE IF NOT EXISTS coalition_challenges (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id          UUID        NOT NULL REFERENCES topics(id)     ON DELETE CASCADE,
  challenger_id     UUID        NOT NULL REFERENCES coalitions(id) ON DELETE CASCADE,
  challenged_id     UUID        NOT NULL REFERENCES coalitions(id) ON DELETE CASCADE,
  issued_by         UUID        NOT NULL REFERENCES profiles(id)   ON DELETE CASCADE,

  status            TEXT        NOT NULL DEFAULT 'pending'
                                CHECK (status IN ('pending', 'accepted', 'declined', 'expired', 'resolved')),

  -- Stances each side declares (filled in on accept for challenged side)
  challenger_stance TEXT        CHECK (challenger_stance IN ('for', 'against', 'neutral')),
  challenged_stance TEXT        CHECK (challenged_stance IN ('for', 'against', 'neutral')),

  -- Optional message from challenger (like trash talk or policy rationale)
  message           TEXT        CHECK (char_length(message) <= 500),

  -- Optional Clout stake put up by challenger (winner takes all)
  stake_clout       INTEGER     NOT NULL DEFAULT 0 CHECK (stake_clout >= 0),

  -- Resolution
  winner_id         UUID        REFERENCES coalitions(id) ON DELETE SET NULL,

  expires_at        TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  responded_at      TIMESTAMPTZ,
  resolved_at       TIMESTAMPTZ,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- A coalition pair can only have one open challenge per topic at a time
  CONSTRAINT coalition_challenges_unique_open
    EXCLUDE USING btree (
      LEAST(challenger_id::text, challenged_id::text)   WITH =,
      GREATEST(challenger_id::text, challenged_id::text) WITH =,
      topic_id WITH =
    ) WHERE (status IN ('pending', 'accepted'))
);

CREATE INDEX IF NOT EXISTS idx_coalition_challenges_challenger
  ON coalition_challenges (challenger_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_coalition_challenges_challenged
  ON coalition_challenges (challenged_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_coalition_challenges_topic
  ON coalition_challenges (topic_id, status);

CREATE INDEX IF NOT EXISTS idx_coalition_challenges_status
  ON coalition_challenges (status, expires_at);

-- ── Row Level Security ─────────────────────────────────────────────────────────

ALTER TABLE coalition_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "coalition_challenges_select_public"
  ON coalition_challenges FOR SELECT USING (true);

CREATE POLICY "coalition_challenges_insert_auth"
  ON coalition_challenges FOR INSERT
  WITH CHECK (auth.uid() = issued_by);

CREATE POLICY "coalition_challenges_update_own"
  ON coalition_challenges FOR UPDATE
  USING (
    auth.uid() IN (
      SELECT user_id FROM coalition_members
      WHERE coalition_id IN (challenger_id, challenged_id)
        AND role IN ('leader', 'officer')
    )
  );

-- ── RPC: expire stale pending challenges (called by cron or on-demand) ────────

CREATE OR REPLACE FUNCTION expire_coalition_challenges()
RETURNS INTEGER
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_count INTEGER;
BEGIN
  UPDATE coalition_challenges
  SET status = 'expired'
  WHERE status = 'pending'
    AND expires_at < now();

  GET DIAGNOSTICS v_count = ROW_COUNT;
  RETURN v_count;
END;
$$;

COMMENT ON TABLE coalition_challenges IS
  'Formal inter-coalition debate challenges on specific topics.
   Accepted challenges track stance declarations and resolve when the topic does.';
