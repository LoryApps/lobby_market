-- ─────────────────────────────────────────────────────────────────────────────
-- Migration 00026 · Coalition Stances
--
-- Coalitions can officially declare their stance on an active topic.
-- Each coalition can hold exactly one stance per topic (UNIQUE constraint).
-- Leaders and officers can create/update the stance; anyone can read stances
-- on public coalitions.
-- ─────────────────────────────────────────────────────────────────────────────

-- ---------------------------------------------------------------------------
-- TABLE: coalition_stances
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS coalition_stances (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  coalition_id  UUID        NOT NULL REFERENCES coalitions (id) ON DELETE CASCADE,
  topic_id      UUID        NOT NULL REFERENCES topics (id)     ON DELETE CASCADE,
  stance        TEXT        NOT NULL CHECK (stance IN ('for', 'against', 'neutral')),
  statement     TEXT        CHECK (char_length(statement) <= 500),
  declared_by   UUID        NOT NULL REFERENCES profiles (id),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (coalition_id, topic_id)
);

CREATE INDEX IF NOT EXISTS idx_coalition_stances_topic     ON coalition_stances (topic_id);
CREATE INDEX IF NOT EXISTS idx_coalition_stances_coalition ON coalition_stances (coalition_id);

COMMENT ON TABLE coalition_stances IS
  'Official FOR / AGAINST / NEUTRAL declarations by coalitions on topics';

-- ---------------------------------------------------------------------------
-- Row-Level Security
-- ---------------------------------------------------------------------------

ALTER TABLE coalition_stances ENABLE ROW LEVEL SECURITY;

-- Anyone can read stances whose parent coalition is public
CREATE POLICY "coalition_stances_select" ON coalition_stances
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM coalitions c
      WHERE c.id = coalition_id AND c.is_public = true
    )
    OR
    EXISTS (
      SELECT 1 FROM coalition_members cm
      WHERE cm.coalition_id = coalition_stances.coalition_id
        AND cm.user_id = auth.uid()
    )
  );

-- Only coalition leaders and officers may insert / update stances
CREATE POLICY "coalition_stances_write" ON coalition_stances
  FOR ALL USING (
    EXISTS (
      SELECT 1 FROM coalition_members cm
      WHERE cm.coalition_id = coalition_stances.coalition_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('leader', 'officer')
    )
  );

-- ---------------------------------------------------------------------------
-- Trigger: keep updated_at current
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION update_coalition_stance_updated_at()
  RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_coalition_stances_updated_at
  BEFORE UPDATE ON coalition_stances
  FOR EACH ROW EXECUTE FUNCTION update_coalition_stance_updated_at();
