-- =============================================================================
-- Lobby Market: Phase 4 — Lobbies, Clout Economy, Troll Catcher Moderation
-- =============================================================================
-- This migration introduces:
--   - Lobbies (organised campaigns FOR/AGAINST a topic)
--   - Coalitions (persistent alliances across topics)
--   - Clout transaction ledger (public, radical transparency)
--   - Reports queue + Troll Catcher moderation workflow
--   - Troll Catcher training / certification tracking
-- =============================================================================


-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'lobby_position') THEN
    CREATE TYPE lobby_position AS ENUM ('for', 'against');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'clout_transaction_type') THEN
    CREATE TYPE clout_transaction_type AS ENUM (
      'earned',
      'spent',
      'gifted',
      'refunded'
    );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_status') THEN
    CREATE TYPE report_status AS ENUM (
      'pending',
      'reviewing',
      'resolved',
      'dismissed',
      'escalated'
    );
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'report_action') THEN
    CREATE TYPE report_action AS ENUM (
      'dismiss',
      'warn',
      'hide',
      'escalate',
      'ban'
    );
  END IF;
END$$;


-- ---------------------------------------------------------------------------
-- TABLE: coalitions
-- ---------------------------------------------------------------------------
-- Persistent alliances that span multiple topics. A coalition accumulates
-- a win/loss record as its member lobbies resolve.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS coalitions (
  id                    UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  name                  TEXT          UNIQUE NOT NULL,
  creator_id            UUID          NOT NULL REFERENCES profiles (id),
  description           TEXT,
  member_count          INT           NOT NULL DEFAULT 1,
  coalition_influence   REAL          NOT NULL DEFAULT 0,
  wins                  INT           NOT NULL DEFAULT 0,
  losses                INT           NOT NULL DEFAULT 0,
  is_public             BOOLEAN       NOT NULL DEFAULT TRUE,
  max_members           INT           NOT NULL DEFAULT 100,
  created_at            TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_coalitions_creator    ON coalitions (creator_id);
CREATE INDEX IF NOT EXISTS idx_coalitions_influence  ON coalitions (coalition_influence DESC);

COMMENT ON TABLE coalitions IS
  'Persistent alliances of users that span multiple topics and lobbies';


-- ---------------------------------------------------------------------------
-- TABLE: coalition_members
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS coalition_members (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  coalition_id  UUID        NOT NULL REFERENCES coalitions (id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES profiles (id),
  role          TEXT        NOT NULL DEFAULT 'member'
                CHECK (role IN ('leader', 'officer', 'member')),
  joined_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (coalition_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_coalition_members_coalition ON coalition_members (coalition_id);
CREATE INDEX IF NOT EXISTS idx_coalition_members_user      ON coalition_members (user_id);

COMMENT ON TABLE coalition_members IS 'Users belonging to a coalition';


-- ---------------------------------------------------------------------------
-- TABLE: lobbies
-- ---------------------------------------------------------------------------
-- A campaign FOR or AGAINST a specific topic. A lobby's members are rallying
-- around a single campaign statement. Lobbies may optionally belong to a
-- coalition, which lets an alliance run many lobbies across different topics.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS lobbies (
  id                    UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id              UUID            NOT NULL REFERENCES topics (id) ON DELETE CASCADE,
  creator_id            UUID            NOT NULL REFERENCES profiles (id),
  name                  TEXT            NOT NULL,
  position              lobby_position  NOT NULL,
  campaign_statement    TEXT            NOT NULL
                        CHECK (char_length(campaign_statement) <= 500),
  evidence_links        TEXT[]          NOT NULL DEFAULT '{}',
  coalition_id          UUID            REFERENCES coalitions (id) ON DELETE SET NULL,
  member_count          INT             NOT NULL DEFAULT 1,
  influence_score       REAL            NOT NULL DEFAULT 0,
  is_active             BOOLEAN         NOT NULL DEFAULT TRUE,
  created_at            TIMESTAMPTZ     NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ     NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_lobbies_topic     ON lobbies (topic_id);
CREATE INDEX IF NOT EXISTS idx_lobbies_creator   ON lobbies (creator_id);
CREATE INDEX IF NOT EXISTS idx_lobbies_coalition ON lobbies (coalition_id);
CREATE INDEX IF NOT EXISTS idx_lobbies_active    ON lobbies (is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_lobbies_influence ON lobbies (influence_score DESC);

COMMENT ON TABLE lobbies IS
  'Topic-scoped FOR/AGAINST campaigns that users rally behind';


-- ---------------------------------------------------------------------------
-- TABLE: lobby_members
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS lobby_members (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  lobby_id    UUID        NOT NULL REFERENCES lobbies (id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES profiles (id),
  joined_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (lobby_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_lobby_members_lobby ON lobby_members (lobby_id);
CREATE INDEX IF NOT EXISTS idx_lobby_members_user  ON lobby_members (user_id);

COMMENT ON TABLE lobby_members IS 'Users who have joined a specific lobby';


-- ---------------------------------------------------------------------------
-- TABLE: clout_transactions
-- ---------------------------------------------------------------------------
-- Public ledger of every Clout balance change. Radical transparency: any
-- logged-in user can read every entry. Writes happen exclusively via
-- SECURITY DEFINER server code (no direct RLS insert policy).
-- Convention: amount > 0 for 'earned'/'refunded'; amount < 0 for 'spent'/'gifted'.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS clout_transactions (
  id               UUID                     PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID                     NOT NULL REFERENCES profiles (id),
  type             clout_transaction_type   NOT NULL,
  amount           INT                      NOT NULL,
  reason           TEXT                     NOT NULL,
  reference_id     UUID,
  reference_type   TEXT,
  created_at       TIMESTAMPTZ              NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_clout_tx_user_created
  ON clout_transactions (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_clout_tx_created
  ON clout_transactions (created_at DESC);

COMMENT ON TABLE clout_transactions IS
  'Public ledger of every Clout balance change (radical transparency)';


-- ---------------------------------------------------------------------------
-- TABLE: reports
-- ---------------------------------------------------------------------------
-- Moderation queue. Any logged-in user can file a report; Troll Catchers
-- (and elders) work through the pending queue and take an action.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS reports (
  id                     UUID            PRIMARY KEY DEFAULT gen_random_uuid(),
  reporter_id            UUID            NOT NULL REFERENCES profiles (id),
  reported_user_id       UUID            REFERENCES profiles (id),
  reported_content_type  TEXT            NOT NULL
                         CHECK (reported_content_type IN (
                           'topic', 'message', 'argument', 'lobby', 'continuation'
                         )),
  reported_content_id    UUID            NOT NULL,
  reason                 TEXT            NOT NULL,
  description            TEXT,
  status                 report_status   NOT NULL DEFAULT 'pending',
  reviewer_id            UUID            REFERENCES profiles (id),
  action_taken           report_action,
  resolution_note        TEXT,
  created_at             TIMESTAMPTZ     NOT NULL DEFAULT now(),
  resolved_at            TIMESTAMPTZ
);

-- Fast fetch of the active moderation queue.
CREATE INDEX IF NOT EXISTS idx_reports_queue
  ON reports (status)
  WHERE status IN ('pending', 'reviewing');

CREATE INDEX IF NOT EXISTS idx_reports_reporter ON reports (reporter_id);
CREATE INDEX IF NOT EXISTS idx_reports_reviewer ON reports (reviewer_id);
CREATE INDEX IF NOT EXISTS idx_reports_reported_user ON reports (reported_user_id);

COMMENT ON TABLE reports IS 'Moderation queue — user reports against content';


-- ---------------------------------------------------------------------------
-- TABLE: troll_catcher_training
-- ---------------------------------------------------------------------------
-- Progress tracker for the 20-case Troll Catcher certification module.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS troll_catcher_training (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id          UUID        NOT NULL UNIQUE REFERENCES profiles (id) ON DELETE CASCADE,
  cases_attempted  INT         NOT NULL DEFAULT 0,
  cases_correct    INT         NOT NULL DEFAULT 0,
  accuracy_pct     REAL        NOT NULL DEFAULT 0,
  passed           BOOLEAN     NOT NULL DEFAULT FALSE,
  completed_at     TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_troll_training_user ON troll_catcher_training (user_id);

COMMENT ON TABLE troll_catcher_training IS
  'Per-user progress through the Troll Catcher certification module';


-- ===========================================================================
-- TRIGGER FUNCTIONS
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- handle_lobby_member()
-- ---------------------------------------------------------------------------
-- Keep lobbies.member_count in sync with lobby_members.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION handle_lobby_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE lobbies
    SET member_count = member_count + 1,
        updated_at   = now()
    WHERE id = NEW.lobby_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE lobbies
    SET member_count = GREATEST(member_count - 1, 0),
        updated_at   = now()
    WHERE id = OLD.lobby_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS on_lobby_member_insert ON lobby_members;
CREATE TRIGGER on_lobby_member_insert
  AFTER INSERT ON lobby_members
  FOR EACH ROW
  EXECUTE FUNCTION handle_lobby_member();

DROP TRIGGER IF EXISTS on_lobby_member_delete ON lobby_members;
CREATE TRIGGER on_lobby_member_delete
  AFTER DELETE ON lobby_members
  FOR EACH ROW
  EXECUTE FUNCTION handle_lobby_member();


-- ---------------------------------------------------------------------------
-- handle_coalition_member()
-- ---------------------------------------------------------------------------
-- Keep coalitions.member_count in sync with coalition_members.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION handle_coalition_member()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE coalitions
    SET member_count = member_count + 1,
        updated_at   = now()
    WHERE id = NEW.coalition_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE coalitions
    SET member_count = GREATEST(member_count - 1, 0),
        updated_at   = now()
    WHERE id = OLD.coalition_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS on_coalition_member_insert ON coalition_members;
CREATE TRIGGER on_coalition_member_insert
  AFTER INSERT ON coalition_members
  FOR EACH ROW
  EXECUTE FUNCTION handle_coalition_member();

DROP TRIGGER IF EXISTS on_coalition_member_delete ON coalition_members;
CREATE TRIGGER on_coalition_member_delete
  AFTER DELETE ON coalition_members
  FOR EACH ROW
  EXECUTE FUNCTION handle_coalition_member();


-- ---------------------------------------------------------------------------
-- handle_clout_transaction()
-- ---------------------------------------------------------------------------
-- Apply every clout_transactions row to profiles.clout in a single atomic
-- step, clamping at zero so a buggy spend can never leave a user negative.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION handle_clout_transaction()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE profiles
  SET clout      = GREATEST(clout + NEW.amount, 0),
      updated_at = now()
  WHERE id = NEW.user_id;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_clout_transaction ON clout_transactions;
CREATE TRIGGER on_clout_transaction
  AFTER INSERT ON clout_transactions
  FOR EACH ROW
  EXECUTE FUNCTION handle_clout_transaction();


-- ---------------------------------------------------------------------------
-- set_updated_at on new tables
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS set_updated_at_lobbies ON lobbies;
CREATE TRIGGER set_updated_at_lobbies
  BEFORE UPDATE ON lobbies
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();

DROP TRIGGER IF EXISTS set_updated_at_coalitions ON coalitions;
CREATE TRIGGER set_updated_at_coalitions
  BEFORE UPDATE ON coalitions
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();


-- ===========================================================================
-- ROW LEVEL SECURITY
-- ===========================================================================

ALTER TABLE lobbies                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE lobby_members           ENABLE ROW LEVEL SECURITY;
ALTER TABLE coalitions              ENABLE ROW LEVEL SECURITY;
ALTER TABLE coalition_members       ENABLE ROW LEVEL SECURITY;
ALTER TABLE clout_transactions      ENABLE ROW LEVEL SECURITY;
ALTER TABLE reports                 ENABLE ROW LEVEL SECURITY;
ALTER TABLE troll_catcher_training  ENABLE ROW LEVEL SECURITY;


-- ---- lobbies ------------------------------------------------------------

DROP POLICY IF EXISTS "Lobbies are viewable by everyone" ON lobbies;
CREATE POLICY "Lobbies are viewable by everyone"
  ON lobbies FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can create lobbies" ON lobbies;
CREATE POLICY "Authenticated users can create lobbies"
  ON lobbies FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Creators can update their lobbies" ON lobbies;
CREATE POLICY "Creators can update their lobbies"
  ON lobbies FOR UPDATE
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);


-- ---- lobby_members ------------------------------------------------------

DROP POLICY IF EXISTS "Lobby members are viewable by everyone" ON lobby_members;
CREATE POLICY "Lobby members are viewable by everyone"
  ON lobby_members FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can join lobbies" ON lobby_members;
CREATE POLICY "Authenticated users can join lobbies"
  ON lobby_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can leave lobbies they joined" ON lobby_members;
CREATE POLICY "Users can leave lobbies they joined"
  ON lobby_members FOR DELETE
  USING (auth.uid() = user_id);


-- ---- coalitions ---------------------------------------------------------

DROP POLICY IF EXISTS "Coalitions are viewable by everyone" ON coalitions;
CREATE POLICY "Coalitions are viewable by everyone"
  ON coalitions FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can create coalitions" ON coalitions;
CREATE POLICY "Authenticated users can create coalitions"
  ON coalitions FOR INSERT
  WITH CHECK (auth.uid() = creator_id);

DROP POLICY IF EXISTS "Creators can update their coalitions" ON coalitions;
CREATE POLICY "Creators can update their coalitions"
  ON coalitions FOR UPDATE
  USING (auth.uid() = creator_id)
  WITH CHECK (auth.uid() = creator_id);


-- ---- coalition_members --------------------------------------------------

DROP POLICY IF EXISTS "Coalition members are viewable by everyone" ON coalition_members;
CREATE POLICY "Coalition members are viewable by everyone"
  ON coalition_members FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can join coalitions" ON coalition_members;
CREATE POLICY "Authenticated users can join coalitions"
  ON coalition_members FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can leave coalitions they joined" ON coalition_members;
CREATE POLICY "Users can leave coalitions they joined"
  ON coalition_members FOR DELETE
  USING (auth.uid() = user_id);


-- ---- clout_transactions -------------------------------------------------
-- Radical transparency: everyone can read the ledger.
-- No INSERT/UPDATE/DELETE policies — writes happen exclusively from
-- SECURITY DEFINER server code on the API side.
-- -------------------------------------------------------------------------

DROP POLICY IF EXISTS "Clout ledger is viewable by everyone" ON clout_transactions;
CREATE POLICY "Clout ledger is viewable by everyone"
  ON clout_transactions FOR SELECT
  USING (true);


-- ---- reports ------------------------------------------------------------

DROP POLICY IF EXISTS "Reporters and moderators can view reports" ON reports;
CREATE POLICY "Reporters and moderators can view reports"
  ON reports FOR SELECT
  USING (
    auth.uid() = reporter_id
    OR EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('troll_catcher', 'elder')
    )
  );

DROP POLICY IF EXISTS "Authenticated users can file reports" ON reports;
CREATE POLICY "Authenticated users can file reports"
  ON reports FOR INSERT
  WITH CHECK (auth.uid() = reporter_id);

DROP POLICY IF EXISTS "Moderators can update reports" ON reports;
CREATE POLICY "Moderators can update reports"
  ON reports FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('troll_catcher', 'elder')
    )
  );


-- ---- troll_catcher_training ---------------------------------------------

DROP POLICY IF EXISTS "Users can view their own training progress" ON troll_catcher_training;
CREATE POLICY "Users can view their own training progress"
  ON troll_catcher_training FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can create their own training record" ON troll_catcher_training;
CREATE POLICY "Users can create their own training record"
  ON troll_catcher_training FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own training progress" ON troll_catcher_training;
CREATE POLICY "Users can update their own training progress"
  ON troll_catcher_training FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);


-- =============================================================================
-- End of 00005_lobbies_clout_moderation.sql
-- =============================================================================
