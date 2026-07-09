-- =============================================================================
-- Lobby Market: Relay Notifications
-- =============================================================================
-- Adds in-app notifications for the three most meaningful relay events:
--   relay_leg_added  — someone joined your relay chain with a new leg
--   relay_completed  — your relay chain now has all legs and is open for voting
--   relay_voted      — someone voted on whether your completed relay is compelling
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
    'ama_session_starting',
    'relay_leg_added',
    'relay_completed',
    'relay_voted'
  ));

COMMENT ON COLUMN notifications.type IS
  'Notification type. Includes relay_leg_added, relay_completed, relay_voted for Civic Relay events.';

-- ─── 2. Add relay_notifications preference column ────────────────────────────

ALTER TABLE user_notification_prefs
  ADD COLUMN IF NOT EXISTS relay_notifications BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN user_notification_prefs.relay_notifications IS
  'Send notifications when relay chain events occur: a new leg is added, relay completes, or voting happens.';

-- ─── 3. Trigger: relay_leg_added ─────────────────────────────────────────────
-- Fires on INSERT into relay_legs.
-- Notifies the relay starter AND all existing leg authors (except the new author)
-- so the whole chain knows the relay is progressing.

CREATE OR REPLACE FUNCTION fn_notify_relay_leg_added()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_relay       RECORD;
  v_topic_stmt  TEXT;
  v_author_name TEXT;
  v_side_label  TEXT;
  v_leg_author  RECORD;
BEGIN
  -- Load relay
  SELECT r.*, p.username AS starter_username
  INTO   v_relay
  FROM   civic_relays r
  JOIN   profiles p ON p.id = r.starter_id
  WHERE  r.id = NEW.relay_id;

  IF NOT FOUND THEN RETURN NEW; END IF;

  -- Load topic statement (optional — relay may have no topic)
  IF v_relay.topic_id IS NOT NULL THEN
    SELECT statement INTO v_topic_stmt
    FROM   topics
    WHERE  id = v_relay.topic_id;
  END IF;

  -- Load new leg author username
  SELECT username INTO v_author_name
  FROM   profiles
  WHERE  id = NEW.author_id;

  v_side_label := CASE v_relay.side WHEN 'for' THEN 'FOR' ELSE 'AGAINST' END;

  -- Notify the relay starter (if they're not the one who just added the leg)
  IF v_relay.starter_id <> NEW.author_id THEN
    IF EXISTS (
      SELECT 1 FROM user_notification_prefs
      WHERE  user_id = v_relay.starter_id
        AND  relay_notifications = true
    ) OR NOT EXISTS (
      SELECT 1 FROM user_notification_prefs WHERE user_id = v_relay.starter_id
    ) THEN
      INSERT INTO notifications (user_id, type, title, body, reference_id, reference_type)
      SELECT
        v_relay.starter_id,
        'relay_leg_added',
        'New leg in your relay',
        CASE
          WHEN v_topic_stmt IS NOT NULL THEN
            '@' || v_author_name || ' added leg ' || NEW.leg_number || ' to your '
            || v_side_label || ' relay on "' || LEFT(v_topic_stmt, 60)
            || CASE WHEN LENGTH(v_topic_stmt) > 60 THEN '…' ELSE '"' END
          ELSE
            '@' || v_author_name || ' added leg ' || NEW.leg_number || ' to your ' || v_side_label || ' relay'
        END,
        NEW.relay_id,
        'relay'
      WHERE NOT EXISTS (
        SELECT 1 FROM notifications
        WHERE  user_id      = v_relay.starter_id
          AND  type         = 'relay_leg_added'
          AND  reference_id = NEW.relay_id
          AND  created_at   > now() - INTERVAL '1 hour'
      );
    END IF;
  END IF;

  -- Notify all other leg authors in this relay (not the starter, not the new author)
  FOR v_leg_author IN
    SELECT DISTINCT l.author_id
    FROM   relay_legs l
    WHERE  l.relay_id = NEW.relay_id
      AND  l.author_id <> NEW.author_id
      AND  l.author_id <> v_relay.starter_id
  LOOP
    IF EXISTS (
      SELECT 1 FROM user_notification_prefs
      WHERE  user_id = v_leg_author.author_id
        AND  relay_notifications = true
    ) OR NOT EXISTS (
      SELECT 1 FROM user_notification_prefs WHERE user_id = v_leg_author.author_id
    ) THEN
      INSERT INTO notifications (user_id, type, title, body, reference_id, reference_type)
      SELECT
        v_leg_author.author_id,
        'relay_leg_added',
        'Your relay is growing',
        CASE
          WHEN v_topic_stmt IS NOT NULL THEN
            '@' || v_author_name || ' joined the ' || v_side_label || ' relay on "'
            || LEFT(v_topic_stmt, 60) || CASE WHEN LENGTH(v_topic_stmt) > 60 THEN '…"' ELSE '"' END
          ELSE
            '@' || v_author_name || ' added a leg to a relay you''re part of'
        END,
        NEW.relay_id,
        'relay'
      WHERE NOT EXISTS (
        SELECT 1 FROM notifications
        WHERE  user_id      = v_leg_author.author_id
          AND  type         = 'relay_leg_added'
          AND  reference_id = NEW.relay_id
          AND  created_at   > now() - INTERVAL '1 hour'
      );
    END IF;
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_relay_leg_added ON relay_legs;
CREATE TRIGGER trg_notify_relay_leg_added
  AFTER INSERT ON relay_legs
  FOR EACH ROW
  EXECUTE FUNCTION fn_notify_relay_leg_added();

-- ─── 4. Trigger: relay_completed ─────────────────────────────────────────────
-- Fires when civic_relays.status transitions to 'complete'.
-- Notifies the relay starter and all leg authors so they know the relay is
-- now open for community voting.

CREATE OR REPLACE FUNCTION fn_notify_relay_completed()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_topic_stmt TEXT;
  v_side_label TEXT;
  v_participant UUID;
BEGIN
  -- Only fire on the specific transition open/in_progress → complete
  IF NEW.status <> 'complete' OR OLD.status = 'complete' THEN
    RETURN NEW;
  END IF;

  -- Load topic statement
  IF NEW.topic_id IS NOT NULL THEN
    SELECT statement INTO v_topic_stmt FROM topics WHERE id = NEW.topic_id;
  END IF;

  v_side_label := CASE NEW.side WHEN 'for' THEN 'FOR' ELSE 'AGAINST' END;

  -- Collect all unique participants: starter + all leg authors
  FOR v_participant IN
    SELECT NEW.starter_id
    UNION
    SELECT DISTINCT author_id FROM relay_legs WHERE relay_id = NEW.id
  LOOP
    IF EXISTS (
      SELECT 1 FROM user_notification_prefs
      WHERE  user_id = v_participant
        AND  relay_notifications = true
    ) OR NOT EXISTS (
      SELECT 1 FROM user_notification_prefs WHERE user_id = v_participant
    ) THEN
      INSERT INTO notifications (user_id, type, title, body, reference_id, reference_type)
      SELECT
        v_participant,
        'relay_completed',
        'Relay chain complete — open for votes',
        CASE
          WHEN v_topic_stmt IS NOT NULL THEN
            'Your ' || v_side_label || ' relay on "' || LEFT(v_topic_stmt, 70)
            || CASE WHEN LENGTH(v_topic_stmt) > 70 THEN '…"' ELSE '"' END
            || ' is now complete and open for community voting.'
          ELSE
            'Your ' || v_side_label || ' relay chain is complete and open for community voting.'
        END,
        NEW.id,
        'relay'
      WHERE NOT EXISTS (
        SELECT 1 FROM notifications
        WHERE  user_id      = v_participant
          AND  type         = 'relay_completed'
          AND  reference_id = NEW.id
      );
    END IF;
  END LOOP;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_relay_completed ON civic_relays;
CREATE TRIGGER trg_notify_relay_completed
  AFTER UPDATE OF status ON civic_relays
  FOR EACH ROW
  EXECUTE FUNCTION fn_notify_relay_completed();

-- ─── 5. Trigger: relay_voted ──────────────────────────────────────────────────
-- Fires on INSERT into relay_votes.
-- Notifies the relay starter when someone casts a vote, throttled to once per
-- hour per relay so high-traffic relays don't spam the starter.

CREATE OR REPLACE FUNCTION fn_notify_relay_voted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_relay       RECORD;
  v_topic_stmt  TEXT;
  v_side_label  TEXT;
  v_vote_label  TEXT;
  v_total_votes INT;
BEGIN
  -- Load relay
  SELECT r.*, p.username AS starter_username
  INTO   v_relay
  FROM   civic_relays r
  JOIN   profiles p ON p.id = r.starter_id
  WHERE  r.id = NEW.relay_id;

  IF NOT FOUND THEN RETURN NEW; END IF;

  -- Don't notify the starter if they voted on their own relay
  IF v_relay.starter_id = NEW.voter_id THEN RETURN NEW; END IF;

  -- Load topic statement
  IF v_relay.topic_id IS NOT NULL THEN
    SELECT statement INTO v_topic_stmt FROM topics WHERE id = v_relay.topic_id;
  END IF;

  v_side_label := CASE v_relay.side WHEN 'for' THEN 'FOR' ELSE 'AGAINST' END;
  v_vote_label := CASE NEW.vote WHEN 'compelling' THEN 'compelling' ELSE 'not compelling' END;
  v_total_votes := v_relay.vote_compelling + v_relay.vote_not_compelling + 1;

  IF EXISTS (
    SELECT 1 FROM user_notification_prefs
    WHERE  user_id = v_relay.starter_id
      AND  relay_notifications = true
  ) OR NOT EXISTS (
    SELECT 1 FROM user_notification_prefs WHERE user_id = v_relay.starter_id
  ) THEN
    -- Throttle: one relay_voted notification per hour per relay per user
    INSERT INTO notifications (user_id, type, title, body, reference_id, reference_type)
    SELECT
      v_relay.starter_id,
      'relay_voted',
      'Your relay received a vote',
      CASE
        WHEN v_topic_stmt IS NOT NULL THEN
          'Someone found your ' || v_side_label || ' relay on "' || LEFT(v_topic_stmt, 50)
          || CASE WHEN LENGTH(v_topic_stmt) > 50 THEN '…"' ELSE '"' END
          || ' ' || v_vote_label || '. ' || v_total_votes || ' vote' || CASE WHEN v_total_votes = 1 THEN '' ELSE 's' END || ' so far.'
        ELSE
          'Someone voted your ' || v_side_label || ' relay as ' || v_vote_label || '.'
      END,
      NEW.relay_id,
      'relay'
    WHERE NOT EXISTS (
      SELECT 1 FROM notifications
      WHERE  user_id      = v_relay.starter_id
        AND  type         = 'relay_voted'
        AND  reference_id = NEW.relay_id
        AND  created_at   > now() - INTERVAL '1 hour'
    );
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_relay_voted ON relay_votes;
CREATE TRIGGER trg_notify_relay_voted
  AFTER INSERT ON relay_votes
  FOR EACH ROW
  EXECUTE FUNCTION fn_notify_relay_voted();
