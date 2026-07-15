-- ───────────────────────────────────────────────────────────────────────────
-- 00153_topic_price_history.sql
-- Periodic price snapshots for the Civic Exchange sparklines.
-- Records topic consensus percentage (blue_pct) every 20 votes so the
-- Exchange page can render real price-history sparklines.
-- ───────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS topic_price_history (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id     UUID        NOT NULL REFERENCES topics (id) ON DELETE CASCADE,
  price        REAL        NOT NULL,   -- blue_pct at snapshot time (0–100)
  volume       INT         NOT NULL DEFAULT 0,  -- total_votes at snapshot time
  recorded_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tph_topic_time
  ON topic_price_history (topic_id, recorded_at DESC);

COMMENT ON TABLE topic_price_history IS
  'Point-in-time snapshots of topic consensus price used to draw Exchange
   sparklines. One row per 20-vote interval.';

-- ---------------------------------------------------------------------------
-- TRIGGER: record a snapshot every 20 votes
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION record_topic_price_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Fire every 20 votes (total_votes divisible by 20 after this increment)
  IF (NEW.total_votes % 20) = 0 THEN
    INSERT INTO topic_price_history (topic_id, price, volume)
    VALUES (NEW.id, COALESCE(NEW.blue_pct, 50), COALESCE(NEW.total_votes, 0));
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_topic_price_snapshot ON topics;
CREATE TRIGGER trg_topic_price_snapshot
  AFTER UPDATE OF total_votes ON topics
  FOR EACH ROW
  EXECUTE FUNCTION record_topic_price_snapshot();

-- ---------------------------------------------------------------------------
-- Backfill: seed one initial snapshot per existing topic so the sparkline
-- has at least a starting point.
-- ---------------------------------------------------------------------------

INSERT INTO topic_price_history (topic_id, price, volume, recorded_at)
SELECT
  id,
  COALESCE(blue_pct, 50),
  COALESCE(total_votes, 0),
  COALESCE(created_at, now())
FROM topics
ON CONFLICT DO NOTHING;
