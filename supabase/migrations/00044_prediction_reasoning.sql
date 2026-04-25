-- =============================================================================
-- Lobby Market: Prediction Reasoning
-- =============================================================================
-- Adds an optional short-form reasoning note to topic_predictions so users
-- can explain WHY they expect a topic to pass or fail.
-- Max 280 characters — punchy, like a civic hot-take.
-- =============================================================================

ALTER TABLE topic_predictions
  ADD COLUMN IF NOT EXISTS reasoning TEXT
    CHECK (reasoning IS NULL OR (char_length(reasoning) >= 1 AND char_length(reasoning) <= 280));

COMMENT ON COLUMN topic_predictions.reasoning IS
  'Optional short explanation (≤280 chars) for the prediction';

-- Index to allow efficient fetch of "top community predictions" on the
-- market page — predictions with reasoning, ordered by confidence.
CREATE INDEX IF NOT EXISTS idx_topic_predictions_reasoning
  ON topic_predictions (topic_id, confidence DESC)
  WHERE reasoning IS NOT NULL;
