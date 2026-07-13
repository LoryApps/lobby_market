-- =============================================================================
-- Lobby Market: Westminster Hall — Secondary Debating Chamber
-- =============================================================================
-- The backbench chamber where any citizen can request a focused discussion
-- slot on any civic topic. Unlike formal debates (FOR vs AGAINST), Westminster
-- Hall sessions are open discussions where contributors make short "speeches"
-- and the community can "hear, hear!" (upvote) them.
--
-- Distinct from:
--   debates        — formal structured debates with assigned sides
--   floor (chamber)— The Floor: consensus formation chamber
--   edm            — Early Day Motions: parliamentary notice board
--   hansard        — official debate record (this feeds into it)
--
-- Session lifecycle: requested → approved → scheduled → live → concluded
-- =============================================================================

-- ─── Westminster Hall Sessions ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS westminster_hall_sessions (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id        uuid        REFERENCES topics(id) ON DELETE SET NULL,
  requester_id    uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Session details
  title           text        NOT NULL CHECK (char_length(title) BETWEEN 5 AND 200),
  motion          text        NOT NULL CHECK (char_length(motion) BETWEEN 10 AND 500),
  -- "This House believes that climate targets should be legally binding"
  -- "This House notes with concern the rise of misinformation in civic debate"

  -- Status lifecycle
  status          text        NOT NULL DEFAULT 'requested'
                              CHECK (status IN ('requested', 'approved', 'scheduled', 'live', 'concluded', 'withdrawn')),

  -- Scheduling
  scheduled_at    timestamptz,
  duration_mins   int         NOT NULL DEFAULT 30 CHECK (duration_mins IN (30, 60, 90)),
  started_at      timestamptz,
  concluded_at    timestamptz,

  -- Support petitioning (5 supporters needed to be approved)
  support_count   int         NOT NULL DEFAULT 0,
  support_threshold int       NOT NULL DEFAULT 5,

  -- Metadata
  category        text,
  speech_count    int         NOT NULL DEFAULT 0,
  viewer_count    int         NOT NULL DEFAULT 0,

  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS westminster_hall_sessions_status_idx
  ON westminster_hall_sessions(status, scheduled_at DESC);
CREATE INDEX IF NOT EXISTS westminster_hall_sessions_requester_idx
  ON westminster_hall_sessions(requester_id);
CREATE INDEX IF NOT EXISTS westminster_hall_sessions_topic_idx
  ON westminster_hall_sessions(topic_id)
  WHERE topic_id IS NOT NULL;

-- ─── Session Supporters ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS westminster_hall_supporters (
  session_id  uuid  NOT NULL REFERENCES westminster_hall_sessions(id) ON DELETE CASCADE,
  user_id     uuid  NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  supported_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, user_id)
);

-- ─── Speeches ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS westminster_hall_speeches (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id  uuid        NOT NULL REFERENCES westminster_hall_sessions(id) ON DELETE CASCADE,
  speaker_id  uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content     text        NOT NULL CHECK (char_length(content) BETWEEN 5 AND 500),
  hear_count  int         NOT NULL DEFAULT 0,  -- "Hear, hear!" upvotes
  order_num   int         NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS westminster_hall_speeches_session_idx
  ON westminster_hall_speeches(session_id, created_at ASC);
CREATE INDEX IF NOT EXISTS westminster_hall_speeches_speaker_idx
  ON westminster_hall_speeches(speaker_id);

-- ─── Hear, Hear! (speech upvotes) ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS westminster_hall_hear_votes (
  speech_id   uuid  NOT NULL REFERENCES westminster_hall_speeches(id) ON DELETE CASCADE,
  user_id     uuid  NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  voted_at    timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (speech_id, user_id)
);

-- ─── Trigger: update support_count ──────────────────────────────────────────

CREATE OR REPLACE FUNCTION wh_update_support_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE westminster_hall_sessions
    SET support_count = support_count + 1,
        updated_at = now()
    WHERE id = NEW.session_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE westminster_hall_sessions
    SET support_count = GREATEST(0, support_count - 1),
        updated_at = now()
    WHERE id = OLD.session_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS wh_support_count_trigger ON westminster_hall_supporters;
CREATE TRIGGER wh_support_count_trigger
  AFTER INSERT OR DELETE ON westminster_hall_supporters
  FOR EACH ROW EXECUTE FUNCTION wh_update_support_count();

-- ─── Trigger: update speech_count + hear_count ───────────────────────────────

CREATE OR REPLACE FUNCTION wh_update_speech_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE westminster_hall_sessions
    SET speech_count = speech_count + 1,
        updated_at = now()
    WHERE id = NEW.session_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE westminster_hall_sessions
    SET speech_count = GREATEST(0, speech_count - 1),
        updated_at = now()
    WHERE id = OLD.session_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS wh_speech_count_trigger ON westminster_hall_speeches;
CREATE TRIGGER wh_speech_count_trigger
  AFTER INSERT OR DELETE ON westminster_hall_speeches
  FOR EACH ROW EXECUTE FUNCTION wh_update_speech_count();

CREATE OR REPLACE FUNCTION wh_update_hear_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE westminster_hall_speeches
    SET hear_count = hear_count + 1
    WHERE id = NEW.speech_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE westminster_hall_speeches
    SET hear_count = GREATEST(0, hear_count - 1)
    WHERE id = OLD.speech_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS wh_hear_count_trigger ON westminster_hall_hear_votes;
CREATE TRIGGER wh_hear_count_trigger
  AFTER INSERT OR DELETE ON westminster_hall_hear_votes
  FOR EACH ROW EXECUTE FUNCTION wh_update_hear_count();

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE westminster_hall_sessions ENABLE ROW LEVEL SECURITY;
ALTER TABLE westminster_hall_supporters ENABLE ROW LEVEL SECURITY;
ALTER TABLE westminster_hall_speeches ENABLE ROW LEVEL SECURITY;
ALTER TABLE westminster_hall_hear_votes ENABLE ROW LEVEL SECURITY;

-- Sessions: anyone can read, authenticated users can create
CREATE POLICY "wh_sessions_select" ON westminster_hall_sessions
  FOR SELECT USING (true);
CREATE POLICY "wh_sessions_insert" ON westminster_hall_sessions
  FOR INSERT WITH CHECK (auth.uid() = requester_id);
CREATE POLICY "wh_sessions_update_owner" ON westminster_hall_sessions
  FOR UPDATE USING (auth.uid() = requester_id);

-- Supporters: anyone can read, authenticated can insert/delete their own
CREATE POLICY "wh_supporters_select" ON westminster_hall_supporters
  FOR SELECT USING (true);
CREATE POLICY "wh_supporters_insert" ON westminster_hall_supporters
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "wh_supporters_delete" ON westminster_hall_supporters
  FOR DELETE USING (auth.uid() = user_id);

-- Speeches: anyone can read, authenticated can create in live sessions
CREATE POLICY "wh_speeches_select" ON westminster_hall_speeches
  FOR SELECT USING (true);
CREATE POLICY "wh_speeches_insert" ON westminster_hall_speeches
  FOR INSERT WITH CHECK (
    auth.uid() = speaker_id
    AND EXISTS (
      SELECT 1 FROM westminster_hall_sessions
      WHERE id = session_id AND status = 'live'
    )
  );

-- Hear votes: anyone can read, authenticated can vote
CREATE POLICY "wh_hear_select" ON westminster_hall_hear_votes
  FOR SELECT USING (true);
CREATE POLICY "wh_hear_insert" ON westminster_hall_hear_votes
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "wh_hear_delete" ON westminster_hall_hear_votes
  FOR DELETE USING (auth.uid() = user_id);
