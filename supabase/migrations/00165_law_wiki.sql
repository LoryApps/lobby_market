-- =============================================================================
-- Lobby Market: Law Wiki
-- =============================================================================
-- Adds collaborative wiki editing to established laws, mirroring the
-- topic wiki feature.  Citizens can contribute context, history, impact
-- notes, and implementation analysis for any law in the Codex.
--
-- Changes:
--   1. laws — add wiki_content, wiki_updated_at, wiki_updated_by
--   2. law_wiki_history — full edit-history log (before/after snapshots)
--   3. Trigger trg_law_wiki_history — auto-records edits on laws.wiki_content
-- =============================================================================

-- ── 1. Extend laws table ──────────────────────────────────────────────────────

ALTER TABLE laws
  ADD COLUMN IF NOT EXISTS wiki_content       TEXT
    CHECK (wiki_content IS NULL OR char_length(wiki_content) <= 5000),
  ADD COLUMN IF NOT EXISTS wiki_updated_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS wiki_updated_by    UUID REFERENCES profiles (id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS laws_wiki_updated_at_idx
  ON laws (wiki_updated_at DESC NULLS LAST)
  WHERE wiki_updated_at IS NOT NULL;

COMMENT ON COLUMN laws.wiki_content IS
  'Community-editable markdown wiki article for this law (max 5000 chars).';
COMMENT ON COLUMN laws.wiki_updated_at IS
  'Timestamp of the last wiki edit.';
COMMENT ON COLUMN laws.wiki_updated_by IS
  'Profile ID of the last wiki editor.';

-- ── 2. History table ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS law_wiki_history (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  law_id           UUID        NOT NULL REFERENCES laws (id) ON DELETE CASCADE,
  editor_id        UUID        REFERENCES profiles (id) ON DELETE SET NULL,
  previous_content TEXT,
  new_content      TEXT,
  char_delta       INT GENERATED ALWAYS AS (
    coalesce(char_length(new_content), 0) - coalesce(char_length(previous_content), 0)
  ) STORED,
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS law_wiki_history_law_idx
  ON law_wiki_history (law_id, created_at DESC);

CREATE INDEX IF NOT EXISTS law_wiki_history_editor_idx
  ON law_wiki_history (editor_id, created_at DESC);

COMMENT ON TABLE law_wiki_history IS
  'Edit-history log for law wiki articles — one row per save.';

-- ── 3. Row Level Security ─────────────────────────────────────────────────────

ALTER TABLE law_wiki_history ENABLE ROW LEVEL SECURITY;

CREATE POLICY "law_wiki_history_select_public"
  ON law_wiki_history FOR SELECT USING (true);

CREATE POLICY "law_wiki_history_insert_auth"
  ON law_wiki_history FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL);

-- ── 4. Auto-history trigger ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION record_law_wiki_history()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Only record when wiki_content actually changed
  IF OLD.wiki_content IS DISTINCT FROM NEW.wiki_content THEN
    INSERT INTO law_wiki_history (law_id, editor_id, previous_content, new_content)
    VALUES (
      NEW.id,
      NEW.wiki_updated_by,
      OLD.wiki_content,
      NEW.wiki_content
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_law_wiki_history ON laws;

CREATE TRIGGER trg_law_wiki_history
  AFTER UPDATE ON laws
  FOR EACH ROW
  EXECUTE FUNCTION record_law_wiki_history();
