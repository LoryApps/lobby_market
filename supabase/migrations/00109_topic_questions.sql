-- =============================================================================
-- Lobby Market: Topic Q&A — Community question-and-answer for each debate
-- =============================================================================
-- Allows users to post clarifying questions about a topic and receive
-- crowd-sourced answers. Distinct from:
--   topic_arguments   — structured FOR/AGAINST positions with upvotes
--   topic_chat        — ephemeral real-time discussion
--   topic_sources     — external reference material
--
-- Questions → community upvotes → best rises. Answers → question author
-- marks one as accepted. Top-voted questions surface the real uncertainties.
-- =============================================================================

-- ─── Questions ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS topic_questions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id    UUID        NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  author_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content     TEXT        NOT NULL CHECK (char_length(content) BETWEEN 10 AND 400),
  upvotes     INTEGER     NOT NULL DEFAULT 0,
  answer_count INTEGER    NOT NULL DEFAULT 0,
  is_answered BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_topic_questions_topic ON topic_questions(topic_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_topic_questions_author ON topic_questions(author_id);
CREATE INDEX IF NOT EXISTS idx_topic_questions_upvotes ON topic_questions(topic_id, upvotes DESC);

-- ─── Answers ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS topic_answers (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id  UUID        NOT NULL REFERENCES topic_questions(id) ON DELETE CASCADE,
  topic_id     UUID        NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  author_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content      TEXT        NOT NULL CHECK (char_length(content) BETWEEN 10 AND 1000),
  upvotes      INTEGER     NOT NULL DEFAULT 0,
  is_accepted  BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_topic_answers_question ON topic_answers(question_id, upvotes DESC);
CREATE INDEX IF NOT EXISTS idx_topic_answers_author ON topic_answers(author_id);

-- ─── Question upvotes (1 per user per question) ────────────────────────────────

CREATE TABLE IF NOT EXISTS topic_question_votes (
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  question_id UUID NOT NULL REFERENCES topic_questions(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, question_id)
);

-- ─── Answer upvotes (1 per user per answer) ────────────────────────────────────

CREATE TABLE IF NOT EXISTS topic_answer_votes (
  user_id   UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  answer_id UUID NOT NULL REFERENCES topic_answers(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, answer_id)
);

-- ─── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE topic_questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE topic_answers ENABLE ROW LEVEL SECURITY;
ALTER TABLE topic_question_votes ENABLE ROW LEVEL SECURITY;
ALTER TABLE topic_answer_votes ENABLE ROW LEVEL SECURITY;

-- Questions: public read, authenticated write
CREATE POLICY "tq_select" ON topic_questions FOR SELECT USING (true);
CREATE POLICY "tq_insert" ON topic_questions FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);
CREATE POLICY "tq_update_author" ON topic_questions FOR UPDATE TO authenticated USING (auth.uid() = author_id);

-- Answers: public read, authenticated write
CREATE POLICY "ta_select" ON topic_answers FOR SELECT USING (true);
CREATE POLICY "ta_insert" ON topic_answers FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);

-- Votes: own rows only
CREATE POLICY "tqv_all" ON topic_question_votes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "tav_all" ON topic_answer_votes FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- ─── Trigger: keep answer_count + is_answered in sync ─────────────────────────

CREATE OR REPLACE FUNCTION sync_question_answer_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE topic_questions
  SET
    answer_count = (SELECT COUNT(*) FROM topic_answers WHERE question_id = COALESCE(NEW.question_id, OLD.question_id)),
    is_answered  = EXISTS (SELECT 1 FROM topic_answers WHERE question_id = COALESCE(NEW.question_id, OLD.question_id) AND is_accepted)
  WHERE id = COALESCE(NEW.question_id, OLD.question_id);
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_question_answer_count
AFTER INSERT OR DELETE ON topic_answers
FOR EACH ROW EXECUTE FUNCTION sync_question_answer_count();
