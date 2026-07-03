-- =============================================================================
-- Lobby Market: Q&A Notifications
-- =============================================================================
-- Sends in-app notifications for the two most personal Q&A events:
--   qa_question_answered — someone posted an answer to your question
--   qa_answer_accepted   — the question author accepted your answer as best
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
    'qa_answer_accepted'
  ));

COMMENT ON COLUMN notifications.type IS
  'Notification type. Includes qa_question_answered and qa_answer_accepted for Q&A events.';

-- ─── 2. Add qa_notifications preference column ────────────────────────────────

ALTER TABLE user_notification_prefs
  ADD COLUMN IF NOT EXISTS qa_notifications BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN user_notification_prefs.qa_notifications IS
  'Send notifications when someone answers your question or accepts your answer as best.';

-- ─── 3. Trigger: notify question author when a new answer is posted ───────────

CREATE OR REPLACE FUNCTION _notify_qa_question_answered()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_question_author_id UUID;
  v_answerer_name      TEXT;
  v_question_snippet   TEXT;
  v_topic_id           UUID;
BEGIN
  -- Fetch the question author and snippet
  SELECT author_id, LEFT(content, 80), topic_id
    INTO v_question_author_id, v_question_snippet, v_topic_id
    FROM topic_questions
   WHERE id = NEW.question_id;

  -- Skip if the answerer is also the question author (no self-notifications)
  IF v_question_author_id IS NULL OR v_question_author_id = NEW.author_id THEN
    RETURN NEW;
  END IF;

  -- Resolve answerer display name
  SELECT COALESCE(display_name, username)
    INTO v_answerer_name
    FROM profiles
   WHERE id = NEW.author_id;

  -- Insert notification (deduplicate: 1 per question per 10 min to avoid spam)
  INSERT INTO notifications (user_id, type, title, body, reference_id, reference_type)
  SELECT
    v_question_author_id,
    'qa_question_answered',
    COALESCE(v_answerer_name, 'Someone') || ' answered your question',
    v_question_snippet,
    NEW.question_id,
    'question'
  WHERE NOT EXISTS (
    SELECT 1 FROM notifications
     WHERE user_id      = v_question_author_id
       AND type         = 'qa_question_answered'
       AND reference_id = NEW.question_id
       AND created_at   > now() - INTERVAL '10 minutes'
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_qa_answer_inserted
  AFTER INSERT ON topic_answers
  FOR EACH ROW
  EXECUTE FUNCTION _notify_qa_question_answered();

-- ─── 4. Trigger: notify answer author when their answer is accepted ────────────

CREATE OR REPLACE FUNCTION _notify_qa_answer_accepted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_acceptor_name    TEXT;
  v_question_snippet TEXT;
BEGIN
  -- Only fire when is_accepted transitions false → true
  IF NOT (OLD.is_accepted = FALSE AND NEW.is_accepted = TRUE) THEN
    RETURN NEW;
  END IF;

  -- Skip self-acceptance (shouldn't happen via RLS, but guard anyway)
  -- Look up who asked the question
  SELECT LEFT(content, 80)
    INTO v_question_snippet
    FROM topic_questions
   WHERE id = NEW.question_id;

  SELECT COALESCE(display_name, username)
    INTO v_acceptor_name
    FROM profiles
    JOIN topic_questions ON topic_questions.author_id = profiles.id
   WHERE topic_questions.id = NEW.question_id;

  -- Insert notification for the answer author
  INSERT INTO notifications (user_id, type, title, body, reference_id, reference_type)
  VALUES (
    NEW.author_id,
    'qa_answer_accepted',
    'Your answer was accepted as best',
    v_question_snippet,
    NEW.question_id,
    'question'
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_qa_answer_accepted
  AFTER UPDATE OF is_accepted ON topic_answers
  FOR EACH ROW
  EXECUTE FUNCTION _notify_qa_answer_accepted();
