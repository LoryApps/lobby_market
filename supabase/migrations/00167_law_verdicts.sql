-- =============================================================================
-- Lobby Market: Law Verdict Votes
-- =============================================================================
-- Community retrospective assessment of established laws.
-- Citizens vote on whether each law achieved its stated goals.
-- One vote per user per law, updatable.
-- =============================================================================

CREATE TABLE IF NOT EXISTS law_verdict_votes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  law_id      UUID        NOT NULL REFERENCES laws(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  verdict     TEXT        NOT NULL
              CHECK (verdict IN ('succeeded', 'mostly_succeeded', 'mixed', 'mostly_failed', 'failed')),
  reasoning   TEXT
              CHECK (reasoning IS NULL OR char_length(reasoning) <= 400),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (law_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_law_verdict_law
  ON law_verdict_votes (law_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_law_verdict_user
  ON law_verdict_votes (user_id, created_at DESC);

ALTER TABLE law_verdict_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "law_verdict_select_public"
  ON law_verdict_votes FOR SELECT
  USING (true);

CREATE POLICY "law_verdict_insert_auth"
  ON law_verdict_votes FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "law_verdict_update_own"
  ON law_verdict_votes FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "law_verdict_delete_own"
  ON law_verdict_votes FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

COMMENT ON TABLE law_verdict_votes IS
  'Community retrospective verdict votes on whether an established law achieved its stated goals.';
