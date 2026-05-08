-- =============================================================================
-- Lobby Market: Direct Argument Reply Notifications
-- =============================================================================
--
-- When someone replies to your argument (not just @-mentions you), you should
-- receive a 'reply_received' notification linking you back to the argument.
--
-- The existing 00030_argument_mentions.sql migration handles @mention
-- notifications inside reply text.  This migration adds a complementary
-- trigger that fires for the *argument author* whenever anyone posts a reply
-- to one of their arguments — even if the replier doesn't @-mention them.
--
-- Guard conditions:
--   • Does not fire if the replier IS the argument author (no self-notify).
--   • Uses _safe_notify() which deduplicates within a 24-hour window, so
--     a user who posts 10 replies in a row only generates one notification.
-- =============================================================================

-- ── 1. Trigger function ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_argument_reply_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_author_id  UUID;
  v_snippet    TEXT;
  v_topic_stmt TEXT;
BEGIN
  -- Fetch the argument author
  SELECT user_id INTO v_author_id
  FROM topic_arguments
  WHERE id = NEW.argument_id;

  -- Skip if the argument no longer exists or the replier is the author
  IF v_author_id IS NULL OR v_author_id = NEW.user_id THEN
    RETURN NEW;
  END IF;

  -- Build a short preview of the reply for the notification body
  v_snippet := left(NEW.content, 120);
  IF length(NEW.content) > 120 THEN
    v_snippet := v_snippet || '…';
  END IF;

  -- Fetch the topic statement for a richer notification title
  SELECT statement INTO v_topic_stmt
  FROM topics
  WHERE id = NEW.topic_id;

  PERFORM _safe_notify(
    v_author_id,
    'reply_received',
    CASE
      WHEN v_topic_stmt IS NOT NULL
      THEN 'Someone replied to your argument on: ' || left(v_topic_stmt, 60)
      ELSE 'Someone replied to your argument'
    END,
    v_snippet,
    NEW.argument_id,
    'argument'
  );

  RETURN NEW;
END;
$$;

-- ── 2. Attach trigger to argument_replies ─────────────────────────────────────

DROP TRIGGER IF EXISTS trg_argument_reply_notify ON argument_replies;

CREATE TRIGGER trg_argument_reply_notify
  AFTER INSERT ON argument_replies
  FOR EACH ROW
  EXECUTE FUNCTION fn_argument_reply_notify();

COMMENT ON FUNCTION fn_argument_reply_notify() IS
  'Fires a reply_received notification to an argument author whenever a new reply is posted (excluding self-replies).';
