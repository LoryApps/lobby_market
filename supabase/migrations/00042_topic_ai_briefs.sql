-- =============================================================================
-- Lobby Market: AI Debate Briefs
-- =============================================================================
-- Caches Claude-generated neutral summaries of each topic's debate.
-- Generated on demand and refreshed when argument_hash changes.
-- =============================================================================

CREATE TABLE IF NOT EXISTS topic_ai_briefs (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id       UUID        NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  brief_text     TEXT        NOT NULL,
  -- SHA-256-ish fingerprint of the input arguments so we know when to re-generate
  argument_hash  TEXT        NOT NULL,
  model          TEXT        NOT NULL DEFAULT 'claude-sonnet-4-6',
  generated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (topic_id)
);

CREATE INDEX IF NOT EXISTS idx_topic_ai_briefs_topic
  ON topic_ai_briefs (topic_id);

COMMENT ON TABLE topic_ai_briefs IS
  'Claude-generated neutral debate summaries, cached per topic and
   refreshed whenever the argument fingerprint changes.';

-- ── Row Level Security ─────────────────────────────────────────────────────────

ALTER TABLE topic_ai_briefs ENABLE ROW LEVEL SECURITY;

-- Anyone can read cached briefs
CREATE POLICY "ai_briefs_select_public"
  ON topic_ai_briefs FOR SELECT USING (true);

-- Only service-role can insert/update (done through server-side API routes)
CREATE POLICY "ai_briefs_insert_service"
  ON topic_ai_briefs FOR INSERT
  WITH CHECK (false);

CREATE POLICY "ai_briefs_update_service"
  ON topic_ai_briefs FOR UPDATE
  USING (false);
