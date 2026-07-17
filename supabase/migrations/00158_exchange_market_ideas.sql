-- =============================================================================
-- Lobby Market: Exchange Market Ideas
-- =============================================================================
-- A social feed where users share prediction theses on civic markets.
-- Each idea has a direction (for/against/neutral), optional target price,
-- confidence rating, and title/body. Other users upvote/downvote ideas.
-- =============================================================================

CREATE TABLE IF NOT EXISTS market_ideas (
  id          UUID    DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id     UUID    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  topic_id    UUID    REFERENCES topics(id) ON DELETE SET NULL,
  title       TEXT    NOT NULL CHECK (char_length(title) BETWEEN 5 AND 120),
  body        TEXT    NOT NULL CHECK (char_length(body) BETWEEN 20 AND 500),
  direction   TEXT    NOT NULL CHECK (direction IN ('for', 'against', 'neutral')),
  target_price INTEGER CHECK (target_price BETWEEN 1 AND 99),
  confidence  INTEGER NOT NULL DEFAULT 3 CHECK (confidence BETWEEN 1 AND 5),
  upvotes     INTEGER NOT NULL DEFAULT 0,
  downvotes   INTEGER NOT NULL DEFAULT 0,
  is_featured BOOLEAN NOT NULL DEFAULT false,
  created_at  TIMESTAMPTZ DEFAULT now()
);

CREATE TABLE IF NOT EXISTS market_idea_votes (
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  idea_id    UUID NOT NULL REFERENCES market_ideas(id) ON DELETE CASCADE,
  direction  TEXT NOT NULL CHECK (direction IN ('up', 'down')),
  created_at TIMESTAMPTZ DEFAULT now(),
  PRIMARY KEY (user_id, idea_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_market_ideas_topic_id   ON market_ideas (topic_id);
CREATE INDEX IF NOT EXISTS idx_market_ideas_user_id    ON market_ideas (user_id);
CREATE INDEX IF NOT EXISTS idx_market_ideas_created_at ON market_ideas (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_market_ideas_score
  ON market_ideas ((upvotes - downvotes) DESC, created_at DESC);

-- RLS
ALTER TABLE market_ideas ENABLE ROW LEVEL SECURITY;
ALTER TABLE market_idea_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "market_ideas_select" ON market_ideas FOR SELECT USING (true);
CREATE POLICY "market_ideas_insert" ON market_ideas FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "market_ideas_delete" ON market_ideas FOR DELETE
  USING (auth.uid() = user_id);

CREATE POLICY "market_idea_votes_select" ON market_idea_votes FOR SELECT USING (true);
CREATE POLICY "market_idea_votes_upsert" ON market_idea_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "market_idea_votes_update" ON market_idea_votes FOR UPDATE
  USING (auth.uid() = user_id);
CREATE POLICY "market_idea_votes_delete" ON market_idea_votes FOR DELETE
  USING (auth.uid() = user_id);

-- Vote trigger: keeps upvotes/downvotes counts in sync
CREATE OR REPLACE FUNCTION sync_market_idea_vote()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.direction = 'up' THEN
      UPDATE market_ideas SET upvotes = upvotes + 1 WHERE id = NEW.idea_id;
    ELSE
      UPDATE market_ideas SET downvotes = downvotes + 1 WHERE id = NEW.idea_id;
    END IF;
  ELSIF TG_OP = 'UPDATE' THEN
    IF OLD.direction = 'up' AND NEW.direction = 'down' THEN
      UPDATE market_ideas SET upvotes = GREATEST(upvotes - 1, 0), downvotes = downvotes + 1 WHERE id = NEW.idea_id;
    ELSIF OLD.direction = 'down' AND NEW.direction = 'up' THEN
      UPDATE market_ideas SET downvotes = GREATEST(downvotes - 1, 0), upvotes = upvotes + 1 WHERE id = NEW.idea_id;
    END IF;
  ELSIF TG_OP = 'DELETE' THEN
    IF OLD.direction = 'up' THEN
      UPDATE market_ideas SET upvotes = GREATEST(upvotes - 1, 0) WHERE id = OLD.idea_id;
    ELSE
      UPDATE market_ideas SET downvotes = GREATEST(downvotes - 1, 0) WHERE id = OLD.idea_id;
    END IF;
    RETURN OLD;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trg_market_idea_vote
  AFTER INSERT OR UPDATE OR DELETE ON market_idea_votes
  FOR EACH ROW EXECUTE FUNCTION sync_market_idea_vote();

COMMENT ON TABLE market_ideas      IS 'User-authored prediction theses for civic exchange markets';
COMMENT ON TABLE market_idea_votes IS 'Upvote/downvote records for market ideas';
