-- =============================================================================
-- Lobby Market: The Division Bell — formal parliamentary divisions
-- =============================================================================
-- In Westminster, a "division" is a formal recorded vote. When a division is
-- called, the Division Bell rings throughout Parliament and members have 8
-- minutes to walk through either the Aye lobby or the No lobby. The result
-- is permanently recorded in the Division Register.
--
-- The name "Lobby Market" itself derives from these voting lobbies — the Aye
-- and No lobbies where MPs physically walk to cast their votes. This table
-- captures that core mechanic.
--
-- Division triggers:
--   floor          — called directly from the Floor chamber
--   supply_day     — elevated from a Supply Day motion of type 'division'
--   lords          — Lords chamber formal vote
--   motion         — any formal motion reaching threshold
--
-- Division result:
--   ayes_win       — motion passes (more Ayes than Noes)
--   noes_win       — motion fails
--   tied           — equal votes; Speaker casts deciding vote (Noe by convention)
--   quorum_failed  — insufficient participation; result void
--   withdrawn      — withdrawn before close
-- =============================================================================

CREATE TABLE IF NOT EXISTS civic_divisions (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  -- Title and substance of the motion being divided on
  title             TEXT        NOT NULL CHECK (char_length(title) BETWEEN 5 AND 300),
  motion_text       TEXT        NOT NULL CHECK (char_length(motion_text) BETWEEN 20 AND 5000),

  -- What triggered this division
  trigger_type      TEXT        NOT NULL DEFAULT 'floor'
                    CHECK (trigger_type IN ('floor', 'supply_day', 'lords', 'motion')),

  -- Optional foreign keys to the source object
  topic_id          UUID        REFERENCES topics(id) ON DELETE SET NULL,
  supply_motion_id  UUID        REFERENCES supply_day_motions(id) ON DELETE SET NULL,
  coalition_id      UUID        REFERENCES coalitions(id) ON DELETE SET NULL,

  -- The member who called the division
  called_by         UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Division window — citizens may vote while status = 'open'
  opens_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  closes_at         TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours'),

  -- Vote tallies (updated in real time)
  ayes              INT         NOT NULL DEFAULT 0 CHECK (ayes >= 0),
  noes              INT         NOT NULL DEFAULT 0 CHECK (noes >= 0),
  abstentions       INT         NOT NULL DEFAULT 0 CHECK (abstentions >= 0),

  -- Status lifecycle
  status            TEXT        NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open', 'closed', 'withdrawn')),

  -- Formal result declared when status → closed
  result            TEXT        CHECK (result IN ('ayes_win', 'noes_win', 'tied', 'quorum_failed', 'withdrawn')),
  result_declared_at TIMESTAMPTZ,

  -- Optional Speaker note / formal declaration
  speaker_note      TEXT        CHECK (char_length(speaker_note) <= 2000),

  -- Quorum threshold (default 5 votes)
  quorum            INT         NOT NULL DEFAULT 5 CHECK (quorum >= 1),

  created_at        TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Each citizen may vote once per division
CREATE TABLE IF NOT EXISTS division_votes (
  division_id   UUID        NOT NULL REFERENCES civic_divisions(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Which lobby they walked through
  lobby         TEXT        NOT NULL CHECK (lobby IN ('aye', 'no', 'abstain')),

  voted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  PRIMARY KEY (division_id, user_id)
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_civic_divisions_status
  ON civic_divisions (status, opens_at DESC);

CREATE INDEX IF NOT EXISTS idx_civic_divisions_topic
  ON civic_divisions (topic_id) WHERE topic_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_civic_divisions_coalition
  ON civic_divisions (coalition_id) WHERE coalition_id IS NOT NULL;

CREATE INDEX IF NOT EXISTS idx_division_votes_division
  ON division_votes (division_id);

CREATE INDEX IF NOT EXISTS idx_division_votes_user
  ON division_votes (user_id);

-- ─── Auto-close expired divisions ─────────────────────────────────────────────

-- A trigger to automatically close divisions when closes_at passes and declare
-- result. This fires on any INSERT/UPDATE touching the division row.
CREATE OR REPLACE FUNCTION close_expired_division()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.status = 'open' AND NEW.closes_at <= now() THEN
    NEW.status := 'closed';
    NEW.result_declared_at := now();

    -- Quorum check
    IF (NEW.ayes + NEW.noes + NEW.abstentions) < NEW.quorum THEN
      NEW.result := 'quorum_failed';
    ELSIF NEW.ayes > NEW.noes THEN
      NEW.result := 'ayes_win';
    ELSIF NEW.noes > NEW.ayes THEN
      NEW.result := 'noes_win';
    ELSE
      -- Tied: convention is Speaker votes Noe
      NEW.result := 'tied';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER trg_close_expired_division
  BEFORE UPDATE ON civic_divisions
  FOR EACH ROW EXECUTE FUNCTION close_expired_division();

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE civic_divisions   ENABLE ROW LEVEL SECURITY;
ALTER TABLE division_votes    ENABLE ROW LEVEL SECURITY;

-- Anyone can read divisions
CREATE POLICY "divisions_read_all"
  ON civic_divisions FOR SELECT USING (true);

-- Authenticated users can create divisions
CREATE POLICY "divisions_insert_auth"
  ON civic_divisions FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = called_by);

-- Author can withdraw their own open division
CREATE POLICY "divisions_update_own"
  ON civic_divisions FOR UPDATE
  USING (auth.uid() = called_by AND status = 'open');

-- Anyone can read division votes
CREATE POLICY "division_votes_read_all"
  ON division_votes FOR SELECT USING (true);

-- Authenticated users can insert their own vote
CREATE POLICY "division_votes_insert_auth"
  ON division_votes FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND auth.uid() = user_id);
