-- =============================================================================
-- Lobby Market: Civic Select Committees
-- =============================================================================
-- Standing committees that permanently scrutinise specific policy areas.
-- Committees are SEEDED (predefined by name/area) and persist forever.
-- The chair is automatically the highest-reputation user in that category.
--
-- Citizens can:
--   • Follow a committee (subscribe to its work)
--   • Submit written evidence to an inquiry (links a topic/argument)
--   • React to committee findings
-- =============================================================================

CREATE TABLE IF NOT EXISTS civic_committees (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT        UNIQUE NOT NULL,          -- e.g. 'home-affairs'
  name            TEXT        NOT NULL,                 -- e.g. 'Home Affairs'
  policy_area     TEXT        NOT NULL,                 -- category e.g. 'Politics'
  description     TEXT        NOT NULL,
  remit           TEXT        NOT NULL,                 -- formal terms of reference
  icon            TEXT        NOT NULL DEFAULT 'scale', -- lucide icon name
  colour          TEXT        NOT NULL DEFAULT '#3b82f6',
  chair_id        UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  member_count    INT         NOT NULL DEFAULT 0,
  inquiry_count   INT         NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Committee inquiries — each inquiry examines a specific topic or question
CREATE TABLE IF NOT EXISTS committee_inquiries (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  committee_id    UUID        NOT NULL REFERENCES civic_committees(id) ON DELETE CASCADE,
  title           TEXT        NOT NULL,
  terms           TEXT        NOT NULL,  -- terms of reference
  status          TEXT        NOT NULL DEFAULT 'open'
                              CHECK (status IN ('open','closed','reported')),
  topic_id        UUID        REFERENCES topics(id) ON DELETE SET NULL,
  evidence_count  INT         NOT NULL DEFAULT 0,
  opened_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  closed_at       TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Submitted evidence — citizens link their arguments or sources as evidence
CREATE TABLE IF NOT EXISTS committee_evidence (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  inquiry_id      UUID        NOT NULL REFERENCES committee_inquiries(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  argument_id     UUID        REFERENCES arguments(id) ON DELETE SET NULL,
  topic_id        UUID        REFERENCES topics(id) ON DELETE SET NULL,
  summary         TEXT        NOT NULL,    -- brief statement of what the evidence shows
  position        TEXT        NOT NULL DEFAULT 'neutral'
                              CHECK (position IN ('for','against','neutral')),
  upvote_count    INT         NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (inquiry_id, user_id)             -- one submission per citizen per inquiry
);

-- Committee memberships (citizens who follow a committee)
CREATE TABLE IF NOT EXISTS committee_members (
  committee_id    UUID        NOT NULL REFERENCES civic_committees(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at       TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (committee_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_committee_inquiries_committee ON committee_inquiries(committee_id);
CREATE INDEX IF NOT EXISTS idx_committee_inquiries_status ON committee_inquiries(status);
CREATE INDEX IF NOT EXISTS idx_committee_evidence_inquiry ON committee_evidence(inquiry_id);
CREATE INDEX IF NOT EXISTS idx_committee_evidence_user ON committee_evidence(user_id);
CREATE INDEX IF NOT EXISTS idx_committee_members_user ON committee_members(user_id);

-- RLS
ALTER TABLE civic_committees ENABLE ROW LEVEL SECURITY;
ALTER TABLE committee_inquiries ENABLE ROW LEVEL SECURITY;
ALTER TABLE committee_evidence ENABLE ROW LEVEL SECURITY;
ALTER TABLE committee_members ENABLE ROW LEVEL SECURITY;

CREATE POLICY "committees_read_all"
  ON civic_committees FOR SELECT USING (true);

CREATE POLICY "inquiries_read_all"
  ON committee_inquiries FOR SELECT USING (true);

CREATE POLICY "evidence_read_all"
  ON committee_evidence FOR SELECT USING (true);

CREATE POLICY "evidence_insert_auth"
  ON committee_evidence FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "members_read_all"
  ON committee_members FOR SELECT USING (true);

CREATE POLICY "members_insert_auth"
  ON committee_members FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);

CREATE POLICY "members_delete_own"
  ON committee_members FOR DELETE
  USING (auth.uid() = user_id);

-- Seed the 10 standing committees (one per policy category)
INSERT INTO civic_committees (slug, name, policy_area, description, remit, icon, colour) VALUES
  ('home-affairs',     'Home Affairs Committee',      'Politics',     'Scrutinises the work of the Home Office and matters relating to governance, law, and the democratic process.',                                    'To examine the administration, expenditure and policy of civic governance bodies and related bodies.',                     'landmark',    '#3b82f6'),
  ('treasury',         'Treasury Select Committee',   'Economics',    'Examines the expenditure, administration and policy of HM Treasury and subordinate departments.',                                               'To scrutinise economic policy, fiscal discipline, and the long-term financial stewardship of the Lobby.',                  'trending-up', '#c9a84c'),
  ('science-tech',     'Science & Technology Committee','Technology',  'Scrutinises technology policy, digital rights, AI governance, and the civic implications of emerging technologies.',                           'To examine the impact of technology on civic life and hold technological actors to democratic account.',                    'cpu',         '#a855f7'),
  ('science-research', 'Science & Research Committee','Science',      'Examines scientific evidence, research policy, and the role of evidence in forming civic consensus.',                                           'To ensure that scientific integrity informs civic debate and that research is freely accessible to all citizens.',          'flask-conical','#10b981'),
  ('ethics',           'Ethics & Standards Committee','Ethics',       'Scrutinises questions of civic ethics, standards in public life, and the moral dimensions of platform governance.',                            'To uphold standards of integrity in civic discourse and hold all participants to a shared code of conduct.',               'scale',       '#ef4444'),
  ('philosophy',       'Philosophy & Ideas Committee','Philosophy',   'Examines foundational questions of political philosophy, civic values, and the intellectual frameworks behind policy positions.',                'To enrich civic debate through philosophical rigour and ensure that first principles are never lost in partisan argument.',  'book-open',   '#6366f1'),
  ('culture',          'Culture, Media & Sport Committee','Culture',  'Scrutinises policy related to culture, creative industries, media plurality, and civil society.',                                               'To protect freedom of expression and ensure that cultural life flourishes within democratic norms.',                        'music-2',     '#ec4899'),
  ('health',           'Health & Social Care Committee','Health',     'Examines health policy, the social care system, public health, and the science behind medical civic debate.',                                   'To ensure all health policy is evidence-based and that health equity is the guiding principle of civic decision-making.',  'heart',       '#f43f5e'),
  ('environment',      'Environment & Climate Committee','Environment','Scrutinises environmental regulation, climate commitments, and the long-term sustainability of civic policy.',                                  'To hold civic debate to its environmental commitments and ensure that future generations have a voice in the Lobby.',       'leaf',        '#22c55e'),
  ('education',        'Education Select Committee',  'Education',    'Examines education policy, civic literacy, access to knowledge, and the role of learning in democratic participation.',                        'To champion civic education and ensure that every citizen has the knowledge to participate meaningfully in democracy.',     'graduation-cap','#f59e0b')
ON CONFLICT (slug) DO NOTHING;

-- Trigger to keep member_count in sync
CREATE OR REPLACE FUNCTION update_committee_member_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE civic_committees SET member_count = member_count + 1 WHERE id = NEW.committee_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE civic_committees SET member_count = member_count - 1 WHERE id = OLD.committee_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_committee_member_count ON committee_members;
CREATE TRIGGER trg_committee_member_count
  AFTER INSERT OR DELETE ON committee_members
  FOR EACH ROW EXECUTE FUNCTION update_committee_member_count();

-- Trigger to keep inquiry_count in sync
CREATE OR REPLACE FUNCTION update_committee_inquiry_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE civic_committees SET inquiry_count = inquiry_count + 1 WHERE id = NEW.committee_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE civic_committees SET inquiry_count = inquiry_count - 1 WHERE id = OLD.committee_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_committee_inquiry_count ON committee_inquiries;
CREATE TRIGGER trg_committee_inquiry_count
  AFTER INSERT OR DELETE ON committee_inquiries
  FOR EACH ROW EXECUTE FUNCTION update_committee_inquiry_count();

-- Trigger to keep evidence_count in sync
CREATE OR REPLACE FUNCTION update_inquiry_evidence_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE committee_inquiries SET evidence_count = evidence_count + 1 WHERE id = NEW.inquiry_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE committee_inquiries SET evidence_count = evidence_count - 1 WHERE id = OLD.inquiry_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_inquiry_evidence_count ON committee_evidence;
CREATE TRIGGER trg_inquiry_evidence_count
  AFTER INSERT OR DELETE ON committee_evidence
  FOR EACH ROW EXECUTE FUNCTION update_inquiry_evidence_count();
