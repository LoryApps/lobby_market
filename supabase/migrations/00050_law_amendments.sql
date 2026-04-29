-- ─────────────────────────────────────────────────────────────────────────────
-- 00050_law_amendments.sql
-- Law Amendment Proposals: community-driven amendments to established laws
-- ─────────────────────────────────────────────────────────────────────────────

-- ── Amendments table ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS law_amendments (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  law_id        UUID        NOT NULL REFERENCES laws(id) ON DELETE CASCADE,
  topic_id      UUID        REFERENCES topics(id) ON DELETE SET NULL,
  proposer_id   UUID        NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  title         TEXT        NOT NULL,
  body          TEXT        NOT NULL,
  status        TEXT        NOT NULL DEFAULT 'pending'
                              CHECK (status IN ('pending', 'ratified', 'rejected')),
  for_count     INT         NOT NULL DEFAULT 0,
  against_count INT         NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  ratified_at   TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '14 days'),
  CONSTRAINT amendment_title_length CHECK (char_length(title) BETWEEN 5 AND 120),
  CONSTRAINT amendment_body_length  CHECK (char_length(body)  BETWEEN 20 AND 1000)
);

COMMENT ON TABLE law_amendments IS
  'Community-proposed amendments to established consensus laws';

CREATE INDEX IF NOT EXISTS idx_law_amendments_law_id    ON law_amendments(law_id);
CREATE INDEX IF NOT EXISTS idx_law_amendments_status    ON law_amendments(status);
CREATE INDEX IF NOT EXISTS idx_law_amendments_created   ON law_amendments(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_law_amendments_proposer  ON law_amendments(proposer_id);

-- ── Amendment votes table ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS law_amendment_votes (
  amendment_id UUID        NOT NULL REFERENCES law_amendments(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES auth.users(id)     ON DELETE CASCADE,
  vote         BOOLEAN     NOT NULL,  -- TRUE = FOR, FALSE = AGAINST
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (amendment_id, user_id)
);

COMMENT ON TABLE law_amendment_votes IS
  'One vote per user per amendment — TRUE = for, FALSE = against';

CREATE INDEX IF NOT EXISTS idx_law_amendment_votes_amendment
  ON law_amendment_votes(amendment_id);

-- ── Trigger: keep for_count / against_count in sync ─────────────────────────

CREATE OR REPLACE FUNCTION sync_amendment_vote_counts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  target_id UUID;
BEGIN
  target_id := COALESCE(NEW.amendment_id, OLD.amendment_id);

  UPDATE law_amendments
  SET
    for_count     = (SELECT COUNT(*) FROM law_amendment_votes
                     WHERE amendment_id = target_id AND vote = TRUE),
    against_count = (SELECT COUNT(*) FROM law_amendment_votes
                     WHERE amendment_id = target_id AND vote = FALSE)
  WHERE id = target_id;

  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_amendment_vote_insert ON law_amendment_votes;
CREATE TRIGGER trg_amendment_vote_insert
  AFTER INSERT ON law_amendment_votes
  FOR EACH ROW EXECUTE FUNCTION sync_amendment_vote_counts();

DROP TRIGGER IF EXISTS trg_amendment_vote_update ON law_amendment_votes;
CREATE TRIGGER trg_amendment_vote_update
  AFTER UPDATE ON law_amendment_votes
  FOR EACH ROW EXECUTE FUNCTION sync_amendment_vote_counts();

DROP TRIGGER IF EXISTS trg_amendment_vote_delete ON law_amendment_votes;
CREATE TRIGGER trg_amendment_vote_delete
  AFTER DELETE ON law_amendment_votes
  FOR EACH ROW EXECUTE FUNCTION sync_amendment_vote_counts();

-- ── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE law_amendments       ENABLE ROW LEVEL SECURITY;
ALTER TABLE law_amendment_votes  ENABLE ROW LEVEL SECURITY;

-- Amendments: anyone can read; authenticated users can insert their own
CREATE POLICY "amendments_select_all"
  ON law_amendments FOR SELECT USING (true);

CREATE POLICY "amendments_insert_auth"
  ON law_amendments FOR INSERT
  WITH CHECK (auth.uid() = proposer_id);

CREATE POLICY "amendments_delete_own"
  ON law_amendments FOR DELETE
  USING (auth.uid() = proposer_id AND status = 'pending');

-- Amendment votes: anyone can read; authenticated users can insert/update their own
CREATE POLICY "amendment_votes_select_all"
  ON law_amendment_votes FOR SELECT USING (true);

CREATE POLICY "amendment_votes_insert_auth"
  ON law_amendment_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "amendment_votes_update_own"
  ON law_amendment_votes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "amendment_votes_delete_own"
  ON law_amendment_votes FOR DELETE
  USING (auth.uid() = user_id);
