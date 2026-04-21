-- =============================================================================
-- Lobby Market: Argument Bookmarks
-- =============================================================================
-- Lets users save individual arguments (FOR / AGAINST) to a personal
-- reading list, separate from topic bookmarks.
-- =============================================================================

-- ── Table ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS argument_bookmarks (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  argument_id UUID NOT NULL REFERENCES topic_arguments(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, argument_id)
);

-- ── Indexes ───────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS argument_bookmarks_user_id_idx
  ON argument_bookmarks (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS argument_bookmarks_argument_id_idx
  ON argument_bookmarks (argument_id);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE argument_bookmarks ENABLE ROW LEVEL SECURITY;

-- Users can only see their own bookmarks
CREATE POLICY "Users can view own argument bookmarks"
  ON argument_bookmarks FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own bookmarks
CREATE POLICY "Users can insert own argument bookmarks"
  ON argument_bookmarks FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own bookmarks
CREATE POLICY "Users can delete own argument bookmarks"
  ON argument_bookmarks FOR DELETE
  USING (auth.uid() = user_id);
