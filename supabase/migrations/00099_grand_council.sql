-- =============================================================================
-- Lobby Market: The Civic Grand Council
-- =============================================================================
-- The Grand Council is a meritocratic governance body composed of the top 20
-- citizens by total clout. Council members can propose motions — resolutions
-- that carry special weight on the platform.
--
-- Council membership is dynamic: computed from profiles.clout at read time
-- (no separate table needed — membership changes as clout changes).
--
-- Motions:
--   - Proposed by any council member
--   - Other council members vote FOR or AGAINST within 7 days
--   - Pass with >= 60% of votes cast (min 3 votes required)
--   - Effect: 'elevate_topic' | 'issue_statement' | 'call_assembly'
--
-- Distinct from:
--   senate          — the voting chamber for topic resolution
--   citizens_assembly — sortition-based deliberative body
--   elections       — monthly role elections
-- =============================================================================

-- ── 1. Motions table ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS council_motions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  proposer_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Motion content
  title           TEXT        NOT NULL CHECK (char_length(title) BETWEEN 5 AND 120),
  description     TEXT        NOT NULL CHECK (char_length(description) BETWEEN 10 AND 1000),

  -- What happens if the motion passes
  effect          TEXT        NOT NULL DEFAULT 'issue_statement'
                              CHECK (effect IN ('elevate_topic', 'issue_statement', 'call_assembly')),

  -- Optional reference to a topic (required for elevate_topic / call_assembly)
  topic_id        UUID        REFERENCES topics(id) ON DELETE SET NULL,

  -- Tally (updated by trigger or application layer)
  votes_for       INT         NOT NULL DEFAULT 0,
  votes_against   INT         NOT NULL DEFAULT 0,

  -- Lifecycle
  status          TEXT        NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'passed', 'rejected', 'withdrawn')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  closes_at       TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  resolved_at     TIMESTAMPTZ
);

-- ── 2. Motion votes table ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS council_motion_votes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  motion_id   UUID        NOT NULL REFERENCES council_motions(id) ON DELETE CASCADE,
  voter_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vote        TEXT        NOT NULL CHECK (vote IN ('for', 'against')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (motion_id, voter_id)
);

-- ── 3. Indexes ────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_council_motions_status    ON council_motions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_council_motions_proposer  ON council_motions(proposer_id);
CREATE INDEX IF NOT EXISTS idx_council_votes_motion      ON council_motion_votes(motion_id);
CREATE INDEX IF NOT EXISTS idx_council_votes_voter       ON council_motion_votes(voter_id);

-- ── 4. RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE council_motions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE council_motion_votes  ENABLE ROW LEVEL SECURITY;

-- Everyone can read motions and votes
CREATE POLICY "council_motions_read_all"
  ON council_motions FOR SELECT USING (true);

CREATE POLICY "council_votes_read_all"
  ON council_motion_votes FOR SELECT USING (true);

-- Any authenticated user can propose (we validate council membership in the API)
CREATE POLICY "council_motions_insert_auth"
  ON council_motions FOR INSERT
  WITH CHECK (auth.uid() = proposer_id);

-- Proposer can withdraw their own motion
CREATE POLICY "council_motions_update_own"
  ON council_motions FOR UPDATE
  USING (auth.uid() = proposer_id);

-- Any authenticated user can vote (we validate council membership in the API)
CREATE POLICY "council_votes_insert_auth"
  ON council_motion_votes FOR INSERT
  WITH CHECK (auth.uid() = voter_id);
