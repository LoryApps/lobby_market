-- Migration 00146: Bill amendment votes
-- Lets citizens vote for/against amendments on civic bills.
-- The bill_amendments table already has votes_for/votes_against counters;
-- this table tracks who voted what and keeps those counters accurate.

CREATE TABLE IF NOT EXISTS bill_amendment_votes (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  amendment_id  UUID        NOT NULL REFERENCES bill_amendments(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  vote          BOOLEAN     NOT NULL,   -- true = for, false = against
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (amendment_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_bill_amendment_votes_amendment
  ON bill_amendment_votes(amendment_id);
CREATE INDEX IF NOT EXISTS idx_bill_amendment_votes_user
  ON bill_amendment_votes(user_id);

COMMENT ON TABLE bill_amendment_votes IS
  'One row per (amendment, user) pair — records each citizen vote on a proposed bill amendment.';

-- ─── Trigger: sync vote counts on bill_amendments ───────────────────────────

CREATE OR REPLACE FUNCTION sync_bill_amendment_vote_counts()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
DECLARE
  aid UUID;
BEGIN
  aid := COALESCE(NEW.amendment_id, OLD.amendment_id);
  UPDATE bill_amendments
  SET
    votes_for     = (SELECT COUNT(*) FROM bill_amendment_votes WHERE amendment_id = aid AND vote = true),
    votes_against = (SELECT COUNT(*) FROM bill_amendment_votes WHERE amendment_id = aid AND vote = false)
  WHERE id = aid;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_bill_amendment_vote_insert ON bill_amendment_votes;
CREATE TRIGGER trg_bill_amendment_vote_insert
  AFTER INSERT ON bill_amendment_votes
  FOR EACH ROW EXECUTE FUNCTION sync_bill_amendment_vote_counts();

DROP TRIGGER IF EXISTS trg_bill_amendment_vote_update ON bill_amendment_votes;
CREATE TRIGGER trg_bill_amendment_vote_update
  AFTER UPDATE ON bill_amendment_votes
  FOR EACH ROW EXECUTE FUNCTION sync_bill_amendment_vote_counts();

DROP TRIGGER IF EXISTS trg_bill_amendment_vote_delete ON bill_amendment_votes;
CREATE TRIGGER trg_bill_amendment_vote_delete
  AFTER DELETE ON bill_amendment_votes
  FOR EACH ROW EXECUTE FUNCTION sync_bill_amendment_vote_counts();

-- ─── RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE bill_amendment_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "bill_amendment_votes_select_all"
  ON bill_amendment_votes FOR SELECT USING (true);

CREATE POLICY "bill_amendment_votes_insert_auth"
  ON bill_amendment_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "bill_amendment_votes_update_own"
  ON bill_amendment_votes FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "bill_amendment_votes_delete_own"
  ON bill_amendment_votes FOR DELETE
  USING (auth.uid() = user_id);
