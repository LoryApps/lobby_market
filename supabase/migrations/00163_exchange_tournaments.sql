-- =============================================================================
-- Lobby Market: Exchange Prediction Tournaments
-- Competitive prediction challenges where users compete to make the most
-- accurate civic market forecasts over a fixed time window.
-- =============================================================================

-- ── 1. Tournaments table ──────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS exchange_tournaments (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  title            TEXT        NOT NULL CHECK (char_length(title) BETWEEN 5 AND 120),
  description      TEXT                 CHECK (char_length(description) <= 500),
  category         TEXT,                 -- NULL = all categories
  status           TEXT        NOT NULL DEFAULT 'upcoming'
                               CHECK (status IN ('upcoming', 'active', 'finished')),
  starts_at        TIMESTAMPTZ NOT NULL,
  ends_at          TIMESTAMPTZ NOT NULL CHECK (ends_at > starts_at),
  prize_description TEXT                CHECK (char_length(prize_description) <= 200),
  created_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_et_status     ON exchange_tournaments (status, starts_at);
CREATE INDEX IF NOT EXISTS idx_et_category   ON exchange_tournaments (category);

ALTER TABLE exchange_tournaments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Tournaments are publicly visible"
  ON exchange_tournaments FOR SELECT
  USING (true);

-- ── 2. Tournament entries table ───────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS exchange_tournament_entries (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  tournament_id       UUID        NOT NULL REFERENCES exchange_tournaments (id) ON DELETE CASCADE,
  user_id             UUID        NOT NULL REFERENCES profiles (id) ON DELETE CASCADE,
  score               DECIMAL(10, 4) NOT NULL DEFAULT 0,
  predictions_correct INT         NOT NULL DEFAULT 0,
  predictions_total   INT         NOT NULL DEFAULT 0,
  rank                INT,
  joined_at           TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (tournament_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_ete_tournament
  ON exchange_tournament_entries (tournament_id, score DESC);

CREATE INDEX IF NOT EXISTS idx_ete_user
  ON exchange_tournament_entries (user_id, joined_at DESC);

ALTER TABLE exchange_tournament_entries ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Entries are publicly visible"
  ON exchange_tournament_entries FOR SELECT
  USING (true);

CREATE POLICY "Users manage own entries"
  ON exchange_tournament_entries FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- ── 3. Seed initial tournaments so the page isn't empty ──────────────────────

INSERT INTO exchange_tournaments (title, description, category, status, starts_at, ends_at, prize_description)
VALUES
  (
    'July Accuracy Challenge',
    'Predict the final consensus on 10 active civic markets before month-end. Highest cumulative accuracy wins.',
    NULL,
    'active',
    now() - INTERVAL '5 days',
    now() + INTERVAL '9 days',
    'Gold badge + 500 Clout'
  ),
  (
    'Economics Prediction Cup',
    'All predictions must be on Economics-category topics. Compete on Brier Score across the full category.',
    'Economics',
    'active',
    now() - INTERVAL '2 days',
    now() + INTERVAL '12 days',
    'Economist badge + 300 Clout'
  ),
  (
    'Climate & Environment Sprint',
    'A 7-day blitz on Environment-category markets. Fast-moving debates, fast decisions.',
    'Environment',
    'active',
    now() - INTERVAL '1 day',
    now() + INTERVAL '6 days',
    'Green Forecaster badge'
  ),
  (
    'August Grand Slam',
    'The biggest prediction tournament of the summer — all categories, 30 days, open leaderboard.',
    NULL,
    'upcoming',
    now() + INTERVAL '11 days',
    now() + INTERVAL '41 days',
    'Grand Slam trophy + 1000 Clout + Legendary badge'
  ),
  (
    'Science & Technology Bowl',
    'Predict outcomes across Science and Technology civic debates. AI, space, biotech, and more.',
    'Technology',
    'upcoming',
    now() + INTERVAL '3 days',
    now() + INTERVAL '17 days',
    'Tech Oracle badge + 250 Clout'
  ),
  (
    'June Retrospective',
    'Completed tournament from last month. Review the final standings and top predictions.',
    NULL,
    'finished',
    now() - INTERVAL '35 days',
    now() - INTERVAL '5 days',
    'Champion badge awarded'
  )
ON CONFLICT DO NOTHING;
