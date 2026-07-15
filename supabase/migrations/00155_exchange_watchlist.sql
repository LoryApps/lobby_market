-- Exchange Market Watchlist
-- Users can bookmark/watch specific markets for quick access and tracking.
-- Unlike price alerts (which trigger on threshold crosses), a watchlist is
-- a passive "I want to keep an eye on this" tracker.

CREATE TABLE IF NOT EXISTS exchange_watchlist (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES profiles(id)  ON DELETE CASCADE,
  topic_id   UUID        NOT NULL REFERENCES topics(id)    ON DELETE CASCADE,
  note       TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, topic_id)
);

ALTER TABLE exchange_watchlist ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own watchlist"
  ON exchange_watchlist
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Fast lookup by user
CREATE INDEX IF NOT EXISTS idx_exchange_watchlist_user
  ON exchange_watchlist (user_id, created_at DESC);
