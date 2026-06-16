-- =============================================================================
-- Lobby Market: Coalition Constitution — formal founding charters
-- =============================================================================
-- Each coalition can author a markdown constitution defining their values,
-- governance, and policy positions. Leaders edit it; everyone can read it.
-- Revision history is stored for transparency.
-- =============================================================================

-- Add constitution column to coalitions
ALTER TABLE coalitions
  ADD COLUMN IF NOT EXISTS constitution_md   TEXT,
  ADD COLUMN IF NOT EXISTS constitution_updated_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS constitution_updated_by UUID REFERENCES profiles(id) ON DELETE SET NULL;

-- Revision history table
CREATE TABLE IF NOT EXISTS coalition_constitution_revisions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  coalition_id    UUID        NOT NULL REFERENCES coalitions(id) ON DELETE CASCADE,
  author_id       UUID        NOT NULL REFERENCES profiles(id)   ON DELETE CASCADE,
  body_md         TEXT        NOT NULL,
  edit_summary    TEXT        CHECK (char_length(edit_summary) <= 200),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_ccr_coalition
  ON coalition_constitution_revisions (coalition_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ccr_author
  ON coalition_constitution_revisions (author_id);

-- ── Row Level Security ─────────────────────────────────────────────────────────

ALTER TABLE coalition_constitution_revisions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ccr_select_public"
  ON coalition_constitution_revisions FOR SELECT USING (true);

CREATE POLICY "ccr_insert_auth"
  ON coalition_constitution_revisions FOR INSERT
  WITH CHECK (auth.uid() = author_id);

COMMENT ON TABLE coalition_constitution_revisions IS
  'Revision history for coalition constitutions. Every save appends a new row.
   The current constitution is stored denormalised on coalitions.constitution_md.';
