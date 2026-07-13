-- =============================================================================
-- Lobby Market: The House of Lords Chamber
-- =============================================================================
-- Second chamber of the Lobby Parliament. Lords (top civic contributors by
-- clout) review recently established laws and vote to ratify or send back
-- for reconsideration. Mirrors the UK House of Lords reviewing role.
-- =============================================================================

-- ─── Lords Review Votes ───────────────────────────────────────────────────────
-- Records how each Lord voted on a law under review.

CREATE TABLE IF NOT EXISTS lords_reviews (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  law_id          UUID        NOT NULL REFERENCES laws(id) ON DELETE CASCADE,
  user_id         UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- 'ratify'    = Lord approves the law as passed
  -- 'send_back' = Lord requests amendments / reconsideration
  -- 'abstain'   = Lord formally abstains
  verdict         TEXT        NOT NULL CHECK (verdict IN ('ratify', 'send_back', 'abstain')),
  amendment_note  TEXT        CHECK (char_length(amendment_note) <= 500),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (law_id, user_id)
);

ALTER TABLE lords_reviews ENABLE ROW LEVEL SECURITY;

-- Anyone can read review records (transparency)
CREATE POLICY "lords_reviews_select_all"
  ON lords_reviews FOR SELECT USING (true);

-- Only the lord themselves can insert their own review
CREATE POLICY "lords_reviews_insert_self"
  ON lords_reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Lord can update their own review (change of mind)
CREATE POLICY "lords_reviews_update_self"
  ON lords_reviews FOR UPDATE
  USING (auth.uid() = user_id);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_lords_reviews_law
  ON lords_reviews(law_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_lords_reviews_user
  ON lords_reviews(user_id, created_at DESC);

-- ─── Ratification Summary View ────────────────────────────────────────────────

CREATE OR REPLACE VIEW lords_ratification_summary AS
SELECT
  law_id,
  COUNT(*) FILTER (WHERE verdict = 'ratify')    AS ratify_count,
  COUNT(*) FILTER (WHERE verdict = 'send_back') AS send_back_count,
  COUNT(*) FILTER (WHERE verdict = 'abstain')   AS abstain_count,
  COUNT(*)                                       AS total_reviews,
  CASE WHEN COUNT(*) > 0
    THEN ROUND(100.0 * COUNT(*) FILTER (WHERE verdict = 'ratify') / COUNT(*), 1)
    ELSE 0
  END AS ratify_pct
FROM lords_reviews
GROUP BY law_id;
