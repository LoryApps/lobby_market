-- Exchange Trades Feed — performance index
-- The /exchange/trades page queries recent votes ordered by created_at DESC.
-- Without this index the query does a full table scan.

CREATE INDEX IF NOT EXISTS idx_votes_created_at
  ON votes (created_at DESC);

COMMENT ON INDEX idx_votes_created_at IS
  'Powers the Exchange live trades feed which orders recent votes by time.';
