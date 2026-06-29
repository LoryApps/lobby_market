-- =============================================================================
-- Lobby Market Ch. 419: Civic Appeals Panel
-- =============================================================================
-- The Appeals Panel is the final civic recourse tier above the Ombudsman.
-- Citizens can formally appeal decisions made by:
--   ombudsman   — a dismissed / upheld Ombudsman finding
--   council     — a Grand Council motion outcome
--   moderation  — a moderation action (ban, post removal, demotion)
--   vote        — a disputed topic vote result
--
-- Appeals are reviewed by a rotating panel of three senior citizens (trust ≥ 50)
-- who were not involved in the original decision.  Panel members cast yes/no
-- votes; a 2-of-3 majority grants or denies the appeal.  Granted appeals
-- trigger a formal re-review of the original decision.
--
-- Distinct from:
--   ombudsman_cases    — first-tier complaint filing (open to everyone)
--   grand_council      — legislative motions
--   tribunal           — argument quality review
-- =============================================================================

-- ─── Appeal types ─────────────────────────────────────────────────────────────

-- ombudsman  — contest the finding of an Ombudsman case
-- council    — contest the outcome of a Grand Council motion
-- moderation — contest a moderation action against the appellant
-- vote       — contest a disputed topic vote result

-- ─── Appeal status ────────────────────────────────────────────────────────────

-- pending   — filed, awaiting panel assignment
-- reviewing — panel assigned, deliberating
-- granted   — majority panel vote to grant (original decision re-reviewed)
-- denied    — majority panel vote to deny
-- withdrawn — appellant withdrew before panel voted

CREATE TABLE IF NOT EXISTS civic_appeals (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  appeal_number   TEXT        UNIQUE NOT NULL,          -- AP-YYYY-NNNN
  appeal_type     TEXT        NOT NULL
                  CHECK (appeal_type IN ('ombudsman', 'council', 'moderation', 'vote')),
  -- The original decision being appealed
  target_type     TEXT        NOT NULL,                 -- table name or entity type
  target_id       UUID,                                 -- row id in that table
  target_label    TEXT        CHECK (char_length(target_label) <= 300), -- human-readable label
  -- Appellant
  appellant_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- Appeal grounds and statement
  grounds         TEXT        NOT NULL
                  CHECK (grounds IN ('procedural_error', 'new_evidence', 'bias', 'disproportionate', 'other')),
  statement       TEXT        NOT NULL CHECK (char_length(statement) BETWEEN 80 AND 2000),
  -- Panel votes (stored as counts; panel members identified separately)
  votes_for       INT         NOT NULL DEFAULT 0 CHECK (votes_for   >= 0 AND votes_for   <= 3),
  votes_against   INT         NOT NULL DEFAULT 0 CHECK (votes_against >= 0 AND votes_against <= 3),
  votes_abstain   INT         NOT NULL DEFAULT 0 CHECK (votes_abstain >= 0 AND votes_abstain <= 3),
  -- Outcome
  status          TEXT        NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'reviewing', 'granted', 'denied', 'withdrawn')),
  panel_decision  TEXT        CHECK (char_length(panel_decision) <= 1500),
  -- Support from the gallery
  support_count   INT         NOT NULL DEFAULT 0 CHECK (support_count >= 0),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at     TIMESTAMPTZ,
  CONSTRAINT appeals_decision_requires_votes
    CHECK (panel_decision IS NULL OR (votes_for + votes_against + votes_abstain) > 0)
);

-- Sequence for appeal numbers
CREATE SEQUENCE IF NOT EXISTS civic_appeal_seq START 1;

CREATE OR REPLACE FUNCTION generate_appeal_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_year TEXT;
  v_seq  INT;
BEGIN
  v_year := to_char(now(), 'YYYY');
  v_seq  := nextval('civic_appeal_seq');
  RETURN 'AP-' || v_year || '-' || lpad(v_seq::TEXT, 4, '0');
END;
$$;

CREATE OR REPLACE FUNCTION set_appeal_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.appeal_number IS NULL OR NEW.appeal_number = '' THEN
    NEW.appeal_number := generate_appeal_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER civic_appeals_set_number
  BEFORE INSERT ON civic_appeals
  FOR EACH ROW EXECUTE FUNCTION set_appeal_number();

-- Public support (gallery backing for an appeal)
CREATE TABLE IF NOT EXISTS civic_appeal_support (
  appeal_id  UUID        NOT NULL REFERENCES civic_appeals(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (appeal_id, user_id)
);

-- Public submissions (amicus-style statements from the gallery)
CREATE TABLE IF NOT EXISTS civic_appeal_submissions (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  appeal_id  UUID        NOT NULL REFERENCES civic_appeals(id) ON DELETE CASCADE,
  author_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stance     TEXT        NOT NULL DEFAULT 'neutral'
             CHECK (stance IN ('supporting', 'opposing', 'neutral')),
  content    TEXT        NOT NULL CHECK (char_length(content) BETWEEN 20 AND 800),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_civic_appeals_status
  ON civic_appeals (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_civic_appeals_appellant
  ON civic_appeals (appellant_id);

CREATE INDEX IF NOT EXISTS idx_civic_appeals_type
  ON civic_appeals (appeal_type, status);

CREATE INDEX IF NOT EXISTS idx_civic_appeal_submissions_appeal
  ON civic_appeal_submissions (appeal_id, created_at);

CREATE INDEX IF NOT EXISTS idx_civic_appeal_support_user
  ON civic_appeal_support (user_id);

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE civic_appeals            ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic_appeal_support     ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic_appeal_submissions ENABLE ROW LEVEL SECURITY;

-- Appeals are fully public
CREATE POLICY "civic_appeals_read"
  ON civic_appeals FOR SELECT USING (true);

-- Any authenticated user can file an appeal
CREATE POLICY "civic_appeals_insert"
  ON civic_appeals FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND appellant_id = auth.uid());

-- Appellant can withdraw; admins/moderators can update status + decision
CREATE POLICY "civic_appeals_update"
  ON civic_appeals FOR UPDATE
  USING (
    auth.uid() = appellant_id
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

CREATE POLICY "civic_appeal_support_read"
  ON civic_appeal_support FOR SELECT USING (true);

CREATE POLICY "civic_appeal_support_manage"
  ON civic_appeal_support FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "civic_appeal_submissions_read"
  ON civic_appeal_submissions FOR SELECT USING (true);

CREATE POLICY "civic_appeal_submissions_insert"
  ON civic_appeal_submissions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND author_id = auth.uid());

-- ─── RPC: toggle gallery support ──────────────────────────────────────────────

CREATE OR REPLACE FUNCTION toggle_appeal_support(p_appeal_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id     UUID;
  v_appeal_status TEXT;
  v_already     BOOLEAN;
  v_new_count   INT;
  v_supported   BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('error', 'not_authenticated');
  END IF;

  SELECT status INTO v_appeal_status
  FROM civic_appeals WHERE id = p_appeal_id;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'not_found');
  END IF;

  IF v_appeal_status NOT IN ('pending', 'reviewing') THEN
    RETURN json_build_object('error', 'appeal_closed');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM civic_appeal_support
    WHERE appeal_id = p_appeal_id AND user_id = v_user_id
  ) INTO v_already;

  IF v_already THEN
    DELETE FROM civic_appeal_support
    WHERE appeal_id = p_appeal_id AND user_id = v_user_id;

    UPDATE civic_appeals
    SET support_count = GREATEST(0, support_count - 1)
    WHERE id = p_appeal_id
    RETURNING support_count INTO v_new_count;

    v_supported := FALSE;
  ELSE
    INSERT INTO civic_appeal_support (appeal_id, user_id)
    VALUES (p_appeal_id, v_user_id)
    ON CONFLICT DO NOTHING;

    UPDATE civic_appeals
    SET support_count = support_count + 1
    WHERE id = p_appeal_id
    RETURNING support_count INTO v_new_count;

    v_supported := TRUE;
  END IF;

  RETURN json_build_object(
    'supported', v_supported,
    'support_count', v_new_count
  );
END;
$$;
