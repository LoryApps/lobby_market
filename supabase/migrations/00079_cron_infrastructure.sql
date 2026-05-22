-- =============================================================================
-- Cron Infrastructure
-- =============================================================================
-- Adds the columns and SQL functions needed by the Vercel Cron endpoints:
--
--   /api/cron/topic-lifecycle  — calls evaluate_topic_thresholds() to close
--                                expired voting phases and create law records
--
--   /api/cron/daily-reset      — resets daily_votes_used, updates vote_streak
--                                based on last_vote_date
-- =============================================================================

-- ─── 1. Track the date of each user's last vote (for streak management) ───────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_vote_date DATE;

-- Backfill: set last_vote_date = most recent vote date for each user
UPDATE profiles p
SET last_vote_date = (
  SELECT MAX(v.created_at::DATE)
  FROM votes v
  WHERE v.user_id = p.id
)
WHERE last_vote_date IS NULL;

-- ─── 2. Update the vote trigger to stamp last_vote_date and advance streak ────

CREATE OR REPLACE FUNCTION handle_vote_cast()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_new_blue         INT;
  v_new_red          INT;
  v_new_total        INT;
  v_current_streak   INT;
  v_last_vote_date   DATE;
  v_today            DATE := CURRENT_DATE;
BEGIN
  -- Update topic vote tallies atomically
  IF NEW.side = 'blue' THEN
    UPDATE topics
    SET blue_votes  = blue_votes + 1,
        total_votes = total_votes + 1
    WHERE id = NEW.topic_id
    RETURNING blue_votes, red_votes, total_votes
    INTO v_new_blue, v_new_red, v_new_total;
  ELSE
    UPDATE topics
    SET red_votes   = red_votes + 1,
        total_votes = total_votes + 1
    WHERE id = NEW.topic_id
    RETURNING blue_votes, red_votes, total_votes
    INTO v_new_blue, v_new_red, v_new_total;
  END IF;

  -- Recalculate blue percentage
  IF v_new_total > 0 THEN
    UPDATE topics
    SET blue_pct = (v_new_blue::REAL / v_new_total::REAL) * 100.0
    WHERE id = NEW.topic_id;
  END IF;

  -- Fetch current streak and last vote date
  SELECT vote_streak, last_vote_date
  INTO v_current_streak, v_last_vote_date
  FROM profiles
  WHERE id = NEW.user_id;

  -- Update voter profile: counters + streak + last_vote_date
  IF NEW.side = 'blue' THEN
    UPDATE profiles
    SET total_votes      = total_votes + 1,
        daily_votes_used = daily_votes_used + 1,
        blue_vote_count  = blue_vote_count + 1,
        clout            = clout + 1,
        last_vote_date   = v_today,
        -- Advance streak only on the first vote of a new day
        vote_streak      = CASE
          WHEN v_last_vote_date = v_today THEN vote_streak          -- already voted today
          WHEN v_last_vote_date = v_today - 1 THEN vote_streak + 1 -- consecutive day
          ELSE 1                                                      -- gap → restart
        END
    WHERE id = NEW.user_id;
  ELSE
    UPDATE profiles
    SET total_votes      = total_votes + 1,
        daily_votes_used = daily_votes_used + 1,
        red_vote_count   = red_vote_count + 1,
        clout            = clout + 1,
        last_vote_date   = v_today,
        vote_streak      = CASE
          WHEN v_last_vote_date = v_today THEN vote_streak
          WHEN v_last_vote_date = v_today - 1 THEN vote_streak + 1
          ELSE 1
        END
    WHERE id = NEW.user_id;
  END IF;

  RETURN NEW;
END;
$$;

-- ─── 3. Daily reset function — called by /api/cron/daily-reset ───────────────
--
-- Resets daily_votes_used to 0 for all users and breaks streaks for anyone
-- who has not voted since the day before yesterday.  (We allow same-day and
-- previous-day votes; only a 2+ day gap breaks the streak.)

CREATE OR REPLACE FUNCTION run_daily_reset()
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_reset_count  INT;
  v_streak_break INT;
  v_today        DATE := CURRENT_DATE;
BEGIN
  -- 1. Reset daily vote counter for every profile
  UPDATE profiles
  SET daily_votes_used    = 0,
      daily_votes_reset_at = now()
  WHERE daily_votes_used > 0;

  GET DIAGNOSTICS v_reset_count = ROW_COUNT;

  -- 2. Break streaks for users who missed yesterday (last_vote_date < today - 1)
  UPDATE profiles
  SET vote_streak = 0
  WHERE vote_streak > 0
    AND (last_vote_date IS NULL OR last_vote_date < v_today - 1);

  GET DIAGNOSTICS v_streak_break = ROW_COUNT;

  RETURN json_build_object(
    'daily_resets', v_reset_count,
    'streaks_broken', v_streak_break,
    'run_at', now()
  );
END;
$$;

COMMENT ON FUNCTION run_daily_reset() IS
  'Resets daily vote counters and breaks vote streaks for inactive users. Called by /api/cron/daily-reset at midnight UTC.';

-- ─── 4. Index for efficient streak-break query ───────────────────────────────

CREATE INDEX IF NOT EXISTS idx_profiles_last_vote_date
  ON profiles (last_vote_date)
  WHERE vote_streak > 0;
