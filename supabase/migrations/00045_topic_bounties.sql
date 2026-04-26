-- =============================================================================
-- Lobby Market: Topic Bounties
-- =============================================================================
-- Users can stake clout to commission the best argument on a topic.
-- The bounty creator picks a winner; clout is transferred via gift_clout().
-- =============================================================================

CREATE TABLE IF NOT EXISTS topic_bounties (
  id                  UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id            UUID        NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  creator_id          UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- which side the argument should argue (null = either side welcome)
  side                TEXT        CHECK (side IN ('for', 'against')),
  amount              INTEGER     NOT NULL DEFAULT 10 CHECK (amount BETWEEN 1 AND 500),
  description         TEXT        NOT NULL CHECK (char_length(description) BETWEEN 5 AND 280),
  deadline            TIMESTAMPTZ,
  winner_argument_id  UUID        REFERENCES topic_arguments(id),
  winner_id           UUID        REFERENCES profiles(id),
  status              TEXT        NOT NULL DEFAULT 'open'
                                  CHECK (status IN ('open', 'awarded', 'expired')),
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_topic_bounties_topic   ON topic_bounties(topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_bounties_creator ON topic_bounties(creator_id);
CREATE INDEX IF NOT EXISTS idx_topic_bounties_status  ON topic_bounties(status, created_at DESC);

ALTER TABLE topic_bounties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "topic_bounties_select" ON topic_bounties
  FOR SELECT USING (true);

CREATE POLICY "topic_bounties_insert" ON topic_bounties
  FOR INSERT WITH CHECK (auth.uid() = creator_id);

-- Creators can update their own bounties (e.g. to mark awarded/expired)
CREATE POLICY "topic_bounties_update" ON topic_bounties
  FOR UPDATE USING (auth.uid() = creator_id);

COMMENT ON TABLE topic_bounties IS
  'Clout bounties posted by users to commission the best argument on a topic.
   Winner selection + payout handled via gift_clout() RPC.';
