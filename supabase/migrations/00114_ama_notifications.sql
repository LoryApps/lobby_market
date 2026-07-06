-- =============================================================================
-- Lobby Market: AMA Notification Triggers
-- =============================================================================
-- Adds in-app notifications for the two most meaningful AMA events:
--   ama_question_answered — fires when a host answers your question
--   ama_session_starting  — fires when a session you RSVP'd to goes live
--
-- Follows the exact pattern of 00110_qa_notifications.sql and
-- the debate_starting trigger in 00016_notification_triggers.sql.
-- =============================================================================

-- ─── 1. Extend the notification type constraint ───────────────────────────────

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
    'ama_session_starting'
  ));

COMMENT ON COLUMN notifications.type IS
  'Notification type. Includes ama_question_answered and ama_session_starting for AMA events.';

-- ─── 2. Add ama_notifications preference column ───────────────────────────────

ALTER TABLE user_notification_prefs
  ADD COLUMN IF NOT EXISTS ama_notifications BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN user_notification_prefs.ama_notifications IS
  'Send notifications when a host answers your AMA question or a session you RSVP''d to goes live.';

-- ─── 3. Trigger: ama_question_answered ───────────────────────────────────────
-- Fires on INSERT into ama_answers. Notifies the author of the answered question.

CREATE OR REPLACE FUNCTION fn_notify_ama_question_answered()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_question_author_id  UUID;
  v_session_title       TEXT;
  v_expert_name         TEXT;
BEGIN
  -- Look up the question author
  SELECT q.author_id, s.title
  INTO v_question_author_id, v_session_title
  FROM ama_questions q
  JOIN ama_sessions  s ON s.id = q.session_id
  WHERE q.id = NEW.question_id
  LIMIT 1;

  -- Skip if we can't find the question or the host answered their own question
  IF v_question_author_id IS NULL THEN
    RETURN NEW;
  END IF;
  IF v_question_author_id = NEW.host_id THEN
    RETURN NEW;
  END IF;

  -- Look up the expert's display name
  SELECT COALESCE(display_name, username, 'An expert')
  INTO v_expert_name
  FROM profiles
  WHERE id = NEW.host_id
  LIMIT 1;

  -- Check that the user has ama_notifications enabled (default true)
  IF EXISTS (
    SELECT 1 FROM user_notification_prefs
    WHERE user_id = v_question_author_id
      AND ama_notifications = false
  ) THEN
    RETURN NEW;
  END IF;

  PERFORM _safe_notify(
    v_question_author_id,
    'ama_question_answered',
    v_expert_name || ' answered your question',
    COALESCE(v_session_title, 'Your AMA question has been answered'),
    NEW.session_id,
    'ama_session'
  );

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ama_question_answered ON ama_answers;
CREATE TRIGGER trg_ama_question_answered
  AFTER INSERT ON ama_answers
  FOR EACH ROW
  EXECUTE FUNCTION fn_notify_ama_question_answered();

-- ─── 4. Trigger: ama_session_starting ────────────────────────────────────────
-- Fires when an ama_session transitions from upcoming → live.
-- Notifies every user who RSVP'd (ama_rsvps).

CREATE OR REPLACE FUNCTION fn_notify_ama_session_starting()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row        RECORD;
  v_expert     TEXT;
BEGIN
  -- Only fire when status transitions to 'live'
  IF NEW.status = 'live' AND OLD.status <> 'live' THEN

    SELECT COALESCE(display_name, username, 'An expert')
    INTO v_expert
    FROM profiles
    WHERE id = NEW.host_id
    LIMIT 1;

    FOR v_row IN
      SELECT r.user_id
      FROM ama_rsvps r
      WHERE r.session_id = NEW.id
        AND r.user_id <> NEW.host_id
    LOOP
      -- Respect preference (default true)
      IF EXISTS (
        SELECT 1 FROM user_notification_prefs
        WHERE user_id = v_row.user_id
          AND ama_notifications = false
      ) THEN
        CONTINUE;
      END IF;

      PERFORM _safe_notify(
        v_row.user_id,
        'ama_session_starting',
        v_expert || '''s AMA is live',
        COALESCE(NEW.title, 'The AMA session you RSVP''d to is live now'),
        NEW.id,
        'ama_session'
      );
    END LOOP;

  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_ama_session_starting ON ama_sessions;
CREATE TRIGGER trg_ama_session_starting
  AFTER UPDATE OF status ON ama_sessions
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION fn_notify_ama_session_starting();
