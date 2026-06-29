-- =============================================================================
-- Lobby Market: Civic Hearings — formal committee testimony sessions
-- =============================================================================
-- Each civic committee (corresponding to a topic category) can hold a formal
-- hearing on a contested topic before it goes to a vote.  Citizens submit
-- written testimony (for / against / neutral, max 500 chars).  The committee
-- chair (a Grand Council member) closes the hearing and issues a formal
-- recommendation that is displayed on the topic page.
--
-- Distinct from:
--   citizens_assemblies — random sortition, multi-round deliberation
--   debates             — live, adversarial, timed events
--   tribunals           — argument quality review
--   town_hall           — platform-wide open forum
--   topic_arguments     — free-form arguments written during the vote phase
--
-- This is the committee-layer: structured, evidence-based, pre-vote testimony.
-- =============================================================================

CREATE TABLE IF NOT EXISTS civic_hearings (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id         UUID        REFERENCES topics(id)   ON DELETE SET NULL,
  committee        TEXT        NOT NULL,   -- matches a topic category
  title            TEXT        NOT NULL,
  description      TEXT,
  chair_id         UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  status           TEXT        NOT NULL DEFAULT 'open'
                   CHECK (status IN ('open', 'closed', 'archived')),
  recommendation   TEXT        CHECK (recommendation IN ('for', 'against', 'hold', 'neutral')),
  rationale        TEXT        CHECK (char_length(rationale) <= 1000),
  testimony_count  INT         NOT NULL DEFAULT 0 CHECK (testimony_count >= 0),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at        TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS civic_testimonies (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  hearing_id  UUID        NOT NULL REFERENCES civic_hearings(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content     TEXT        NOT NULL CHECK (char_length(content) BETWEEN 10 AND 500),
  stance      TEXT        NOT NULL DEFAULT 'neutral'
              CHECK (stance IN ('for', 'against', 'neutral')),
  upvotes     INT         NOT NULL DEFAULT 0 CHECK (upvotes >= 0),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT civic_testimonies_one_per_user_per_hearing UNIQUE (hearing_id, user_id)
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_civic_hearings_topic
  ON civic_hearings (topic_id);

CREATE INDEX IF NOT EXISTS idx_civic_hearings_committee
  ON civic_hearings (committee);

CREATE INDEX IF NOT EXISTS idx_civic_hearings_status
  ON civic_hearings (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_civic_testimonies_hearing
  ON civic_testimonies (hearing_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_civic_testimonies_user
  ON civic_testimonies (user_id, created_at DESC);

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE civic_hearings   ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic_testimonies ENABLE ROW LEVEL SECURITY;

-- Hearings: public read; authenticated chair can insert/update
CREATE POLICY "civic_hearings_select"
  ON civic_hearings FOR SELECT USING (true);

CREATE POLICY "civic_hearings_insert"
  ON civic_hearings FOR INSERT TO authenticated
  WITH CHECK (chair_id = auth.uid());

CREATE POLICY "civic_hearings_update"
  ON civic_hearings FOR UPDATE TO authenticated
  USING (chair_id = auth.uid());

-- Testimonies: public read; own insert/update/delete
CREATE POLICY "civic_testimonies_select"
  ON civic_testimonies FOR SELECT USING (true);

CREATE POLICY "civic_testimonies_insert"
  ON civic_testimonies FOR INSERT TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "civic_testimonies_update"
  ON civic_testimonies FOR UPDATE TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "civic_testimonies_delete"
  ON civic_testimonies FOR DELETE TO authenticated
  USING (user_id = auth.uid());

-- ─── Trigger: keep testimony_count accurate ───────────────────────────────────

CREATE OR REPLACE FUNCTION civic_hearing_testimony_inc()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE civic_hearings SET testimony_count = testimony_count + 1 WHERE id = NEW.hearing_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION civic_hearing_testimony_dec()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE civic_hearings SET testimony_count = GREATEST(0, testimony_count - 1) WHERE id = OLD.hearing_id;
  RETURN OLD;
END;
$$;

CREATE OR REPLACE TRIGGER trg_civic_testimony_inc
AFTER INSERT ON civic_testimonies
FOR EACH ROW EXECUTE FUNCTION civic_hearing_testimony_inc();

CREATE OR REPLACE TRIGGER trg_civic_testimony_dec
AFTER DELETE ON civic_testimonies
FOR EACH ROW EXECUTE FUNCTION civic_hearing_testimony_dec();

COMMENT ON TABLE civic_hearings   IS 'Formal civic committee hearings — structured pre-vote testimony sessions per topic category.';
COMMENT ON TABLE civic_testimonies IS 'Citizen written testimony submitted to a civic hearing (for / against / neutral).';
