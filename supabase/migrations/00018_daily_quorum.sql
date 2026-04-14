-- =============================================================================
-- Lobby Market: Daily Quorum
-- =============================================================================
-- Each day the system presents 3 curated active topics.  Completing all 3
-- votes earns the user a Clout bonus and records the achievement.
--
-- Design notes:
--   • The quorum topics are chosen at query time in the API (top active
--     topics seeded by date — no pre-scheduling table needed).
--   • daily_quorum_completions stores one row per user per day once they
--     have voted on all 3 quorum topics.
--   • Clout is awarded via the `claim_daily_quorum` SECURITY DEFINER
--     function so it can bypass RLS on clout_transactions.
-- =============================================================================

-- ─── Table ────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS daily_quorum_completions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  quorum_date  DATE        NOT NULL DEFAULT CURRENT_DATE,
  topic_ids    UUID[]      NOT NULL,           -- the 3 topic IDs for this day
  clout_earned INT         NOT NULL DEFAULT 10,
  completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  UNIQUE (user_id, quorum_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_quorum_user
  ON daily_quorum_completions (user_id, quorum_date DESC);

CREATE INDEX IF NOT EXISTS idx_daily_quorum_date
  ON daily_quorum_completions (quorum_date DESC);

-- ─── Row Level Security ───────────────────────────────────────────────────────

ALTER TABLE daily_quorum_completions ENABLE ROW LEVEL SECURITY;

-- Users can see their own completions; public can see counts (for stats).
CREATE POLICY "daily_quorum_completions_select"
  ON daily_quorum_completions FOR SELECT
  USING (auth.uid() = user_id);

-- INSERT is intentionally blocked at the RLS level — use claim_daily_quorum().

-- ─── SECURITY DEFINER function ────────────────────────────────────────────────
-- claim_daily_quorum(p_user_id, p_topic_ids, p_quorum_date)
--
-- Called from the Next.js API route via supabase.rpc().
-- Returns a JSON object:
--   { status: 'claimed' | 'already_claimed' | 'incomplete', new_balance: int }
--
-- 'incomplete'     → not all 3 topics have been voted on yet
-- 'already_claimed'→ already claimed today
-- 'claimed'        → just awarded
-- =============================================================================

CREATE OR REPLACE FUNCTION claim_daily_quorum(
  p_user_id    UUID,
  p_topic_ids  UUID[],
  p_quorum_date DATE DEFAULT CURRENT_DATE
)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_already      BOOLEAN;
  v_vote_count   INT;
  v_clout_award  INT := 10;
  v_new_balance  INT;
BEGIN
  -- 1. Guard: caller must be the user themselves
  IF auth.uid() IS DISTINCT FROM p_user_id THEN
    RETURN json_build_object('status', 'unauthorized');
  END IF;

  -- 2. Already claimed today?
  SELECT EXISTS (
    SELECT 1 FROM daily_quorum_completions
    WHERE user_id = p_user_id AND quorum_date = p_quorum_date
  ) INTO v_already;

  IF v_already THEN
    SELECT clout INTO v_new_balance
    FROM profiles WHERE id = p_user_id;
    RETURN json_build_object('status', 'already_claimed', 'new_balance', COALESCE(v_new_balance, 0));
  END IF;

  -- 3. Verify all topic votes exist
  SELECT COUNT(DISTINCT topic_id)
  INTO v_vote_count
  FROM votes
  WHERE user_id = p_user_id
    AND topic_id = ANY(p_topic_ids);

  IF v_vote_count < array_length(p_topic_ids, 1) THEN
    RETURN json_build_object('status', 'incomplete', 'voted', v_vote_count, 'needed', array_length(p_topic_ids, 1));
  END IF;

  -- 4. Record completion
  INSERT INTO daily_quorum_completions (user_id, quorum_date, topic_ids, clout_earned)
  VALUES (p_user_id, p_quorum_date, p_topic_ids, v_clout_award)
  ON CONFLICT (user_id, quorum_date) DO NOTHING;

  -- 5. Award Clout
  INSERT INTO clout_transactions (user_id, type, amount, reason, reference_type)
  VALUES (
    p_user_id,
    'earned',
    v_clout_award,
    'Daily Quorum completed — 3 votes cast',
    'daily_quorum'
  );

  -- 6. Return updated balance
  SELECT clout INTO v_new_balance
  FROM profiles WHERE id = p_user_id;

  RETURN json_build_object('status', 'claimed', 'clout_earned', v_clout_award, 'new_balance', COALESCE(v_new_balance, 0));
END;
$$;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION claim_daily_quorum(UUID, UUID[], DATE) TO authenticated;
