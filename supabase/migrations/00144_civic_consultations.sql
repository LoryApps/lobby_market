-- =============================================================================
-- Lobby Market: Government Consultations
-- =============================================================================
-- The UK Government routinely issues consultation documents (Green Papers for
-- discussion, White Papers for firm proposals) inviting public responses before
-- legislation is drafted. This mirrors that process on the platform.
--
-- Consultation lifecycle:
--   draft       → being prepared by department lead
--   open        → accepting public responses (most visible state)
--   closed      → deadline passed, responses being analysed
--   published   → government response / summary published
--   withdrawn   → consultation cancelled
--
-- Paper types:
--   green_paper → exploratory document, seeking views on a broad policy area
--   white_paper → firm proposals — government has a preferred policy direction
--   call_for_evidence → technical/expert evidence gathering
-- =============================================================================

CREATE TABLE IF NOT EXISTS civic_consultations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title           TEXT        NOT NULL CHECK (char_length(title) BETWEEN 5 AND 200),
  summary         TEXT        NOT NULL CHECK (char_length(summary) BETWEEN 20 AND 1000),
  full_text       TEXT,

  paper_type      TEXT        NOT NULL DEFAULT 'green_paper'
                    CHECK (paper_type IN ('green_paper', 'white_paper', 'call_for_evidence')),

  status          TEXT        NOT NULL DEFAULT 'open'
                    CHECK (status IN ('draft', 'open', 'closed', 'published', 'withdrawn')),

  department      TEXT        NOT NULL,
  category        TEXT        NOT NULL DEFAULT 'Politics',

  sponsor_id      UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  topic_id        UUID        REFERENCES topics(id)   ON DELETE SET NULL,

  -- Dates
  opens_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  closes_at       TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '12 weeks'),
  published_at    TIMESTAMPTZ,

  -- Engagement counters (denormalised for query speed)
  response_count  INTEGER     NOT NULL DEFAULT 0,
  view_count      INTEGER     NOT NULL DEFAULT 0,

  -- Government response (filled when status = 'published')
  gov_response    TEXT,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Consultation Responses ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS civic_consultation_responses (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  consultation_id   UUID        NOT NULL REFERENCES civic_consultations(id) ON DELETE CASCADE,
  author_id         UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  response_text     TEXT        NOT NULL CHECK (char_length(response_text) BETWEEN 20 AND 5000),

  -- The respondent's overall position
  stance            TEXT        NOT NULL DEFAULT 'neutral'
                      CHECK (stance IN ('strongly_support', 'support', 'neutral', 'oppose', 'strongly_oppose')),

  -- Upvotes from the community (most persuasive response surfacing)
  upvotes           INTEGER     NOT NULL DEFAULT 0,
  is_featured       BOOLEAN     NOT NULL DEFAULT FALSE, -- department can feature a response

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (consultation_id, author_id) -- one response per user per consultation
);

CREATE TABLE IF NOT EXISTS civic_consultation_response_upvotes (
  response_id UUID NOT NULL REFERENCES civic_consultation_responses(id) ON DELETE CASCADE,
  user_id     UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (response_id, user_id)
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS civic_consultations_status_idx   ON civic_consultations(status);
CREATE INDEX IF NOT EXISTS civic_consultations_closes_at_idx ON civic_consultations(closes_at);
CREATE INDEX IF NOT EXISTS civic_consultations_department_idx ON civic_consultations(department);
CREATE INDEX IF NOT EXISTS civic_consultation_responses_consultation_idx
  ON civic_consultation_responses(consultation_id);

-- ─── Counter triggers ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_consultation_response_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE civic_consultations
      SET response_count = response_count + 1, updated_at = now()
      WHERE id = NEW.consultation_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE civic_consultations
      SET response_count = GREATEST(response_count - 1, 0), updated_at = now()
      WHERE id = OLD.consultation_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE TRIGGER trg_consultation_response_count
  AFTER INSERT OR DELETE ON civic_consultation_responses
  FOR EACH ROW EXECUTE FUNCTION update_consultation_response_count();

CREATE OR REPLACE FUNCTION update_consultation_response_upvotes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE civic_consultation_responses SET upvotes = upvotes + 1 WHERE id = NEW.response_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE civic_consultation_responses SET upvotes = GREATEST(upvotes - 1, 0) WHERE id = OLD.response_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE OR REPLACE TRIGGER trg_consultation_response_upvotes
  AFTER INSERT OR DELETE ON civic_consultation_response_upvotes
  FOR EACH ROW EXECUTE FUNCTION update_consultation_response_upvotes();

-- ─── Row-Level Security ───────────────────────────────────────────────────────

ALTER TABLE civic_consultations                    ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic_consultation_responses           ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic_consultation_response_upvotes    ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Anyone can read consultations"
  ON civic_consultations FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create consultations"
  ON civic_consultations FOR INSERT
  WITH CHECK (auth.uid() = sponsor_id);

CREATE POLICY "Sponsors can update own consultations"
  ON civic_consultations FOR UPDATE
  USING (auth.uid() = sponsor_id);

CREATE POLICY "Anyone can read consultation responses"
  ON civic_consultation_responses FOR SELECT USING (true);

CREATE POLICY "Authenticated users can submit a response"
  ON civic_consultation_responses FOR INSERT
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "Authors can edit own responses while open"
  ON civic_consultation_responses FOR UPDATE
  USING (auth.uid() = author_id);

CREATE POLICY "Authors can delete own responses"
  ON civic_consultation_responses FOR DELETE
  USING (auth.uid() = author_id);

CREATE POLICY "Anyone can read response upvotes"
  ON civic_consultation_response_upvotes FOR SELECT USING (true);

CREATE POLICY "Authenticated users can upvote responses"
  ON civic_consultation_response_upvotes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can remove their own upvotes"
  ON civic_consultation_response_upvotes FOR DELETE
  USING (auth.uid() = user_id);

-- ─── Seed data ────────────────────────────────────────────────────────────────

INSERT INTO civic_consultations
  (title, summary, paper_type, status, department, category, opens_at, closes_at)
VALUES
  (
    'Reforming the Civic Voting Threshold',
    'This Green Paper sets out proposals to lower the voting threshold for topics to progress from "proposed" to "active" status, enabling faster democratic engagement on emerging civic issues.',
    'green_paper', 'open', 'Department for Civic Engagement', 'Politics',
    now() - INTERVAL '2 weeks', now() + INTERVAL '10 weeks'
  ),
  (
    'Artificial Intelligence in Public Decision-Making',
    'A call for evidence on the use of AI-assisted systems in civic deliberation, including algorithmic recommendation of debate topics, automated argument quality scoring, and bias detection.',
    'call_for_evidence', 'open', 'Department for Digital & Technology', 'Technology',
    now() - INTERVAL '1 week', now() + INTERVAL '11 weeks'
  ),
  (
    'Strengthening the Civic Coalition Framework',
    'This White Paper sets out the government''s firm proposals to extend coalition tools — including binding coalition votes, coalition manifestos, and inter-coalition debate arenas.',
    'white_paper', 'open', 'Department for Civic Engagement', 'Politics',
    now() - INTERVAL '3 days', now() + INTERVAL '12 weeks'
  ),
  (
    'Carbon Budget Civic Oversight',
    'Green Paper seeking views on whether civic topics related to environmental policy should be subject to a mandatory carbon-impact assessment before progressing to law.',
    'green_paper', 'closed', 'Department for Environment', 'Environment',
    now() - INTERVAL '14 weeks', now() - INTERVAL '2 weeks'
  ),
  (
    'Civic Education Curriculum Standards',
    'Published response to the consultation on integrating civic participation skills — voting, deliberation, argument construction — into the formal education curriculum.',
    'white_paper', 'published', 'Department for Education', 'Education',
    now() - INTERVAL '20 weeks', now() - INTERVAL '8 weeks'
  )
ON CONFLICT DO NOTHING;
