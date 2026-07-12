-- =============================================================================
-- Lobby Market: Civic Committee Reports
-- =============================================================================
-- After Civic Hearings gather testimony, committee chairs publish formal
-- reports with findings, analysis, and a final policy recommendation.
-- Citizens can endorse reports they find compelling.
--
-- Distinct from:
--   civic_hearings       — the evidence-gathering phase (testimony)
--   civic_appeals        — contesting decisions
--   grand_council        — binding legislative motions
-- =============================================================================

-- ─── Reports ─────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS civic_committee_reports (
  id                uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id         uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  hearing_id        uuid        REFERENCES civic_hearings(id) ON DELETE SET NULL,
  topic_id          uuid        REFERENCES topics(id) ON DELETE SET NULL,
  title             text        NOT NULL CHECK (char_length(title) BETWEEN 10 AND 200),
  summary           text        NOT NULL CHECK (char_length(summary) BETWEEN 20 AND 500),
  content           text        NOT NULL CHECK (char_length(content) BETWEEN 100 AND 10000),
  category          text        NOT NULL,
  recommendation    text        NOT NULL CHECK (recommendation IN ('for', 'against', 'neutral', 'hold')),
  status            text        NOT NULL DEFAULT 'published'
                                  CHECK (status IN ('draft', 'published', 'archived')),
  endorsement_count int         NOT NULL DEFAULT 0,
  view_count        int         NOT NULL DEFAULT 0,
  tags              text[]      NOT NULL DEFAULT '{}',
  created_at        timestamptz NOT NULL DEFAULT now(),
  published_at      timestamptz DEFAULT now()
);

ALTER TABLE civic_committee_reports ENABLE ROW LEVEL SECURITY;

CREATE POLICY "reports_read_published"
  ON civic_committee_reports FOR SELECT
  USING (status = 'published' OR auth.uid() = author_id);

CREATE POLICY "reports_insert_auth"
  ON civic_committee_reports FOR INSERT
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "reports_update_author"
  ON civic_committee_reports FOR UPDATE
  USING (auth.uid() = author_id)
  WITH CHECK (auth.uid() = author_id);

-- ─── Endorsements ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS civic_report_endorsements (
  report_id  uuid        NOT NULL REFERENCES civic_committee_reports(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (report_id, user_id)
);

ALTER TABLE civic_report_endorsements ENABLE ROW LEVEL SECURITY;

CREATE POLICY "endorsements_read_all"
  ON civic_report_endorsements FOR SELECT USING (true);

CREATE POLICY "endorsements_insert_auth"
  ON civic_report_endorsements FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "endorsements_delete_own"
  ON civic_report_endorsements FOR DELETE
  USING (auth.uid() = user_id);

-- ─── Trigger: sync endorsement count ─────────────────────────────────────────

CREATE OR REPLACE FUNCTION sync_report_endorsement_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE civic_committee_reports
    SET endorsement_count = endorsement_count + 1
    WHERE id = NEW.report_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE civic_committee_reports
    SET endorsement_count = GREATEST(0, endorsement_count - 1)
    WHERE id = OLD.report_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_report_endorsement_count
  AFTER INSERT OR DELETE ON civic_report_endorsements
  FOR EACH ROW EXECUTE FUNCTION sync_report_endorsement_count();

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_committee_reports_category
  ON civic_committee_reports(category, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_committee_reports_status
  ON civic_committee_reports(status, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_committee_reports_author
  ON civic_committee_reports(author_id, published_at DESC);

CREATE INDEX IF NOT EXISTS idx_committee_reports_topic
  ON civic_committee_reports(topic_id)
  WHERE topic_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_committee_reports_endorsements
  ON civic_committee_reports(endorsement_count DESC, published_at DESC);
