-- =============================================================================
-- Lobby Market: Civic Crossroads
-- =============================================================================
-- Weekly civic values dilemma game. Each week a new "Crossroads" is presented:
-- two fundamental civic values in direct tension. Users pick one. The community
-- results reveal where the Lobby stands on core philosophical divides.
--
-- Tables:
--   crossroads_votes  — one row per user per dilemma_id (weekly slug)
-- =============================================================================

-- ── 1. Votes table ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS crossroads_votes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  dilemma_id  TEXT        NOT NULL CHECK (char_length(dilemma_id) BETWEEN 1 AND 64),
  choice      TEXT        NOT NULL CHECK (choice IN ('A', 'B')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- One vote per user per dilemma
  UNIQUE (user_id, dilemma_id)
);

-- ── 2. Indexes ────────────────────────────────────────────────────────────────

-- Fast aggregation per dilemma
CREATE INDEX IF NOT EXISTS idx_crossroads_dilemma
  ON crossroads_votes (dilemma_id, choice);

-- Fast lookup per user
CREATE INDEX IF NOT EXISTS idx_crossroads_user
  ON crossroads_votes (user_id, dilemma_id);

-- ── 3. Row Level Security ─────────────────────────────────────────────────────

ALTER TABLE crossroads_votes ENABLE ROW LEVEL SECURITY;

-- Anyone can read aggregate votes
CREATE POLICY "crossroads_select_public"
  ON crossroads_votes FOR SELECT
  USING (true);

-- Authenticated users can insert their own votes
CREATE POLICY "crossroads_insert_own"
  ON crossroads_votes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users cannot change their choice (delete not allowed either)
