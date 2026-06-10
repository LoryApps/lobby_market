-- =============================================================================
-- Lobby Market: Blueprint Community Notes
-- =============================================================================
-- Citizen annotations on law implementation blueprints.
-- Linked to the law (not the blueprint row) so notes survive regeneration.
-- =============================================================================

CREATE TABLE IF NOT EXISTS blueprint_notes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  law_id     UUID        NOT NULL REFERENCES laws(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content    TEXT        NOT NULL CHECK (char_length(content) BETWEEN 10 AND 500),
  aspect     TEXT        NOT NULL DEFAULT 'general'
               CHECK (aspect IN ('phase','stakeholder','challenge','metric','resource','general')),
  upvotes    INTEGER     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_blueprint_notes_law
  ON blueprint_notes (law_id, upvotes DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_blueprint_notes_user
  ON blueprint_notes (user_id);

-- ── Upvotes tracking ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS blueprint_note_upvotes (
  note_id    UUID NOT NULL REFERENCES blueprint_notes(id) ON DELETE CASCADE,
  user_id    UUID NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  PRIMARY KEY (note_id, user_id)
);

-- ── Row Level Security ─────────────────────────────────────────────────────────

ALTER TABLE blueprint_notes ENABLE ROW LEVEL SECURITY;
ALTER TABLE blueprint_note_upvotes ENABLE ROW LEVEL SECURITY;

-- Notes: public read, auth insert own, no update/delete (immutable for integrity)
CREATE POLICY "blueprint_notes_select_public"
  ON blueprint_notes FOR SELECT USING (true);

CREATE POLICY "blueprint_notes_insert_auth"
  ON blueprint_notes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- One note per user per law (enforced in application layer)

-- Upvotes: public read, auth insert/delete own
CREATE POLICY "blueprint_note_upvotes_select"
  ON blueprint_note_upvotes FOR SELECT USING (true);

CREATE POLICY "blueprint_note_upvotes_insert"
  ON blueprint_note_upvotes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "blueprint_note_upvotes_delete"
  ON blueprint_note_upvotes FOR DELETE
  USING (auth.uid() = user_id);

-- ── Upvote count trigger ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION _sync_blueprint_note_upvotes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE blueprint_notes SET upvotes = upvotes + 1 WHERE id = NEW.note_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE blueprint_notes SET upvotes = GREATEST(0, upvotes - 1) WHERE id = OLD.note_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_blueprint_note_upvotes
  AFTER INSERT OR DELETE ON blueprint_note_upvotes
  FOR EACH ROW EXECUTE FUNCTION _sync_blueprint_note_upvotes();

COMMENT ON TABLE blueprint_notes IS
  'Community annotations on law implementation blueprints. Citizens flag phases,
   stakeholder concerns, challenges, and metrics for peer review.';
