-- =============================================================================
-- Lobby Market: Topic Collections
-- Users can create named lists of topics (like playlists/reading lists).
-- Collections can be private or public.
-- =============================================================================

-- ---------------------------------------------------------------------------
-- TABLE: topic_collections
-- ---------------------------------------------------------------------------

CREATE TABLE topic_collections (
  id          UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name        TEXT         NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  description TEXT                  CHECK (char_length(description) <= 300),
  is_public   BOOLEAN      NOT NULL DEFAULT false,
  item_count  INT          NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX idx_topic_collections_user
  ON topic_collections(user_id, updated_at DESC);

CREATE INDEX idx_topic_collections_public
  ON topic_collections(is_public, updated_at DESC)
  WHERE is_public = true;

COMMENT ON TABLE topic_collections IS
  'User-curated named lists of topics (playlists / reading lists)';

-- ---------------------------------------------------------------------------
-- TABLE: collection_items
-- ---------------------------------------------------------------------------

CREATE TABLE collection_items (
  collection_id  UUID         NOT NULL REFERENCES topic_collections(id) ON DELETE CASCADE,
  topic_id       UUID         NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  note           TEXT                  CHECK (char_length(note) <= 200),
  added_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (collection_id, topic_id)
);

CREATE INDEX idx_collection_items_collection
  ON collection_items(collection_id, added_at DESC);

CREATE INDEX idx_collection_items_topic
  ON collection_items(topic_id);

COMMENT ON TABLE collection_items IS
  'Topics within a collection, with optional per-item note';

-- ---------------------------------------------------------------------------
-- TRIGGER: maintain item_count on topic_collections
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION trg_fn_collection_item_count()
RETURNS trigger LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE topic_collections
    SET item_count = item_count + 1,
        updated_at = now()
    WHERE id = NEW.collection_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE topic_collections
    SET item_count = GREATEST(item_count - 1, 0),
        updated_at = now()
    WHERE id = OLD.collection_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_collection_item_count
  AFTER INSERT OR DELETE ON collection_items
  FOR EACH ROW EXECUTE FUNCTION trg_fn_collection_item_count();

-- ---------------------------------------------------------------------------
-- RLS: topic_collections
-- ---------------------------------------------------------------------------

ALTER TABLE topic_collections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "collections_read"
  ON topic_collections FOR SELECT
  USING (is_public = true OR auth.uid() = user_id);

CREATE POLICY "collections_insert"
  ON topic_collections FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "collections_update"
  ON topic_collections FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "collections_delete"
  ON topic_collections FOR DELETE
  USING (auth.uid() = user_id);

-- ---------------------------------------------------------------------------
-- RLS: collection_items
-- ---------------------------------------------------------------------------

ALTER TABLE collection_items ENABLE ROW LEVEL SECURITY;

CREATE POLICY "collection_items_read"
  ON collection_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM topic_collections tc
      WHERE tc.id = collection_id
        AND (tc.is_public = true OR tc.user_id = auth.uid())
    )
  );

CREATE POLICY "collection_items_insert"
  ON collection_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM topic_collections tc
      WHERE tc.id = collection_id AND tc.user_id = auth.uid()
    )
  );

CREATE POLICY "collection_items_delete"
  ON collection_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM topic_collections tc
      WHERE tc.id = collection_id AND tc.user_id = auth.uid()
    )
  );

-- ---------------------------------------------------------------------------
-- Grants
-- ---------------------------------------------------------------------------

GRANT SELECT, INSERT, UPDATE, DELETE ON topic_collections TO authenticated;
GRANT SELECT, INSERT, DELETE ON collection_items TO authenticated;
