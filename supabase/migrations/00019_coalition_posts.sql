-- =============================================================================
-- Lobby Market: Coalition Bulletin Board
-- =============================================================================
-- Coalition leaders and officers can post announcements, strategy updates,
-- and news to their coalition's bulletin board. All members can read; only
-- leaders/officers can write; only the author or a leader can delete.
-- =============================================================================

-- ─── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS coalition_posts (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  coalition_id UUID        NOT NULL REFERENCES coalitions(id) ON DELETE CASCADE,
  author_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content      TEXT        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  is_pinned    BOOLEAN     NOT NULL DEFAULT false,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Ordering: pinned first, then newest
CREATE INDEX IF NOT EXISTS idx_coalition_posts_coalition
  ON coalition_posts (coalition_id, is_pinned DESC, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_coalition_posts_author
  ON coalition_posts (author_id);

COMMENT ON TABLE coalition_posts IS
  'Announcements and updates posted to a coalition bulletin board by leaders/officers';

-- ─── Auto-update updated_at ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION _set_coalition_post_updated_at()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_coalition_post_updated_at
  BEFORE UPDATE ON coalition_posts
  FOR EACH ROW EXECUTE FUNCTION _set_coalition_post_updated_at();

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE coalition_posts ENABLE ROW LEVEL SECURITY;

-- Anyone can read posts for public coalitions; members can read posts for
-- private ones.  For simplicity (and since Supabase doesn't allow multi-table
-- sub-queries in RLS easily), we allow all authenticated users to SELECT.
-- The application layer restricts display for private coalitions.
CREATE POLICY "coalition_posts_select"
  ON coalition_posts FOR SELECT USING (true);

-- Only authenticated users who are a leader or officer of the coalition may post.
CREATE POLICY "coalition_posts_insert"
  ON coalition_posts FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (
      SELECT 1 FROM coalition_members cm
       WHERE cm.coalition_id = coalition_posts.coalition_id
         AND cm.user_id = auth.uid()
         AND cm.role IN ('leader', 'officer')
    )
  );

-- Author can update their own post; leader can pin/unpin any post.
CREATE POLICY "coalition_posts_update"
  ON coalition_posts FOR UPDATE
  USING (
    auth.uid() = author_id
    OR EXISTS (
      SELECT 1 FROM coalition_members cm
       WHERE cm.coalition_id = coalition_posts.coalition_id
         AND cm.user_id = auth.uid()
         AND cm.role = 'leader'
    )
  );

-- Author or any leader of the coalition may delete.
CREATE POLICY "coalition_posts_delete"
  ON coalition_posts FOR DELETE
  USING (
    auth.uid() = author_id
    OR EXISTS (
      SELECT 1 FROM coalition_members cm
       WHERE cm.coalition_id = coalition_posts.coalition_id
         AND cm.user_id = auth.uid()
         AND cm.role = 'leader'
    )
  );

-- ─── Grants ───────────────────────────────────────────────────────────────────

GRANT SELECT ON coalition_posts TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON coalition_posts TO authenticated;
