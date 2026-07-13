-- =============================================================================
-- Lobby Market: Civic Supply Day — Opposition-tabled parliamentary motions
-- =============================================================================
-- In the Westminster system, "Supply Days" (now called Opposition Days) are
-- parliamentary sessions where opposition parties choose the topic of debate.
-- There are 20 such days per session; the opposition uses them to challenge
-- government policy, call emergency debates, or pass motions of censure.
--
-- For Lobby Market:
--   • Any coalition not in government can table a Supply Day motion.
--   • Motions target a specific civic topic and state the type of action sought.
--   • Citizens endorse motions; when the target is reached, the motion is
--     "granted" and appears on the Floor as a priority debate.
--   • The governing coalition may formally respond to any motion.
--
-- Motion types:
--   debate          — request a full floor debate on the topic
--   urgent_question — demand an urgent government statement
--   censure         — formal vote of no confidence in government position
--   division        — call for an immediate binding division
-- =============================================================================

CREATE TABLE IF NOT EXISTS supply_day_motions (
  id                    UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  coalition_id          UUID        NOT NULL REFERENCES coalitions(id) ON DELETE CASCADE,
  topic_id              UUID        REFERENCES topics(id) ON DELETE SET NULL,
  tabled_by             UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  title                 TEXT        NOT NULL CHECK (char_length(title) BETWEEN 10 AND 200),
  urgency_statement     TEXT        NOT NULL CHECK (char_length(urgency_statement) BETWEEN 30 AND 2000),
  motion_type           TEXT        NOT NULL DEFAULT 'debate'
                        CHECK (motion_type IN ('debate', 'urgent_question', 'censure', 'division')),

  endorsement_count     INT         NOT NULL DEFAULT 0 CHECK (endorsement_count >= 0),
  endorsement_target    INT         NOT NULL DEFAULT 20 CHECK (endorsement_target >= 5),

  status                TEXT        NOT NULL DEFAULT 'tabled'
                        CHECK (status IN ('tabled', 'granted', 'denied', 'withdrawn')),

  government_response   TEXT        CHECK (char_length(government_response) <= 3000),
  responded_by          UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  responded_at          TIMESTAMPTZ,

  closes_at             TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  created_at            TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS supply_day_endorsements (
  motion_id     UUID        NOT NULL REFERENCES supply_day_motions(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (motion_id, user_id)
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_supply_day_motions_status
  ON supply_day_motions (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_supply_day_motions_coalition
  ON supply_day_motions (coalition_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_supply_day_motions_topic
  ON supply_day_motions (topic_id);

CREATE INDEX IF NOT EXISTS idx_supply_day_endorsements_motion
  ON supply_day_endorsements (motion_id);

CREATE INDEX IF NOT EXISTS idx_supply_day_endorsements_user
  ON supply_day_endorsements (user_id);

-- ─── Trigger: keep endorsement_count in sync ──────────────────────────────────

CREATE OR REPLACE FUNCTION update_supply_day_endorsement_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE supply_day_motions
    SET
      endorsement_count = endorsement_count + 1,
      status = CASE
        WHEN endorsement_count + 1 >= endorsement_target AND status = 'tabled' THEN 'granted'
        ELSE status
      END
    WHERE id = NEW.motion_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE supply_day_motions
    SET endorsement_count = GREATEST(0, endorsement_count - 1)
    WHERE id = OLD.motion_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_supply_day_endorsement_count ON supply_day_endorsements;
CREATE TRIGGER trg_supply_day_endorsement_count
AFTER INSERT OR DELETE ON supply_day_endorsements
FOR EACH ROW EXECUTE FUNCTION update_supply_day_endorsement_count();

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE supply_day_motions ENABLE ROW LEVEL SECURITY;
ALTER TABLE supply_day_endorsements ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "supply_day_motions_public_read"  ON supply_day_motions;
DROP POLICY IF EXISTS "supply_day_motions_auth_insert"  ON supply_day_motions;
DROP POLICY IF EXISTS "supply_day_motions_auth_update"  ON supply_day_motions;
DROP POLICY IF EXISTS "supply_day_endorsements_public_read" ON supply_day_endorsements;
DROP POLICY IF EXISTS "supply_day_endorsements_auth_insert" ON supply_day_endorsements;
DROP POLICY IF EXISTS "supply_day_endorsements_auth_delete" ON supply_day_endorsements;

CREATE POLICY "supply_day_motions_public_read"
  ON supply_day_motions FOR SELECT USING (true);

CREATE POLICY "supply_day_motions_auth_insert"
  ON supply_day_motions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = tabled_by);

CREATE POLICY "supply_day_motions_auth_update"
  ON supply_day_motions FOR UPDATE
  USING (auth.uid() = tabled_by OR auth.uid() = responded_by);

CREATE POLICY "supply_day_endorsements_public_read"
  ON supply_day_endorsements FOR SELECT USING (true);

CREATE POLICY "supply_day_endorsements_auth_insert"
  ON supply_day_endorsements FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "supply_day_endorsements_auth_delete"
  ON supply_day_endorsements FOR DELETE
  USING (auth.uid() = user_id);
