-- =============================================================================
-- Lobby Market: Expanded Achievement Catalog
-- =============================================================================
-- Adds a `category` column to achievements for branch-grouped display,
-- then seeds 23 new achievements across 6 civic branches:
--   voter · orator · scholar · economist · strategist · citizen
-- =============================================================================

-- ── 1. Add category column ────────────────────────────────────────────────────
ALTER TABLE achievements
  ADD COLUMN IF NOT EXISTS category TEXT NOT NULL DEFAULT 'general';

COMMENT ON COLUMN achievements.category IS
  'Civic branch this achievement belongs to (voter, orator, scholar, economist, strategist, citizen)';

-- ── 2. Backfill categories on the original 9 seeds ───────────────────────────
UPDATE achievements SET category = 'voter'      WHERE slug = 'first-vote';
UPDATE achievements SET category = 'voter'      WHERE slug = 'hundred-votes';
UPDATE achievements SET category = 'voter'      WHERE slug = 'five-streak';
UPDATE achievements SET category = 'voter'      WHERE slug = 'thirty-day-streak';
UPDATE achievements SET category = 'voter'      WHERE slug = 'contrarian';
UPDATE achievements SET category = 'orator'     WHERE slug = 'first-topic';
UPDATE achievements SET category = 'strategist' WHERE slug = 'chain-master';
UPDATE achievements SET category = 'citizen'    WHERE slug = 'founding-member';
UPDATE achievements SET category = 'orator'     WHERE slug = 'first-law';

-- ── 3. New achievements ───────────────────────────────────────────────────────

INSERT INTO achievements (slug, name, description, icon, tier, category, criteria) VALUES

  -- ── Voter branch ─────────────────────────────────────────────────────────
  (
    'voter-10',
    'Getting Warmed Up',
    'Cast 10 votes across any topics.',
    'ThumbsUp',
    'common',
    'voter',
    '{"type":"total_votes","threshold":10}'::jsonb
  ),
  (
    'voter-50',
    'Regular at the Polls',
    'Cast 50 votes — you show up.',
    'Vote',
    'common',
    'voter',
    '{"type":"total_votes","threshold":50}'::jsonb
  ),
  (
    'voter-500',
    'Five Hundred Strong',
    'Cast 500 votes. The Lobby runs on citizens like you.',
    'Flame',
    'epic',
    'voter',
    '{"type":"total_votes","threshold":500}'::jsonb
  ),
  (
    'voter-1000',
    'The Thousand',
    'Cast 1,000 votes. A civic legend.',
    'Crown',
    'legendary',
    'voter',
    '{"type":"total_votes","threshold":1000}'::jsonb
  ),
  (
    'streak-3',
    'Three-Peat',
    'Maintain a 3-day voting streak.',
    'Zap',
    'common',
    'voter',
    '{"type":"vote_streak","threshold":3}'::jsonb
  ),
  (
    'streak-7',
    'Week Warrior',
    'Maintain a 7-day voting streak.',
    'CalendarCheck',
    'rare',
    'voter',
    '{"type":"vote_streak","threshold":7}'::jsonb
  ),

  -- ── Orator branch ────────────────────────────────────────────────────────
  (
    'first-argument',
    'First Word',
    'Post your first argument on any topic.',
    'MessageSquare',
    'common',
    'orator',
    '{"type":"total_arguments","threshold":1}'::jsonb
  ),
  (
    'orator-10',
    'Voice in the Room',
    'Post 10 arguments.',
    'Mic',
    'common',
    'orator',
    '{"type":"total_arguments","threshold":10}'::jsonb
  ),
  (
    'orator-50',
    'Floor Speaker',
    'Post 50 arguments — your voice carries.',
    'MessageSquareDot',
    'rare',
    'orator',
    '{"type":"total_arguments","threshold":50}'::jsonb
  ),
  (
    'orator-100',
    'Grand Orator',
    'Post 100 arguments. The chamber knows your name.',
    'BookOpen',
    'epic',
    'orator',
    '{"type":"total_arguments","threshold":100}'::jsonb
  ),

  -- ── Scholar branch ───────────────────────────────────────────────────────
  (
    'bookworm',
    'Bookworm',
    'Bookmark 5 topics for later reading.',
    'Bookmark',
    'common',
    'scholar',
    '{"type":"bookmarks_count","threshold":5}'::jsonb
  ),
  (
    'archivist',
    'The Archivist',
    'Bookmark 25 topics — your personal civic library.',
    'Library',
    'rare',
    'scholar',
    '{"type":"bookmarks_count","threshold":25}'::jsonb
  ),
  (
    'civic-supporter',
    'Civic Supporter',
    'Support 5 topics to help them reach the floor.',
    'HandHelping',
    'common',
    'scholar',
    '{"type":"topics_supported","threshold":5}'::jsonb
  ),

  -- ── Economist branch ─────────────────────────────────────────────────────
  (
    'clout-100',
    'First Hundred',
    'Accumulate 100 clout.',
    'Coins',
    'common',
    'economist',
    '{"type":"clout_balance","threshold":100}'::jsonb
  ),
  (
    'clout-500',
    'Clout Broker',
    'Accumulate 500 clout.',
    'TrendingUp',
    'rare',
    'economist',
    '{"type":"clout_balance","threshold":500}'::jsonb
  ),
  (
    'clout-1000',
    'Civic Investor',
    'Accumulate 1,000 clout. Power player.',
    'Banknote',
    'epic',
    'economist',
    '{"type":"clout_balance","threshold":1000}'::jsonb
  ),

  -- ── Strategist branch ────────────────────────────────────────────────────
  (
    'first-prediction',
    'First Call',
    'Make your first prediction on a topic outcome.',
    'Target',
    'common',
    'strategist',
    '{"type":"predictions_count","threshold":1}'::jsonb
  ),
  (
    'oracle-10',
    'The Oracle',
    'Make 10 predictions.',
    'Eye',
    'rare',
    'strategist',
    '{"type":"predictions_count","threshold":10}'::jsonb
  ),
  (
    'first-debate',
    'Into the Arena',
    'Participate in your first live debate.',
    'Swords',
    'common',
    'strategist',
    '{"type":"debates_count","threshold":1}'::jsonb
  ),
  (
    'debate-veteran',
    'Battle-Tested',
    'Participate in 5 debates.',
    'Shield',
    'rare',
    'strategist',
    '{"type":"debates_count","threshold":5}'::jsonb
  ),
  (
    'coalition-member',
    'Coalition Builder',
    'Join your first coalition.',
    'Users',
    'common',
    'strategist',
    '{"type":"coalitions_count","threshold":1}'::jsonb
  ),

  -- ── Citizen branch ───────────────────────────────────────────────────────
  (
    'first-follower',
    'Noticed',
    'Earn 5 followers in the Lobby.',
    'UserPlus',
    'common',
    'citizen',
    '{"type":"follower_count","threshold":5}'::jsonb
  ),
  (
    'popular',
    'Popular Voice',
    'Earn 25 followers — people are listening.',
    'Users',
    'rare',
    'citizen',
    '{"type":"follower_count","threshold":25}'::jsonb
  ),
  (
    'civic-elder',
    'Civic Elder',
    'Earn 100 followers. A community pillar.',
    'Star',
    'epic',
    'citizen',
    '{"type":"follower_count","threshold":100}'::jsonb
  )

ON CONFLICT (slug) DO NOTHING;
