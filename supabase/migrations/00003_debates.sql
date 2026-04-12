-- =============================================================================
-- Lobby Market: Phase 3A — Live Debates
-- =============================================================================
-- Real-time debate arena with participants, chat, reactions, and audience sway.
-- =============================================================================


-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'debate_type') THEN
    CREATE TYPE debate_type AS ENUM ('quick', 'grand', 'tribunal');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'debate_status') THEN
    CREATE TYPE debate_status AS ENUM ('scheduled', 'live', 'ended', 'cancelled');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'debate_phase') THEN
    CREATE TYPE debate_phase AS ENUM (
      'opening', 'cross_exam', 'closing', 'audience_qa', 'ended'
    );
  END IF;
END$$;


-- ---------------------------------------------------------------------------
-- TABLE: debates
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS debates (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id        UUID          NOT NULL REFERENCES topics (id),
  creator_id      UUID          NOT NULL REFERENCES profiles (id),
  type            debate_type   NOT NULL,
  status          debate_status NOT NULL DEFAULT 'scheduled',
  phase           debate_phase  NOT NULL DEFAULT 'opening',
  title           TEXT          NOT NULL,
  description     TEXT,
  scheduled_at    TIMESTAMPTZ   NOT NULL,
  started_at      TIMESTAMPTZ,
  ended_at        TIMESTAMPTZ,
  phase_ends_at   TIMESTAMPTZ,
  viewer_count    INT           NOT NULL DEFAULT 0,
  blue_sway       INT           NOT NULL DEFAULT 50,
  red_sway        INT           NOT NULL DEFAULT 50,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_debates_status       ON debates (status);
CREATE INDEX IF NOT EXISTS idx_debates_scheduled    ON debates (scheduled_at);
CREATE INDEX IF NOT EXISTS idx_debates_topic        ON debates (topic_id);
CREATE INDEX IF NOT EXISTS idx_debates_creator      ON debates (creator_id);

COMMENT ON TABLE debates IS 'Live debate events linked to topics';


-- ---------------------------------------------------------------------------
-- TABLE: debate_participants
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS debate_participants (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id   UUID        NOT NULL REFERENCES debates (id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES profiles (id),
  side        vote_side   NOT NULL,
  is_speaker  BOOLEAN     NOT NULL DEFAULT FALSE,
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  left_at     TIMESTAMPTZ,
  UNIQUE (debate_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_debate_participants_debate ON debate_participants (debate_id);
CREATE INDEX IF NOT EXISTS idx_debate_participants_user   ON debate_participants (user_id);

COMMENT ON TABLE debate_participants IS 'Users joined to a debate (speakers and audience)';


-- ---------------------------------------------------------------------------
-- TABLE: debate_messages
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS debate_messages (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id     UUID        NOT NULL REFERENCES debates (id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES profiles (id),
  content       TEXT        NOT NULL CHECK (char_length(content) > 0 AND char_length(content) <= 500),
  side          vote_side,
  is_argument   BOOLEAN     NOT NULL DEFAULT FALSE,
  upvotes       INT         NOT NULL DEFAULT 0,
  parent_id     UUID        REFERENCES debate_messages (id) ON DELETE SET NULL,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_debate_messages_debate_created
  ON debate_messages (debate_id, created_at);
CREATE INDEX IF NOT EXISTS idx_debate_messages_user
  ON debate_messages (user_id);

COMMENT ON TABLE debate_messages IS 'Chat and argument messages within a live debate';


-- ---------------------------------------------------------------------------
-- TABLE: debate_reactions
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS debate_reactions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id   UUID        NOT NULL REFERENCES debates (id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES profiles (id),
  emoji       TEXT        NOT NULL,
  side        vote_side,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_debate_reactions_debate_created
  ON debate_reactions (debate_id, created_at);

COMMENT ON TABLE debate_reactions IS 'Floating emoji reactions during a live debate';


-- ---------------------------------------------------------------------------
-- TABLE: debate_sway_votes
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS debate_sway_votes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  debate_id   UUID        NOT NULL REFERENCES debates (id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES profiles (id),
  checkpoint  INT         NOT NULL CHECK (checkpoint IN (1, 2, 3)),
  side        vote_side   NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (debate_id, user_id, checkpoint)
);

CREATE INDEX IF NOT EXISTS idx_debate_sway_votes_debate
  ON debate_sway_votes (debate_id);

COMMENT ON TABLE debate_sway_votes IS 'Audience sway votes cast at debate checkpoints';


-- ===========================================================================
-- TRIGGER FUNCTIONS
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- handle_debate_message()
-- ---------------------------------------------------------------------------
-- When a message is inserted, increment the author's total_arguments counter
-- if the message is flagged as an argument.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION handle_debate_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.is_argument THEN
    UPDATE profiles
    SET total_arguments = total_arguments + 1
    WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_debate_message ON debate_messages;
CREATE TRIGGER on_debate_message
  AFTER INSERT ON debate_messages
  FOR EACH ROW
  EXECUTE FUNCTION handle_debate_message();


-- ---------------------------------------------------------------------------
-- handle_debate_reaction()
-- ---------------------------------------------------------------------------
-- Each reaction nudges the running sway by a tiny delta (±1%), clamped to
-- [0, 100]. Neutral reactions (side IS NULL) have no sway effect.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION handle_debate_reaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.side = 'blue' THEN
    UPDATE debates
    SET blue_sway = LEAST(100, blue_sway + 1),
        red_sway  = GREATEST(0,   red_sway  - 1)
    WHERE id = NEW.debate_id;
  ELSIF NEW.side = 'red' THEN
    UPDATE debates
    SET red_sway  = LEAST(100, red_sway  + 1),
        blue_sway = GREATEST(0, blue_sway - 1)
    WHERE id = NEW.debate_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_debate_reaction ON debate_reactions;
CREATE TRIGGER on_debate_reaction
  AFTER INSERT ON debate_reactions
  FOR EACH ROW
  EXECUTE FUNCTION handle_debate_reaction();


-- ---------------------------------------------------------------------------
-- handle_debate_sway_vote()
-- ---------------------------------------------------------------------------
-- Recalculate sway percentages after a checkpoint sway vote. Uses the full
-- set of sway votes on the debate so the result is a true audience tally.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION handle_debate_sway_vote()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_blue INT;
  v_red  INT;
  v_total INT;
BEGIN
  SELECT
    COUNT(*) FILTER (WHERE side = 'blue'),
    COUNT(*) FILTER (WHERE side = 'red'),
    COUNT(*)
  INTO v_blue, v_red, v_total
  FROM debate_sway_votes
  WHERE debate_id = NEW.debate_id;

  IF v_total > 0 THEN
    UPDATE debates
    SET blue_sway = ROUND((v_blue::REAL / v_total::REAL) * 100.0)::INT,
        red_sway  = ROUND((v_red::REAL  / v_total::REAL) * 100.0)::INT
    WHERE id = NEW.debate_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_debate_sway_vote ON debate_sway_votes;
CREATE TRIGGER on_debate_sway_vote
  AFTER INSERT ON debate_sway_votes
  FOR EACH ROW
  EXECUTE FUNCTION handle_debate_sway_vote();


-- ---------------------------------------------------------------------------
-- set_updated_at on debates
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS set_updated_at_debates ON debates;
CREATE TRIGGER set_updated_at_debates
  BEFORE UPDATE ON debates
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();


-- ===========================================================================
-- ROW LEVEL SECURITY
-- ===========================================================================

ALTER TABLE debates             ENABLE ROW LEVEL SECURITY;
ALTER TABLE debate_participants ENABLE ROW LEVEL SECURITY;
ALTER TABLE debate_messages     ENABLE ROW LEVEL SECURITY;
ALTER TABLE debate_reactions    ENABLE ROW LEVEL SECURITY;
ALTER TABLE debate_sway_votes   ENABLE ROW LEVEL SECURITY;


-- ---- debates ------------------------------------------------------------

DROP POLICY IF EXISTS "Debates are viewable by everyone" ON debates;
CREATE POLICY "Debates are viewable by everyone"
  ON debates FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Debators can schedule debates" ON debates;
CREATE POLICY "Debators can schedule debates"
  ON debates FOR INSERT
  WITH CHECK (
    auth.uid() = creator_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('debator', 'troll_catcher', 'elder')
    )
  );

DROP POLICY IF EXISTS "Creators can update their debates" ON debates;
CREATE POLICY "Creators can update their debates"
  ON debates FOR UPDATE
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);


-- ---- debate_participants ------------------------------------------------

DROP POLICY IF EXISTS "Debate participants are viewable by everyone" ON debate_participants;
CREATE POLICY "Debate participants are viewable by everyone"
  ON debate_participants FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can join debates" ON debate_participants;
CREATE POLICY "Authenticated users can join debates"
  ON debate_participants FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own participation" ON debate_participants;
CREATE POLICY "Users can update their own participation"
  ON debate_participants FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- ---- debate_messages ----------------------------------------------------

DROP POLICY IF EXISTS "Debate messages are viewable by everyone" ON debate_messages;
CREATE POLICY "Debate messages are viewable by everyone"
  ON debate_messages FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can send messages in live debates" ON debate_messages;
CREATE POLICY "Authenticated users can send messages in live debates"
  ON debate_messages FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM debates
      WHERE debates.id = debate_id
        AND debates.status = 'live'
    )
  );


-- ---- debate_reactions ---------------------------------------------------

DROP POLICY IF EXISTS "Debate reactions are viewable by everyone" ON debate_reactions;
CREATE POLICY "Debate reactions are viewable by everyone"
  ON debate_reactions FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can react in live debates" ON debate_reactions;
CREATE POLICY "Authenticated users can react in live debates"
  ON debate_reactions FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM debates
      WHERE debates.id = debate_id
        AND debates.status = 'live'
    )
  );


-- ---- debate_sway_votes --------------------------------------------------

DROP POLICY IF EXISTS "Debate sway votes are viewable by everyone" ON debate_sway_votes;
CREATE POLICY "Debate sway votes are viewable by everyone"
  ON debate_sway_votes FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can cast sway votes in live debates" ON debate_sway_votes;
CREATE POLICY "Authenticated users can cast sway votes in live debates"
  ON debate_sway_votes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM debates
      WHERE debates.id = debate_id
        AND debates.status = 'live'
    )
  );


-- =============================================================================
-- End of 00003_debates.sql
-- =============================================================================
