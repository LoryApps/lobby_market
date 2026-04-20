-- =============================================================================
-- Lobby Market: Full-Text Search Index for Topic Arguments
-- =============================================================================
-- Adds a stored tsvector generated column + GIN index on topic_arguments.content
-- so the global search can find arguments by keyword without slow ILIKE scans.
-- Also adds an index on upvotes DESC for sorting search results by quality.
-- =============================================================================

-- ── 1. tsvector column ───────────────────────────────────────────────────────

ALTER TABLE topic_arguments
  ADD COLUMN IF NOT EXISTS fts tsvector
    GENERATED ALWAYS AS (
      to_tsvector('english', coalesce(content, ''))
    ) STORED;

-- ── 2. GIN index for fast text search ────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_topic_arguments_fts
  ON topic_arguments USING GIN(fts);

-- ── 3. Index for high-quality results (most upvoted first) ───────────────────

CREATE INDEX IF NOT EXISTS idx_topic_arguments_upvotes
  ON topic_arguments(upvotes DESC, created_at DESC);
