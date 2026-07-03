-- =============================================================================
-- Lobby Market: Civic Nominations — citizen nomination system for civic roles
-- =============================================================================
-- Citizens can nominate each other for formal platform roles.  Nominations
-- accumulate endorsements; when a nomination hits its threshold the nominee
-- is considered "elected" into that role for a term.
--
-- Roles:
--   grand_council          — Grand Council voting member (top-20 governance)
--   tribunal_judge         — Civic Tribunal judge panel
--   fact_checker           — Platform fact-checker badge
--   debate_moderator       — Licensed debate moderator
--   assembly_rapporteur    — Citizens Assembly facilitator / rapporteur
--
-- Lifecycle:
--   open → endorsed (reaches threshold) → elected
--        → declined (nominee rejects)
--        → expired  (closes_at passed without enough endorsements)
-- =============================================================================

CREATE TABLE IF NOT EXISTS civic_nominations (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  role                TEXT        NOT NULL
                      CHECK (role IN (
                        'grand_council',
                        'tribunal_judge',
                        'fact_checker',
                        'debate_moderator',
                        'assembly_rapporteur'
                      )),
  nominee_id          UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  nominator_id        UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  reason              TEXT        NOT NULL CHECK (char_length(reason) BETWEEN 20 AND 1000),
  endorsement_count   INT         NOT NULL DEFAULT 0 CHECK (endorsement_count >= 0),
  endorsement_target  INT         NOT NULL DEFAULT 10 CHECK (endorsement_target >= 3),
  status              TEXT        NOT NULL DEFAULT 'open'
                      CHECK (status IN ('open', 'elected', 'declined', 'expired')),
  closes_at           TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '14 days'),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  -- A person can only have one OPEN nomination per role at a time
  CONSTRAINT unique_open_nomination UNIQUE NULLS NOT DISTINCT (nominee_id, role, status)
);

CREATE TABLE IF NOT EXISTS civic_nomination_endorsements (
  nomination_id UUID        NOT NULL REFERENCES civic_nominations(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (nomination_id, user_id)
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_civic_nominations_role_status
  ON civic_nominations (role, status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_civic_nominations_nominee
  ON civic_nominations (nominee_id, status);

CREATE INDEX IF NOT EXISTS idx_civic_nomination_endorsements_nomination
  ON civic_nomination_endorsements (nomination_id);

-- ─── Trigger: keep endorsement_count in sync ──────────────────────────────────

CREATE OR REPLACE FUNCTION update_nomination_endorsement_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE civic_nominations
    SET
      endorsement_count = endorsement_count + 1,
      status = CASE
        WHEN endorsement_count + 1 >= endorsement_target THEN 'elected'
        ELSE status
      END
    WHERE id = NEW.nomination_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE civic_nominations
    SET endorsement_count = GREATEST(0, endorsement_count - 1)
    WHERE id = OLD.nomination_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_nomination_endorsement_count ON civic_nomination_endorsements;
CREATE TRIGGER trg_nomination_endorsement_count
AFTER INSERT OR DELETE ON civic_nomination_endorsements
FOR EACH ROW EXECUTE FUNCTION update_nomination_endorsement_count();

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE civic_nominations ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic_nomination_endorsements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "nominations_public_read"   ON civic_nominations;
DROP POLICY IF EXISTS "nominations_auth_insert"   ON civic_nominations;
DROP POLICY IF EXISTS "endorsements_public_read"  ON civic_nomination_endorsements;
DROP POLICY IF EXISTS "endorsements_auth_insert"  ON civic_nomination_endorsements;
DROP POLICY IF EXISTS "endorsements_auth_delete"  ON civic_nomination_endorsements;

CREATE POLICY "nominations_public_read"
  ON civic_nominations FOR SELECT USING (true);

CREATE POLICY "nominations_auth_insert"
  ON civic_nominations FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = nominator_id);

CREATE POLICY "endorsements_public_read"
  ON civic_nomination_endorsements FOR SELECT USING (true);

CREATE POLICY "endorsements_auth_insert"
  ON civic_nomination_endorsements FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "endorsements_auth_delete"
  ON civic_nomination_endorsements FOR DELETE
  USING (auth.uid() = user_id);
