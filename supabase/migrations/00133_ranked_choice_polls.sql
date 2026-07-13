-- =============================================================================
-- Lobby Market: Ranked Choice Polls
-- =============================================================================
-- Multi-option civic polls where users rank alternatives in order of preference.
-- Results are tallied via Instant Runoff Voting (IRV) to find the majority winner.
-- Any authenticated citizen can create a poll; any citizen can vote once per poll.
-- =============================================================================

CREATE TABLE IF NOT EXISTS ranked_choice_polls (
  id            UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  created_by    UUID         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  title         TEXT         NOT NULL CHECK (char_length(title) BETWEEN 10 AND 160),
  description   TEXT         CHECK (char_length(description) <= 500),
  category      TEXT         NOT NULL DEFAULT 'Politics'
                             CHECK (category IN (
                               'Politics','Economics','Technology','Science',
                               'Ethics','Philosophy','Culture','Health',
                               'Education','Environment','Other'
                             )),

  status        TEXT         NOT NULL DEFAULT 'open'
                             CHECK (status IN ('open', 'closed', 'archived')),

  -- At least 3, at most 8 options (enforced at application layer)
  closes_at     TIMESTAMPTZ  NOT NULL DEFAULT (now() + INTERVAL '7 days'),
  created_at    TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS ranked_choice_options (
  id         UUID   PRIMARY KEY DEFAULT gen_random_uuid(),
  poll_id    UUID   NOT NULL REFERENCES ranked_choice_polls(id) ON DELETE CASCADE,
  text       TEXT   NOT NULL CHECK (char_length(text) BETWEEN 2 AND 120),
  position   INT    NOT NULL DEFAULT 0,
  UNIQUE (poll_id, position)
);

-- Each user submits a full ranking: [{option_id, rank}] ordered 1..N
CREATE TABLE IF NOT EXISTS ranked_choice_votes (
  poll_id    UUID         NOT NULL REFERENCES ranked_choice_polls(id) ON DELETE CASCADE,
  user_id    UUID         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  rankings   JSONB        NOT NULL DEFAULT '[]',
  created_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ  NOT NULL DEFAULT now(),
  PRIMARY KEY (poll_id, user_id)
);

-- ── Indexes ─────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_rcp_created_by  ON ranked_choice_polls (created_by);
CREATE INDEX IF NOT EXISTS idx_rcp_status       ON ranked_choice_polls (status);
CREATE INDEX IF NOT EXISTS idx_rcp_category     ON ranked_choice_polls (category);
CREATE INDEX IF NOT EXISTS idx_rcp_closes_at    ON ranked_choice_polls (closes_at DESC);
CREATE INDEX IF NOT EXISTS idx_rco_poll_id      ON ranked_choice_options (poll_id, position);
CREATE INDEX IF NOT EXISTS idx_rcv_poll_id      ON ranked_choice_votes (poll_id);
CREATE INDEX IF NOT EXISTS idx_rcv_user_id      ON ranked_choice_votes (user_id);

-- ── Row Level Security ──────────────────────────────────────────────────────────

ALTER TABLE ranked_choice_polls   ENABLE ROW LEVEL SECURITY;
ALTER TABLE ranked_choice_options ENABLE ROW LEVEL SECURITY;
ALTER TABLE ranked_choice_votes   ENABLE ROW LEVEL SECURITY;

-- Polls: public read
CREATE POLICY "rcp_select_public"
  ON ranked_choice_polls FOR SELECT USING (true);

-- Polls: authenticated users can create
CREATE POLICY "rcp_insert_authenticated"
  ON ranked_choice_polls FOR INSERT
  WITH CHECK (auth.uid() = created_by);

-- Polls: only creator can update/close
CREATE POLICY "rcp_update_own"
  ON ranked_choice_polls FOR UPDATE
  USING (auth.uid() = created_by);

-- Options: public read
CREATE POLICY "rco_select_public"
  ON ranked_choice_options FOR SELECT USING (true);

-- Options: creator of the poll can insert options
CREATE POLICY "rco_insert_own"
  ON ranked_choice_options FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM ranked_choice_polls
      WHERE id = poll_id AND created_by = auth.uid()
    )
  );

-- Votes: only the voter can see their own vote
CREATE POLICY "rcv_select_own"
  ON ranked_choice_votes FOR SELECT
  USING (auth.uid() = user_id);

-- Votes: authenticated users can vote (once per poll — enforced by PK)
CREATE POLICY "rcv_insert"
  ON ranked_choice_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Votes: users can update their own ranking while poll is open
CREATE POLICY "rcv_update_own"
  ON ranked_choice_votes FOR UPDATE
  USING (auth.uid() = user_id);

-- ── Seed: 3 civic polls to bootstrap the gallery ────────────────────────────────

WITH poll_eco AS (
  INSERT INTO ranked_choice_polls (id, created_by, title, description, category, status, closes_at)
  SELECT
    gen_random_uuid(),
    id,
    'How should the government prioritise economic recovery?',
    'Rank the following policy approaches from most to least preferable. The winning approach will be formally tabled in the next budget debate.',
    'Economics',
    'open',
    now() + interval '7 days'
  FROM profiles LIMIT 1
  RETURNING id
)
INSERT INTO ranked_choice_options (poll_id, text, position)
SELECT id, unnest(ARRAY[
  'Universal Basic Income for all citizens',
  'Tax cuts for small businesses',
  'Green infrastructure investment',
  'Public housing expansion',
  'Free skills retraining programmes'
]), generate_series(0, 4)
FROM poll_eco;

WITH poll_tech AS (
  INSERT INTO ranked_choice_polls (id, created_by, title, description, category, status, closes_at)
  SELECT
    gen_random_uuid(),
    id,
    'Which AI governance model do you prefer?',
    'Rank these approaches to regulating artificial intelligence in public life.',
    'Technology',
    'open',
    now() + interval '14 days'
  FROM profiles LIMIT 1
  RETURNING id
)
INSERT INTO ranked_choice_options (poll_id, text, position)
SELECT id, unnest(ARRAY[
  'Government-led independent regulator',
  'Industry self-regulation with audits',
  'Open-source transparency mandate',
  'International treaty-based oversight',
  'Ban high-risk AI outright'
]), generate_series(0, 4)
FROM poll_tech;

WITH poll_env AS (
  INSERT INTO ranked_choice_polls (id, created_by, title, description, category, status, closes_at)
  SELECT
    gen_random_uuid(),
    id,
    'What is the most urgent environmental priority?',
    'Rank these environmental challenges by how urgently they need policy attention.',
    'Environment',
    'open',
    now() + interval '10 days'
  FROM profiles LIMIT 1
  RETURNING id
)
INSERT INTO ranked_choice_options (poll_id, text, position)
SELECT id, unnest(ARRAY[
  'Climate change mitigation',
  'Biodiversity loss and habitat destruction',
  'Ocean plastic pollution',
  'Air quality in cities',
  'Water scarcity and access'
]), generate_series(0, 4)
FROM poll_env;
