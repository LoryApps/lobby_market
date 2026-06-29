-- =============================================================================
-- Lobby Market: Civic Petitions — citizen-initiated democratic action
-- =============================================================================
-- Citizens can draft formal petitions tied to a topic.  When a petition
-- reaches its target signature count before its deadline, it auto-escalates
-- to the relevant committee as a mandatory civic hearing (action_type=hearing),
-- a referendum trigger (action_type=referendum), or an assembly convening
-- request (action_type=assembly).
--
-- Distinct from:
--   civic_hearings      — committee-initiated, chair-led testimony sessions
--   citizens_assemblies — sortition-based deliberation
--   civic_referendums   — direct vote on laws
--   topic_arguments     — free-form debate
--
-- Petitions are citizen-driven escalation.  They represent organised civic
-- demand for formal action on a topic.
-- =============================================================================

CREATE TABLE IF NOT EXISTS civic_petitions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id          UUID        REFERENCES topics(id) ON DELETE SET NULL,
  title             TEXT        NOT NULL CHECK (char_length(title) BETWEEN 10 AND 200),
  description       TEXT        NOT NULL CHECK (char_length(description) BETWEEN 20 AND 2000),
  committee         TEXT        NOT NULL,
  action_type       TEXT        NOT NULL DEFAULT 'hearing'
                    CHECK (action_type IN ('hearing', 'referendum', 'assembly', 'review')),
  creator_id        UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  target_signatures INT         NOT NULL DEFAULT 100 CHECK (target_signatures >= 10),
  signature_count   INT         NOT NULL DEFAULT 0 CHECK (signature_count >= 0),
  status            TEXT        NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'fulfilled', 'expired', 'rejected')),
  outcome_id        UUID,
  closes_at         TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '30 days'),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS civic_petition_signatures (
  petition_id  UUID        NOT NULL REFERENCES civic_petitions(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (petition_id, user_id)
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_civic_petitions_status
  ON civic_petitions (status, closes_at);

CREATE INDEX IF NOT EXISTS idx_civic_petitions_committee
  ON civic_petitions (committee);

CREATE INDEX IF NOT EXISTS idx_civic_petitions_topic
  ON civic_petitions (topic_id) WHERE topic_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_civic_petitions_creator
  ON civic_petitions (creator_id) WHERE creator_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_civic_petition_signatures_user
  ON civic_petition_signatures (user_id);

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE civic_petitions ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic_petition_signatures ENABLE ROW LEVEL SECURITY;

CREATE POLICY "civic_petitions_read"
  ON civic_petitions FOR SELECT USING (true);

CREATE POLICY "civic_petitions_create"
  ON civic_petitions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND creator_id = auth.uid());

CREATE POLICY "civic_petitions_update_status"
  ON civic_petitions FOR UPDATE
  USING (auth.uid() = creator_id OR
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'moderator')
    )
  );

CREATE POLICY "civic_petition_signatures_read"
  ON civic_petition_signatures FOR SELECT USING (true);

CREATE POLICY "civic_petition_signatures_manage"
  ON civic_petition_signatures FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ─── RPC: sign / unsign ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION toggle_petition_signature(p_petition_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id       UUID;
  v_petition      civic_petitions%ROWTYPE;
  v_already_signed BOOLEAN;
  v_new_count     INT;
  v_signed        BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('error', 'not_authenticated');
  END IF;

  SELECT * INTO v_petition
  FROM civic_petitions
  WHERE id = p_petition_id;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'not_found');
  END IF;

  IF v_petition.status <> 'open' THEN
    RETURN json_build_object('error', 'petition_closed');
  END IF;

  IF v_petition.closes_at < now() THEN
    RETURN json_build_object('error', 'petition_expired');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM civic_petition_signatures
    WHERE petition_id = p_petition_id AND user_id = v_user_id
  ) INTO v_already_signed;

  IF v_already_signed THEN
    DELETE FROM civic_petition_signatures
    WHERE petition_id = p_petition_id AND user_id = v_user_id;

    UPDATE civic_petitions
    SET signature_count = GREATEST(0, signature_count - 1)
    WHERE id = p_petition_id
    RETURNING signature_count INTO v_new_count;

    v_signed := FALSE;
  ELSE
    INSERT INTO civic_petition_signatures (petition_id, user_id)
    VALUES (p_petition_id, v_user_id)
    ON CONFLICT DO NOTHING;

    UPDATE civic_petitions
    SET signature_count = signature_count + 1
    WHERE id = p_petition_id
    RETURNING signature_count INTO v_new_count;

    v_signed := TRUE;

    -- Auto-fulfil if target reached
    IF v_new_count >= v_petition.target_signatures THEN
      UPDATE civic_petitions
      SET status = 'fulfilled'
      WHERE id = p_petition_id AND status = 'open';
    END IF;
  END IF;

  RETURN json_build_object(
    'signed', v_signed,
    'signature_count', v_new_count
  );
END;
$$;
