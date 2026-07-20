-- =============================================================================
-- Lobby Market: Exchange Market Proposals
-- Community-submitted proposals for new civic prediction markets.
-- Users can propose a market question, describe why it matters, and set
-- resolution criteria. Other users upvote to signal demand.
-- Admins / automated rules accept/reject proposals into the live exchange.
-- =============================================================================

-- ── 1. Proposals table ────────────────────────────────────────────────────────

CREATE TABLE exchange_proposals (
  id                       UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id                  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  title                    TEXT        NOT NULL CHECK (char_length(title) BETWEEN 10 AND 200),
  description              TEXT                 CHECK (char_length(description) <= 1000),
  category                 TEXT,
  resolution_criteria      TEXT                 CHECK (char_length(resolution_criteria) <= 500),
  estimated_settlement_date DATE,
  status                   TEXT        NOT NULL DEFAULT 'pending'
                           CHECK (status IN ('pending', 'accepted', 'rejected', 'duplicate')),
  upvotes                  INT         NOT NULL DEFAULT 0,
  topic_id                 UUID                 REFERENCES topics(id) ON DELETE SET NULL,
  rejection_reason         TEXT,
  created_at               TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at               TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_exchange_proposals_user
  ON exchange_proposals(user_id, created_at DESC);

CREATE INDEX idx_exchange_proposals_status_score
  ON exchange_proposals(status, upvotes DESC, created_at DESC)
  WHERE status = 'pending';

CREATE INDEX idx_exchange_proposals_category
  ON exchange_proposals(category, upvotes DESC)
  WHERE status = 'pending';

COMMENT ON TABLE exchange_proposals IS
  'Community-submitted proposals for new civic prediction markets. '
  'Top-upvoted proposals can be accepted and turned into live topics.';

-- ── 2. Votes table ────────────────────────────────────────────────────────────

CREATE TABLE exchange_proposal_votes (
  proposal_id UUID        NOT NULL REFERENCES exchange_proposals(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (proposal_id, user_id)
);

CREATE INDEX idx_exchange_proposal_votes_user
  ON exchange_proposal_votes(user_id, created_at DESC);

COMMENT ON TABLE exchange_proposal_votes IS
  'One row per user per proposal — a simple upvote. No downvotes.';

-- ── 3. Trigger: keep upvote counter in sync ───────────────────────────────────

CREATE OR REPLACE FUNCTION sync_proposal_upvotes()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE exchange_proposals SET upvotes = upvotes + 1, updated_at = now()
    WHERE id = NEW.proposal_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE exchange_proposals SET upvotes = GREATEST(upvotes - 1, 0), updated_at = now()
    WHERE id = OLD.proposal_id;
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$;

DROP TRIGGER IF EXISTS trg_sync_proposal_upvotes ON exchange_proposal_votes;
CREATE TRIGGER trg_sync_proposal_upvotes
AFTER INSERT OR DELETE ON exchange_proposal_votes
FOR EACH ROW EXECUTE FUNCTION sync_proposal_upvotes();

-- ── 4. RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE exchange_proposals ENABLE ROW LEVEL SECURITY;
ALTER TABLE exchange_proposal_votes ENABLE ROW LEVEL SECURITY;

-- Proposals: anyone can read; only owner can insert; only owner or admin can update
CREATE POLICY "proposals_select" ON exchange_proposals
  FOR SELECT USING (true);

CREATE POLICY "proposals_insert" ON exchange_proposals
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "proposals_update_owner" ON exchange_proposals
  FOR UPDATE USING (auth.uid() = user_id AND status = 'pending');

-- Votes: anyone can read; users manage their own votes
CREATE POLICY "proposal_votes_select" ON exchange_proposal_votes
  FOR SELECT USING (true);

CREATE POLICY "proposal_votes_insert" ON exchange_proposal_votes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "proposal_votes_delete" ON exchange_proposal_votes
  FOR DELETE USING (auth.uid() = user_id);
