-- =============================================================================
-- Lobby Market: Law Endorsement Notifications
-- =============================================================================
-- Notifies the law's originating topic author when:
--   1. The law receives its very first endorsement  (milestone: 1)
--   2. The law crosses endorsement milestones       (5, 10, 25, 50, 100, 250)
--
-- Notification type: 'law_endorsed'
-- Reference type:    'law'
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
    'law_challenge_milestone',
    'law_endorsed'
  ));

-- ── 2. Trigger function ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION notify_law_endorsed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_law_stmt    TEXT;
  v_law_category TEXT;
  v_topic_author UUID;
  v_endorser_name TEXT;
  v_endorsement_count INT;
  v_milestones  INT[] := ARRAY[1, 5, 10, 25, 50, 100, 250, 500, 1000];
  v_milestone   INT;
BEGIN
  -- Count total endorsements for this law after this INSERT
  SELECT COUNT(*)
    INTO v_endorsement_count
    FROM law_endorsements
   WHERE law_id = NEW.law_id;

  -- Only fire on milestone counts
  v_milestone := NULL;
  FOR i IN 1..array_length(v_milestones, 1) LOOP
    IF v_endorsement_count = v_milestones[i] THEN
      v_milestone := v_milestones[i];
      EXIT;
    END IF;
  END LOOP;

  IF v_milestone IS NULL THEN
    RETURN NEW;
  END IF;

  -- Get law statement
  SELECT l.statement, l.category
    INTO v_law_stmt, v_law_category
    FROM laws l
   WHERE l.id = NEW.law_id;

  IF v_law_stmt IS NULL THEN
    RETURN NEW;
  END IF;

  -- Find the originating topic's author
  SELECT t.author_id
    INTO v_topic_author
    FROM topics t
    JOIN laws l ON l.topic_id = t.id
   WHERE l.id = NEW.law_id
   LIMIT 1;

  IF v_topic_author IS NULL THEN
    RETURN NEW;
  END IF;

  -- Don't notify the person endorsing their own law
  IF v_topic_author = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Get endorser display name
  SELECT COALESCE(display_name, username)
    INTO v_endorser_name
    FROM profiles
   WHERE id = NEW.user_id;

  IF v_endorser_name IS NULL THEN
    v_endorser_name := 'A citizen';
  END IF;

  -- Insert notification (idempotent via ON CONFLICT DO NOTHING)
  INSERT INTO notifications (user_id, type, title, body, reference_id, reference_type)
  VALUES (
    v_topic_author,
    'law_endorsed',
    CASE
      WHEN v_milestone = 1
        THEN v_endorser_name || ' endorsed your law'
      ELSE
        'Your law has ' || v_milestone::TEXT || ' endorsements'
    END,
    '"' || LEFT(v_law_stmt, 100) || CASE WHEN LENGTH(v_law_stmt) > 100 THEN '…' ELSE '' END || '"',
    NEW.law_id,
    'law'
  )
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- ── 3. Attach trigger ─────────────────────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_law_endorsed_notify ON law_endorsements;

CREATE TRIGGER trg_law_endorsed_notify
  AFTER INSERT ON law_endorsements
  FOR EACH ROW
  EXECUTE FUNCTION notify_law_endorsed();
