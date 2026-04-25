-- =============================================================================
-- Lobby Market: Daily Civic Editorial
-- =============================================================================
-- Caches one Claude-generated editorial per calendar day.
-- Analysed topics are stored as JSONB so the page can render topic links
-- without a second query.
-- =============================================================================

CREATE TABLE IF NOT EXISTS daily_editorials (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  date_key      DATE        UNIQUE NOT NULL,
  headline      TEXT        NOT NULL,
  lede          TEXT        NOT NULL,
  body          TEXT        NOT NULL,          -- prose separated by \n\n
  topics_json   JSONB       NOT NULL DEFAULT '[]',
  model         TEXT        NOT NULL DEFAULT 'claude-sonnet-4-6',
  generated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_daily_editorials_date
  ON daily_editorials (date_key DESC);

COMMENT ON TABLE daily_editorials IS
  'One Claude-generated civic editorial per calendar day, caching the
   headline, lede, body prose, and a JSONB snapshot of the analysed topics.';

-- ── Row Level Security ─────────────────────────────────────────────────────────

ALTER TABLE daily_editorials ENABLE ROW LEVEL SECURITY;

-- Anyone (including anonymous visitors) can read editorials
CREATE POLICY "daily_editorials_select" ON daily_editorials
  FOR SELECT USING (true);

-- Only the service role (server-side generation) may insert / update
CREATE POLICY "daily_editorials_insert" ON daily_editorials
  FOR INSERT WITH CHECK (true);

CREATE POLICY "daily_editorials_update" ON daily_editorials
  FOR UPDATE USING (true);
