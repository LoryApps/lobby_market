-- =============================================================================
-- Lobby Market: Pre-Debate Outcome Predictions
-- =============================================================================
-- Users can predict debate outcomes before debates start:
--   • predicted_winner: which side they expect to argue more convincingly
--   • predicted_sway:   how much they think the debate will move the topic's
--                       FOR% (signed integer, e.g. +5 = gains 5 pp FOR)
--   • confidence:       1–100 self-assessed certainty
--
-- Predictions resolve when the debate ends:
--   • correct_winner   — true if their predicted_winner matches the community
--                        poll winner (from debate_winner_polls)
--   • sway_error       — |actual_sway_change - predicted_sway| in pp
--   • clout_earned     — bonus clout for an accurate call
--
-- One prediction per user per debate; can be updated while debate is scheduled.
-- =============================================================================

CREATE TABLE IF NOT EXISTS debate_predictions (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id        UUID        NOT NULL REFERENCES debates(id) ON DELETE CASCADE,
  user_id          UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Pre-debate prediction fields
  predicted_winner TEXT        NOT NULL CHECK (predicted_winner IN ('for', 'against', 'tie')),
  predicted_sway   INT         NOT NULL DEFAULT 0  -- signed pp change forecast for FOR side
                                CHECK (predicted_sway BETWEEN -50 AND 50),
  confidence       INT         NOT NULL DEFAULT 50
                                CHECK (confidence BETWEEN 1 AND 100),

  -- Resolution (filled when debate ends)
  resolved_at      TIMESTAMPTZ,
  correct_winner   BOOLEAN,           -- null until resolved
  sway_error       INT,               -- |actual - predicted| in pp; null until resolved
  clout_earned     INT         NOT NULL DEFAULT 0,

  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at       TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (debate_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_debate_predictions_debate
  ON debate_predictions (debate_id);
CREATE INDEX IF NOT EXISTS idx_debate_predictions_user
  ON debate_predictions (user_id);
CREATE INDEX IF NOT EXISTS idx_debate_predictions_resolved
  ON debate_predictions (user_id, resolved_at) WHERE resolved_at IS NOT NULL;

-- ── Row Level Security ─────────────────────────────────────────────────────────

ALTER TABLE debate_predictions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "debate_predictions_select_public"
  ON debate_predictions FOR SELECT USING (true);

CREATE POLICY "debate_predictions_insert_auth"
  ON debate_predictions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "debate_predictions_update_own"
  ON debate_predictions FOR UPDATE
  USING (auth.uid() = user_id AND resolved_at IS NULL);

COMMENT ON TABLE debate_predictions IS
  'Pre-debate outcome predictions. Users predict winner and sway change before
   a debate starts. Predictions resolve after the debate ends and are scored
   against the community winner poll and actual topic sway delta.';
