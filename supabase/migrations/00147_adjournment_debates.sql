-- =============================================================================
-- Lobby Market: Adjournment Debates
-- =============================================================================
-- In the UK Parliament, an adjournment debate is a short debate (usually 30
-- minutes) held at the end of each day's business. MPs secure them through
-- a daily ballot operated by the Speaker's office, or by ministerial courtesy.
--
-- On Lobby Market:
--   1. Any citizen can submit an application to raise a specific issue.
--   2. Other citizens can "second" an application to boost its priority.
--   3. Each day, the top-supported application is "called" for debate.
--   4. The applicant delivers an opening speech (up to 500 words).
--   5. Up to 3 other citizens may deliver floor speeches (up to 200 words).
--   6. A closing response is submitted last (anyone can respond as "minister").
--   7. The debate is archived in the Hansard.
--
-- Status lifecycle:
--   pending  → application submitted, seeking support
--   selected → chosen by ballot for today's debate
--   open     → debate is accepting speeches
--   closed   → debate complete, archived
--   withdrawn → applicant withdrew
-- =============================================================================

CREATE TABLE IF NOT EXISTS adjournment_applications (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  applicant_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  title           TEXT        NOT NULL CHECK (char_length(title) BETWEEN 10 AND 120),
  issue           TEXT        NOT NULL CHECK (char_length(issue) BETWEEN 50 AND 1000),
  category        TEXT        NOT NULL DEFAULT 'Politics',

  -- Optional link to an existing topic
  topic_id        UUID        REFERENCES topics(id) ON DELETE SET NULL,

  status          TEXT        NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'selected', 'open', 'closed', 'withdrawn')),

  -- Support count (from adjournment_seconds)
  seconds_count   INT         NOT NULL DEFAULT 0,

  -- When it was selected and debated
  selected_for    DATE,       -- the calendar date it was scheduled for
  debate_opens_at TIMESTAMPTZ,
  debate_closes_at TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Seconds: citizens who endorse an application (boost ballot priority)
CREATE TABLE IF NOT EXISTS adjournment_seconds (
  application_id  UUID        NOT NULL REFERENCES adjournment_applications(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (application_id, user_id)
);

-- Speeches within a selected/open debate
CREATE TABLE IF NOT EXISTS adjournment_speeches (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  application_id  UUID        NOT NULL REFERENCES adjournment_applications(id) ON DELETE CASCADE,
  speaker_id      UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- 'opening'   = applicant's statement (first)
  -- 'floor'     = other citizen contributions (middle)
  -- 'response'  = closing ministerial response (last)
  speech_type     TEXT        NOT NULL CHECK (speech_type IN ('opening', 'floor', 'response')),

  content         TEXT        NOT NULL CHECK (char_length(content) BETWEEN 20 AND 1000),

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_adjournment_apps_status
  ON adjournment_applications(status);

CREATE INDEX IF NOT EXISTS idx_adjournment_apps_applicant
  ON adjournment_applications(applicant_id);

CREATE INDEX IF NOT EXISTS idx_adjournment_apps_selected_for
  ON adjournment_applications(selected_for) WHERE selected_for IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_adjournment_seconds_app
  ON adjournment_seconds(application_id);

CREATE INDEX IF NOT EXISTS idx_adjournment_speeches_app
  ON adjournment_speeches(application_id, created_at);

-- ─── Trigger: sync seconds_count ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION sync_adjournment_seconds_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  aid UUID;
BEGIN
  aid := COALESCE(NEW.application_id, OLD.application_id);
  UPDATE adjournment_applications
  SET seconds_count = (
    SELECT COUNT(*) FROM adjournment_seconds WHERE application_id = aid
  ),
  updated_at = now()
  WHERE id = aid;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_adjournment_seconds_change ON adjournment_seconds;
CREATE TRIGGER trg_adjournment_seconds_change
  AFTER INSERT OR DELETE ON adjournment_seconds
  FOR EACH ROW EXECUTE FUNCTION sync_adjournment_seconds_count();

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE adjournment_applications ENABLE ROW LEVEL SECURITY;
ALTER TABLE adjournment_seconds      ENABLE ROW LEVEL SECURITY;
ALTER TABLE adjournment_speeches     ENABLE ROW LEVEL SECURITY;

-- Applications: anyone can read
CREATE POLICY "adjournment_apps_select_all"
  ON adjournment_applications FOR SELECT USING (true);

-- Insert: authenticated users only
CREATE POLICY "adjournment_apps_insert_auth"
  ON adjournment_applications FOR INSERT
  WITH CHECK (auth.uid() = applicant_id);

-- Update: applicant can withdraw their own; service role can update status
CREATE POLICY "adjournment_apps_update_own"
  ON adjournment_applications FOR UPDATE
  USING (auth.uid() = applicant_id)
  WITH CHECK (auth.uid() = applicant_id);

-- Seconds
CREATE POLICY "adjournment_seconds_select_all"
  ON adjournment_seconds FOR SELECT USING (true);

CREATE POLICY "adjournment_seconds_insert_auth"
  ON adjournment_seconds FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "adjournment_seconds_delete_own"
  ON adjournment_seconds FOR DELETE
  USING (auth.uid() = user_id);

-- Speeches
CREATE POLICY "adjournment_speeches_select_all"
  ON adjournment_speeches FOR SELECT USING (true);

CREATE POLICY "adjournment_speeches_insert_auth"
  ON adjournment_speeches FOR INSERT
  WITH CHECK (auth.uid() = speaker_id);

COMMENT ON TABLE adjournment_applications IS
  'Applications from citizens to raise a specific issue in a daily adjournment debate.';
COMMENT ON TABLE adjournment_seconds IS
  'Citizens who second an application to boost its priority in the ballot.';
COMMENT ON TABLE adjournment_speeches IS
  'Speeches delivered in an adjournment debate — opening, floor contributions, and ministerial response.';
