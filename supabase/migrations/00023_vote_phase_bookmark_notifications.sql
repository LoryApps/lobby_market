-- =============================================================================
-- Lobby Market: Vote-Phase & Bookmark Notifications
-- =============================================================================
--
-- Two new notification categories:
--
-- 1. vote_started  — When a topic moves from "active" → "voting" (final vote
--    phase), notify up to 500 users who already voted on it so they know the
--    outcome will be decided soon.
--
-- 2. bookmark_update — When a topic that a user bookmarked (but hasn't voted
--    on) changes to a major status (active, law, failed), surface a
--    notification so they can engage before the window closes.
--
-- The existing _safe_notify() helper deduplicates automatically, so a user
-- who both voted AND bookmarked a topic will only receive one notification
-- per event (whichever INSERT arrives first wins).
-- =============================================================================

-- ── 1. Expand the type check constraint ───────────────────────────────────────

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
    'bookmark_update'
  ));

-- ── 2. Replace fn_notify_topic_status_change with the expanded version ─────────
--
-- New additions vs the version in 00016:
--   • active → voting    → notify voters (type: vote_started)
--   • active → voting    → notify bookmarkers who haven't voted (type: bookmark_update)
--   • proposed → active  → notify bookmarkers who haven't voted (type: topic_activated)
--   • any → law          → notify bookmarkers who haven't voted (type: law_established)
--   • any → failed       → notify bookmarkers who haven't voted (type: bookmark_update)

CREATE OR REPLACE FUNCTION fn_notify_topic_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row RECORD;
BEGIN

  -- ── topic_activated: proposed → active ───────────────────────────────────
  IF NEW.status = 'active' AND OLD.status = 'proposed' THEN

    -- Notify the author
    IF NEW.author_id IS NOT NULL THEN
      PERFORM _safe_notify(
        NEW.author_id,
        'topic_activated',
        'Your topic is now active',
        NEW.statement,
        NEW.id,
        'topic'
      );
    END IF;

    -- Notify bookmarkers who haven't voted yet (exclude author)
    FOR v_row IN
      SELECT DISTINCT tb.user_id
      FROM topic_bookmarks tb
      WHERE tb.topic_id = NEW.id
        AND tb.user_id IS DISTINCT FROM NEW.author_id
        AND NOT EXISTS (
          SELECT 1 FROM votes v
          WHERE v.topic_id = NEW.id AND v.user_id = tb.user_id
        )
      LIMIT 500
    LOOP
      PERFORM _safe_notify(
        v_row.user_id,
        'topic_activated',
        'A topic you saved is now active',
        NEW.statement,
        NEW.id,
        'topic'
      );
    END LOOP;
  END IF;

  -- ── vote_started: active → voting (final vote phase) ─────────────────────
  IF NEW.status = 'voting' AND OLD.status = 'active' THEN

    -- Notify the author
    IF NEW.author_id IS NOT NULL THEN
      PERFORM _safe_notify(
        NEW.author_id,
        'vote_started',
        'Your topic has entered final voting',
        NEW.statement,
        NEW.id,
        'topic'
      );
    END IF;

    -- Notify up to 500 voters
    FOR v_row IN
      SELECT DISTINCT v.user_id
      FROM votes v
      WHERE v.topic_id = NEW.id
        AND v.user_id IS DISTINCT FROM NEW.author_id
      LIMIT 500
    LOOP
      PERFORM _safe_notify(
        v_row.user_id,
        'vote_started',
        'A topic you voted on is in final voting',
        NEW.statement,
        NEW.id,
        'topic'
      );
    END LOOP;

    -- Notify bookmarkers who haven't voted yet
    FOR v_row IN
      SELECT DISTINCT tb.user_id
      FROM topic_bookmarks tb
      WHERE tb.topic_id = NEW.id
        AND tb.user_id IS DISTINCT FROM NEW.author_id
        AND NOT EXISTS (
          SELECT 1 FROM votes v
          WHERE v.topic_id = NEW.id AND v.user_id = tb.user_id
        )
      LIMIT 500
    LOOP
      PERFORM _safe_notify(
        v_row.user_id,
        'bookmark_update',
        'A saved topic is now in final voting',
        NEW.statement,
        NEW.id,
        'topic'
      );
    END LOOP;
  END IF;

  -- ── law_established: any status → law ────────────────────────────────────
  IF NEW.status = 'law' AND OLD.status IS DISTINCT FROM 'law' THEN

    -- Notify the author first
    IF NEW.author_id IS NOT NULL THEN
      PERFORM _safe_notify(
        NEW.author_id,
        'law_established',
        'Your proposal became law!',
        NEW.statement,
        NEW.id,
        'topic'
      );
    END IF;

    -- Notify up to 500 voters (excluding author)
    FOR v_row IN
      SELECT DISTINCT v.user_id
      FROM votes v
      WHERE v.topic_id = NEW.id
        AND v.user_id IS DISTINCT FROM NEW.author_id
      LIMIT 500
    LOOP
      PERFORM _safe_notify(
        v_row.user_id,
        'law_established',
        'A topic you voted on is now law',
        NEW.statement,
        NEW.id,
        'topic'
      );
    END LOOP;

    -- Notify bookmarkers who never voted (deduplicated by _safe_notify)
    FOR v_row IN
      SELECT DISTINCT tb.user_id
      FROM topic_bookmarks tb
      WHERE tb.topic_id = NEW.id
        AND tb.user_id IS DISTINCT FROM NEW.author_id
        AND NOT EXISTS (
          SELECT 1 FROM votes v
          WHERE v.topic_id = NEW.id AND v.user_id = tb.user_id
        )
      LIMIT 500
    LOOP
      PERFORM _safe_notify(
        v_row.user_id,
        'law_established',
        'A topic you saved is now law',
        NEW.statement,
        NEW.id,
        'topic'
      );
    END LOOP;
  END IF;

  -- ── topic failed: → failed ────────────────────────────────────────────────
  IF NEW.status = 'failed' AND OLD.status IS DISTINCT FROM 'failed' THEN

    -- Notify bookmarkers who never voted
    FOR v_row IN
      SELECT DISTINCT tb.user_id
      FROM topic_bookmarks tb
      WHERE tb.topic_id = NEW.id
        AND NOT EXISTS (
          SELECT 1 FROM votes v
          WHERE v.topic_id = NEW.id AND v.user_id = tb.user_id
        )
      LIMIT 200
    LOOP
      PERFORM _safe_notify(
        v_row.user_id,
        'bookmark_update',
        'A topic you saved did not pass',
        NEW.statement,
        NEW.id,
        'topic'
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate the trigger (REPLACE OR CREATE pattern)
DROP TRIGGER IF EXISTS trg_topic_status_notification ON topics;
CREATE TRIGGER trg_topic_status_notification
  AFTER UPDATE OF status ON topics
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION fn_notify_topic_status_change();
