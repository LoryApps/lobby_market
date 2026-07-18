-- =============================================================================
-- Lobby Market: Exchange Market Commentary
-- =============================================================================
-- Short-form (≤280 char) public notes traders post to share quick takes on
-- civic prediction markets. Simpler than market_ideas — no title, no target
-- price, no confidence rating. Think Twitter-style hot-takes on market moves.
-- =============================================================================

CREATE TABLE IF NOT EXISTS market_commentary (
  id         UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id    UUID    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  topic_id   UUID    REFERENCES topics(id) ON DELETE SET NULL,
  content    TEXT    NOT NULL CHECK (char_length(content) BETWEEN 1 AND 280),
  direction  TEXT    CHECK (direction IN ('for', 'against', 'neutral')),
  likes      INTEGER NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market_commentary_likes (
  user_id      UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  commentary_id UUID NOT NULL REFERENCES market_commentary(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, commentary_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_market_commentary_topic_id   ON market_commentary (topic_id);
CREATE INDEX IF NOT EXISTS idx_market_commentary_user_id    ON market_commentary (user_id);
CREATE INDEX IF NOT EXISTS idx_market_commentary_created_at ON market_commentary (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_commentary_likes      ON market_commentary (likes DESC, created_at DESC);

-- RLS
ALTER TABLE market_commentary       ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_commentary_likes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "market_commentary_select" ON market_commentary FOR SELECT USING (true);
CREATE POLICY "market_commentary_insert" ON market_commentary FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "market_commentary_delete" ON market_commentary FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "market_commentary_likes_select" ON market_commentary_likes FOR SELECT USING (true);
CREATE POLICY "market_commentary_likes_insert" ON market_commentary_likes FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "market_commentary_likes_delete" ON market_commentary_likes FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger: keep likes count in sync
CREATE OR REPLACE FUNCTION sync_market_commentary_like()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE market_commentary SET likes = likes + 1 WHERE id = NEW.commentary_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE market_commentary SET likes = GREATEST(likes - 1, 0) WHERE id = OLD.commentary_id;
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_market_commentary_like
  AFTER INSERT OR DELETE ON market_commentary_likes
  FOR EACH ROW EXECUTE FUNCTION sync_market_commentary_like();

COMMENT ON TABLE market_commentary       IS 'Short-form market position notes (≤280 chars) in the Exchange';
COMMENT ON TABLE market_commentary_likes IS 'Like records for market commentary notes';
