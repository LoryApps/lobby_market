-- =============================================================================
-- Lobby Market: Notification Triggers & Constraint Fix
-- =============================================================================
-- 1. Expand the notifications.type check constraint to include coalition types
--    (the existing code was inserting 'coalition_invite' but the constraint
--     only allowed the original 8 types — silently failing).
-- 2. Add PL/pgSQL triggers that auto-create notifications for the four key
--    platform events:
--      a) topic_activated  — when a topic moves from proposed → active
--      b) law_established  — when a topic becomes a law (notifies voters)
--      c) debate_starting  — when a debate goes live (notifies RSVPed users)
--      d) vote_threshold   — when a topic crosses 50/100/250/500/1k/5k votes
-- =============================================================================

-- ── 1. Expand check constraint ─────────────────────────────────────────────────

-- Drop the inline check constraint (Postgres names it notifications_type_check
-- by default). Use IF EXISTS so it's safe to re-run.
ALTER TABLE notifications
  DROP CONSTRAINT IF EXISTS notifications_type_check;

-- Re-add with all supported types, including the coalition variants.
ALTER TABLE notifications
  ADD CONSTRAINT notifications_type_check CHECK (type IN (
    'topic_activated',
    'vote_threshold',
    'law_established',
    'debate_starting',
    'achievement_earned',
    'reply_received',
    'lobby_update',
    'role_promoted',
    'coalition_invite',
    'coalition_invite_accepted'
  ));

-- ── 2. Helper: safe notification insert ───────────────────────────────────────
-- Wraps a guarded INSERT so we never spam duplicate notifications.
-- A notification is considered a duplicate if a record with the same
-- (user_id, type, reference_id) exists that was created in the last 24 hours.

CREATE OR REPLACE FUNCTION _safe_notify(
  p_user_id      UUID,
  p_type         TEXT,
  p_title        TEXT,
  p_body         TEXT,
  p_reference_id UUID DEFAULT NULL,
  p_ref_type     TEXT DEFAULT NULL
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  -- Skip if user doesn't exist (safety guard for cascaded deletes in progress)
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
    RETURN;
  END IF;

  -- Skip if already notified about this exact event recently
  IF p_reference_id IS NOT NULL THEN
    IF EXISTS (
      SELECT 1 FROM notifications
      WHERE user_id     = p_user_id
        AND type        = p_type
        AND reference_id = p_reference_id
        AND created_at  > now() - INTERVAL '24 hours'
    ) THEN
      RETURN;
    END IF;
  END IF;

  INSERT INTO notifications (user_id, type, title, body, reference_id, reference_type)
  VALUES (p_user_id, p_type, p_title, p_body, p_reference_id, p_ref_type);

EXCEPTION WHEN OTHERS THEN
  -- Never let a notification failure break the main transaction
  NULL;
END;
$$;

-- ── 3. Trigger function: topic status changes ──────────────────────────────────

CREATE OR REPLACE FUNCTION fn_notify_topic_status_change()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_row RECORD;
BEGIN
  -- ── topic_activated: proposed → active ─────────────────────────────────────
  IF NEW.status = 'active' AND OLD.status = 'proposed' THEN
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
  END IF;

  -- ── law_established: any status → law ──────────────────────────────────────
  IF NEW.status = 'law' AND OLD.status IS DISTINCT FROM 'law' THEN
    -- Notify the topic author first (special message)
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

    -- Notify up to 500 users who voted on this topic (excluding the author)
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
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_topic_status_notification ON topics;
CREATE TRIGGER trg_topic_status_notification
  AFTER UPDATE OF status ON topics
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION fn_notify_topic_status_change();

-- ── 4. Trigger function: debate goes live ──────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_notify_debate_starting()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_topic_stmt TEXT;
  v_row        RECORD;
BEGIN
  -- Only fire when transitioning scheduled → live
  IF NEW.status = 'live' AND OLD.status = 'scheduled' THEN

    -- Fetch the topic statement for the notification body
    SELECT statement INTO v_topic_stmt
    FROM topics
    WHERE id = NEW.topic_id
    LIMIT 1;

    -- Notify every user who RSVP'd to this debate
    FOR v_row IN
      SELECT r.user_id
      FROM debate_rsvps r
      WHERE r.debate_id = NEW.id
    LOOP
      PERFORM _safe_notify(
        v_row.user_id,
        'debate_starting',
        'A debate you RSVP''d to is live',
        COALESCE(v_topic_stmt, 'The debate is starting now'),
        NEW.id,
        'debate'
      );
    END LOOP;

  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_debate_starting_notification ON debates;
CREATE TRIGGER trg_debate_starting_notification
  AFTER UPDATE OF status ON debates
  FOR EACH ROW
  WHEN (OLD.status IS DISTINCT FROM NEW.status)
  EXECUTE FUNCTION fn_notify_debate_starting();

-- ── 5. Trigger function: vote threshold milestones ────────────────────────────

CREATE OR REPLACE FUNCTION fn_notify_vote_threshold()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_milestones  INT[] := ARRAY[50, 100, 250, 500, 1000, 5000];
  v_milestone   INT;
BEGIN
  -- Skip if no author or vote counts aren't changing
  IF NEW.author_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF OLD.total_votes IS NULL OR NEW.total_votes IS NULL THEN
    RETURN NEW;
  END IF;

  -- Check each milestone in ascending order; stop at the first one crossed
  FOREACH v_milestone IN ARRAY v_milestones
  LOOP
    IF NEW.total_votes >= v_milestone AND OLD.total_votes < v_milestone THEN
      PERFORM _safe_notify(
        NEW.author_id,
        'vote_threshold',
        'Your topic reached ' || v_milestone || ' votes',
        NEW.statement,
        NEW.id,
        'topic'
      );
      EXIT; -- Only fire for the lowest crossed milestone per update
    END IF;
  END LOOP;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_vote_threshold_notification ON topics;
CREATE TRIGGER trg_vote_threshold_notification
  AFTER UPDATE OF total_votes ON topics
  FOR EACH ROW
  WHEN (
    OLD.total_votes IS DISTINCT FROM NEW.total_votes
    AND NEW.author_id IS NOT NULL
  )
  EXECUTE FUNCTION fn_notify_vote_threshold();

-- ── 6. Trigger function: role promoted ────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_notify_role_promoted()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_role_label TEXT;
BEGIN
  IF NEW.role IS DISTINCT FROM OLD.role THEN
    v_role_label := CASE NEW.role
      WHEN 'debator'       THEN 'Debator'
      WHEN 'troll_catcher' THEN 'Troll Catcher'
      WHEN 'elder'         THEN 'Elder'
      ELSE initcap(NEW.role)
    END;

    PERFORM _safe_notify(
      NEW.id,
      'role_promoted',
      'Your role has changed',
      'You are now a ' || v_role_label || ' in the Lobby',
      NEW.id,
      'profile'
    );
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_role_promoted_notification ON profiles;
CREATE TRIGGER trg_role_promoted_notification
  AFTER UPDATE OF role ON profiles
  FOR EACH ROW
  WHEN (OLD.role IS DISTINCT FROM NEW.role)
  EXECUTE FUNCTION fn_notify_role_promoted();

-- ── 7. Grant execute on helper to authenticated role ──────────────────────────

GRANT EXECUTE ON FUNCTION _safe_notify(UUID, TEXT, TEXT, TEXT, UUID, TEXT)
  TO authenticated;
