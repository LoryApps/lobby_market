-- Civic Journal: personal notes tied to platform topics
-- Users write private (or optionally public) reflections on debates they care about.

CREATE TABLE IF NOT EXISTS civic_journal_entries (
  id              UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id         UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  topic_id        UUID        REFERENCES topics(id) ON DELETE SET NULL,
  content         TEXT        NOT NULL CHECK (length(content) >= 1 AND length(content) <= 2000),
  is_public       BOOLEAN     NOT NULL DEFAULT FALSE,
  -- snapshot of topic state at time of writing (for comparison later)
  vote_snapshot   JSONB,
  mood            TEXT        CHECK (mood IN ('hopeful','concerned','neutral','confident','uncertain')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS civic_journal_entries_user_created
  ON civic_journal_entries(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS civic_journal_entries_topic
  ON civic_journal_entries(topic_id)
  WHERE topic_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS civic_journal_entries_public
  ON civic_journal_entries(created_at DESC)
  WHERE is_public = TRUE;

ALTER TABLE civic_journal_entries ENABLE ROW LEVEL SECURITY;

-- Users own their entries; public entries readable by all authenticated users
CREATE POLICY "journal_owner_all"
  ON civic_journal_entries FOR ALL
  USING (auth.uid() = user_id);

CREATE POLICY "journal_public_read"
  ON civic_journal_entries FOR SELECT
  USING (is_public = TRUE);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_journal_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER journal_updated_at
  BEFORE UPDATE ON civic_journal_entries
  FOR EACH ROW EXECUTE FUNCTION update_journal_updated_at();
