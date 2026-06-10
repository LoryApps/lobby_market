-- =============================================================================
-- Lobby Market: Law Implementation Blueprints
-- =============================================================================
-- Caches Claude-generated implementation plans for established laws.
-- Generated on demand when a user views /law/[id]/blueprint.
-- =============================================================================

CREATE TABLE IF NOT EXISTS law_blueprints (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  law_id         UUID        NOT NULL REFERENCES laws(id) ON DELETE CASCADE,
  blueprint_json JSONB       NOT NULL DEFAULT '{}',
  model          TEXT        NOT NULL DEFAULT 'claude-sonnet-4-6',
  generated_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (law_id)
);

CREATE INDEX IF NOT EXISTS idx_law_blueprints_law
  ON law_blueprints (law_id);

COMMENT ON TABLE law_blueprints IS
  'Claude-generated implementation blueprints for established Codex laws.
   Cached per law; re-generated on demand via /api/laws/[id]/blueprint.';

-- ── Row Level Security ─────────────────────────────────────────────────────────

ALTER TABLE law_blueprints ENABLE ROW LEVEL SECURITY;

CREATE POLICY "law_blueprints_select_public"
  ON law_blueprints FOR SELECT USING (true);

CREATE POLICY "law_blueprints_insert_service"
  ON law_blueprints FOR INSERT
  WITH CHECK (false);

CREATE POLICY "law_blueprints_update_service"
  ON law_blueprints FOR UPDATE
  USING (false);
