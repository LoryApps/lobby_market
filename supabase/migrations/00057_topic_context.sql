-- =============================================================================
-- Lobby Market: Topic real-world context cache
-- =============================================================================
-- Stores Claude-generated real-world background for each topic:
-- what the underlying issue is, who it affects, and what's at stake.
-- Distinct from topic_ai_briefs (which summarises platform arguments).
-- =============================================================================

CREATE TABLE IF NOT EXISTS topic_contexts (
  topic_id       UUID        PRIMARY KEY REFERENCES topics (id) ON DELETE CASCADE,
  context_text   TEXT        NOT NULL,
  model          TEXT        NOT NULL DEFAULT 'claude-sonnet-4-6',
  generated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_topic_contexts_generated
  ON topic_contexts (generated_at DESC);

COMMENT ON TABLE topic_contexts IS
  'AI-generated real-world context cards for topics (background, stakes, stakeholders)';
