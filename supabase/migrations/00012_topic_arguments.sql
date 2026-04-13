-- =============================================================================
-- Lobby Market: Topic Arguments
-- Users can post a short FOR or AGAINST argument per topic.
-- Other users can upvote arguments (one vote per argument per user).
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TABLE: topic_arguments
-- ---------------------------------------------------------------------------

CREATE TABLE topic_arguments (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id    UUID         NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  user_id     UUID         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  side        TEXT         NOT NULL CHECK (side IN ('blue', 'red')),
  content     TEXT         NOT NULL CHECK (char_length(content) BETWEEN 10 AND 500),
  upvotes     INT          NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

-- Each user can only post one argument per topic
CREATE UNIQUE INDEX idx_topic_arguments_user_topic
  ON topic_arguments(user_id, topic_id);

CREATE INDEX idx_topic_arguments_topic
  ON topic_arguments(topic_id, upvotes DESC, created_at DESC);

COMMENT ON TABLE topic_arguments IS
  'Short FOR/AGAINST text arguments posted by users under a topic';

-- ---------------------------------------------------------------------------
-- TABLE: topic_argument_votes  (upvotes — one per user per argument)
-- ---------------------------------------------------------------------------

CREATE TABLE topic_argument_votes (
  argument_id UUID         NOT NULL REFERENCES topic_arguments(id) ON DELETE CASCADE,
  user_id     UUID         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (argument_id, user_id)
);

COMMENT ON TABLE topic_argument_votes IS
  'Tracks which users have upvoted which arguments (one upvote per user per argument)';

-- ---------------------------------------------------------------------------
-- RLS: topic_arguments
-- ---------------------------------------------------------------------------

ALTER TABLE topic_arguments ENABLE ROW LEVEL SECURITY;

-- Anyone can read arguments
CREATE POLICY "public_read_topic_arguments"
  ON topic_arguments FOR SELECT USING (true);

-- Authenticated users can insert their own argument
CREATE POLICY "auth_insert_topic_argument"
  ON topic_arguments FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- RLS: topic_argument_votes
-- ---------------------------------------------------------------------------

ALTER TABLE topic_argument_votes ENABLE ROW LEVEL SECURITY;

-- Anyone can read votes (so the client knows if the user has upvoted)
CREATE POLICY "public_read_argument_votes"
  ON topic_argument_votes FOR SELECT USING (true);

-- Auth users can insert their own vote
CREATE POLICY "auth_insert_argument_vote"
  ON topic_argument_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Auth users can delete (un-upvote) their own vote
CREATE POLICY "auth_delete_argument_vote"
  ON topic_argument_votes FOR DELETE
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- TRIGGERS: maintain upvote count on topic_arguments
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION _on_argument_vote_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE topic_arguments
     SET upvotes = upvotes + 1
   WHERE id = NEW.argument_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION _on_argument_vote_delete()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE topic_arguments
     SET upvotes = GREATEST(0, upvotes - 1)
   WHERE id = OLD.argument_id;
  RETURN OLD;
END;
$$;

CREATE TRIGGER trg_argument_vote_insert
  AFTER INSERT ON topic_argument_votes
  FOR EACH ROW EXECUTE FUNCTION _on_argument_vote_insert();

CREATE TRIGGER trg_argument_vote_delete
  AFTER DELETE ON topic_argument_votes
  FOR EACH ROW EXECUTE FUNCTION _on_argument_vote_delete();

-- ---------------------------------------------------------------------------
-- TRIGGER: increment profiles.total_arguments when an argument is posted
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION _on_topic_argument_insert()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE profiles
     SET total_arguments = total_arguments + 1
   WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_topic_argument_insert
  AFTER INSERT ON topic_arguments
  FOR EACH ROW EXECUTE FUNCTION _on_topic_argument_insert();

-- ---------------------------------------------------------------------------
-- GRANTS
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT ON topic_arguments TO anon, authenticated;
GRANT SELECT, INSERT, DELETE ON topic_argument_votes TO anon, authenticated;
