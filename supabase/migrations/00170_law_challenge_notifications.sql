-- =============================================================================
-- Lobby Market: Law Challenge Notifications
-- =============================================================================
-- Adds 'law_challenge_support' and 'law_challenge_milestone' notification types
-- so challenge authors are notified when citizens vote on their formal challenge.
-- Also adds the user_notification_prefs toggle.
-- =============================================================================

-- ── 1. Expand notifications type constraint ────────────────────────────────────

ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'topic_activated',
    'vote_threshold',
    'vote_started',
    'law_established',
    'debate_starting',
    'achievement_earned',
    'reply_received',
    'lobby_update',
    'role_promoted',
    'coalition_invite',
    'coalition_invite_accepted',
    'bookmark_update',
    'new_follower',
    'argument_upvoted',
    'argument_cited',
    'topic_subscribed_update',
    'vote_phase_started',
    'direct_message',
    'new_topic_in_tag',
    'streak_at_risk',
    'weekly_digest',
    'qa_question_answered',
    'qa_answer_accepted',
    'ama_question_answered',
    'ama_session_starting',
    'relay_leg_added',
    'relay_completed',
    'relay_voted',
    'relay_invitation',
    'debate_challenge',
    'debate_challenge_accepted',
    'debate_challenge_declined',
    'exchange_alert',
    'law_challenge_support',
    'law_challenge_milestone'
  ));

-- ── 2. Add notification preference column ─────────────────────────────────────

ALTER TABLE user_notification_prefs
  ADD COLUMN IF NOT EXISTS law_challenge_notifications BOOLEAN NOT NULL DEFAULT true;

-- ── 3. DB trigger: notify challenge author on first support vote ───────────────

CREATE OR REPLACE FUNCTION notify_law_challenge_support()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_challenge_author UUID;
  v_law_id           UUID;
  v_law_stmt         TEXT;
  v_challenge_title  TEXT;
  v_voter_name       TEXT;
  v_support_count    INT;
  v_pref_enabled     BOOLEAN;
BEGIN
  -- Only fire on 'support' votes
  IF NEW.vote <> 'support' THEN
    RETURN NEW;
  END IF;

  -- Get challenge details
  SELECT user_id, law_id, title, support_count
    INTO v_challenge_author, v_law_id, v_challenge_title, v_support_count
    FROM law_challenges
   WHERE id = NEW.challenge_id;

  -- Don't notify if author is the voter
  IF v_challenge_author = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Check pref
  SELECT law_challenge_notifications
    INTO v_pref_enabled
    FROM user_notification_prefs
   WHERE user_id = v_challenge_author;

  IF v_pref_enabled = false THEN
    RETURN NEW;
  END IF;

  -- Get voter display name
  SELECT COALESCE(display_name, username)
    INTO v_voter_name
    FROM profiles
   WHERE id = NEW.user_id;

  -- Get law statement
  SELECT statement INTO v_law_stmt FROM laws WHERE id = v_law_id;
  IF v_law_stmt IS NULL THEN v_law_stmt := 'a law'; END IF;

  -- Notify on 1st, 5th, 10th, 25th, 50th supporter (milestone-style).
  -- The vote counter trigger (law_challenge_vote_counter) fires first alphabetically
  -- and increments support_count before this trigger reads it, so no +1 needed.
  IF v_support_count IN (1, 5, 10, 25, 50, 100) THEN
    INSERT INTO notifications (user_id, type, title, body, reference_id, reference_type)
    VALUES (
      v_challenge_author,
      CASE
        WHEN v_support_count = 1 THEN 'law_challenge_support'
        ELSE 'law_challenge_milestone'
      END,
      CASE
        WHEN v_support_count = 1
          THEN v_voter_name || ' supported your law challenge'
        ELSE v_support_count::TEXT || ' citizens now support your challenge'
      END,
      '"' || LEFT(v_challenge_title, 80) || CASE WHEN LENGTH(v_challenge_title) > 80 THEN '…' ELSE '' END || '"'
        || ' — ' || LEFT(v_law_stmt, 60) || CASE WHEN LENGTH(v_law_stmt) > 60 THEN '…' ELSE '' END,
      NEW.challenge_id,
      'law_challenge'
    )
    ON CONFLICT DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_law_challenge_support_notify ON law_challenge_votes;

CREATE TRIGGER trg_law_challenge_support_notify
  AFTER INSERT ON law_challenge_votes
  FOR EACH ROW
  EXECUTE FUNCTION notify_law_challenge_support();
