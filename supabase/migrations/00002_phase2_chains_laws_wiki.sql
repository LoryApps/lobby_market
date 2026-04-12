-- =============================================================================
-- Lobby Market: Phase 2 — Continuation Chains, Law Wiki, Law Reopening
-- =============================================================================
-- This migration extends the Phase 1 schema with:
--   - Continuation ("...but/and") proposal + voting lifecycle for chained topics
--   - Wiki-style revision history for Law body_markdown
--   - Petition-based Law reopening with original-voter consent
--   - Periodic threshold evaluator that advances topics through their lifecycle
--   - Feed score calculation function
-- =============================================================================


-- ---------------------------------------------------------------------------
-- ENUMS
-- ---------------------------------------------------------------------------

-- Lifecycle of a single continuation proposal during a chain phase.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'continuation_status') THEN
    CREATE TYPE continuation_status AS ENUM (
      'pending',    -- Still being boosted/considered during the authoring window
      'finalist',   -- Made it into the plurality vote phase
      'winner',     -- Won the plurality vote and became the next chain link
      'rejected'    -- Eliminated before or during the vote
    );
  END IF;
END$$;

-- Lifecycle of a Law-reopen petition.
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_type WHERE typname = 'reopen_status') THEN
    CREATE TYPE reopen_status AS ENUM (
      'pending',    -- Collecting consents / override support
      'approved',   -- Enough consents collected — law goes back to voting
      'rejected',   -- Petition explicitly denied
      'expired'     -- 30-day window lapsed without reaching threshold
    );
  END IF;
END$$;


-- ---------------------------------------------------------------------------
-- TABLE: continuations
-- ---------------------------------------------------------------------------
-- A proposed "...but X" or "...and X" continuation during a topic's authoring
-- window. Boosts/endorsements decide which continuations reach the plurality
-- vote phase. Only one continuation per author per topic.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS continuations (
  id                  UUID                PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id            UUID                NOT NULL REFERENCES topics (id) ON DELETE CASCADE,
  author_id           UUID                NOT NULL REFERENCES profiles (id),
  text                TEXT                NOT NULL CHECK (char_length(text) <= 100),
  connector           TEXT                NOT NULL CHECK (connector IN ('but', 'and')),
  boost_count         INT                 NOT NULL DEFAULT 0,
  endorsement_count   INT                 NOT NULL DEFAULT 0,
  vote_count          INT                 NOT NULL DEFAULT 0,
  status              continuation_status NOT NULL DEFAULT 'pending',
  created_at          TIMESTAMPTZ         NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ         NOT NULL DEFAULT now(),
  UNIQUE (topic_id, author_id)
);

CREATE INDEX IF NOT EXISTS idx_continuations_topic       ON continuations (topic_id);
CREATE INDEX IF NOT EXISTS idx_continuations_status      ON continuations (status);
CREATE INDEX IF NOT EXISTS idx_continuations_boost_desc  ON continuations (boost_count DESC);

COMMENT ON TABLE continuations IS
  'Proposed "...but/and" continuations authored during a topic''s chain window';


-- ---------------------------------------------------------------------------
-- TABLE: continuation_boosts
-- ---------------------------------------------------------------------------
-- Users boosting a continuation during the authoring window. A boost from a
-- Debator or higher also counts as an endorsement (tracked separately).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS continuation_boosts (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  continuation_id   UUID        NOT NULL REFERENCES continuations (id) ON DELETE CASCADE,
  user_id           UUID        NOT NULL REFERENCES profiles (id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (continuation_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_continuation_boosts_cont ON continuation_boosts (continuation_id);
CREATE INDEX IF NOT EXISTS idx_continuation_boosts_user ON continuation_boosts (user_id);

COMMENT ON TABLE continuation_boosts IS
  'Per-user boosts of a continuation during the authoring window';


-- ---------------------------------------------------------------------------
-- TABLE: continuation_votes
-- ---------------------------------------------------------------------------
-- Plurality votes during the continuation vote phase. One vote per user per
-- topic; the continuation with the most votes becomes the next chain link.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS continuation_votes (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id          UUID        NOT NULL REFERENCES topics (id) ON DELETE CASCADE,
  continuation_id   UUID        NOT NULL REFERENCES continuations (id) ON DELETE CASCADE,
  user_id           UUID        NOT NULL REFERENCES profiles (id),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (topic_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_continuation_votes_topic_cont
  ON continuation_votes (topic_id, continuation_id);
CREATE INDEX IF NOT EXISTS idx_continuation_votes_user
  ON continuation_votes (user_id);

COMMENT ON TABLE continuation_votes IS
  'Plurality votes cast during a topic''s continuation vote phase';


-- ---------------------------------------------------------------------------
-- TABLE: law_revisions
-- ---------------------------------------------------------------------------
-- Wiki-style edit history for a Law's body_markdown. Each edit snapshots the
-- full body with a monotonically increasing revision number.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS law_revisions (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  law_id          UUID        NOT NULL REFERENCES laws (id) ON DELETE CASCADE,
  editor_id       UUID        NOT NULL REFERENCES profiles (id),
  body_markdown   TEXT        NOT NULL,
  summary         TEXT,
  revision_num    INT         NOT NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (law_id, revision_num)
);

CREATE INDEX IF NOT EXISTS idx_law_revisions_law_rev
  ON law_revisions (law_id, revision_num DESC);

COMMENT ON TABLE law_revisions IS
  'Wiki-style edit history for Law body_markdown content';


-- ---------------------------------------------------------------------------
-- TABLE: law_reopen_requests
-- ---------------------------------------------------------------------------
-- A petition to reopen an established Law for re-voting. Two paths to approval:
--   1. Consent path: a majority of the original voters explicitly consent
--   2. Override path: 5x the original vote count in new support
-- The requester auto-consents when creating the request (consent_count = 1).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS law_reopen_requests (
  id                        UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  law_id                    UUID          NOT NULL REFERENCES laws (id) ON DELETE CASCADE,
  topic_id                  UUID          NOT NULL REFERENCES topics (id),
  requester_id              UUID          NOT NULL REFERENCES profiles (id),
  case_for_repeal           TEXT          NOT NULL CHECK (char_length(case_for_repeal) >= 200),
  total_original_voters     INT           NOT NULL,
  consent_count             INT           NOT NULL DEFAULT 1,
  override_support_count    INT           NOT NULL DEFAULT 0,
  status                    reopen_status NOT NULL DEFAULT 'pending',
  expires_at                TIMESTAMPTZ   NOT NULL DEFAULT (now() + interval '30 days'),
  created_at                TIMESTAMPTZ   NOT NULL DEFAULT now()
);

-- One active (pending) request per law.
CREATE UNIQUE INDEX IF NOT EXISTS idx_law_reopen_requests_one_pending
  ON law_reopen_requests (law_id)
  WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_law_reopen_requests_status ON law_reopen_requests (status);
CREATE INDEX IF NOT EXISTS idx_law_reopen_requests_law    ON law_reopen_requests (law_id);

COMMENT ON TABLE law_reopen_requests IS
  'Petitions to reopen an established Law for re-voting';


-- ---------------------------------------------------------------------------
-- TABLE: law_reopen_consents
-- ---------------------------------------------------------------------------
-- A record of an original voter consenting to reopen a Law. One consent per
-- user per request.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS law_reopen_consents (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  request_id  UUID        NOT NULL REFERENCES law_reopen_requests (id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES profiles (id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (request_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_law_reopen_consents_request ON law_reopen_consents (request_id);
CREATE INDEX IF NOT EXISTS idx_law_reopen_consents_user    ON law_reopen_consents (user_id);

COMMENT ON TABLE law_reopen_consents IS
  'Original voters consenting to reopen a Law via a reopen request';


-- ---------------------------------------------------------------------------
-- ALTER TABLE: topics — chain window timestamps
-- ---------------------------------------------------------------------------
-- Two new timestamps to track the two phases of a continuation chain:
--   - continuation_window_ends_at: when continuation authoring closes
--   - continuation_vote_ends_at:   when the plurality vote closes
-- ---------------------------------------------------------------------------

ALTER TABLE topics
  ADD COLUMN IF NOT EXISTS continuation_window_ends_at TIMESTAMPTZ;

ALTER TABLE topics
  ADD COLUMN IF NOT EXISTS continuation_vote_ends_at TIMESTAMPTZ;

COMMENT ON COLUMN topics.continuation_window_ends_at IS
  'Deadline for authoring "...but/and" continuations during a chain phase';
COMMENT ON COLUMN topics.continuation_vote_ends_at IS
  'Deadline for the plurality vote that selects the winning continuation';


-- ===========================================================================
-- TRIGGER FUNCTIONS
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- handle_continuation_boost()
-- ---------------------------------------------------------------------------
-- When a user boosts a continuation:
--   - Always increment boost_count
--   - If booster is Debator or higher, also increment endorsement_count
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION handle_continuation_boost()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_booster_role user_role;
BEGIN
  SELECT role INTO v_booster_role
  FROM profiles
  WHERE id = NEW.user_id;

  IF v_booster_role IN ('debator', 'troll_catcher', 'elder') THEN
    UPDATE continuations
    SET boost_count       = boost_count + 1,
        endorsement_count = endorsement_count + 1
    WHERE id = NEW.continuation_id;
  ELSE
    UPDATE continuations
    SET boost_count = boost_count + 1
    WHERE id = NEW.continuation_id;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_continuation_boost ON continuation_boosts;
CREATE TRIGGER on_continuation_boost
  AFTER INSERT ON continuation_boosts
  FOR EACH ROW
  EXECUTE FUNCTION handle_continuation_boost();


-- ---------------------------------------------------------------------------
-- handle_continuation_vote()
-- ---------------------------------------------------------------------------
-- When a user votes for a continuation during the plurality vote phase,
-- increment that continuation's vote_count.
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION handle_continuation_vote()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE continuations
  SET vote_count = vote_count + 1
  WHERE id = NEW.continuation_id;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_continuation_vote ON continuation_votes;
CREATE TRIGGER on_continuation_vote
  AFTER INSERT ON continuation_votes
  FOR EACH ROW
  EXECUTE FUNCTION handle_continuation_vote();


-- ---------------------------------------------------------------------------
-- handle_law_reopen_consent()
-- ---------------------------------------------------------------------------
-- When an original voter consents to a reopen request:
--   - Increment consent_count
--   - If consent_count reaches total_original_voters, approve the request
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION handle_law_reopen_consent()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_request law_reopen_requests%ROWTYPE;
BEGIN
  UPDATE law_reopen_requests
  SET consent_count = consent_count + 1
  WHERE id = NEW.request_id
  RETURNING * INTO v_request;

  IF v_request.consent_count >= v_request.total_original_voters THEN
    UPDATE law_reopen_requests
    SET status = 'approved'
    WHERE id = NEW.request_id
      AND status = 'pending';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_law_reopen_consent ON law_reopen_consents;
CREATE TRIGGER on_law_reopen_consent
  AFTER INSERT ON law_reopen_consents
  FOR EACH ROW
  EXECUTE FUNCTION handle_law_reopen_consent();


-- ---------------------------------------------------------------------------
-- set_updated_at on continuations
-- ---------------------------------------------------------------------------

DROP TRIGGER IF EXISTS set_updated_at_continuations ON continuations;
CREATE TRIGGER set_updated_at_continuations
  BEFORE UPDATE ON continuations
  FOR EACH ROW
  EXECUTE FUNCTION set_updated_at();


-- ===========================================================================
-- THRESHOLD EVALUATOR
-- ===========================================================================
-- Periodic job that advances topics whose voting period has ended:
--   - >= 67% either side         -> Law (creates laws row)
--   - >  50% but < 67%           -> Continued (opens 24h continuation window)
--                                    unless max chain_depth reached, then archived
--   - <= 50% both sides (tied)   -> Failed
-- Also promotes topics whose continuation authoring window has just closed
-- into the 'voting' phase (plurality vote on continuations).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION evaluate_topic_thresholds()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  topic_row   RECORD;
  against_pct REAL;
BEGIN
  -- 1. Score-based advancement for topics whose voting deadline has passed.
  FOR topic_row IN
    SELECT *
    FROM topics
    WHERE status IN ('active', 'voting')
      AND voting_ends_at IS NOT NULL
      AND voting_ends_at <= now()
  LOOP
    against_pct := 100.0 - topic_row.blue_pct;

    -- Law: supermajority either side
    IF topic_row.blue_pct >= 67 OR against_pct >= 67 THEN
      UPDATE topics SET status = 'law' WHERE id = topic_row.id;

      -- Materialise a laws row (skip if one already exists for this topic)
      INSERT INTO laws (
        topic_id, statement, full_statement, category,
        established_at, blue_pct, total_votes
      )
      VALUES (
        topic_row.id,
        topic_row.statement,
        topic_row.statement,  -- full chain text is patched in later
        topic_row.category,
        now(),
        topic_row.blue_pct,
        topic_row.total_votes
      )
      ON CONFLICT (topic_id) DO NOTHING;

    -- Chain: simple majority but short of supermajority
    ELSIF topic_row.blue_pct > 50 OR against_pct > 50 THEN
      IF topic_row.chain_depth < 3 THEN
        UPDATE topics
        SET status                      = 'continued',
            continuation_window_ends_at = now() + interval '24 hours'
        WHERE id = topic_row.id;
      ELSE
        -- Max chain depth hit — archive as near-law
        UPDATE topics SET status = 'archived' WHERE id = topic_row.id;
      END IF;

    -- Failed: tied or below on both sides
    ELSE
      UPDATE topics SET status = 'failed' WHERE id = topic_row.id;
    END IF;
  END LOOP;

  -- 2. Transition: continuation authoring window -> plurality vote phase.
  UPDATE topics
  SET status                    = 'voting',
      voting_ends_at            = now() + interval '48 hours',
      continuation_vote_ends_at = now() + interval '48 hours'
  WHERE status = 'continued'
    AND continuation_window_ends_at IS NOT NULL
    AND continuation_window_ends_at <= now();
  -- Note: the actual winner-selection happens elsewhere via continuation_votes;
  -- this block just advances the status so voting can begin.
END;
$$;

COMMENT ON FUNCTION evaluate_topic_thresholds() IS
  'Periodic evaluator that advances topics through law/chain/failed outcomes';


-- ===========================================================================
-- FEED SCORE CALCULATION
-- ===========================================================================
-- Recompute feed_score across all non-terminal topics. Blends:
--   - Engagement  (log of vote + support count)
--   - Controversy (closer to 50/50 = higher)
--   - Time decay  (older topics sink)
--   - Status boost (active/voting topics surface first)
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION calculate_feed_scores()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE topics
  SET feed_score =
      -- Base engagement: log of vote + support activity
      LOG(GREATEST(total_votes + support_count, 1)) * 10
      -- Controversy bonus: tighter margins score higher
      + (100 - ABS(blue_pct - 50) * 2) * 0.1
      -- Time decay: older topics lose score
      - EXTRACT(EPOCH FROM (now() - created_at)) / 3600.0 * 0.05
      -- Status-specific boost
      + CASE
          WHEN status = 'active'    OR status = 'voting' THEN 50
          WHEN status = 'proposed'                       THEN 20
          WHEN status = 'continued'                      THEN 40
          WHEN status = 'law'                            THEN 10
          ELSE 0
        END
  WHERE status IN ('proposed', 'active', 'voting', 'continued', 'law');
END;
$$;

COMMENT ON FUNCTION calculate_feed_scores() IS
  'Recomputes topics.feed_score using engagement, controversy, time decay, and status';


-- ===========================================================================
-- ROW LEVEL SECURITY
-- ===========================================================================

ALTER TABLE continuations         ENABLE ROW LEVEL SECURITY;
ALTER TABLE continuation_boosts   ENABLE ROW LEVEL SECURITY;
ALTER TABLE continuation_votes    ENABLE ROW LEVEL SECURITY;
ALTER TABLE law_revisions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE law_reopen_requests   ENABLE ROW LEVEL SECURITY;
ALTER TABLE law_reopen_consents   ENABLE ROW LEVEL SECURITY;


-- ---- continuations ------------------------------------------------------

DROP POLICY IF EXISTS "Continuations are viewable by everyone" ON continuations;
CREATE POLICY "Continuations are viewable by everyone"
  ON continuations FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Debators can author continuations on chained topics" ON continuations;
CREATE POLICY "Debators can author continuations on chained topics"
  ON continuations FOR INSERT
  WITH CHECK (
    auth.uid() = author_id
    AND EXISTS (
      SELECT 1 FROM topics
      WHERE topics.id = topic_id
        AND topics.status = 'continued'
    )
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('debator', 'troll_catcher', 'elder')
    )
  );


-- ---- continuation_boosts -------------------------------------------------

DROP POLICY IF EXISTS "Continuation boosts are viewable by everyone" ON continuation_boosts;
CREATE POLICY "Continuation boosts are viewable by everyone"
  ON continuation_boosts FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can boost continuations" ON continuation_boosts;
CREATE POLICY "Authenticated users can boost continuations"
  ON continuation_boosts FOR INSERT
  WITH CHECK (auth.uid() = user_id);


-- ---- continuation_votes --------------------------------------------------

DROP POLICY IF EXISTS "Continuation votes are viewable by everyone" ON continuation_votes;
CREATE POLICY "Continuation votes are viewable by everyone"
  ON continuation_votes FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Authenticated users can vote on continuations" ON continuation_votes;
CREATE POLICY "Authenticated users can vote on continuations"
  ON continuation_votes FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1 FROM topics
      WHERE topics.id = topic_id
        AND topics.status = 'voting'
        AND topics.continuation_vote_ends_at IS NOT NULL
    )
  );


-- ---- law_revisions -------------------------------------------------------

DROP POLICY IF EXISTS "Law revisions are viewable by everyone" ON law_revisions;
CREATE POLICY "Law revisions are viewable by everyone"
  ON law_revisions FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Debators can edit law body" ON law_revisions;
CREATE POLICY "Debators can edit law body"
  ON law_revisions FOR INSERT
  WITH CHECK (
    auth.uid() = editor_id
    AND EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role IN ('debator', 'troll_catcher', 'elder')
    )
  );


-- ---- law_reopen_requests -------------------------------------------------

DROP POLICY IF EXISTS "Law reopen requests are viewable by everyone" ON law_reopen_requests;
CREATE POLICY "Law reopen requests are viewable by everyone"
  ON law_reopen_requests FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Original voters can petition to reopen a law" ON law_reopen_requests;
CREATE POLICY "Original voters can petition to reopen a law"
  ON law_reopen_requests FOR INSERT
  WITH CHECK (
    auth.uid() = requester_id
    AND EXISTS (
      SELECT 1 FROM votes
      WHERE votes.topic_id = law_reopen_requests.topic_id
        AND votes.user_id  = auth.uid()
    )
  );


-- ---- law_reopen_consents -------------------------------------------------

DROP POLICY IF EXISTS "Law reopen consents are viewable by everyone" ON law_reopen_consents;
CREATE POLICY "Law reopen consents are viewable by everyone"
  ON law_reopen_consents FOR SELECT
  USING (true);

DROP POLICY IF EXISTS "Original voters can consent to reopen" ON law_reopen_consents;
CREATE POLICY "Original voters can consent to reopen"
  ON law_reopen_consents FOR INSERT
  WITH CHECK (
    auth.uid() = user_id
    AND EXISTS (
      SELECT 1
      FROM law_reopen_requests r
      JOIN votes v
        ON v.topic_id = r.topic_id
       AND v.user_id  = auth.uid()
      WHERE r.id = law_reopen_consents.request_id
    )
  );


-- =============================================================================
-- End of 00002_phase2_chains_laws_wiki.sql
-- =============================================================================
