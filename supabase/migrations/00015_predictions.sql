-- =============================================================================
-- Lobby Market: Topic Prediction Market
-- =============================================================================
-- Users can stake predictions on whether a topic will become law or fail.
-- Predictions are scored when a topic resolves; accuracy drives a clout bonus.
-- One prediction per user per topic; can be updated before the topic resolves.
-- =============================================================================

CREATE TABLE IF NOT EXISTS topic_predictions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id        UUID        NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- Predicted outcome
  predicted_law   BOOLEAN     NOT NULL,   -- true = will become law, false = will fail
  confidence      INT         NOT NULL CHECK (confidence BETWEEN 1 AND 100),
  -- Resolution (filled when topic reaches terminal state)
  resolved_at     TIMESTAMPTZ,
  correct         BOOLEAN,                -- null until resolved
  brier_score     NUMERIC(6,4),          -- lower = better (0.0–1.0)
  clout_earned    INT         NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (topic_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_topic_predictions_topic   ON topic_predictions (topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_predictions_user    ON topic_predictions (user_id);
CREATE INDEX IF NOT EXISTS idx_topic_predictions_correct ON topic_predictions (user_id, correct) WHERE correct IS NOT NULL;

-- ── Materialized aggregate per topic ──────────────────────────────────────────
-- Computed columns on the topics table would be expensive; instead we store
-- a simple aggregate in a separate table updated on prediction changes.

CREATE TABLE IF NOT EXISTS topic_prediction_stats (
  topic_id          UUID        PRIMARY KEY REFERENCES topics(id) ON DELETE CASCADE,
  total_predictions INT         NOT NULL DEFAULT 0,
  law_confidence    NUMERIC(5,2) NOT NULL DEFAULT 50.00,  -- aggregate % predicting law
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Row Level Security ─────────────────────────────────────────────────────────

ALTER TABLE topic_predictions       ENABLE ROW LEVEL SECURITY;
ALTER TABLE topic_prediction_stats  ENABLE ROW LEVEL SECURITY;

-- Anyone can read predictions and stats (public market)
CREATE POLICY "topic_predictions_select_public"
  ON topic_predictions FOR SELECT USING (true);

CREATE POLICY "topic_prediction_stats_select_public"
  ON topic_prediction_stats FOR SELECT USING (true);

-- Authenticated users can insert/update their own predictions
CREATE POLICY "topic_predictions_insert_own"
  ON topic_predictions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "topic_predictions_update_own"
  ON topic_predictions FOR UPDATE
  USING (auth.uid() = user_id AND resolved_at IS NULL);

-- Users can delete (cancel) unresolved predictions
CREATE POLICY "topic_predictions_delete_own"
  ON topic_predictions FOR DELETE
  USING (auth.uid() = user_id AND resolved_at IS NULL);

-- ── Function: recompute aggregate after prediction change ─────────────────────

CREATE OR REPLACE FUNCTION refresh_topic_prediction_stats(p_topic_id UUID)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_total  INT;
  v_law_pct NUMERIC;
BEGIN
  SELECT
    COUNT(*),
    COALESCE(
      AVG(CASE WHEN predicted_law THEN confidence ELSE (100 - confidence) END),
      50
    )
  INTO v_total, v_law_pct
  FROM topic_predictions
  WHERE topic_id = p_topic_id;

  INSERT INTO topic_prediction_stats (topic_id, total_predictions, law_confidence, updated_at)
  VALUES (p_topic_id, v_total, v_law_pct, now())
  ON CONFLICT (topic_id) DO UPDATE
    SET total_predictions = EXCLUDED.total_predictions,
        law_confidence    = EXCLUDED.law_confidence,
        updated_at        = EXCLUDED.updated_at;
END;
$$;
