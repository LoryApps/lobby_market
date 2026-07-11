-- =============================================================================
-- Lobby Market: Civic Filibuster — parliamentary debate extension mechanism
-- =============================================================================
-- Any authenticated user may file a filibuster on a topic that is currently
-- in the 'voting' phase.  Filing costs 5 Clout (to prevent spam).  The
-- filibustering citizen must supply a substantive speech (min 150 chars)
-- explaining why the community needs more time to debate before the vote
-- closes.
--
-- Once filed, other users can vote:
--   'cloture'  — force the vote to proceed (end the filibuster)
--   'second'   — support extending debate (back the filibuster)
--
-- Resolution rules (evaluated every hour via the existing cron):
--   • cloture_count  >= cloture_threshold → filibuster overridden; vote proceeds.
--   • second_count   >= second_threshold  → voting deadline extended by extend_hours.
--   • expires_at reached with neither threshold met → filibuster lapses quietly.
--
-- Limits:
--   • One active filibuster per topic at a time.
--   • A user may only filibuster a given topic once (even across multiple
--     voting cycles — prevents repeat stalling).
-- =============================================================================

CREATE TABLE IF NOT EXISTS civic_filibusters (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id          UUID        NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  filibuster_id     UUID        REFERENCES profiles(id) ON DELETE SET NULL,

  -- The parliamentary speech — must explain the grounds for extending debate.
  title             TEXT        NOT NULL CHECK (char_length(title) BETWEEN 10 AND 120),
  speech            TEXT        NOT NULL CHECK (char_length(speech) BETWEEN 150 AND 3000),

  -- 'procedural' | 'insufficient_debate' | 'missing_evidence' | 'rights_concern' | 'constitutional'
  grounds           TEXT        NOT NULL DEFAULT 'insufficient_debate'
                    CHECK (grounds IN ('procedural','insufficient_debate','missing_evidence','rights_concern','constitutional')),

  -- Cloture: votes to END the filibuster and force the vote.
  cloture_count     INT         NOT NULL DEFAULT 0 CHECK (cloture_count >= 0),
  cloture_threshold INT         NOT NULL DEFAULT 10 CHECK (cloture_threshold >= 5),

  -- Seconds: votes to SUPPORT the filibuster and extend debate.
  second_count      INT         NOT NULL DEFAULT 0 CHECK (second_count >= 0),
  second_threshold  INT         NOT NULL DEFAULT 5  CHECK (second_threshold >= 3),

  -- How many hours to extend the voting deadline if the filibuster succeeds.
  extend_hours      INT         NOT NULL DEFAULT 48 CHECK (extend_hours BETWEEN 24 AND 168),

  -- Lifecycle: active → overridden (cloture won) | extended (second won) | lapsed | withdrawn
  status            TEXT        NOT NULL DEFAULT 'active'
                    CHECK (status IN ('active','overridden','extended','lapsed','withdrawn')),

  -- Filibuster expires in 24 hours regardless of outcome
  expires_at        TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '24 hours'),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at       TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS civic_filibuster_votes (
  filibuster_id UUID        NOT NULL REFERENCES civic_filibusters(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES profiles(id)           ON DELETE CASCADE,
  -- 'cloture' = end the filibuster; 'second' = extend debate
  vote          TEXT        NOT NULL CHECK (vote IN ('cloture','second')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (filibuster_id, user_id)
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_civic_filibusters_topic
  ON civic_filibusters (topic_id);

CREATE INDEX IF NOT EXISTS idx_civic_filibusters_status
  ON civic_filibusters (status, expires_at DESC);

CREATE INDEX IF NOT EXISTS idx_civic_filibusters_filibuster
  ON civic_filibusters (filibuster_id);

CREATE INDEX IF NOT EXISTS idx_civic_filibuster_votes_filibuster
  ON civic_filibuster_votes (filibuster_id);

CREATE INDEX IF NOT EXISTS idx_civic_filibuster_votes_user
  ON civic_filibuster_votes (user_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE civic_filibusters       ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic_filibuster_votes  ENABLE ROW LEVEL SECURITY;

-- Anyone can read filibusters
CREATE POLICY "civic_filibusters_select_public"
  ON civic_filibusters FOR SELECT USING (true);

-- Authenticated users can create filibusters
CREATE POLICY "civic_filibusters_insert_auth"
  ON civic_filibusters FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND filibuster_id = auth.uid());

-- Only filibusterer can withdraw their own; service role can update status
CREATE POLICY "civic_filibusters_update_auth"
  ON civic_filibusters FOR UPDATE
  USING (auth.uid() = filibuster_id OR auth.role() = 'service_role');

-- Anyone can read votes
CREATE POLICY "civic_filibuster_votes_select_public"
  ON civic_filibuster_votes FOR SELECT USING (true);

-- Authenticated users can cast votes
CREATE POLICY "civic_filibuster_votes_insert_auth"
  ON civic_filibuster_votes FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());
