-- =============================================================================
-- Lobby Market: Initial Schema Migration
-- Consensus/debate platform database schema
-- =============================================================================

-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------

CREATE TYPE user_role AS ENUM ('person', 'debator', 'troll_catcher', 'elder');

CREATE TYPE topic_status AS ENUM (
  'proposed', 'active', 'voting', 'continued', 'law', 'failed', 'archived'
);

CREATE TYPE vote_side AS ENUM ('blue', 'red');

-- ---------------------------------------------------------------------------
-- TABLE: profiles (extends auth.users)
-- ---------------------------------------------------------------------------

CREATE TABLE profiles (
  id                  UUID        PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  username            TEXT        UNIQUE NOT NULL,
  display_name        TEXT,
  avatar_url          TEXT,
  bio                 TEXT,
  role                user_role   NOT NULL DEFAULT 'person',
  clout               INT         NOT NULL DEFAULT 0,
  reputation_score    REAL        NOT NULL DEFAULT 0,
  total_votes         INT         NOT NULL DEFAULT 0,
  total_arguments     INT         NOT NULL DEFAULT 0,
  blue_vote_count     INT         NOT NULL DEFAULT 0,
  red_vote_count      INT         NOT NULL DEFAULT 0,
  vote_streak         INT         NOT NULL DEFAULT 0,
  daily_votes_used    INT         NOT NULL DEFAULT 0,
  daily_votes_reset_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  verification_tier   INT         NOT NULL DEFAULT 0,
  is_influencer       BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_profiles_username ON profiles (username);
CREATE INDEX idx_profiles_reputation ON profiles (reputation_score DESC);

COMMENT ON TABLE profiles IS 'User profiles extending Supabase auth.users';

-- ---------------------------------------------------------------------------
-- TABLE: topics
-- ---------------------------------------------------------------------------

CREATE TABLE topics (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id             UUID          NOT NULL REFERENCES profiles (id),
  statement             TEXT          NOT NULL,
  category              TEXT,
  scope                 TEXT          NOT NULL DEFAULT 'global',
  status                topic_status  NOT NULL DEFAULT 'proposed',
  support_count         INT           NOT NULL DEFAULT 0,
  activation_threshold  INT           NOT NULL DEFAULT 500,
  blue_votes            INT           NOT NULL DEFAULT 0,
  red_votes             INT           NOT NULL DEFAULT 0,
  total_votes           INT           NOT NULL DEFAULT 0,
  blue_pct              REAL          NOT NULL DEFAULT 50.0,
  voting_duration_hours INT           NOT NULL DEFAULT 72,
  voting_ends_at        TIMESTAMPTZ,
  parent_id             UUID          REFERENCES topics (id),
  connector             TEXT          CHECK (connector IN ('but', 'and')),
  chain_depth           INT           NOT NULL DEFAULT 0,
  feed_score            REAL          NOT NULL DEFAULT 0,
  view_count            INT           NOT NULL DEFAULT 0,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_topics_status ON topics (status);
CREATE INDEX idx_topics_author ON topics (author_id);
CREATE INDEX idx_topics_feed_score ON topics (feed_score DESC);
CREATE INDEX idx_topics_parent ON topics (parent_id);
CREATE INDEX idx_topics_created ON topics (created_at DESC);

COMMENT ON TABLE topics IS 'Debate topics that progress through proposal, voting, and law stages';

-- ---------------------------------------------------------------------------
-- TABLE: topic_supports
-- ---------------------------------------------------------------------------

CREATE TABLE topic_supports (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES profiles (id),
  topic_id   UUID        NOT NULL REFERENCES topics (id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, topic_id)
);

CREATE INDEX idx_topic_supports_topic ON topic_supports (topic_id);
CREATE INDEX idx_topic_supports_user ON topic_supports (user_id);

COMMENT ON TABLE topic_supports IS 'User endorsements that push proposed topics toward activation';

-- ---------------------------------------------------------------------------
-- TABLE: votes
-- ---------------------------------------------------------------------------

CREATE TABLE votes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID        NOT NULL REFERENCES profiles (id),
  topic_id   UUID        NOT NULL REFERENCES topics (id),
  side       vote_side   NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, topic_id)
);

CREATE INDEX idx_votes_topic ON votes (topic_id);
CREATE INDEX idx_votes_user ON votes (user_id);
CREATE INDEX idx_votes_topic_side ON votes (topic_id, side);

COMMENT ON TABLE votes IS 'Blue/red votes cast on active topics';

-- ---------------------------------------------------------------------------
-- TABLE: laws
-- ---------------------------------------------------------------------------

CREATE TABLE laws (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id        UUID        NOT NULL UNIQUE REFERENCES topics (id),
  statement       TEXT        NOT NULL,
  full_statement  TEXT,
  body_markdown   TEXT,
  category        TEXT,
  established_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  is_active       BOOLEAN     NOT NULL DEFAULT TRUE,
  blue_pct        REAL,
  total_votes     INT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

COMMENT ON TABLE laws IS 'Consensus laws established from topics that pass voting';

-- ---------------------------------------------------------------------------
-- TABLE: law_links
-- ---------------------------------------------------------------------------

CREATE TABLE law_links (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  source_law_id  UUID NOT NULL REFERENCES laws (id) ON DELETE CASCADE,
  target_law_id  UUID NOT NULL REFERENCES laws (id) ON DELETE CASCADE,
  UNIQUE (source_law_id, target_law_id),
  CHECK (source_law_id <> target_law_id)
);

COMMENT ON TABLE law_links IS 'Directed links between related laws';

-- ===========================================================================
-- TRIGGER FUNCTIONS
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- 1. Auto-create a profile row when a new auth user signs up
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION handle_new_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO profiles (id, username, display_name, avatar_url)
  VALUES (
    NEW.id,
    -- Prefer the username supplied during sign-up; fall back to a stable default
    COALESCE(
      NEW.raw_user_meta_data ->> 'username',
      'user_' || substr(NEW.id::text, 1, 8)
    ),
    COALESCE(NEW.raw_user_meta_data ->> 'display_name', NULL),
    COALESCE(NEW.raw_user_meta_data ->> 'avatar_url', NULL)
  );
  RETURN NEW;
END;
$$;

CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION handle_new_user();

-- ---------------------------------------------------------------------------
-- 2. Increment support_count and activate topic when threshold is reached
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION handle_topic_support()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_topic topics%ROWTYPE;
BEGIN
  -- Atomically increment and fetch the updated row
  UPDATE topics
  SET support_count = support_count + 1
  WHERE id = NEW.topic_id
  RETURNING * INTO v_topic;

  -- If the topic just crossed its activation threshold while still proposed,
  -- move it to active and set the voting deadline.
  IF v_topic.status = 'proposed'
     AND v_topic.support_count >= v_topic.activation_threshold
  THEN
    UPDATE topics
    SET status        = 'active',
        voting_ends_at = now() + (v_topic.voting_duration_hours || ' hours')::interval
    WHERE id = NEW.topic_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_topic_support
  AFTER INSERT ON topic_supports
  FOR EACH ROW
  EXECUTE FUNCTION handle_topic_support();

-- ---------------------------------------------------------------------------
-- 3. Tally a vote and update the voter's profile stats
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION handle_vote_cast()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_blue   INT;
  v_new_red    INT;
  v_new_total  INT;
BEGIN
  -- Update topic vote tallies in a single atomic statement
  IF NEW.side = 'blue' THEN
    UPDATE topics
    SET blue_votes  = blue_votes + 1,
        total_votes = total_votes + 1
    WHERE id = NEW.topic_id
    RETURNING blue_votes, red_votes, total_votes
    INTO v_new_blue, v_new_red, v_new_total;
  ELSE
    UPDATE topics
    SET red_votes   = red_votes + 1,
        total_votes = total_votes + 1
    WHERE id = NEW.topic_id
    RETURNING blue_votes, red_votes, total_votes
    INTO v_new_blue, v_new_red, v_new_total;
  END IF;

  -- Recalculate blue percentage (guard against division by zero)
  IF v_new_total > 0 THEN
    UPDATE topics
    SET blue_pct = (v_new_blue::REAL / v_new_total::REAL) * 100.0
    WHERE id = NEW.topic_id;
  END IF;

  -- Update the voter's profile counters
  IF NEW.side = 'blue' THEN
    UPDATE profiles
    SET total_votes      = total_votes + 1,
        daily_votes_used = daily_votes_used + 1,
        blue_vote_count  = blue_vote_count + 1,
        clout            = clout + 1
    WHERE id = NEW.user_id;
  ELSE
    UPDATE profiles
    SET total_votes      = total_votes + 1,
        daily_votes_used = daily_votes_used + 1,
        red_vote_count   = red_vote_count + 1,
        clout            = clout + 1
    WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_vote_cast
  AFTER INSERT ON votes
  FOR EACH ROW
  EXECUTE FUNCTION handle_vote_cast();

-- ---------------------------------------------------------------------------
-- 4. Auto-set updated_at on row modification
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

CREATE TRIGGER set_updated_at_profiles
  BEFORE UPDATE ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_topics
  BEFORE UPDATE ON topics
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

CREATE TRIGGER set_updated_at_laws
  BEFORE UPDATE ON laws
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

-- ===========================================================================
-- ROW LEVEL SECURITY
-- ===========================================================================

-- Enable RLS on every table
ALTER TABLE profiles       ENABLE ROW LEVEL SECURITY;
ALTER TABLE topics         ENABLE ROW LEVEL SECURITY;
ALTER TABLE topic_supports ENABLE ROW LEVEL SECURITY;
ALTER TABLE votes          ENABLE ROW LEVEL SECURITY;
ALTER TABLE laws           ENABLE ROW LEVEL SECURITY;
ALTER TABLE law_links      ENABLE ROW LEVEL SECURITY;

-- ---- profiles -----------------------------------------------------------

CREATE POLICY "Profiles are viewable by everyone"
  ON profiles FOR SELECT
  USING (true);

CREATE POLICY "Users can update their own profile"
  ON profiles FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ---- topics -------------------------------------------------------------

CREATE POLICY "Topics are viewable by everyone"
  ON topics FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can create topics"
  ON topics FOR INSERT
  WITH CHECK (auth.uid() = author_id);

-- ---- topic_supports -----------------------------------------------------

CREATE POLICY "Topic supports are viewable by everyone"
  ON topic_supports FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can support topics"
  ON topic_supports FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ---- votes --------------------------------------------------------------

CREATE POLICY "Votes are viewable by everyone"
  ON votes FOR SELECT
  USING (true);

CREATE POLICY "Authenticated users can vote on active topics"
  ON votes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM topics
      WHERE topics.id = topic_id
        AND topics.status IN ('active', 'voting')
    )
  );

-- ---- laws ---------------------------------------------------------------

CREATE POLICY "Laws are viewable by everyone"
  ON laws FOR SELECT
  USING (true);

-- ---- law_links ----------------------------------------------------------

CREATE POLICY "Law links are viewable by everyone"
  ON law_links FOR SELECT
  USING (true);
