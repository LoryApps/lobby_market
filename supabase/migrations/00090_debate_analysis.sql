-- =============================================================================
-- Lobby Market: AI Debate Analysis Cache
-- =============================================================================
-- Stores the AI-generated analysis for completed debates so we don't
-- re-invoke the LLM on every page load.  One analysis per debate;
-- regenerated on demand if the cache row is missing.
-- =============================================================================

CREATE TABLE IF NOT EXISTS debate_analyses (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id    UUID        NOT NULL REFERENCES debates(id) ON DELETE CASCADE,
  analysis     JSONB       NOT NULL,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT debate_analyses_debate_id_key UNIQUE (debate_id)
);

CREATE INDEX IF NOT EXISTS idx_debate_analyses_debate_id
  ON debate_analyses (debate_id);

-- Allow authenticated users to read analyses
ALTER TABLE debate_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "debate_analyses_select"
  ON debate_analyses FOR SELECT
  USING (true);

CREATE POLICY "debate_analyses_insert_service"
  ON debate_analyses FOR INSERT
  WITH CHECK (true);

CREATE POLICY "debate_analyses_delete_service"
  ON debate_analyses FOR DELETE
  USING (true);
