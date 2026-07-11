-- =============================================================================
-- Lobby Market: Relay Chain Comments
-- =============================================================================
-- Threaded discussion on completed relay chains. Distinct from:
--   relay_legs        — the collaborative argument contributions
--   relay_votes       — compelling / not_compelling verdicts
--   topic_chat        — ephemeral live chat on topics
--   argument_replies  — adversarial replies within topic arguments
--
-- Comments are for meta-discussion about the relay chain as a whole:
-- "This chain makes a great case for X", "Leg 3 was weak because...", etc.
-- =============================================================================

CREATE TABLE IF NOT EXISTS relay_comments (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  relay_id    UUID        NOT NULL REFERENCES civic_relays(id) ON DELETE CASCADE,
  author_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content     TEXT        NOT NULL
              CHECK (char_length(content) >= 1 AND char_length(content) <= 500),
  -- Optional: pinpoint discussion to a specific leg
  leg_number  INT         CHECK (leg_number BETWEEN 1 AND 5),
  upvote_count INT        NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  edited_at   TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_relay_comments_relay
  ON relay_comments(relay_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_relay_comments_author
  ON relay_comments(author_id, created_at DESC);

ALTER TABLE relay_comments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "relay_comments_read"
  ON relay_comments FOR SELECT
  USING (true);

CREATE POLICY "relay_comments_insert"
  ON relay_comments FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = author_id);

CREATE POLICY "relay_comments_update"
  ON relay_comments FOR UPDATE
  TO authenticated
  USING (auth.uid() = author_id);

CREATE POLICY "relay_comments_delete"
  ON relay_comments FOR DELETE
  TO authenticated
  USING (auth.uid() = author_id);

-- ─── Comment upvotes ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS relay_comment_upvotes (
  comment_id  UUID  NOT NULL REFERENCES relay_comments(id) ON DELETE CASCADE,
  user_id     UUID  NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (comment_id, user_id)
);

ALTER TABLE relay_comment_upvotes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "relay_comment_upvotes_read"
  ON relay_comment_upvotes FOR SELECT
  USING (true);

CREATE POLICY "relay_comment_upvotes_insert"
  ON relay_comment_upvotes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "relay_comment_upvotes_delete"
  ON relay_comment_upvotes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- ─── Trigger: keep upvote_count denormalised on relay_comments ────────────────

CREATE OR REPLACE FUNCTION fn_sync_relay_comment_upvote_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE relay_comments SET upvote_count = upvote_count + 1 WHERE id = NEW.comment_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE relay_comments SET upvote_count = GREATEST(upvote_count - 1, 0) WHERE id = OLD.comment_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS tg_relay_comment_upvote ON relay_comment_upvotes;
CREATE TRIGGER tg_relay_comment_upvote
  AFTER INSERT OR DELETE ON relay_comment_upvotes
  FOR EACH ROW EXECUTE FUNCTION fn_sync_relay_comment_upvote_count();
