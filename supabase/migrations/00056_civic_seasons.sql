-- =============================================================================
-- Lobby Market: Civic Seasons
-- =============================================================================
-- Monthly competitive meta-game. Each season spans ~4 weeks; citizens earn
-- season points for every civic action.  At season end, top performers earn
-- exclusive season titles and badges.
--
-- Point scoring:
--   1 pt  per vote cast
--   5 pts per argument posted
--  10 pts per debate participated in
--  25 pts per topic that became law (user must have voted FOR)
--   3 pts per argument upvote received
--  15 pts per prediction that resolved correctly
-- =============================================================================

-- ── 1. Seasons master table ───────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS civic_seasons (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT        NOT NULL CHECK (char_length(name) BETWEEN 3 AND 80),
  slug        TEXT        NOT NULL UNIQUE CHECK (char_length(slug) BETWEEN 3 AND 40),
  tagline     TEXT        CHECK (tagline IS NULL OR char_length(tagline) <= 120),
  starts_at   TIMESTAMPTZ NOT NULL,
  ends_at     TIMESTAMPTZ NOT NULL,
  is_active   BOOLEAN     NOT NULL DEFAULT FALSE,
  theme_color TEXT        NOT NULL DEFAULT '#8b5cf6'
              CHECK (theme_color ~ '^#[0-9a-fA-F]{6}$'),
  theme_icon  TEXT        NOT NULL DEFAULT 'Sparkles',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT seasons_end_after_start CHECK (ends_at > starts_at)
);

-- Only one active season at a time
CREATE UNIQUE INDEX IF NOT EXISTS idx_civic_seasons_one_active
  ON civic_seasons (is_active)
  WHERE is_active = TRUE;

-- ── 2. Season leaderboard entries ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS season_points (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  season_id     UUID        NOT NULL REFERENCES civic_seasons(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vote_pts      INT         NOT NULL DEFAULT 0 CHECK (vote_pts >= 0),
  argument_pts  INT         NOT NULL DEFAULT 0 CHECK (argument_pts >= 0),
  debate_pts    INT         NOT NULL DEFAULT 0 CHECK (debate_pts >= 0),
  law_pts       INT         NOT NULL DEFAULT 0 CHECK (law_pts >= 0),
  upvote_pts    INT         NOT NULL DEFAULT 0 CHECK (upvote_pts >= 0),
  prediction_pts INT        NOT NULL DEFAULT 0 CHECK (prediction_pts >= 0),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (season_id, user_id)
);

-- Fast leaderboard queries
CREATE INDEX IF NOT EXISTS idx_season_points_season
  ON season_points (season_id, (vote_pts + argument_pts + debate_pts + law_pts + upvote_pts + prediction_pts) DESC);

CREATE INDEX IF NOT EXISTS idx_season_points_user
  ON season_points (user_id, season_id);

-- ── 3. RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE civic_seasons  ENABLE ROW LEVEL SECURITY;
ALTER TABLE season_points  ENABLE ROW LEVEL SECURITY;

-- Anyone can read seasons
CREATE POLICY "seasons_read_all"
  ON civic_seasons FOR SELECT USING (TRUE);

-- Anyone can read season points
CREATE POLICY "season_points_read_all"
  ON season_points FOR SELECT USING (TRUE);

-- Only authenticated users can upsert their own row (via server-side RPC)
CREATE POLICY "season_points_self_upsert"
  ON season_points FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 4. Helper: upsert season points for a user ────────────────────────────────

CREATE OR REPLACE FUNCTION fn_award_season_points(
  p_user_id      UUID,
  p_season_id    UUID,
  p_vote_pts     INT DEFAULT 0,
  p_argument_pts INT DEFAULT 0,
  p_debate_pts   INT DEFAULT 0,
  p_law_pts      INT DEFAULT 0,
  p_upvote_pts   INT DEFAULT 0,
  p_prediction_pts INT DEFAULT 0
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  INSERT INTO season_points (
    season_id, user_id,
    vote_pts, argument_pts, debate_pts,
    law_pts, upvote_pts, prediction_pts
  ) VALUES (
    p_season_id, p_user_id,
    p_vote_pts, p_argument_pts, p_debate_pts,
    p_law_pts, p_upvote_pts, p_prediction_pts
  )
  ON CONFLICT (season_id, user_id) DO UPDATE SET
    vote_pts       = season_points.vote_pts       + EXCLUDED.vote_pts,
    argument_pts   = season_points.argument_pts   + EXCLUDED.argument_pts,
    debate_pts     = season_points.debate_pts     + EXCLUDED.debate_pts,
    law_pts        = season_points.law_pts        + EXCLUDED.law_pts,
    upvote_pts     = season_points.upvote_pts     + EXCLUDED.upvote_pts,
    prediction_pts = season_points.prediction_pts + EXCLUDED.prediction_pts,
    updated_at     = now();
END;
$$;

-- ── 5. Seed the inaugural season ─────────────────────────────────────────────

INSERT INTO civic_seasons (name, slug, tagline, starts_at, ends_at, is_active, theme_color, theme_icon)
VALUES (
  'Season 1 — The Founding',
  's1-founding',
  'The first citizens shape the Lobby. Every vote counts double in history.',
  '2026-05-01T00:00:00Z',
  '2026-05-31T23:59:59Z',
  TRUE,
  '#c9a84c',
  'Crown'
)
ON CONFLICT (slug) DO NOTHING;
