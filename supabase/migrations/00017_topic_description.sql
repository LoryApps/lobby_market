-- Migration: Add optional description/context field to topics
-- Topics currently only have a 280-char `statement`. This adds a longer
-- `description` field where authors can provide context, evidence links,
-- and background reasoning (up to 2000 characters).

ALTER TABLE topics
  ADD COLUMN IF NOT EXISTS description TEXT;

-- Add a CHECK constraint to enforce max length at the DB level.
ALTER TABLE topics
  ADD CONSTRAINT topics_description_length
    CHECK (description IS NULL OR char_length(description) <= 2000);

-- GIN index for full-text search on description (extends existing FTS on statement).
-- Coalesce NULL to empty string so the index doesn't skip rows.
CREATE INDEX IF NOT EXISTS topics_description_fts
  ON topics
  USING gin(to_tsvector('english', coalesce(description, '')));

COMMENT ON COLUMN topics.description IS
  'Optional context: background, evidence links, and reasoning for the topic statement (max 2000 chars).';
