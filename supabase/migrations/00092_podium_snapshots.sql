-- =============================================================================
-- Lobby Market: Podium Snapshots — weekly per-category leaderboard history
-- =============================================================================
-- Persists the top-3 finishers for each category every Monday when the cron
-- runs.  Drives the /profile/[username]/podium history view and the
-- all-time podium champions page.
-- =============================================================================

CREATE TABLE IF NOT EXISTS podium_snapshots (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  week_start   DATE        NOT NULL,
  category     TEXT        NOT NULL,
  rank         INT         NOT NULL CHECK (rank IN (1, 2, 3)),
  user_id      UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  score        INT         NOT NULL DEFAULT 0,
  weekly_votes INT         NOT NULL DEFAULT 0,
  weekly_arguments INT     NOT NULL DEFAULT 0,
  weekly_upvotes INT       NOT NULL DEFAULT 0,
  notified_at  TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT podium_snapshots_unique UNIQUE (week_start, category, rank)
);

CREATE INDEX IF NOT EXISTS idx_podium_snapshots_user
  ON podium_snapshots (user_id, week_start DESC);

CREATE INDEX IF NOT EXISTS idx_podium_snapshots_week
  ON podium_snapshots (week_start DESC);

CREATE INDEX IF NOT EXISTS idx_podium_snapshots_category_week
  ON podium_snapshots (category, week_start DESC);

COMMENT ON TABLE podium_snapshots IS
  'Weekly per-category top-3 podium standings, snapshotted every Monday.
   Powers historical podium records and podium achievement notifications.';

-- ── Row Level Security ─────────────────────────────────────────────────────────

ALTER TABLE podium_snapshots ENABLE ROW LEVEL SECURITY;

CREATE POLICY "podium_snapshots_select_public"
  ON podium_snapshots FOR SELECT USING (true);

-- Allow server-side inserts (service role bypasses this anyway; anon denied on update/delete)
CREATE POLICY "podium_snapshots_insert_any"
  ON podium_snapshots FOR INSERT WITH CHECK (true);

CREATE POLICY "podium_snapshots_update_service"
  ON podium_snapshots FOR UPDATE USING (false);

CREATE POLICY "podium_snapshots_delete_service"
  ON podium_snapshots FOR DELETE USING (false);
