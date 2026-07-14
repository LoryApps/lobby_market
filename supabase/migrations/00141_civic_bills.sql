-- =============================================================================
-- Lobby Market: Civic Bills — The Parliamentary Bill Readings System
-- =============================================================================
-- Bills are the formal legislative instruments by which civic topics become
-- law. Each bill travels through the parliamentary reading system before
-- receiving Royal Assent (or being defeated).
--
-- Bill lifecycle:
--   first_reading   → formal introduction (no vote, notice only)
--   second_reading  → general debate on principles (citizens vote FOR/AGAINST)
--   committee_stage → line-by-line scrutiny by a select committee
--   report_stage    → committee amendments considered by the full house
--   third_reading   → final approval vote (minor amendments only)
--   lords           → Lords chamber consideration (ping-pong possible)
--   royal_assent    → ceremonial signing — bill becomes law
--   defeated        → voted down at any reading
--   withdrawn       → sponsor withdrew the bill
--
-- Distinct from:
--   topics          — informal proposals; topics that pass "voting" phase
--                     may be elevated to a formal bill
--   laws            — already-enacted laws; bills become laws on Royal Assent
--   civic_divisions — formal recorded votes; second/third readings can
--                     trigger a division
--   royal_assent    — the final ceremony (separate table/page)
-- =============================================================================

-- ─── Bills ───────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS civic_bills (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  short_title     TEXT        NOT NULL CHECK (char_length(short_title) BETWEEN 5  AND 80),
  long_title      TEXT        NOT NULL CHECK (char_length(long_title)  BETWEEN 10 AND 300),
  category        TEXT        NOT NULL DEFAULT 'Politics',
  sponsor_id      UUID        REFERENCES profiles(id)    ON DELETE SET NULL,
  coalition_id    UUID        REFERENCES coalitions(id)  ON DELETE SET NULL,
  topic_id        UUID        REFERENCES topics(id)      ON DELETE SET NULL,
  committee_id    UUID        REFERENCES civic_committees(id) ON DELETE SET NULL,

  -- Current stage in the reading process
  stage           TEXT        NOT NULL DEFAULT 'first_reading'
                    CHECK (stage IN (
                      'first_reading', 'second_reading', 'committee_stage',
                      'report_stage', 'third_reading', 'lords',
                      'royal_assent', 'defeated', 'withdrawn'
                    )),

  -- Overall bill status
  status          TEXT        NOT NULL DEFAULT 'introduced'
                    CHECK (status IN ('introduced','progressing','enacted','defeated','withdrawn')),

  -- Vote tallies (aggregated across all supported readings)
  votes_for       INT         NOT NULL DEFAULT 0,
  votes_against   INT         NOT NULL DEFAULT 0,

  -- Reading dates (null until that reading happens)
  first_reading_at   TIMESTAMPTZ DEFAULT now(),
  second_reading_at  TIMESTAMPTZ,
  committee_at       TIMESTAMPTZ,
  report_at          TIMESTAMPTZ,
  third_reading_at   TIMESTAMPTZ,
  lords_at           TIMESTAMPTZ,
  royal_assent_at    TIMESTAMPTZ,
  defeated_at        TIMESTAMPTZ,

  -- Optional: second reading debate closes at
  debate_closes_at   TIMESTAMPTZ,

  -- Bill type
  bill_type       TEXT        NOT NULL DEFAULT 'government'
                    CHECK (bill_type IN (
                      'government',       -- introduced by the governing coalition
                      'private_members',  -- introduced by an individual citizen
                      'opposition',       -- introduced by an opposition coalition
                      'lords'             -- introduced in the Lords chamber
                    )),

  view_count      INT         NOT NULL DEFAULT 0,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Reading votes ────────────────────────────────────────────────────────────
-- Citizens vote on bills at Second Reading and Third Reading

CREATE TABLE IF NOT EXISTS bill_reading_votes (
  id        UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id   UUID        NOT NULL REFERENCES civic_bills(id) ON DELETE CASCADE,
  user_id   UUID        NOT NULL REFERENCES profiles(id)    ON DELETE CASCADE,
  reading   TEXT        NOT NULL CHECK (reading IN ('second_reading', 'third_reading')),
  position  TEXT        NOT NULL CHECK (position IN ('for', 'against', 'abstain')),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (bill_id, user_id, reading)
);

-- ─── Bill amendments ─────────────────────────────────────────────────────────
-- Proposed during committee or report stage

CREATE TABLE IF NOT EXISTS bill_amendments (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  bill_id       UUID        NOT NULL REFERENCES civic_bills(id) ON DELETE CASCADE,
  proposer_id   UUID        REFERENCES profiles(id) ON DELETE SET NULL,
  clause_number TEXT        NOT NULL,               -- e.g. "Clause 3(b)"
  amendment     TEXT        NOT NULL CHECK (char_length(amendment) BETWEEN 10 AND 1000),
  status        TEXT        NOT NULL DEFAULT 'tabled'
                  CHECK (status IN ('tabled','accepted','rejected','withdrawn')),
  votes_for     INT         NOT NULL DEFAULT 0,
  votes_against INT         NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS civic_bills_stage_idx     ON civic_bills(stage);
CREATE INDEX IF NOT EXISTS civic_bills_status_idx    ON civic_bills(status);
CREATE INDEX IF NOT EXISTS civic_bills_category_idx  ON civic_bills(category);
CREATE INDEX IF NOT EXISTS civic_bills_topic_id_idx  ON civic_bills(topic_id);
CREATE INDEX IF NOT EXISTS bill_reading_votes_bill_idx ON bill_reading_votes(bill_id);
CREATE INDEX IF NOT EXISTS bill_reading_votes_user_idx ON bill_reading_votes(user_id);

-- ─── Seed data — sample bills at various stages ───────────────────────────────
-- These are illustrative; real bills come from community action

DO $$
DECLARE
  bill1_id UUID := gen_random_uuid();
  bill2_id UUID := gen_random_uuid();
  bill3_id UUID := gen_random_uuid();
  bill4_id UUID := gen_random_uuid();
  bill5_id UUID := gen_random_uuid();
  bill6_id UUID := gen_random_uuid();
BEGIN
  INSERT INTO civic_bills (
    id, short_title, long_title, category, bill_type, stage, status,
    votes_for, votes_against,
    first_reading_at, second_reading_at, committee_at, report_at, third_reading_at,
    debate_closes_at
  ) VALUES
  (
    bill1_id,
    'Universal Basic Infrastructure Bill',
    'A Bill to establish universal minimum standards for digital, transport, and utility infrastructure across all civic regions.',
    'Economics', 'government', 'third_reading', 'progressing',
    1847, 623,
    now() - interval '60 days',
    now() - interval '45 days',
    now() - interval '30 days',
    now() - interval '14 days',
    now() - interval '3 days',
    now() + interval '2 days'
  ),
  (
    bill2_id,
    'Open Data Transparency Bill',
    'A Bill to require all civic institutions to publish machine-readable data on their decisions, expenditure, and policy outcomes.',
    'Technology', 'government', 'second_reading', 'progressing',
    2341, 891,
    now() - interval '21 days',
    now() - interval '14 days',
    NULL, NULL, NULL,
    now() + interval '7 days'
  ),
  (
    bill3_id,
    'Civic Education Reform Bill',
    'A Bill to modernise civic education curricula with compulsory modules on democratic participation, critical thinking, and digital literacy.',
    'Education', 'private_members', 'committee_stage', 'progressing',
    1204, 378,
    now() - interval '45 days',
    now() - interval '35 days',
    now() - interval '21 days',
    NULL, NULL,
    NULL
  ),
  (
    bill4_id,
    'Environmental Standards (Strengthening) Bill',
    'A Bill to raise the minimum environmental protection standards and introduce binding carbon-reduction targets for all civic policies.',
    'Environment', 'opposition', 'royal_assent', 'enacted',
    3102, 441,
    now() - interval '120 days',
    now() - interval '100 days',
    now() - interval '80 days',
    now() - interval '60 days',
    now() - interval '45 days',
    NULL
  ),
  (
    bill5_id,
    'Healthcare Access (Universal Coverage) Bill',
    'A Bill to extend healthcare coverage entitlements and eliminate means-testing for essential preventative treatment.',
    'Health', 'government', 'lords', 'progressing',
    2788, 1134,
    now() - interval '90 days',
    now() - interval '75 days',
    now() - interval '55 days',
    now() - interval '40 days',
    now() - interval '25 days',
    NULL
  ),
  (
    bill6_id,
    'Housing Affordability Bill',
    'A Bill to introduce affordability controls on residential property, expand social housing commitments, and reform the planning system.',
    'Economics', 'government', 'defeated', 'defeated',
    987, 2341,
    now() - interval '75 days',
    now() - interval '60 days',
    NULL, NULL, NULL,
    NULL
  )
  ON CONFLICT DO NOTHING;

  -- Add amendments to the committee-stage bill
  INSERT INTO bill_amendments (bill_id, clause_number, amendment, status, votes_for, votes_against)
  VALUES
  (
    bill3_id,
    'Clause 4(a)',
    'After "secondary school" insert "and adult education providers" so that the duty to provide civic education modules extends to lifelong learning institutions.',
    'accepted', 312, 89
  ),
  (
    bill3_id,
    'Clause 7',
    'Substitute the proposed minimum 30 teaching hours per year with 40 hours, to align with international standards.',
    'tabled', 201, 178
  ),
  (
    bill3_id,
    'Clause 12(b)',
    'Remove subsection (b) entirely, which would require private schools to adopt the civic curriculum, as it exceeds the constitutional remit of this bill.',
    'tabled', 145, 267
  )
  ON CONFLICT DO NOTHING;

EXCEPTION WHEN OTHERS THEN
  NULL; -- Idempotent: ignore if seed already applied
END $$;
