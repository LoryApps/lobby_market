-- =============================================================================
-- Lobby Market: Argument Upvote Milestone Notifications
-- =============================================================================
-- When an argument crosses a milestone upvote count (5, 25, 100), fire a
-- 'reply_received' notification to the argument author.
--
-- We trigger AFTER UPDATE on topic_arguments so we can compare OLD.upvotes
-- vs NEW.upvotes and only fire once per milestone per argument.
-- =============================================================================

-- ── Milestone trigger function ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION _on_argument_upvote_milestone()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_milestones INT[] := ARRAY[5, 25, 100];
  v_milestone  INT;
  v_topic      RECORD;
  v_title      TEXT;
  v_body       TEXT;
BEGIN
  -- Only process upvote increases
  IF NEW.upvotes <= OLD.upvotes THEN
    RETURN NEW;
  END IF;

  -- Check if we just crossed a milestone
  FOREACH v_milestone IN ARRAY v_milestones
  LOOP
    IF OLD.upvotes < v_milestone AND NEW.upvotes >= v_milestone THEN
      -- Fetch topic info for the notification body
      SELECT statement, category
        INTO v_topic
        FROM topics
       WHERE id = NEW.topic_id
       LIMIT 1;

      -- Build notification text
      v_title := 'Your argument reached ' || v_milestone || ' upvotes';
      v_body  := CASE
        WHEN v_topic IS NOT NULL THEN
          'On: "' || LEFT(v_topic.statement, 80) || CASE WHEN LENGTH(v_topic.statement) > 80 THEN '…' ELSE '"' END
        ELSE
          'Keep the debate going!'
      END;

      -- Notify the argument author (idempotent via _safe_notify)
      PERFORM _safe_notify(
        NEW.user_id,
        'reply_received',
        v_title,
        v_body,
        NEW.id,
        'argument'
      );

      EXIT; -- only fire the first crossed milestone per update
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

-- ── Attach trigger to topic_arguments ─────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_argument_upvote_milestone ON topic_arguments;

CREATE TRIGGER trg_argument_upvote_milestone
  AFTER UPDATE OF upvotes ON topic_arguments
  FOR EACH ROW
  EXECUTE FUNCTION _on_argument_upvote_milestone();

-- ── Grant execute ─────────────────────────────────────────────────────────────
-- _on_argument_upvote_milestone is SECURITY DEFINER so it runs with owner
-- privileges; no additional grants are needed on the function itself.
-- The trigger fires automatically on UPDATE, which is already permitted
-- via the existing RLS policies on topic_argument_votes.
