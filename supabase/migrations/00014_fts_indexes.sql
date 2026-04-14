-- Full-text search indexes for topics, laws, and profiles.
-- Adds stored tsvector generated columns with GIN indexes so queries can use
-- Postgres websearch_to_tsquery / ts_rank instead of slow ILIKE scans.
--
-- topics  : index on statement + category
-- laws    : index on statement + full_statement + category
-- profiles: index on username + display_name (for people search)

-- ─── topics ──────────────────────────────────────────────────────────────────

ALTER TABLE topics
  ADD COLUMN IF NOT EXISTS fts tsvector
    GENERATED ALWAYS AS (
      to_tsvector(
        'english',
        coalesce(statement, '') || ' ' || coalesce(category, '')
      )
    ) STORED;

CREATE INDEX IF NOT EXISTS idx_topics_fts ON topics USING GIN(fts);

-- ─── laws ────────────────────────────────────────────────────────────────────

ALTER TABLE laws
  ADD COLUMN IF NOT EXISTS fts tsvector
    GENERATED ALWAYS AS (
      to_tsvector(
        'english',
        coalesce(statement, '') || ' ' ||
        coalesce(full_statement, '') || ' ' ||
        coalesce(category, '')
      )
    ) STORED;

CREATE INDEX IF NOT EXISTS idx_laws_fts ON laws USING GIN(fts);

-- ─── profiles ────────────────────────────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS fts tsvector
    GENERATED ALWAYS AS (
      to_tsvector(
        'simple',
        coalesce(username, '') || ' ' || coalesce(display_name, '')
      )
    ) STORED;

CREATE INDEX IF NOT EXISTS idx_profiles_fts ON profiles USING GIN(fts);
