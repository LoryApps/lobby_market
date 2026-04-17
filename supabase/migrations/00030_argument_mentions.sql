-- =============================================================================
-- Lobby Market: @Mention notifications in arguments and replies
-- =============================================================================
-- When a user posts an argument or reply containing @username patterns,
-- the mentioned users receive a 'reply_received' notification so they
-- can jump straight into the debate.
--
-- Implementation:
--   1. _process_argument_mentions() — shared helper that extracts @usernames
--      from text, looks up the matching profile IDs, and calls _safe_notify()
--      for each mentioned user (skipping self-mentions).
--   2. fn_argument_mention_notify  — AFTER INSERT trigger on topic_arguments
--   3. fn_reply_mention_notify     — AFTER INSERT trigger on argument_replies
-- =============================================================================

-- ── 1. Shared helper ──────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION _process_argument_mentions(
  p_author_id   UUID,
  p_content     TEXT,
  p_source_id   UUID,
  p_source_type TEXT   -- 'argument' | 'reply'
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_username TEXT;
  v_user_id  UUID;
  v_snippet  TEXT;
BEGIN
  -- Nothing to do if content has no @
  IF p_content NOT LIKE '%@%' THEN
    RETURN;
  END IF;

  -- Truncate the content for the notification body
  v_snippet := left(p_content, 120);
  IF length(p_content) > 120 THEN
    v_snippet := v_snippet || '…';
  END IF;

  -- Extract distinct @usernames (letters, digits, underscores)
  FOR v_username IN
    SELECT DISTINCT lower((regexp_matches(p_content, '@([A-Za-z0-9_]+)', 'g'))[1])
  LOOP
    -- Look up the profile by username (case-insensitive)
    SELECT id INTO v_user_id
    FROM profiles
    WHERE lower(username) = v_username
    LIMIT 1;

    -- Skip unknown users and self-mentions
    CONTINUE WHEN v_user_id IS NULL OR v_user_id = p_author_id;

    -- Fire the notification (idempotent — duplicate inserts are silently dropped)
    PERFORM _safe_notify(
      v_user_id,
      'reply_received',
      'You were mentioned in an argument',
      v_snippet,
      p_source_id,
      p_source_type
    );
  END LOOP;
END;
$$;

-- ── 2. Trigger on topic_arguments ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_argument_mention_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  PERFORM _process_argument_mentions(NEW.user_id, NEW.content, NEW.id, 'argument');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_argument_mention_notify ON topic_arguments;

CREATE TRIGGER trg_argument_mention_notify
  AFTER INSERT ON topic_arguments
  FOR EACH ROW
  EXECUTE FUNCTION fn_argument_mention_notify();

-- ── 3. Trigger on argument_replies ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_reply_mention_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Use the argument_id as the source so the notification link resolves
  -- to the parent argument's topic page.
  PERFORM _process_argument_mentions(NEW.user_id, NEW.content, NEW.argument_id, 'argument');
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_reply_mention_notify ON argument_replies;

CREATE TRIGGER trg_reply_mention_notify
  AFTER INSERT ON argument_replies
  FOR EACH ROW
  EXECUTE FUNCTION fn_reply_mention_notify();
