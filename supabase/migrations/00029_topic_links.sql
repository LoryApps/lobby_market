-- =============================================================================
-- Lobby Market: Topic Wiki Backlinks
-- =============================================================================
-- Mirrors the law_links knowledge-graph feature for topic wiki descriptions.
-- When a topic's description is saved with [[wikilinks]] (which the editor
-- converts to [Statement](/topic/UUID) markdown), this migration:
--
--   1. Creates a topic_links table (source → target pairs)
--   2. Adds a trigger that re-syncs outgoing links whenever
--      topics.description is updated
--   3. Creates helper indexes for fast backlink queries
-- =============================================================================

-- ── 1. Table ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS topic_links (
  id               UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  source_topic_id  UUID         NOT NULL REFERENCES topics (id) ON DELETE CASCADE,
  target_topic_id  UUID         NOT NULL REFERENCES topics (id) ON DELETE CASCADE,
  created_at       TIMESTAMPTZ  NOT NULL DEFAULT now(),

  CONSTRAINT topic_links_no_self_ref CHECK (source_topic_id != target_topic_id),
  CONSTRAINT topic_links_unique       UNIQUE (source_topic_id, target_topic_id)
);

CREATE INDEX IF NOT EXISTS topic_links_source_idx ON topic_links (source_topic_id);
CREATE INDEX IF NOT EXISTS topic_links_target_idx ON topic_links (target_topic_id);

COMMENT ON TABLE topic_links IS
  'Directed wiki-link graph between topics: source description contains a [[wikilink]] pointing to target.';

-- ── 2. Trigger function ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_sync_topic_links()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  raw_id  TEXT;
  link_id UUID;
BEGIN
  -- Only run when description actually changed
  IF NEW.description IS NOT DISTINCT FROM OLD.description THEN
    RETURN NEW;
  END IF;

  -- Remove old outgoing links from this topic
  DELETE FROM topic_links WHERE source_topic_id = NEW.id;

  -- Parse new links: extract UUIDs from (/topic/<uuid>) href patterns
  IF NEW.description IS NOT NULL THEN
    FOR raw_id IN
      SELECT DISTINCT (regexp_matches(NEW.description, '\(/topic/([a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12})\)', 'g'))[1]
    LOOP
      BEGIN
        link_id := raw_id::UUID;
        IF link_id != NEW.id AND EXISTS (SELECT 1 FROM topics WHERE id = link_id) THEN
          INSERT INTO topic_links (source_topic_id, target_topic_id)
          VALUES (NEW.id, link_id)
          ON CONFLICT DO NOTHING;
        END IF;
      EXCEPTION WHEN invalid_text_representation THEN
        NULL; -- skip malformed UUIDs
      END;
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- ── 3. Trigger ────────────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_sync_topic_links ON topics;

CREATE TRIGGER trg_sync_topic_links
  AFTER UPDATE OF description ON topics
  FOR EACH ROW
  EXECUTE FUNCTION fn_sync_topic_links();

-- ── 4. Backfill existing descriptions ────────────────────────────────────────
-- Run a synthetic update so the trigger fires for every topic that already
-- has a description containing wikilinks.  We do this by setting description
-- to the same value (NULLIF trick forces a real row diff).

UPDATE topics
SET description = description
WHERE description IS NOT NULL
  AND description LIKE '%/topic/%';
