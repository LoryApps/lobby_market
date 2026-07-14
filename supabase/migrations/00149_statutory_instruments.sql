-- =============================================================================
-- Lobby Market: Statutory Instruments — Secondary Legislation
-- =============================================================================
-- Statutory Instruments (SIs) are secondary legislation made by ministers
-- (coalition leaders / high-rep citizens) using powers delegated in primary
-- legislation (established laws / bills at royal assent).
--
-- Two procedures govern how SIs come into force:
--
--   Negative procedure (default):
--     The SI is "laid" before parliament. If no prayer of annulment is
--     moved within 40 sitting days AND parliament does not vote to annul it,
--     it comes into force automatically.
--
--   Affirmative procedure:
--     The SI MUST be actively approved by a vote before it can come into
--     force. Used for more significant powers.
--
-- Citizens can table "prayers" (motions to annul) against negative SIs
-- within the 40-day window. If a prayer gets enough seconds (20+), it
-- triggers a formal parliamentary vote.
-- =============================================================================

-- ─── Statutory Instruments ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS statutory_instruments (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  reference       TEXT    NOT NULL,                        -- e.g. "SI 2024/001"
  short_title     TEXT    NOT NULL CHECK (char_length(short_title) BETWEEN 5 AND 120),
  description     TEXT    NOT NULL CHECK (char_length(description) BETWEEN 20 AND 1000),
  category        TEXT    NOT NULL DEFAULT 'Politics',
  procedure       TEXT    NOT NULL DEFAULT 'negative'
                    CHECK (procedure IN ('negative', 'affirmative', 'super_affirmative')),
  status          TEXT    NOT NULL DEFAULT 'draft'
                    CHECK (status IN (
                      'draft',       -- being prepared, not yet laid
                      'laid',        -- formally laid before parliament (in 40-day window)
                      'in_force',    -- negative: window expired; affirmative: approved
                      'annulled',    -- prayer of annulment succeeded
                      'approved',    -- affirmative: voted through
                      'rejected',    -- affirmative: voted down
                      'withdrawn'    -- maker withdrew before coming into force
                    )),

  -- Maker
  maker_id        UUID    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  coalition_id    UUID    REFERENCES coalitions(id)        ON DELETE SET NULL,

  -- Parent authority (the law/bill this derives powers from)
  parent_law_id   UUID    REFERENCES laws(id)              ON DELETE SET NULL,
  parent_bill_id  UUID    REFERENCES civic_bills(id)       ON DELETE SET NULL,
  topic_id        UUID    REFERENCES topics(id)            ON DELETE SET NULL,

  -- Timing
  laid_at         TIMESTAMPTZ,
  window_closes_at TIMESTAMPTZ,   -- 40 sitting days after laid_at (negative)
  in_force_at     TIMESTAMPTZ,    -- when the SI actually came into force
  created_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ     NOT NULL DEFAULT now(),

  -- Voting (affirmative procedure)
  yes_votes       INT             NOT NULL DEFAULT 0,
  no_votes        INT             NOT NULL DEFAULT 0,
  vote_closes_at  TIMESTAMPTZ,

  -- Computed counters (denormalised for performance)
  prayer_count    INT             NOT NULL DEFAULT 0
);

-- ─── SI Prayers (motions to annul, tabled by citizens) ───────────────────────

CREATE TABLE IF NOT EXISTS si_prayers (
  id              UUID    PRIMARY KEY DEFAULT gen_random_uuid(),
  si_id           UUID    NOT NULL REFERENCES statutory_instruments(id) ON DELETE CASCADE,
  author_id       UUID    NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  prayer_text     TEXT    NOT NULL CHECK (char_length(prayer_text) BETWEEN 10 AND 500),
  seconds_count   INT     NOT NULL DEFAULT 0,
  status          TEXT    NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active', 'succeeded', 'failed', 'expired')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (si_id, author_id)    -- one prayer per citizen per SI
);

-- ─── SI Prayer Seconds (citizens endorsing a prayer) ─────────────────────────

CREATE TABLE IF NOT EXISTS si_prayer_seconds (
  si_id           UUID    NOT NULL REFERENCES statutory_instruments(id) ON DELETE CASCADE,
  prayer_id       UUID    NOT NULL REFERENCES si_prayers(id)            ON DELETE CASCADE,
  user_id         UUID    NOT NULL REFERENCES profiles(id)              ON DELETE CASCADE,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (prayer_id, user_id)
);

-- ─── SI Votes (affirmative procedure approval votes) ─────────────────────────

CREATE TABLE IF NOT EXISTS si_votes (
  si_id           UUID    NOT NULL REFERENCES statutory_instruments(id) ON DELETE CASCADE,
  user_id         UUID    NOT NULL REFERENCES profiles(id)              ON DELETE CASCADE,
  vote            TEXT    NOT NULL CHECK (vote IN ('yes', 'no', 'abstain')),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (si_id, user_id)
);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_si_status        ON statutory_instruments(status);
CREATE INDEX IF NOT EXISTS idx_si_maker         ON statutory_instruments(maker_id);
CREATE INDEX IF NOT EXISTS idx_si_laid_at       ON statutory_instruments(laid_at DESC);
CREATE INDEX IF NOT EXISTS idx_si_prayers_si    ON si_prayers(si_id);
CREATE INDEX IF NOT EXISTS idx_si_seconds_prayer ON si_prayer_seconds(prayer_id);
CREATE INDEX IF NOT EXISTS idx_si_votes_si      ON si_votes(si_id);

-- ─── Updated-at trigger ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION touch_si_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_si_updated_at ON statutory_instruments;
CREATE TRIGGER trg_si_updated_at
  BEFORE UPDATE ON statutory_instruments
  FOR EACH ROW EXECUTE FUNCTION touch_si_updated_at();

-- ─── Function: increment prayer count on the SI ──────────────────────────────

CREATE OR REPLACE FUNCTION increment_si_prayer_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE statutory_instruments
  SET prayer_count = prayer_count + 1
  WHERE id = NEW.si_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_si_prayer_count ON si_prayers;
CREATE TRIGGER trg_si_prayer_count
  AFTER INSERT ON si_prayers
  FOR EACH ROW EXECUTE FUNCTION increment_si_prayer_count();

-- ─── Function: increment prayer seconds count ────────────────────────────────

CREATE OR REPLACE FUNCTION increment_si_prayer_seconds()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE si_prayers
  SET seconds_count = seconds_count + 1
  WHERE id = NEW.prayer_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_si_prayer_seconds ON si_prayer_seconds;
CREATE TRIGGER trg_si_prayer_seconds
  AFTER INSERT ON si_prayer_seconds
  FOR EACH ROW EXECUTE FUNCTION increment_si_prayer_seconds();

-- ─── Function: mark negative SIs as in_force after window closes ─────────────

CREATE OR REPLACE FUNCTION check_si_windows()
RETURNS void LANGUAGE plpgsql AS $$
BEGIN
  -- Negative SIs whose window has closed with no successful prayer → in_force
  UPDATE statutory_instruments
  SET status = 'in_force', in_force_at = now()
  WHERE status = 'laid'
    AND procedure = 'negative'
    AND window_closes_at < now()
    AND prayer_count = 0;  -- no prayers tabled

  -- Affirmative SIs whose vote window closed → resolve
  UPDATE statutory_instruments
  SET
    status    = CASE WHEN yes_votes > no_votes THEN 'approved' ELSE 'rejected' END,
    in_force_at = CASE WHEN yes_votes > no_votes THEN now() ELSE NULL END
  WHERE status = 'laid'
    AND procedure = 'affirmative'
    AND vote_closes_at < now();
END;
$$;

-- ─── RLS Policies ────────────────────────────────────────────────────────────

ALTER TABLE statutory_instruments  ENABLE ROW LEVEL SECURITY;
ALTER TABLE si_prayers             ENABLE ROW LEVEL SECURITY;
ALTER TABLE si_prayer_seconds      ENABLE ROW LEVEL SECURITY;
ALTER TABLE si_votes               ENABLE ROW LEVEL SECURITY;

CREATE POLICY "si_select"       ON statutory_instruments  FOR SELECT USING (true);
CREATE POLICY "si_insert"       ON statutory_instruments  FOR INSERT WITH CHECK (auth.uid() = maker_id);
CREATE POLICY "si_update"       ON statutory_instruments  FOR UPDATE USING (auth.uid() = maker_id);

CREATE POLICY "si_prayer_select" ON si_prayers            FOR SELECT USING (true);
CREATE POLICY "si_prayer_insert" ON si_prayers            FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "si_seconds_select" ON si_prayer_seconds    FOR SELECT USING (true);
CREATE POLICY "si_seconds_insert" ON si_prayer_seconds    FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "si_seconds_delete" ON si_prayer_seconds    FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "si_votes_select" ON si_votes               FOR SELECT USING (true);
CREATE POLICY "si_votes_insert" ON si_votes               FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "si_votes_delete" ON si_votes               FOR DELETE USING (auth.uid() = user_id);

-- ─── Seed: example SIs ───────────────────────────────────────────────────────
-- (Uses a DO block so it doesn't error if profiles/laws tables are empty)

DO $$
DECLARE
  v_admin_id UUID;
BEGIN
  SELECT id INTO v_admin_id FROM profiles ORDER BY created_at LIMIT 1;
  IF v_admin_id IS NULL THEN RETURN; END IF;

  INSERT INTO statutory_instruments
    (reference, short_title, description, category, procedure, status, maker_id, laid_at, window_closes_at)
  VALUES
    (
      'SI 2024/001',
      'Civic Debate Duration (Extension) Order 2024',
      'Extends the maximum duration of formal Oxford-style debates from 90 minutes to 120 minutes, allowing more comprehensive exploration of complex civic topics.',
      'Politics',
      'negative',
      'laid',
      v_admin_id,
      now() - INTERVAL '5 days',
      now() + INTERVAL '35 days'
    ),
    (
      'SI 2024/002',
      'Civic Clout Threshold (Amendment) Regulations 2024',
      'Amends the minimum clout threshold for sponsoring a Private Member''s Bill from 1,000 to 750 clout points, enabling more citizens to participate in the legislative process.',
      'Politics',
      'affirmative',
      'laid',
      v_admin_id,
      now() - INTERVAL '2 days',
      now() + INTERVAL '28 days'
    ),
    (
      'SI 2024/003',
      'Civic Voting Period (Acceleration) Order 2024',
      'Allows the Speaker to accelerate the voting period on topics that receive more than 10,000 votes in the first 24 hours, reflecting exceptional public interest.',
      'Economics',
      'negative',
      'in_force',
      v_admin_id,
      now() - INTERVAL '50 days',
      now() - INTERVAL '10 days'
    )
  ON CONFLICT DO NOTHING;
END;
$$;
