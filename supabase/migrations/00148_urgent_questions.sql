-- =============================================================================
-- Lobby Market: Urgent Questions
-- =============================================================================
-- In the UK Parliament, an Urgent Question (UQ) is granted by the Speaker
-- when a matter is deemed "urgent and important". The relevant minister must
-- appear and answer without prior notice, while other MPs may ask
-- supplementary questions.
--
-- On Lobby Market:
--   1. Any citizen can table an Urgent Question (1 per user per 24 h).
--   2. The question must identify a specific "minister" — a coalition leader
--      or high-reputation citizen — who is expected to respond.
--   3. Other citizens may "second" the question (upvote it).
--   4. Questions with ≥5 seconds become "certified urgent" and surface at top.
--   5. The addressed minister (or any elder/admin) may submit an official
--      response; other citizens may add supplementary questions.
--   6. Questions expire 24 hours after submission (status → expired).
-- =============================================================================

CREATE TABLE IF NOT EXISTS urgent_questions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id         UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  question_text     TEXT        NOT NULL CHECK (char_length(question_text) BETWEEN 20 AND 300),
  context_note      TEXT        CHECK (char_length(context_note) <= 500),

  -- Optional: target a specific user (coalition leader, elder, etc.)
  addressed_to_id   UUID        REFERENCES profiles(id) ON DELETE SET NULL,

  -- Topic link (optional)
  topic_id          UUID        REFERENCES topics(id) ON DELETE SET NULL,

  seconds_count     INT         NOT NULL DEFAULT 0,
  status            TEXT        NOT NULL DEFAULT 'submitted'
                                CHECK (status IN ('submitted','certified','answered','expired')),

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at        TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours')
);

CREATE TABLE IF NOT EXISTS urgent_question_seconds (
  question_id       UUID        NOT NULL REFERENCES urgent_questions(id) ON DELETE CASCADE,
  user_id           UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (question_id, user_id)
);

CREATE TABLE IF NOT EXISTS urgent_question_responses (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id       UUID        NOT NULL REFERENCES urgent_questions(id) ON DELETE CASCADE,
  responder_id      UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  response_text     TEXT        NOT NULL CHECK (char_length(response_text) BETWEEN 20 AND 1000),
  is_official       BOOL        NOT NULL DEFAULT FALSE,  -- TRUE = addressed minister responded
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS urgent_question_supplementaries (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id       UUID        NOT NULL REFERENCES urgent_questions(id) ON DELETE CASCADE,
  author_id         UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  supplementary     TEXT        NOT NULL CHECK (char_length(supplementary) BETWEEN 10 AND 300),
  upvotes           INT         NOT NULL DEFAULT 0,
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Indexes ────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_uq_status_created    ON urgent_questions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_uq_author            ON urgent_questions(author_id);
CREATE INDEX IF NOT EXISTS idx_uq_addressed_to      ON urgent_questions(addressed_to_id);
CREATE INDEX IF NOT EXISTS idx_uq_seconds_user      ON urgent_question_seconds(user_id);
CREATE INDEX IF NOT EXISTS idx_uq_responses_qid     ON urgent_question_responses(question_id);
CREATE INDEX IF NOT EXISTS idx_uq_supps_qid         ON urgent_question_supplementaries(question_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────
ALTER TABLE urgent_questions                  ENABLE ROW LEVEL SECURITY;
ALTER TABLE urgent_question_seconds           ENABLE ROW LEVEL SECURITY;
ALTER TABLE urgent_question_responses         ENABLE ROW LEVEL SECURITY;
ALTER TABLE urgent_question_supplementaries   ENABLE ROW LEVEL SECURITY;

CREATE POLICY "urgent_questions_select"    ON urgent_questions                FOR SELECT USING (true);
CREATE POLICY "urgent_questions_insert"    ON urgent_questions                FOR INSERT WITH CHECK (auth.uid() = author_id);
CREATE POLICY "uq_seconds_select"          ON urgent_question_seconds         FOR SELECT USING (true);
CREATE POLICY "uq_seconds_insert"          ON urgent_question_seconds         FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "uq_seconds_delete"          ON urgent_question_seconds         FOR DELETE USING (auth.uid() = user_id);
CREATE POLICY "uq_responses_select"        ON urgent_question_responses       FOR SELECT USING (true);
CREATE POLICY "uq_responses_insert"        ON urgent_question_responses       FOR INSERT WITH CHECK (auth.uid() = responder_id);
CREATE POLICY "uq_supps_select"            ON urgent_question_supplementaries FOR SELECT USING (true);
CREATE POLICY "uq_supps_insert"            ON urgent_question_supplementaries FOR INSERT WITH CHECK (auth.uid() = author_id);

-- ── Function: expire stale questions ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION expire_urgent_questions()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  UPDATE urgent_questions
  SET status = 'expired'
  WHERE status IN ('submitted', 'certified')
    AND expires_at < now();
END;
$$;
