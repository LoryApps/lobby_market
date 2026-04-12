-- =============================================================================
-- Lobby Market: Phase 3B — Profiles, Leaderboards, Notifications & Achievements
-- =============================================================================
-- This migration adds:
--   - notifications table for in-app user notifications
--   - achievements catalog (static) + user_achievements (earned)
--   - Seed data for the initial achievement catalog
--   - Reputation recalculation + influence scoring functions
--   - Row Level Security policies for all three tables
-- =============================================================================


-- ---------------------------------------------------------------------------
-- TABLE: notifications
-- ---------------------------------------------------------------------------
-- In-app notifications delivered to a single user. The `reference_id` +
-- `reference_type` pair is polymorphic: the reference_id can point at a
-- topic, debate, law, etc., and reference_type names the target table.
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS notifications (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  type           TEXT        NOT NULL CHECK (type IN (
                              'topic_activated',
                              'vote_threshold',
                              'law_established',
                              'debate_starting',
                              'achievement_earned',
                              'reply_received',
                              'lobby_update',
                              'role_promoted'
                            )),
  title          TEXT        NOT NULL,
  body           TEXT,
  reference_id   UUID,
  reference_type TEXT,
  is_read        BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_notifications_user_created
  ON notifications (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_notifications_user_unread
  ON notifications (user_id, is_read)
  WHERE is_read = FALSE;

COMMENT ON TABLE notifications IS
  'In-app notifications for Lobby Market users (polymorphic reference target).';


-- ---------------------------------------------------------------------------
-- TABLE: achievements (static catalog)
-- ---------------------------------------------------------------------------
-- A catalog of available achievements. Rows are created/updated by the
-- platform, not by end users. `criteria` is machine-readable JSON used by
-- auto-granting logic (future: Edge Function).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS achievements (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  slug        TEXT        UNIQUE NOT NULL,
  name        TEXT        NOT NULL,
  description TEXT        NOT NULL,
  icon        TEXT        NOT NULL,
  tier        TEXT        NOT NULL CHECK (tier IN ('common', 'rare', 'epic', 'legendary')),
  criteria    JSONB       NOT NULL DEFAULT '{}'::jsonb,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_achievements_tier ON achievements (tier);

COMMENT ON TABLE achievements IS
  'Static catalog of achievements that users can earn.';


-- ---------------------------------------------------------------------------
-- TABLE: user_achievements
-- ---------------------------------------------------------------------------
-- Join table: records that a user has earned a particular achievement.
-- Each user can earn each achievement at most once (UNIQUE constraint).
-- ---------------------------------------------------------------------------

CREATE TABLE IF NOT EXISTS user_achievements (
  id             UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id        UUID        NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  achievement_id UUID        NOT NULL REFERENCES achievements (id) ON DELETE CASCADE,
  earned_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, achievement_id)
);

CREATE INDEX IF NOT EXISTS idx_user_achievements_user
  ON user_achievements (user_id);

CREATE INDEX IF NOT EXISTS idx_user_achievements_achievement
  ON user_achievements (achievement_id);

COMMENT ON TABLE user_achievements IS
  'Records of which users have earned which achievements.';


-- ===========================================================================
-- FUNCTIONS
-- ===========================================================================

-- ---------------------------------------------------------------------------
-- calculate_user_influence(user_id)
-- ---------------------------------------------------------------------------
-- Compute a single numeric score summarising how much a user has moved the
-- Lobby Market forward. Currently weighted:
--   - 1 point per cast vote
--   - 5 points per topic authored
--   - 50 points per law authored (topics with status = 'law')
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION calculate_user_influence(p_user_id UUID)
RETURNS REAL AS $$
DECLARE
  score       REAL := 0;
  vote_count  INT  := 0;
  topic_count INT  := 0;
  law_count   INT  := 0;
  accuracy    REAL := 0;
BEGIN
  SELECT COALESCE(total_votes, 0) INTO vote_count FROM profiles WHERE id = p_user_id;
  SELECT COUNT(*) INTO topic_count FROM topics WHERE author_id = p_user_id;
  SELECT COUNT(*) INTO law_count FROM topics WHERE author_id = p_user_id AND status = 'law';

  score := (vote_count * 1) + (topic_count * 5) + (law_count * 50);

  RETURN score;
END;
$$ LANGUAGE plpgsql;


-- ---------------------------------------------------------------------------
-- recalculate_all_reputations()
-- ---------------------------------------------------------------------------
-- Refresh reputation_score on every profile and apply threshold-based role
-- promotions. Intended to be invoked on a cron schedule (pg_cron / Supabase
-- scheduled function).
-- ---------------------------------------------------------------------------

CREATE OR REPLACE FUNCTION recalculate_all_reputations()
RETURNS void AS $$
BEGIN
  UPDATE profiles
  SET reputation_score = calculate_user_influence(id),
      updated_at = now();

  -- Auto-promote 'person' → 'debator' once a user crosses the 500 threshold.
  UPDATE profiles
  SET role = 'debator'
  WHERE role = 'person'
    AND reputation_score >= 500;

  -- Mark influencer status once a user crosses the 10k threshold.
  UPDATE profiles
  SET is_influencer = TRUE
  WHERE reputation_score >= 10000
    AND is_influencer = FALSE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;


-- ===========================================================================
-- ROW LEVEL SECURITY
-- ===========================================================================

ALTER TABLE notifications      ENABLE ROW LEVEL SECURITY;
ALTER TABLE achievements       ENABLE ROW LEVEL SECURITY;
ALTER TABLE user_achievements  ENABLE ROW LEVEL SECURITY;

-- ---- notifications ------------------------------------------------------

DROP POLICY IF EXISTS "Users can view their own notifications" ON notifications;
CREATE POLICY "Users can view their own notifications"
  ON notifications FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Users can update their own notifications" ON notifications;
CREATE POLICY "Users can update their own notifications"
  ON notifications FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ---- achievements (public catalog) -------------------------------------

DROP POLICY IF EXISTS "Achievements are viewable by everyone" ON achievements;
CREATE POLICY "Achievements are viewable by everyone"
  ON achievements FOR SELECT
  USING (true);

-- ---- user_achievements (public: for profile pages) ---------------------

DROP POLICY IF EXISTS "User achievements are viewable by everyone" ON user_achievements;
CREATE POLICY "User achievements are viewable by everyone"
  ON user_achievements FOR SELECT
  USING (true);


-- ===========================================================================
-- SEED: achievement catalog
-- ===========================================================================

INSERT INTO achievements (slug, name, description, icon, tier, criteria) VALUES
  (
    'first-vote',
    'First Vote',
    'Cast your first vote on any topic.',
    'Vote',
    'common',
    '{"type":"total_votes","threshold":1}'::jsonb
  ),
  (
    'first-topic',
    'First Topic',
    'Author your first topic.',
    'MessageSquarePlus',
    'common',
    '{"type":"topics_authored","threshold":1}'::jsonb
  ),
  (
    'first-law',
    'Law Maker',
    'Author a topic that becomes an established Law.',
    'Scale',
    'rare',
    '{"type":"laws_authored","threshold":1}'::jsonb
  ),
  (
    'hundred-votes',
    'Century',
    'Cast 100 votes.',
    'Flame',
    'rare',
    '{"type":"total_votes","threshold":100}'::jsonb
  ),
  (
    'five-streak',
    'On Fire',
    'Maintain a 5-day voting streak.',
    'Zap',
    'rare',
    '{"type":"vote_streak","threshold":5}'::jsonb
  ),
  (
    'thirty-day-streak',
    'Month Strong',
    'Maintain a 30-day voting streak.',
    'CalendarDays',
    'epic',
    '{"type":"vote_streak","threshold":30}'::jsonb
  ),
  (
    'contrarian',
    'Contrarian',
    'Be on the minority side of at least 25 topics that passed.',
    'Shuffle',
    'epic',
    '{"type":"minority_wins","threshold":25}'::jsonb
  ),
  (
    'chain-master',
    'Chain Master',
    'Author a topic that spawns a chain of at least 5 continuations.',
    'Link',
    'epic',
    '{"type":"chain_depth","threshold":5}'::jsonb
  ),
  (
    'founding-member',
    'Founding Member',
    'Among the first 100 registered citizens of the Lobby.',
    'Crown',
    'legendary',
    '{"type":"signup_rank","threshold":100}'::jsonb
  )
ON CONFLICT (slug) DO NOTHING;
