-- Migration: Topic Wiki Editor enhancements
--
-- 1. Increases the topic description character limit from 2000 → 5000 to
--    support richer markdown context authored via the new inline wiki editor.
-- 2. Adds description_updated_at and description_updated_by columns so we can
--    surface "last edited by @username on date" metadata in the UI.

-- Drop the old 2000-char constraint and replace it with a 5000-char one.
ALTER TABLE topics
  DROP CONSTRAINT IF EXISTS topics_description_length;

ALTER TABLE topics
  ADD CONSTRAINT topics_description_length
    CHECK (description IS NULL OR char_length(description) <= 5000);

-- Track when and by whom the description was last updated.
ALTER TABLE topics
  ADD COLUMN IF NOT EXISTS description_updated_at  TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS description_updated_by  UUID REFERENCES profiles (id) ON DELETE SET NULL;

-- Index so we can list "recently edited topics" efficiently.
CREATE INDEX IF NOT EXISTS topics_description_updated_at_idx
  ON topics (description_updated_at DESC NULLS LAST)
  WHERE description_updated_at IS NOT NULL;

COMMENT ON COLUMN topics.description_updated_at IS
  'Timestamp of the last edit to the topic description/context field.';

COMMENT ON COLUMN topics.description_updated_by IS
  'Profile ID of the user who last edited the topic description/context field.';
