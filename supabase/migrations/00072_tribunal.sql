-- =============================================================================
-- Lobby Market: The Civic Tribunal
-- =============================================================================
-- Democratic argument review. Citizens can challenge arguments they believe
-- are misleading, fallacious, off-topic, or spam. Once an argument accumulates
-- 3 challenges it becomes a Tribunal Case. Eligible jurors (debator+) serve
-- 3-vote panels. 2-of-3 majority verdict: sustained (flag) or dismissed (clear).
-- Jurors earn 5 Clout for participating in a decided verdict.
-- =============================================================================

-- ── Individual challenges raised against an argument ──────────────────────────

CREATE TABLE IF NOT EXISTS tribunal_challenges (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  argument_id   UUID        NOT NULL REFERENCES topic_arguments(id) ON DELETE CASCADE,
  challenger_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reason        TEXT        NOT NULL CHECK (reason IN ('misleading', 'fallacious', 'irrelevant', 'spam')),
  note          TEXT        CHECK (char_length(note) <= 280),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(argument_id, challenger_id)
);

ALTER TABLE tribunal_challenges ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read tribunal challenges"
  ON tribunal_challenges FOR SELECT USING (true);

CREATE POLICY "Auth users can create challenges"
  ON tribunal_challenges FOR INSERT
  WITH CHECK (auth.uid() = challenger_id);

-- ── Tribunal cases (created automatically when challenge count ≥ 3) ───────────

CREATE TABLE IF NOT EXISTS tribunal_cases (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  argument_id     UUID        NOT NULL UNIQUE REFERENCES topic_arguments(id) ON DELETE CASCADE,
  status          TEXT        NOT NULL DEFAULT 'open'
    CHECK (status IN ('open', 'deliberating', 'closed')),
  verdict         TEXT        CHECK (verdict IN ('sustained', 'dismissed')),
  challenge_count INT         NOT NULL DEFAULT 3,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  closed_at       TIMESTAMPTZ
);

ALTER TABLE tribunal_cases ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read tribunal cases"
  ON tribunal_cases FOR SELECT USING (true);

CREATE INDEX IF NOT EXISTS idx_tribunal_cases_status      ON tribunal_cases (status);
CREATE INDEX IF NOT EXISTS idx_tribunal_cases_argument    ON tribunal_cases (argument_id);
CREATE INDEX IF NOT EXISTS idx_tribunal_cases_created     ON tribunal_cases (created_at DESC);

-- ── Juror votes per case ───────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tribunal_juror_votes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id     UUID        NOT NULL REFERENCES tribunal_cases(id) ON DELETE CASCADE,
  juror_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vote        TEXT        CHECK (vote IN ('sustained', 'dismissed')),
  voted_at    TIMESTAMPTZ,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(case_id, juror_id)
);

ALTER TABLE tribunal_juror_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read juror votes"
  ON tribunal_juror_votes FOR SELECT USING (true);

CREATE POLICY "Jurors can insert their own vote"
  ON tribunal_juror_votes FOR INSERT
  WITH CHECK (auth.uid() = juror_id);

CREATE POLICY "Jurors can update their own vote"
  ON tribunal_juror_votes FOR UPDATE
  USING (auth.uid() = juror_id AND vote IS NULL);

CREATE INDEX IF NOT EXISTS idx_tribunal_juror_votes_case   ON tribunal_juror_votes (case_id);
CREATE INDEX IF NOT EXISTS idx_tribunal_juror_votes_juror  ON tribunal_juror_votes (juror_id);
