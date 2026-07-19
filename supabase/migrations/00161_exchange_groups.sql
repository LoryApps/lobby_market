-- =============================================================================
-- Lobby Market: Exchange Market Groups
-- User-defined named baskets of exchange markets (thematic portfolios).
-- Different from topic_collections (civic) and exchange_watchlist (flat list).
-- Groups aggregate consensus stats across their member markets.
-- =============================================================================

-- ── 1. Groups table ───────────────────────────────────────────────────────────

CREATE TABLE exchange_groups (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  name        TEXT        NOT NULL CHECK (char_length(name) BETWEEN 1 AND 80),
  description TEXT                 CHECK (char_length(description) <= 300),
  emoji       TEXT        NOT NULL DEFAULT '📊' CHECK (char_length(emoji) <= 8),
  is_public   BOOLEAN     NOT NULL DEFAULT false,
  item_count  INT         NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_exchange_groups_user
  ON exchange_groups(user_id, updated_at DESC);

CREATE INDEX idx_exchange_groups_public
  ON exchange_groups(is_public, updated_at DESC)
  WHERE is_public = true;

COMMENT ON TABLE exchange_groups IS
  'User-curated thematic groups / baskets of Exchange markets';

-- ── 2. Group items table ──────────────────────────────────────────────────────

CREATE TABLE exchange_group_items (
  id       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID        NOT NULL REFERENCES exchange_groups(id) ON DELETE CASCADE,
  topic_id UUID        NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  added_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (group_id, topic_id)
);

CREATE INDEX idx_exchange_group_items_group
  ON exchange_group_items(group_id, added_at DESC);

CREATE INDEX idx_exchange_group_items_topic
  ON exchange_group_items(topic_id);

COMMENT ON TABLE exchange_group_items IS
  'Individual markets belonging to an exchange group';

-- ── 3. RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE exchange_groups      ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_group_items ENABLE ROW LEVEL SECURITY;

-- Groups: owner can do anything; anyone can read public groups
CREATE POLICY "exchange_groups_select"
  ON exchange_groups FOR SELECT
  USING (user_id = auth.uid() OR is_public = true);

CREATE POLICY "exchange_groups_insert"
  ON exchange_groups FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "exchange_groups_update"
  ON exchange_groups FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "exchange_groups_delete"
  ON exchange_groups FOR DELETE
  USING (user_id = auth.uid());

-- Items: readable if the parent group is readable
CREATE POLICY "exchange_group_items_select"
  ON exchange_group_items FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM exchange_groups g
      WHERE g.id = group_id
        AND (g.user_id = auth.uid() OR g.is_public = true)
    )
  );

CREATE POLICY "exchange_group_items_insert"
  ON exchange_group_items FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM exchange_groups g
      WHERE g.id = group_id AND g.user_id = auth.uid()
    )
  );

CREATE POLICY "exchange_group_items_delete"
  ON exchange_group_items FOR DELETE
  USING (
    EXISTS (
      SELECT 1 FROM exchange_groups g
      WHERE g.id = group_id AND g.user_id = auth.uid()
    )
  );

-- ── 4. Trigger: maintain item_count ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION exchange_group_item_count_sync()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE exchange_groups
       SET item_count = item_count + 1, updated_at = now()
     WHERE id = NEW.group_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE exchange_groups
       SET item_count = GREATEST(item_count - 1, 0), updated_at = now()
     WHERE id = OLD.group_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_exchange_group_item_count
  AFTER INSERT OR DELETE ON exchange_group_items
  FOR EACH ROW EXECUTE FUNCTION exchange_group_item_count_sync();
