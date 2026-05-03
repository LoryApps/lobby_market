-- =============================================================================
-- Lobby Market: Civic Archetype persistence
-- =============================================================================
-- Stores the result of each user's Civic Archetype quiz on their profile row.
-- The archetype is computed client-side; this migration adds the columns so
-- the result can be persisted and displayed on public profiles.
-- =============================================================================

-- ── 1. Add columns to profiles ───────────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS civic_archetype TEXT
    CHECK (civic_archetype IN (
      'pragmatist', 'idealist', 'guardian', 'reformer',
      'libertarian', 'communitarian', 'technocrat', 'democrat'
    )),
  ADD COLUMN IF NOT EXISTS archetype_set_at TIMESTAMPTZ;

-- ── 2. Index for distribution stats ─────────────────────────────────────────

CREATE INDEX IF NOT EXISTS profiles_civic_archetype_idx
  ON profiles (civic_archetype)
  WHERE civic_archetype IS NOT NULL;
