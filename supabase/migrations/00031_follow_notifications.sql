-- =============================================================================
-- Lobby Market: New-Follower Notifications
-- =============================================================================
-- When a user follows another user, the followed user receives a
-- 'new_follower' notification so they can check out their new follower's
-- profile and debates.
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
    'bookmark_update',
    'new_follower'
  ));

-- ── 2. Trigger function ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_new_follower_notify()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_display_name TEXT;
  v_username     TEXT;
BEGIN
  -- Fetch the follower's display name (falls back to username)
  SELECT
    COALESCE(display_name, username),
    username
  INTO v_display_name, v_username
  FROM profiles
  WHERE id = NEW.follower_id;

  -- Guard: skip if the profile row doesn't exist yet (race condition)
  IF v_username IS NULL THEN
    RETURN NEW;
  END IF;

  PERFORM _safe_notify(
    NEW.following_id,
    'new_follower',
    v_display_name || ' is now following you',
    '@' || v_username || ' joined your followers.',
    NEW.follower_id,
    'profile'
  );

  RETURN NEW;
END;
$$;

-- ── 3. Attach trigger to user_follows ────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_new_follower_notify ON user_follows;

CREATE TRIGGER trg_new_follower_notify
  AFTER INSERT ON user_follows
  FOR EACH ROW
  EXECUTE FUNCTION fn_new_follower_notify();
