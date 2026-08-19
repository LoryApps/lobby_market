-- =============================================================================
-- Lobby Market: Thesis Watchlist
-- =============================================================================
-- Users can watch (bookmark) individual theses to track their resolution
-- without following the author. Distinct from the /thesis/following view
-- (which shows all theses from users you follow via user_follows).
-- =============================================================================

CREATE TABLE IF NOT EXISTS thesis_watchlist (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id)  ON DELETE CASCADE,
  thesis_id  UUID NOT NULL REFERENCES civic_theses(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, thesis_id)
);

ALTER TABLE thesis_watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own thesis watchlist"
  ON thesis_watchlist FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Anyone can read watchlist counts"
  ON thesis_watchlist FOR SELECT
  USING (TRUE);

CREATE INDEX IF NOT EXISTS idx_thesis_watchlist_thesis_id ON thesis_watchlist(thesis_id);
CREATE INDEX IF NOT EXISTS idx_thesis_watchlist_user_id   ON thesis_watchlist(user_id);
