-- ───────────────────────────────────────────────────────────────────────────
-- 00039_lobby_snapshots.sql
-- Campaign momentum snapshots: record a point-in-time reading of a lobby's
-- member_count and influence_score whenever either value changes.
-- CampaignProgress.tsx uses these to draw a real sparkline instead of a
-- synthetic curve.
-- ───────────────────────────────────────────────────────────────────────────

-- ---------------------------------------------------------------------------
-- TABLE: lobby_snapshots
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS lobby_snapshots (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lobby_id        UUID        NOT NULL REFERENCES lobbies (id) ON DELETE CASCADE,
  member_count    INT         NOT NULL DEFAULT 0,
  influence_score REAL        NOT NULL DEFAULT 0,
  recorded_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lobby_snapshots_lobby_time
  ON lobby_snapshots (lobby_id, recorded_at DESC);

COMMENT ON TABLE lobby_snapshots IS
  'Point-in-time readings of lobby member_count and influence_score used to
   render the CampaignProgress sparkline with real data.';

-- ---------------------------------------------------------------------------
-- FUNCTION + TRIGGER: auto-snapshot on member_count change
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION record_lobby_snapshot()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- INSERT: record the initial state immediately
  -- UPDATE: only record when member_count actually changed (avoid noise)
  IF TG_OP = 'INSERT'
     OR NEW.member_count IS DISTINCT FROM OLD.member_count
  THEN
    INSERT INTO lobby_snapshots (lobby_id, member_count, influence_score)
    VALUES (
      NEW.id,
      COALESCE(NEW.member_count, 0),
      COALESCE(NEW.influence_score, 0)
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_lobby_snapshot ON lobbies;

CREATE TRIGGER trg_lobby_snapshot
  AFTER INSERT OR UPDATE OF member_count, influence_score
  ON lobbies
  FOR EACH ROW
  EXECUTE FUNCTION record_lobby_snapshot();

-- ---------------------------------------------------------------------------
-- BACK-FILL: seed one historical snapshot per existing lobby so the sparkline
-- has at least one data point for lobbies created before this migration.
-- ---------------------------------------------------------------------------

INSERT INTO lobby_snapshots (lobby_id, member_count, influence_score, recorded_at)
SELECT
  id,
  member_count,
  influence_score,
  created_at  -- use original creation time as the "start" reading
FROM lobbies
ON CONFLICT DO NOTHING;

-- ---------------------------------------------------------------------------
-- RLS: snapshots are public-read (same visibility as lobbies)
-- ---------------------------------------------------------------------------

ALTER TABLE lobby_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "lobby_snapshots_select_all"
  ON lobby_snapshots FOR SELECT
  USING (true);

CREATE POLICY "lobby_snapshots_insert_trigger"
  ON lobby_snapshots FOR INSERT
  WITH CHECK (true);
