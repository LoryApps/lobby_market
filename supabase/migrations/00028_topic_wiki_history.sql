-- =============================================================================
-- Lobby Market: Topic Wiki Edit History
-- =============================================================================
--
-- Adds a full edit-history log for topic wiki descriptions so we can
-- surface "what changed" diffs similar to Wikipedia's page history.
--
-- Tables:
--   topic_wiki_history — one row per edit, stores old + new content
--
-- Trigger:
--   trg_topic_wiki_history — fires AFTER UPDATE on topics.description
--   and writes the before/after snapshot into topic_wiki_history.
-- =============================================================================

-- ── 1. History table ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS topic_wiki_history (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id        UUID        NOT NULL REFERENCES topics (id) ON DELETE CASCADE,
  editor_id       UUID        REFERENCES profiles (id) ON DELETE SET NULL,
  previous_content TEXT,          -- NULL on the first edit (no prior description)
  new_content     TEXT,
  char_delta      INT GENERATED ALWAYS AS (
    coalesce(char_length(new_content), 0) - coalesce(char_length(previous_content), 0)
  ) STORED,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS topic_wiki_history_topic_idx
  ON topic_wiki_history (topic_id, created_at DESC);

CREATE INDEX IF NOT EXISTS topic_wiki_history_editor_idx
  ON topic_wiki_history (editor_id);

COMMENT ON TABLE topic_wiki_history IS
  'Full edit log for topic wiki descriptions — before/after snapshots.';

-- ── 2. Trigger function ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_record_topic_wiki_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only fire when the description actually changed (ignore no-op updates).
  IF NEW.description IS NOT DISTINCT FROM OLD.description THEN
    RETURN NEW;
  END IF;

  -- Insert history row. editor_id comes from description_updated_by which
  -- the application sets on every wiki save.
  INSERT INTO topic_wiki_history (
    topic_id,
    editor_id,
    previous_content,
    new_content
  ) VALUES (
    NEW.id,
    NEW.description_updated_by,
    OLD.description,
    NEW.description
  );

  RETURN NEW;
END;
$$;

-- ── 3. Attach trigger ─────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_topic_wiki_history ON topics;

CREATE TRIGGER trg_topic_wiki_history
  AFTER UPDATE OF description ON topics
  FOR EACH ROW
  EXECUTE FUNCTION fn_record_topic_wiki_history();
