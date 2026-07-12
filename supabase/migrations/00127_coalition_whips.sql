-- =============================================================================
-- Lobby Market: Coalition Whip System
-- =============================================================================
-- Parliamentary whip mechanism for coalitions. Officers/leaders can issue
-- formal voting guidance ("three-line whip", "free vote", etc.) on specific
-- topics. Member compliance is tracked after they cast votes.
--
-- Distinct from:
--   coalition_stances  — coalition's general position on a topic (persistent)
--   coalition_posts    — coalition internal feed posts
--   coalition_drives   — fundraising/clout drives
-- =============================================================================

-- ─── Whip Guidance ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS coalition_whip_guidance (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  coalition_id    uuid        NOT NULL REFERENCES coalitions(id) ON DELETE CASCADE,
  topic_id        uuid        NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  issued_by       uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  direction       text        NOT NULL CHECK (direction IN ('for', 'against', 'free')),
  -- 'critical' = three-line whip (attendance + vote mandatory)
  -- 'strong'   = two-line whip (expected to vote as directed)
  -- 'advisory' = one-line whip (guidance only, free to deviate)
  strength        text        NOT NULL DEFAULT 'advisory'
                              CHECK (strength IN ('advisory', 'strong', 'critical')),
  message         text        CHECK (char_length(message) <= 500),
  active          boolean     NOT NULL DEFAULT true,
  created_at      timestamptz NOT NULL DEFAULT now(),
  expires_at      timestamptz,
  UNIQUE (coalition_id, topic_id)  -- one active guidance per topic per coalition
);

ALTER TABLE coalition_whip_guidance ENABLE ROW LEVEL SECURITY;

-- Anyone can read guidance (transparency)
CREATE POLICY "whip_guidance_select_all"
  ON coalition_whip_guidance FOR SELECT USING (true);

-- Only coalition leaders/officers can issue guidance
CREATE POLICY "whip_guidance_insert_officer"
  ON coalition_whip_guidance FOR INSERT
  WITH CHECK (
    auth.uid() = issued_by
    AND EXISTS (
      SELECT 1 FROM coalition_members cm
      WHERE cm.coalition_id = coalition_whip_guidance.coalition_id
        AND cm.user_id = auth.uid()
        AND cm.role IN ('leader', 'officer')
    )
  );

-- Only the issuer or a leader can update/withdraw
CREATE POLICY "whip_guidance_update_officer"
  ON coalition_whip_guidance FOR UPDATE
  USING (
    auth.uid() = issued_by
    OR EXISTS (
      SELECT 1 FROM coalition_members cm
      WHERE cm.coalition_id = coalition_whip_guidance.coalition_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'leader'
    )
  );

CREATE POLICY "whip_guidance_delete_officer"
  ON coalition_whip_guidance FOR DELETE
  USING (
    auth.uid() = issued_by
    OR EXISTS (
      SELECT 1 FROM coalition_members cm
      WHERE cm.coalition_id = coalition_whip_guidance.coalition_id
        AND cm.user_id = auth.uid()
        AND cm.role = 'leader'
    )
  );

-- ─── Whip Compliance Log ─────────────────────────────────────────────────────
-- Recorded when a member casts a vote on a topic where guidance exists.

CREATE TABLE IF NOT EXISTS coalition_whip_compliance (
  id              uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  guidance_id     uuid        NOT NULL REFERENCES coalition_whip_guidance(id) ON DELETE CASCADE,
  coalition_id    uuid        NOT NULL REFERENCES coalitions(id) ON DELETE CASCADE,
  user_id         uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  topic_id        uuid        NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  vote_direction  text        NOT NULL CHECK (vote_direction IN ('for', 'against')),
  compliant       boolean     NOT NULL,  -- true if vote matched guidance direction
  recorded_at     timestamptz NOT NULL DEFAULT now(),
  UNIQUE (guidance_id, user_id)  -- one compliance record per member per guidance
);

ALTER TABLE coalition_whip_compliance ENABLE ROW LEVEL SECURITY;

-- Coalition members can see compliance records for their coalition
CREATE POLICY "whip_compliance_select_members"
  ON coalition_whip_compliance FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM coalition_members cm
      WHERE cm.coalition_id = coalition_whip_compliance.coalition_id
        AND cm.user_id = auth.uid()
    )
  );

-- System inserts compliance records (on behalf of voter)
CREATE POLICY "whip_compliance_insert_self"
  ON coalition_whip_compliance FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- ─── Indexes ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_whip_guidance_coalition
  ON coalition_whip_guidance(coalition_id, active, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_whip_guidance_topic
  ON coalition_whip_guidance(topic_id)
  WHERE active = true;

CREATE INDEX IF NOT EXISTS idx_whip_compliance_guidance
  ON coalition_whip_compliance(guidance_id, compliant);

CREATE INDEX IF NOT EXISTS idx_whip_compliance_user
  ON coalition_whip_compliance(user_id, coalition_id);

CREATE INDEX IF NOT EXISTS idx_whip_compliance_coalition
  ON coalition_whip_compliance(coalition_id, recorded_at DESC);

-- ─── Compliance Rate View ─────────────────────────────────────────────────────

CREATE OR REPLACE VIEW coalition_whip_compliance_rates AS
SELECT
  g.coalition_id,
  g.id               AS guidance_id,
  g.topic_id,
  g.direction,
  g.strength,
  COUNT(c.id)        AS total_votes,
  SUM(CASE WHEN c.compliant THEN 1 ELSE 0 END) AS compliant_votes,
  CASE WHEN COUNT(c.id) > 0
    THEN ROUND(100.0 * SUM(CASE WHEN c.compliant THEN 1 ELSE 0 END) / COUNT(c.id), 1)
    ELSE NULL
  END                AS compliance_pct
FROM coalition_whip_guidance g
LEFT JOIN coalition_whip_compliance c ON c.guidance_id = g.id
GROUP BY g.coalition_id, g.id, g.topic_id, g.direction, g.strength;
