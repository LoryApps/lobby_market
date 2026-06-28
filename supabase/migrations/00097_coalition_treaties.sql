-- =============================================================================
-- Lobby Market: Coalition Treaties — formal inter-coalition diplomatic agreements
-- =============================================================================
-- Coalitions can propose, accept, or reject formal treaties with other coalitions.
-- Active treaties are publicly visible and displayed on coalition profiles.
--
-- Treaty types:
--   alliance          — mutual vote coordination on shared-stance topics
--   non_aggression    — agree not to file coalition_challenges against each other
--   research_exchange — share sources and evidence across coalition members
--
-- Distinct from:
--   coalition_challenges  — adversarial formal debate challenges
--   coalition_drives      — coordinated voting drives on specific topics
--   coalition_stances     — declared positions without diplomatic agreement
-- =============================================================================

CREATE TABLE IF NOT EXISTS coalition_treaties (
  id               UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  proposer_id      UUID        NOT NULL REFERENCES coalitions(id) ON DELETE CASCADE,
  recipient_id     UUID        NOT NULL REFERENCES coalitions(id) ON DELETE CASCADE,
  proposed_by      UUID        NOT NULL REFERENCES profiles(id)   ON DELETE CASCADE,
  accepted_by      UUID                    REFERENCES profiles(id) ON DELETE SET NULL,

  treaty_type      TEXT        NOT NULL DEFAULT 'alliance'
                               CHECK (treaty_type IN ('alliance', 'non_aggression', 'research_exchange')),

  status           TEXT        NOT NULL DEFAULT 'pending'
                               CHECK (status IN ('pending', 'accepted', 'rejected', 'expired', 'broken')),

  title            TEXT        NOT NULL CHECK (char_length(title) BETWEEN 3 AND 100),
  terms            TEXT        CHECK (char_length(terms) <= 500),

  duration_days    INT         NOT NULL DEFAULT 14
                               CHECK (duration_days IN (7, 14, 30)),

  proposed_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  accepted_at      TIMESTAMPTZ,
  expires_at       TIMESTAMPTZ,                    -- set when accepted
  broken_at        TIMESTAMPTZ,
  broken_reason    TEXT        CHECK (char_length(broken_reason) <= 200),

  -- A coalition can only have ONE pending/active treaty with any given partner
  CONSTRAINT treaties_no_self_deal    CHECK (proposer_id <> recipient_id),
  CONSTRAINT treaties_expire_after_accept CHECK (
    expires_at IS NULL OR accepted_at IS NULL OR expires_at > accepted_at
  )
);

-- Enforce one active/pending treaty per pair (canonical: smaller UUID first)
CREATE UNIQUE INDEX IF NOT EXISTS coalition_treaties_unique_pair
  ON coalition_treaties (
    LEAST(proposer_id, recipient_id),
    GREATEST(proposer_id, recipient_id)
  )
  WHERE status IN ('pending', 'accepted');

CREATE INDEX IF NOT EXISTS idx_treaties_proposer  ON coalition_treaties (proposer_id, status);
CREATE INDEX IF NOT EXISTS idx_treaties_recipient ON coalition_treaties (recipient_id, status);
CREATE INDEX IF NOT EXISTS idx_treaties_status    ON coalition_treaties (status, expires_at);

-- ── Row Level Security ─────────────────────────────────────────────────────────

ALTER TABLE coalition_treaties ENABLE ROW LEVEL SECURITY;

CREATE POLICY "treaties_select_public"
  ON coalition_treaties FOR SELECT USING (true);

CREATE POLICY "treaties_insert_leader"
  ON coalition_treaties FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM coalition_members cm
      WHERE cm.coalition_id = proposer_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('leader', 'officer')
    )
  );

CREATE POLICY "treaties_update_parties"
  ON coalition_treaties FOR UPDATE
  USING (
    EXISTS (
      SELECT 1 FROM coalition_members cm
      WHERE cm.coalition_id IN (proposer_id, recipient_id)
        AND cm.user_id = auth.uid()
        AND cm.role IN ('leader', 'officer')
    )
  );

COMMENT ON TABLE coalition_treaties IS
  'Formal diplomatic agreements between coalitions. Types: alliance, non_aggression, research_exchange. '
  'Proposed by a coalition leader, accepted by the recipient coalition leader. '
  'Active treaties expire after duration_days and are publicly displayed on coalition profiles.';
