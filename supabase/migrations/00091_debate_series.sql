-- =============================================================================
-- Lobby Market: Debate Series — multi-round debate competitions
-- =============================================================================
-- Groups related debates into a themed series (e.g. "The UBI Trilogy: Best of 3").
-- Tracks round-by-round outcomes and the overall winner.
-- Series progress (blue_wins, red_wins) is maintained by application logic.
-- =============================================================================

CREATE TABLE IF NOT EXISTS debate_series (
  id            UUID        DEFAULT gen_random_uuid() PRIMARY KEY,
  title         TEXT        NOT NULL,
  description   TEXT,
  topic_id      UUID        REFERENCES topics(id)   ON DELETE SET NULL,
  creator_id    UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  status        TEXT        DEFAULT 'ongoing'
                CHECK (status IN ('ongoing', 'completed', 'cancelled')),
  format        TEXT        DEFAULT 'best_of_3'
                CHECK (format IN ('best_of_3', 'best_of_5', 'best_of_7', 'fixed')),
  blue_wins     INT         DEFAULT 0 NOT NULL CHECK (blue_wins >= 0),
  red_wins      INT         DEFAULT 0 NOT NULL CHECK (red_wins >= 0),
  winner_side   TEXT        CHECK (winner_side IN ('blue', 'red')),
  created_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL,
  updated_at    TIMESTAMPTZ DEFAULT NOW() NOT NULL
);

-- Add series linkage to debates table
ALTER TABLE debates
  ADD COLUMN IF NOT EXISTS series_id    UUID REFERENCES debate_series(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS series_round INT  CHECK (series_round >= 1);

-- ─── Row Level Security ────────────────────────────────────────────────────────

ALTER TABLE debate_series ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Series are publicly visible"
  ON debate_series FOR SELECT USING (true);

CREATE POLICY "Authenticated users can create series"
  ON debate_series FOR INSERT
  TO authenticated
  WITH CHECK (creator_id = auth.uid());

CREATE POLICY "Creators can update their series"
  ON debate_series FOR UPDATE
  TO authenticated
  USING (creator_id = auth.uid());

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS debate_series_topic_idx    ON debate_series (topic_id);
CREATE INDEX IF NOT EXISTS debate_series_creator_idx  ON debate_series (creator_id);
CREATE INDEX IF NOT EXISTS debate_series_status_idx   ON debate_series (status);
CREATE INDEX IF NOT EXISTS debates_series_id_idx      ON debates (series_id);

-- ─── updated_at trigger ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_debate_series_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER debate_series_updated_at
  BEFORE UPDATE ON debate_series
  FOR EACH ROW EXECUTE FUNCTION update_debate_series_updated_at();
