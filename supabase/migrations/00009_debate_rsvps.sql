-- =============================================================================
-- Lobby Market: Debate RSVPs
-- =============================================================================
-- Spectator attendance tracking for scheduled debates.
-- Users can RSVP to a debate to signal intent to watch and get a count shown
-- on the debate card / arena before it goes live.
-- =============================================================================

CREATE TABLE IF NOT EXISTS debate_rsvps (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id  UUID        NOT NULL REFERENCES debates(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (debate_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_debate_rsvps_debate ON debate_rsvps (debate_id);
CREATE INDEX IF NOT EXISTS idx_debate_rsvps_user   ON debate_rsvps (user_id);

-- ── Row Level Security ─────────────────────────────────────────────────────────

ALTER TABLE debate_rsvps ENABLE ROW LEVEL SECURITY;

-- Anyone (including anon) can read RSVP counts.
CREATE POLICY "debate_rsvps_select_public"
  ON debate_rsvps FOR SELECT USING (true);

-- Authenticated users can insert their own RSVP.
CREATE POLICY "debate_rsvps_insert_own"
  ON debate_rsvps FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete (cancel) their own RSVP.
CREATE POLICY "debate_rsvps_delete_own"
  ON debate_rsvps FOR DELETE
  USING (auth.uid() = user_id);
