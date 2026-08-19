-- =============================================================================
-- Lobby Market: Thesis Notifications
-- =============================================================================
-- 1. Expand the notifications.type check constraint to include thesis types.
-- 2. Add thesis_notifications opt-in column to user_notification_prefs.
-- 3. Add trigger: notify thesis author when someone votes (agree/disagree).
-- 4. Add trigger: notify thesis author when someone comments.
--
-- Milestones for votes: 1st, 5th, 10th, 25th, 50th (each side separately).
-- Comments: notify on every comment (the author wants to see feedback).
-- =============================================================================

-- ── 1. Expand check constraint ─────────────────────────────────────────────────

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
    'argument_upvote',
    'argument_reply',
    'follow',
    'mention',
    'new_topic_in_tag',
    'streak_at_risk',
    'weekly_digest',
    'qa_response',
    'ama_response',
    'ama_scheduled',
    'relay_invitation',
    'relay_completed',
    'debate_challenge',
    'delegate_voted',
    'exchange_alert',
    'law_challenge',
    'law_endorsed',
    'thesis_vote',
    'thesis_comment'
  ));

-- ── 2. Add user notification preference column ─────────────────────────────────

ALTER TABLE user_notification_prefs
  ADD COLUMN IF NOT EXISTS thesis_notifications BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN user_notification_prefs.thesis_notifications IS
  'User opt-in for thesis vote and comment notifications.';

-- ── 3. Trigger: thesis vote notification ──────────────────────────────────────

CREATE OR REPLACE FUNCTION notify_thesis_vote()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_thesis_author UUID;
  v_thesis_stmt   TEXT;
  v_voter_name    TEXT;
  v_agree_count   INT;
  v_disagree_count INT;
  v_side_count    INT;
  v_milestone     INT;
  v_opt_in        BOOLEAN;
BEGIN
  -- Fetch thesis author and statement
  SELECT user_id, statement, agree_count, disagree_count
    INTO v_thesis_author, v_thesis_stmt, v_agree_count, v_disagree_count
    FROM civic_theses
   WHERE id = NEW.thesis_id;

  -- Don't notify if voting on your own thesis (shouldn't happen, but guard)
  IF v_thesis_author = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Check opt-in preference
  SELECT COALESCE(thesis_notifications, true)
    INTO v_opt_in
    FROM user_notification_prefs
   WHERE user_id = v_thesis_author;

  IF v_opt_in = false THEN
    RETURN NEW;
  END IF;

  -- Fetch voter display name
  SELECT COALESCE(display_name, username, 'Someone')
    INTO v_voter_name
    FROM profiles
   WHERE id = NEW.user_id;

  -- Determine current side count after this vote
  IF NEW.agree THEN
    v_side_count := v_agree_count;
  ELSE
    v_side_count := v_disagree_count;
  END IF;

  -- Only notify at milestones: 1, 5, 10, 25, 50
  v_milestone := CASE
    WHEN v_side_count = 1  THEN 1
    WHEN v_side_count = 5  THEN 5
    WHEN v_side_count = 10 THEN 10
    WHEN v_side_count = 25 THEN 25
    WHEN v_side_count = 50 THEN 50
    ELSE 0
  END;

  -- For non-milestone votes, still notify on the very first vote (milestone = 1)
  -- For all other non-milestone votes, skip to avoid spam
  IF v_milestone = 0 AND v_side_count != 1 THEN
    -- Always notify on first vote regardless of milestone logic
    -- v_side_count = 1 is handled by the milestone = 1 case above
    RETURN NEW;
  END IF;

  IF v_milestone = 0 THEN
    RETURN NEW;
  END IF;

  INSERT INTO notifications (user_id, type, title, body, reference_id, reference_type)
  VALUES (
    v_thesis_author,
    'thesis_vote',
    CASE
      WHEN NEW.agree AND v_milestone = 1 THEN v_voter_name || ' agreed with your thesis'
      WHEN NOT NEW.agree AND v_milestone = 1 THEN v_voter_name || ' disagreed with your thesis'
      WHEN NEW.agree THEN v_milestone::TEXT || ' people agree with your thesis'
      ELSE v_milestone::TEXT || ' people disagree with your thesis'
    END,
    '"' || LEFT(v_thesis_stmt, 120) || CASE WHEN LENGTH(v_thesis_stmt) > 120 THEN '…' ELSE '' END || '"',
    NEW.thesis_id,
    'thesis'
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_thesis_vote_notify ON thesis_votes;

CREATE TRIGGER trg_thesis_vote_notify
  AFTER INSERT OR UPDATE ON thesis_votes
  FOR EACH ROW
  EXECUTE FUNCTION notify_thesis_vote();

-- ── 4. Trigger: thesis comment notification ────────────────────────────────────

CREATE OR REPLACE FUNCTION notify_thesis_comment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_thesis_author UUID;
  v_thesis_stmt   TEXT;
  v_commenter_name TEXT;
  v_opt_in         BOOLEAN;
BEGIN
  -- Fetch thesis author and statement
  SELECT user_id, statement
    INTO v_thesis_author, v_thesis_stmt
    FROM civic_theses
   WHERE id = NEW.thesis_id;

  -- Don't notify if commenting on your own thesis
  IF v_thesis_author = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Check opt-in preference
  SELECT COALESCE(thesis_notifications, true)
    INTO v_opt_in
    FROM user_notification_prefs
   WHERE user_id = v_thesis_author;

  IF v_opt_in = false THEN
    RETURN NEW;
  END IF;

  -- Fetch commenter display name
  SELECT COALESCE(display_name, username, 'Someone')
    INTO v_commenter_name
    FROM profiles
   WHERE id = NEW.user_id;

  INSERT INTO notifications (user_id, type, title, body, reference_id, reference_type)
  VALUES (
    v_thesis_author,
    'thesis_comment',
    v_commenter_name || ' commented on your thesis',
    '"' || LEFT(v_thesis_stmt, 120) || CASE WHEN LENGTH(v_thesis_stmt) > 120 THEN '…' ELSE '' END || '"',
    NEW.thesis_id,
    'thesis'
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_thesis_comment_notify ON thesis_comments;

CREATE TRIGGER trg_thesis_comment_notify
  AFTER INSERT ON thesis_comments
  FOR EACH ROW
  EXECUTE FUNCTION notify_thesis_comment();
