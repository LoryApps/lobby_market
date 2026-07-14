-- =============================================================================
-- Lobby Market: Ministerial Statements
-- =============================================================================
-- Coalition leaders and senior citizens can make formal Ministerial Statements
-- on any civic matter. Unlike Oral/Written Questions (citizen → minister),
-- Ministerial Statements flow MINISTER → CITIZENS: a formal declaration
-- followed by citizen supplementary questions.
--
-- Statement types:
--   oral    — made "at the despatch box"; higher urgency, same-day Q&A
--   written — published in the Hansard record; slower, more considered
--
-- Departments mirror the civic cabinet structure.
-- =============================================================================

CREATE TABLE IF NOT EXISTS ministerial_statements (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  minister_id      UUID         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Content
  title            TEXT         NOT NULL CHECK (char_length(title)  BETWEEN 10 AND 200),
  body             TEXT         NOT NULL CHECK (char_length(body)   BETWEEN 100 AND 5000),
  summary          TEXT         CHECK (char_length(summary) <= 400),

  -- Classification
  department       TEXT         NOT NULL DEFAULT 'parliament'
                                CHECK (department IN (
                                  'treasury','health','education','home-affairs',
                                  'foreign-affairs','environment','transport','housing',
                                  'science','culture','justice','parliament','other'
                                )),
  category         TEXT         NOT NULL DEFAULT 'Politics'
                                CHECK (category IN (
                                  'Politics','Economics','Technology','Science',
                                  'Ethics','Philosophy','Culture','Health',
                                  'Education','Environment','Other'
                                )),

  -- Oral (made in chamber with immediate Q&A) vs Written (published in record)
  statement_type   TEXT         NOT NULL DEFAULT 'written'
                                CHECK (statement_type IN ('oral', 'written')),

  -- Optional link to a specific topic this statement relates to
  topic_id         UUID         REFERENCES topics(id) ON DELETE SET NULL,

  -- Counters (updated via triggers / application)
  question_count   INT          NOT NULL DEFAULT 0 CHECK (question_count >= 0),
  upvote_count     INT          NOT NULL DEFAULT 0 CHECK (upvote_count  >= 0),

  status           TEXT         NOT NULL DEFAULT 'published'
                                CHECK (status IN ('published', 'archived')),

  published_at     TIMESTAMPTZ  NOT NULL DEFAULT now(),
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- ─── Supplementary questions from citizens ────────────────────────────────────

CREATE TABLE IF NOT EXISTS ministerial_statement_questions (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  statement_id          UUID         NOT NULL REFERENCES ministerial_statements(id) ON DELETE CASCADE,
  questioner_id         UUID         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  content               TEXT         NOT NULL CHECK (char_length(content) BETWEEN 10 AND 500),

  -- Ministerial response (written by the statement's minister)
  ministerial_response  TEXT         CHECK (char_length(ministerial_response) <= 1000),
  responded_at          TIMESTAMPTZ,
  responded_by          UUID         REFERENCES profiles(id) ON DELETE SET NULL,

  upvotes               INT          NOT NULL DEFAULT 0 CHECK (upvotes >= 0),
  created_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),

  -- One supplementary question per citizen per statement
  UNIQUE (statement_id, questioner_id)
);

-- ─── Upvotes on supplementary questions ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS ministerial_statement_question_upvotes (
  question_id  UUID         NOT NULL REFERENCES ministerial_statement_questions(id) ON DELETE CASCADE,
  user_id      UUID         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (question_id, user_id)
);

-- ─── Statement upvotes (citizens can endorse a statement) ────────────────────

CREATE TABLE IF NOT EXISTS ministerial_statement_upvotes (
  statement_id UUID         NOT NULL REFERENCES ministerial_statements(id) ON DELETE CASCADE,
  user_id      UUID         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (statement_id, user_id)
);

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE ministerial_statements                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE ministerial_statement_questions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE ministerial_statement_question_upvotes ENABLE ROW LEVEL SECURITY;
ALTER TABLE ministerial_statement_upvotes          ENABLE ROW LEVEL SECURITY;

-- Statements: public read, auth write
CREATE POLICY "ms_select"  ON ministerial_statements FOR SELECT USING (status = 'published');
CREATE POLICY "ms_insert"  ON ministerial_statements FOR INSERT WITH CHECK (auth.uid() = minister_id);
CREATE POLICY "ms_update"  ON ministerial_statements FOR UPDATE USING (auth.uid() = minister_id);
CREATE POLICY "ms_delete"  ON ministerial_statements FOR DELETE USING (auth.uid() = minister_id);

-- Questions: public read, auth insert (one per statement), minister can update own statement's questions
CREATE POLICY "msq_select" ON ministerial_statement_questions FOR SELECT USING (true);
CREATE POLICY "msq_insert" ON ministerial_statement_questions FOR INSERT WITH CHECK (auth.uid() = questioner_id);
CREATE POLICY "msq_update" ON ministerial_statement_questions FOR UPDATE
  USING (
    auth.uid() = questioner_id
    OR auth.uid() = (SELECT minister_id FROM ministerial_statements WHERE id = statement_id)
  );

-- Question upvotes
CREATE POLICY "msqu_select" ON ministerial_statement_question_upvotes FOR SELECT USING (true);
CREATE POLICY "msqu_insert" ON ministerial_statement_question_upvotes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "msqu_delete" ON ministerial_statement_question_upvotes FOR DELETE USING (auth.uid() = user_id);

-- Statement upvotes
CREATE POLICY "msu_select" ON ministerial_statement_upvotes FOR SELECT USING (true);
CREATE POLICY "msu_insert" ON ministerial_statement_upvotes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "msu_delete" ON ministerial_statement_upvotes FOR DELETE USING (auth.uid() = user_id);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_ms_published_at     ON ministerial_statements (published_at DESC) WHERE status = 'published';
CREATE INDEX IF NOT EXISTS idx_ms_minister_id      ON ministerial_statements (minister_id);
CREATE INDEX IF NOT EXISTS idx_ms_department       ON ministerial_statements (department, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_ms_statement_type   ON ministerial_statements (statement_type, published_at DESC);
CREATE INDEX IF NOT EXISTS idx_msq_statement_id    ON ministerial_statement_questions (statement_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_msq_questioner_id   ON ministerial_statement_questions (questioner_id);

-- Full-text search on title and body
CREATE INDEX IF NOT EXISTS idx_ms_fts ON ministerial_statements
  USING GIN (to_tsvector('english', title || ' ' || body));
