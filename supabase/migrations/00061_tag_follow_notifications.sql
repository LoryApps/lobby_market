-- =============================================================================
-- Lobby Market: Tag Follow Notifications
-- =============================================================================
-- When a new topic is created, notify every user who follows one or more of
-- its auto-generated tags.
--
-- Anti-spam rules:
--   • A user receives at most ONE notification per topic, even if the topic
--     matches multiple followed tags.
--   • A user receives at most 5 new_topic_in_tag notifications per 4 hours
--     to prevent flooding during bulk topic creation.
--
-- A new user_notification_prefs column (new_topic_in_tag) lets users opt
-- out from Settings → Notifications.
-- =============================================================================

-- ── 1. Extend the type check constraint ───────────────────────────────────────

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
    'new_topic_in_tag'
  ));

-- ── 2. Add preference column to user_notification_prefs ───────────────────────

ALTER TABLE user_notification_prefs
  ADD COLUMN IF NOT EXISTS new_topic_in_tag BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN user_notification_prefs.new_topic_in_tag IS
  'Notify user when a new topic is created with a tag they follow';

-- ── 3. Trigger function ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_new_topic_tag_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_tag           TEXT;
  v_follower      RECORD;
  v_notified_ids  UUID[] := '{}';  -- prevent duplicate notifications per user
  v_recent_count  INT;
BEGIN
  -- Skip if topic has no tags or tags column is empty
  IF NEW.tags IS NULL OR array_length(NEW.tags, 1) IS NULL THEN
    RETURN NEW;
  END IF;

  -- Iterate over each tag on the newly created topic
  FOREACH v_tag IN ARRAY NEW.tags LOOP
    -- Find users who follow this tag, joined with their notification prefs
    FOR v_follower IN
      SELECT
        utf.user_id,
        COALESCE(unp.new_topic_in_tag, true) AS wants_notif
      FROM user_tag_follows utf
      LEFT JOIN user_notification_prefs unp ON unp.user_id = utf.user_id
      WHERE utf.tag = v_tag
        -- Don't notify the topic author about their own topic
        AND utf.user_id IS DISTINCT FROM NEW.author_id
    LOOP
      -- Skip if user has opted out
      IF NOT v_follower.wants_notif THEN
        CONTINUE;
      END IF;

      -- Skip if we already queued a notification for this user (multi-tag match)
      IF v_follower.user_id = ANY(v_notified_ids) THEN
        CONTINUE;
      END IF;

      -- Anti-spam: skip if user already received 5+ tag-topic notifications
      -- in the last 4 hours
      SELECT COUNT(*) INTO v_recent_count
      FROM notifications
      WHERE user_id    = v_follower.user_id
        AND type       = 'new_topic_in_tag'
        AND created_at > now() - INTERVAL '4 hours';

      IF v_recent_count >= 5 THEN
        CONTINUE;
      END IF;

      -- Insert the notification (safe duplicate guard: same topic per user)
      INSERT INTO notifications (
        user_id,
        type,
        title,
        body,
        reference_id,
        reference_type
      )
      SELECT
        v_follower.user_id,
        'new_topic_in_tag',
        'New debate in #' || v_tag,
        NEW.statement,
        NEW.id,
        'topic'
      WHERE NOT EXISTS (
        SELECT 1 FROM notifications
         WHERE user_id      = v_follower.user_id
           AND type         = 'new_topic_in_tag'
           AND reference_id = NEW.id
      );

      -- Track this user so we don't notify them twice for the same topic
      v_notified_ids := array_append(v_notified_ids, v_follower.user_id);

    END LOOP;
  END LOOP;

  RETURN NEW;
END;
$$;

-- ── 4. Attach trigger (AFTER INSERT so auto-tagging has already run) ──────────

DROP TRIGGER IF EXISTS trg_new_topic_tag_notify ON topics;

CREATE TRIGGER trg_new_topic_tag_notify
  AFTER INSERT ON topics
  FOR EACH ROW
  EXECUTE FUNCTION fn_new_topic_tag_notify();

-- ── 5. Grant execute ──────────────────────────────────────────────────────────

GRANT EXECUTE ON FUNCTION fn_new_topic_tag_notify()
  TO authenticated, service_role;
