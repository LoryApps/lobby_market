-- =============================================================================
-- Lobby Market: Vote Delegation — Liquid Democracy
-- =============================================================================
-- Users can delegate their voting power to a trusted person on:
--   (a) a specific topic   → topic_id IS NOT NULL, category IS NULL
--   (b) an entire category → category IS NOT NULL, topic_id IS NULL
--   (c) globally           → both NULL (catch-all for any topic not otherwise covered)
--
-- Delegation is "advisory" on the client side: when a user has delegated, the
-- topic card shows the delegate's position and prompts "Mirror vote?".
-- A user's own explicit vote always takes precedence over any delegation.
--
-- Constraints:
--   • A user cannot delegate to themselves.
--   • At most one active delegation per (delegator_id, category, topic_id) triple.
--   • Delegations are soft-deleted (revoked_at) to preserve history.
-- =============================================================================

CREATE TABLE IF NOT EXISTS vote_delegations (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  delegator_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  delegate_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Scope: one of topic, category, or global (both NULL).
  topic_id        UUID        REFERENCES topics(id) ON DELETE CASCADE,
  category        TEXT        CHECK (category IN (
                                'Politics','Economics','Technology','Science',
                                'Ethics','Philosophy','Culture','Health',
                                'Environment','Education'
                              )),

  -- When the delegation was revoked (NULL = still active).
  revoked_at      TIMESTAMPTZ,

  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Cannot delegate to yourself.
  CONSTRAINT no_self_delegation CHECK (delegator_id <> delegate_id),

  -- At most one active delegation per scope triple.
  CONSTRAINT unique_active_delegation UNIQUE NULLS NOT DISTINCT
    (delegator_id, delegate_id, topic_id, category)
);

-- ── Indexes ────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_vote_delegations_delegator
  ON vote_delegations (delegator_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_vote_delegations_delegate
  ON vote_delegations (delegate_id)
  WHERE revoked_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_vote_delegations_topic
  ON vote_delegations (topic_id)
  WHERE revoked_at IS NULL AND topic_id IS NOT NULL;

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE vote_delegations ENABLE ROW LEVEL SECURITY;

-- Anyone can see delegations (needed for delegate leaderboards).
CREATE POLICY "delegations_read_all"
  ON vote_delegations FOR SELECT
  USING (true);

-- Users can only insert delegations where they are the delegator.
CREATE POLICY "delegations_insert_own"
  ON vote_delegations FOR INSERT
  WITH CHECK (delegator_id = auth.uid());

-- Users can only update (revoke) their own delegations.
CREATE POLICY "delegations_update_own"
  ON vote_delegations FOR UPDATE
  USING (delegator_id = auth.uid());

-- ── Delegate popularity view ──────────────────────────────────────────────────
-- Counts how many active delegators each user has received.

CREATE OR REPLACE VIEW delegation_stats AS
  SELECT
    delegate_id,
    COUNT(*) FILTER (WHERE topic_id IS NULL AND category IS NULL) AS global_count,
    COUNT(*) FILTER (WHERE category IS NOT NULL)                  AS category_count,
    COUNT(*) FILTER (WHERE topic_id IS NOT NULL)                  AS topic_count,
    COUNT(*)                                                       AS total_count
  FROM vote_delegations
  WHERE revoked_at IS NULL
  GROUP BY delegate_id;
