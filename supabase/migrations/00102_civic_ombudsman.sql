-- =============================================================================
-- Lobby Market: Civic Ombudsman — independent complaints & findings authority
-- =============================================================================
-- The Civic Ombudsman is an independent oversight body separate from the
-- moderation team and the Grand Council.  Any citizen can file a formal
-- complaint about a civic process, a community decision, or a perceived
-- breach of civic norms.  Ombudsman officers review submissions and publish
-- formal findings (upheld / dismissed / referred).
--
-- Distinct from:
--   moderation / reports  — content-level violations (spam, abuse, ban)
--   tribunal              — argument quality review
--   grand_council motions — governance proposals
--   civic_hearings        — pre-vote committee testimony
--
-- The Ombudsman is about process fairness and civic integrity, not content
-- moderation.  Findings are non-punitive but publicly visible.
-- =============================================================================

-- ─── Case categories ──────────────────────────────────────────────────────────

-- process_fairness  — complaint about how a vote/hearing/assembly was conducted
-- decision_appeal   — formal appeal of a committee recommendation or council motion
-- bias_report       — allegations of systemic bias in outcomes
-- norm_breach       — violation of community norms without a content violation
-- transparency      — demand for information about a civic decision
-- other             — anything else

CREATE TABLE IF NOT EXISTS ombudsman_cases (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  case_number      TEXT        UNIQUE NOT NULL,   -- OM-YYYY-NNNN
  category         TEXT        NOT NULL
                   CHECK (category IN (
                     'process_fairness', 'decision_appeal', 'bias_report',
                     'norm_breach', 'transparency', 'other'
                   )),
  title            TEXT        NOT NULL CHECK (char_length(title) BETWEEN 10 AND 200),
  description      TEXT        NOT NULL CHECK (char_length(description) BETWEEN 50 AND 3000),
  complainant_id   UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  respondent_type  TEXT        CHECK (respondent_type IN (
                     'user', 'committee', 'council', 'assembly', 'platform', NULL
                   )),
  respondent_id    UUID,       -- user id if respondent_type = 'user'
  topic_id         UUID        REFERENCES topics(id) ON DELETE SET NULL,
  status           TEXT        NOT NULL DEFAULT 'open'
                   CHECK (status IN ('open', 'under_review', 'upheld', 'dismissed', 'referred', 'withdrawn')),
  finding          TEXT        CHECK (char_length(finding) <= 2000),
  officer_id       UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  support_count    INT         NOT NULL DEFAULT 0 CHECK (support_count >= 0),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at      TIMESTAMPTZ,
  CONSTRAINT ombudsman_finding_requires_officer
    CHECK (finding IS NULL OR officer_id IS NOT NULL)
);

-- Sequence for case numbers (NNNN part)
CREATE SEQUENCE IF NOT EXISTS ombudsman_case_seq START 1;

-- Function to generate case numbers like OM-2026-0001
CREATE OR REPLACE FUNCTION generate_case_number()
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_year TEXT;
  v_seq  INT;
BEGIN
  v_year := to_char(now(), 'YYYY');
  v_seq  := nextval('ombudsman_case_seq');
  RETURN 'OM-' || v_year || '-' || lpad(v_seq::TEXT, 4, '0');
END;
$$;

-- Trigger to auto-fill case_number on insert
CREATE OR REPLACE FUNCTION set_case_number()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.case_number IS NULL OR NEW.case_number = '' THEN
    NEW.case_number := generate_case_number();
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER ombudsman_cases_set_case_number
  BEFORE INSERT ON ombudsman_cases
  FOR EACH ROW EXECUTE FUNCTION set_case_number();

-- Citizens who publicly support a case (similar to signing a petition)
CREATE TABLE IF NOT EXISTS ombudsman_case_support (
  case_id    UUID        NOT NULL REFERENCES ombudsman_cases(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (case_id, user_id)
);

-- Public statements attached to a case (complainant updates, officer queries,
-- observer notes)
CREATE TABLE IF NOT EXISTS ombudsman_statements (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  case_id    UUID        NOT NULL REFERENCES ombudsman_cases(id) ON DELETE CASCADE,
  author_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  role       TEXT        NOT NULL DEFAULT 'observer'
             CHECK (role IN ('complainant', 'officer', 'observer')),
  content    TEXT        NOT NULL CHECK (char_length(content) BETWEEN 10 AND 1000),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_ombudsman_cases_status
  ON ombudsman_cases (status, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_ombudsman_cases_complainant
  ON ombudsman_cases (complainant_id) WHERE complainant_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ombudsman_cases_topic
  ON ombudsman_cases (topic_id) WHERE topic_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_ombudsman_statements_case
  ON ombudsman_statements (case_id, created_at);

CREATE INDEX IF NOT EXISTS idx_ombudsman_support_user
  ON ombudsman_case_support (user_id);

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE ombudsman_cases         ENABLE ROW LEVEL SECURITY;
ALTER TABLE ombudsman_case_support  ENABLE ROW LEVEL SECURITY;
ALTER TABLE ombudsman_statements    ENABLE ROW LEVEL SECURITY;

-- Cases are public
CREATE POLICY "ombudsman_cases_read"
  ON ombudsman_cases FOR SELECT USING (true);

-- Any authenticated user can file a case
CREATE POLICY "ombudsman_cases_insert"
  ON ombudsman_cases FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND complainant_id = auth.uid());

-- Complainant can withdraw their own open case; officers/admins can update status
CREATE POLICY "ombudsman_cases_update"
  ON ombudsman_cases FOR UPDATE
  USING (
    auth.uid() = complainant_id
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'moderator')
    )
  );

CREATE POLICY "ombudsman_support_read"
  ON ombudsman_case_support FOR SELECT USING (true);

CREATE POLICY "ombudsman_support_manage"
  ON ombudsman_case_support FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ombudsman_statements_read"
  ON ombudsman_statements FOR SELECT USING (true);

CREATE POLICY "ombudsman_statements_insert"
  ON ombudsman_statements FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND author_id = auth.uid());

-- ─── RPC: toggle support ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION toggle_ombudsman_support(p_case_id UUID)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_user_id      UUID;
  v_case_status  TEXT;
  v_already      BOOLEAN;
  v_new_count    INT;
  v_supported    BOOLEAN;
BEGIN
  v_user_id := auth.uid();
  IF v_user_id IS NULL THEN
    RETURN json_build_object('error', 'not_authenticated');
  END IF;

  SELECT status INTO v_case_status
  FROM ombudsman_cases WHERE id = p_case_id;

  IF NOT FOUND THEN
    RETURN json_build_object('error', 'not_found');
  END IF;

  IF v_case_status NOT IN ('open', 'under_review') THEN
    RETURN json_build_object('error', 'case_closed');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM ombudsman_case_support
    WHERE case_id = p_case_id AND user_id = v_user_id
  ) INTO v_already;

  IF v_already THEN
    DELETE FROM ombudsman_case_support
    WHERE case_id = p_case_id AND user_id = v_user_id;

    UPDATE ombudsman_cases
    SET support_count = GREATEST(0, support_count - 1)
    WHERE id = p_case_id
    RETURNING support_count INTO v_new_count;

    v_supported := FALSE;
  ELSE
    INSERT INTO ombudsman_case_support (case_id, user_id)
    VALUES (p_case_id, v_user_id)
    ON CONFLICT DO NOTHING;

    UPDATE ombudsman_cases
    SET support_count = support_count + 1
    WHERE id = p_case_id
    RETURNING support_count INTO v_new_count;

    v_supported := TRUE;
  END IF;

  RETURN json_build_object(
    'supported', v_supported,
    'support_count', v_new_count
  );
END;
$$;
