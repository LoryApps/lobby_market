-- =============================================================================
-- Lobby Market: Argument Citations
-- Adds an optional source_url to topic_arguments so users can back
-- their arguments with a factual reference.
-- =============================================================================

ALTER TABLE topic_arguments
  ADD COLUMN IF NOT EXISTS source_url TEXT
    CHECK (source_url IS NULL OR (
      char_length(source_url) <= 2000
      AND source_url ~* '^https?://'
    ));

COMMENT ON COLUMN topic_arguments.source_url IS
  'Optional URL citation for the argument (must be http/https, max 2000 chars)';
