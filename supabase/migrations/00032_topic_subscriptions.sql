-- =============================================================================
-- Lobby Market: Topic Subscriptions (Follow a Debate)
-- =============================================================================
-- Users can subscribe to any topic to get notified when it changes status
-- (proposed → active, active → voting, * → law, * → failed).
-- Subscribers receive notifications using the existing event types so the
-- existing notification display logic applies without changes.
-- =============================================================================

-- ── 1. topic_subscriptions table ─────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS topic_subscriptions (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    UUID NOT NULL REFERENCES auth.users(id)  ON DELETE CASCADE,
  topic_id   UUID NOT NULL REFERENCES topics(id)       ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, topic_id)
);

ALTER TABLE topic_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can read, insert, and delete their own rows.
CREATE POLICY "Users manage own subscriptions"
  ON topic_subscriptions FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Anyone can read subscription counts (for the UI counter).
DROP POLICY IF EXISTS "Anyone can read subscription counts" ON topic_subscriptions;
CREATE POLICY "Anyone can read subscription counts"
  ON topic_subscriptions FOR SELECT
  USING (TRUE);

-- Fast lookups by topic (count) and user (my subscriptions).
CREATE INDEX IF NOT EXISTS idx_topic_subs_topic_id ON topic_subscriptions(topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_subs_user_id  ON topic_subscriptions(user_id);

-- ── 2. Update fn_notify_topic_status_change to notify subscribers ─────────────
--
-- Subscribers are notified AFTER author/voter/bookmark loops so that
-- _safe_notify's 24-hour deduplication guard prevents duplicate notifications
-- for users who both voted on AND subscribed to the same topic.

CREATE OR REPLACE FUNCTION fn_notify_topic_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row RECORD;
BEGIN

  -- ── topic_activated: proposed → active ──────────────────────────────────
  IF NEW.status = 'active' AND OLD.status = 'proposed' THEN

    IF NEW.author_id IS NOT NULL THEN
      PERFORM _safe_notify(
        NEW.author_id, 'topic_activated',
        'Your topic is now active', NEW.statement, NEW.id, 'topic'
      );
    END IF;

    -- Bookmarkers who haven't voted yet (exclude author)
    FOR v_row IN
      SELECT DISTINCT tb.user_id FROM topic_bookmarks tb
      WHERE tb.topic_id = NEW.id
        AND tb.user_id IS DISTINCT FROM NEW.author_id
        AND NOT EXISTS (
          SELECT 1 FROM votes v WHERE v.topic_id = NEW.id AND v.user_id = tb.user_id
        )
      LIMIT 500
    LOOP
      PERFORM _safe_notify(
        v_row.user_id, 'topic_activated',
        'A topic you saved is now active', NEW.statement, NEW.id, 'topic'
      );
    END LOOP;

    -- Subscribers (dedup prevents double-notification for bookmarkers who also subscribed)
    FOR v_row IN
      SELECT DISTINCT ts.user_id FROM topic_subscriptions ts
      WHERE ts.topic_id = NEW.id
        AND ts.user_id IS DISTINCT FROM NEW.author_id
      LIMIT 500
    LOOP
      PERFORM _safe_notify(
        v_row.user_id, 'topic_activated',
        'A debate you''re following is now active', NEW.statement, NEW.id, 'topic'
      );
    END LOOP;
  END IF;

  -- ── vote_started: active → voting ────────────────────────────────────────
  IF NEW.status = 'voting' AND OLD.status = 'active' THEN

    IF NEW.author_id IS NOT NULL THEN
      PERFORM _safe_notify(
        NEW.author_id, 'vote_started',
        'Your topic has entered final voting', NEW.statement, NEW.id, 'topic'
      );
    END IF;

    -- Voters
    FOR v_row IN
      SELECT DISTINCT v.user_id FROM votes v
      WHERE v.topic_id = NEW.id
        AND v.user_id IS DISTINCT FROM NEW.author_id
      LIMIT 500
    LOOP
      PERFORM _safe_notify(
        v_row.user_id, 'vote_started',
        'A topic you voted on is in final voting', NEW.statement, NEW.id, 'topic'
      );
    END LOOP;

    -- Bookmarkers who haven't voted yet
    FOR v_row IN
      SELECT DISTINCT tb.user_id FROM topic_bookmarks tb
      WHERE tb.topic_id = NEW.id
        AND tb.user_id IS DISTINCT FROM NEW.author_id
        AND NOT EXISTS (
          SELECT 1 FROM votes v WHERE v.topic_id = NEW.id AND v.user_id = tb.user_id
        )
      LIMIT 500
    LOOP
      PERFORM _safe_notify(
        v_row.user_id, 'bookmark_update',
        'A saved topic is now in final voting', NEW.statement, NEW.id, 'topic'
      );
    END LOOP;

    -- Subscribers
    FOR v_row IN
      SELECT DISTINCT ts.user_id FROM topic_subscriptions ts
      WHERE ts.topic_id = NEW.id
        AND ts.user_id IS DISTINCT FROM NEW.author_id
      LIMIT 500
    LOOP
      PERFORM _safe_notify(
        v_row.user_id, 'vote_started',
        'A debate you''re following has entered final voting', NEW.statement, NEW.id, 'topic'
      );
    END LOOP;
  END IF;

  -- ── law_established: any → law ────────────────────────────────────────────
  IF NEW.status = 'law' AND OLD.status IS DISTINCT FROM 'law' THEN

    IF NEW.author_id IS NOT NULL THEN
      PERFORM _safe_notify(
        NEW.author_id, 'law_established',
        'Your proposal became law!', NEW.statement, NEW.id, 'topic'
      );
    END IF;

    -- Voters
    FOR v_row IN
      SELECT DISTINCT v.user_id FROM votes v
      WHERE v.topic_id = NEW.id
        AND v.user_id IS DISTINCT FROM NEW.author_id
      LIMIT 500
    LOOP
      PERFORM _safe_notify(
        v_row.user_id, 'law_established',
        'A topic you voted on is now law', NEW.statement, NEW.id, 'topic'
      );
    END LOOP;

    -- Bookmarkers who never voted
    FOR v_row IN
      SELECT DISTINCT tb.user_id FROM topic_bookmarks tb
      WHERE tb.topic_id = NEW.id
        AND tb.user_id IS DISTINCT FROM NEW.author_id
        AND NOT EXISTS (
          SELECT 1 FROM votes v WHERE v.topic_id = NEW.id AND v.user_id = tb.user_id
        )
      LIMIT 500
    LOOP
      PERFORM _safe_notify(
        v_row.user_id, 'law_established',
        'A topic you saved is now law', NEW.statement, NEW.id, 'topic'
      );
    END LOOP;

    -- Subscribers
    FOR v_row IN
      SELECT DISTINCT ts.user_id FROM topic_subscriptions ts
      WHERE ts.topic_id = NEW.id
        AND ts.user_id IS DISTINCT FROM NEW.author_id
      LIMIT 500
    LOOP
      PERFORM _safe_notify(
        v_row.user_id, 'law_established',
        'A debate you''re following is now law', NEW.statement, NEW.id, 'topic'
      );
    END LOOP;
  END IF;

  -- ── topic failed ──────────────────────────────────────────────────────────
  IF NEW.status = 'failed' AND OLD.status IS DISTINCT FROM 'failed' THEN

    -- Bookmarkers who never voted
    FOR v_row IN
      SELECT DISTINCT tb.user_id FROM topic_bookmarks tb
      WHERE tb.topic_id = NEW.id
        AND NOT EXISTS (
          SELECT 1 FROM votes v WHERE v.topic_id = NEW.id AND v.user_id = tb.user_id
        )
      LIMIT 200
    LOOP
      PERFORM _safe_notify(
        v_row.user_id, 'bookmark_update',
        'A topic you saved did not pass', NEW.statement, NEW.id, 'topic'
      );
    END LOOP;

    -- Subscribers
    FOR v_row IN
      SELECT DISTINCT ts.user_id FROM topic_subscriptions ts
      WHERE ts.topic_id = NEW.id
      LIMIT 200
    LOOP
      PERFORM _safe_notify(
        v_row.user_id, 'bookmark_update',
        'A debate you''re following did not pass', NEW.statement, NEW.id, 'topic'
      );
    END LOOP;
  END IF;

  RETURN NEW;
END;
$$;

-- Recreate trigger (no-op if already exists with same definition)
DROP TRIGGER IF EXISTS trg_topic_status_notification ON topics;
CREATE TRIGGER trg_topic_status_notification
  AFTER UPDATE OF status ON topics
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION fn_notify_topic_status_change();
