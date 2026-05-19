-- Argument drafts: save-before-post for better quality arguments
CREATE TABLE IF NOT EXISTS argument_drafts (
  id         UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID        NOT NULL REFERENCES profiles(id)  ON DELETE CASCADE,
  topic_id   UUID        NOT NULL REFERENCES topics(id)    ON DELETE CASCADE,
  side       TEXT        NOT NULL CHECK (side IN ('blue', 'red')),
  content    TEXT        NOT NULL,
  created_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  UNIQUE (user_id, topic_id)
);

ALTER TABLE argument_drafts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own drafts"
  ON argument_drafts FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE INDEX argument_drafts_user_idx ON argument_drafts (user_id);
CREATE INDEX argument_drafts_topic_idx ON argument_drafts (topic_id);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_argument_drafts_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER argument_drafts_updated_at
  BEFORE UPDATE ON argument_drafts
  FOR EACH ROW EXECUTE FUNCTION update_argument_drafts_updated_at();
