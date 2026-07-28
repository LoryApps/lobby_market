-- =============================================================================
-- Lobby Market: Debate Challenge Notifications
-- Creates DB triggers that fire notifications when:
--   1. A user receives a debate challenge (debate_challenge)
--   2. A challenger's challenge is accepted (debate_challenge_accepted)
--   3. A challenger's challenge is declined (debate_challenge_declined)
-- =============================================================================

-- ── Helper: safe notification insert (skips if user has opted out) ────────────

CREATE OR REPLACE FUNCTION notify_debate_challenge()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  challenger_name TEXT;
  challenged_name TEXT;
  topic_stmt      TEXT;
BEGIN
  -- Fetch display names and topic statement
  SELECT COALESCE(display_name, username) INTO challenger_name
    FROM profiles WHERE id = NEW.challenger_id;

  SELECT COALESCE(display_name, username) INTO challenged_name
    FROM profiles WHERE id = NEW.challenged_id;

  SELECT statement INTO topic_stmt
    FROM topics WHERE id = NEW.topic_id;

  IF topic_stmt IS NULL THEN
    topic_stmt := 'a civic topic';
  END IF;

  -- Notify the challenged user when a challenge is first issued
  IF TG_OP = 'INSERT' THEN
    INSERT INTO notifications (
      user_id,
      type,
      title,
      body,
      reference_id,
      reference_type
    )
    VALUES (
      NEW.challenged_id,
      'debate_challenge',
      challenger_name || ' challenged you to a debate',
      topic_stmt,
      NEW.id,
      'challenge'
    )
    ON CONFLICT DO NOTHING;
    RETURN NEW;
  END IF;

  -- Notify the challenger when their challenge is accepted
  IF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'accepted' THEN
    INSERT INTO notifications (
      user_id,
      type,
      title,
      body,
      reference_id,
      reference_type
    )
    VALUES (
      NEW.challenger_id,
      'debate_challenge_accepted',
      challenged_name || ' accepted your debate challenge',
      topic_stmt,
      COALESCE(NEW.debate_id::TEXT, NEW.id::TEXT),
      CASE WHEN NEW.debate_id IS NOT NULL THEN 'debate' ELSE 'challenge' END
    )
    ON CONFLICT DO NOTHING;
    RETURN NEW;
  END IF;

  -- Notify the challenger when their challenge is declined
  IF TG_OP = 'UPDATE' AND OLD.status = 'pending' AND NEW.status = 'declined' THEN
    INSERT INTO notifications (
      user_id,
      type,
      title,
      body,
      reference_id,
      reference_type
    )
    VALUES (
      NEW.challenger_id,
      'debate_challenge_declined',
      challenged_name || ' declined your debate challenge',
      topic_stmt,
      NEW.id,
      'challenge'
    )
    ON CONFLICT DO NOTHING;
    RETURN NEW;
  END IF;

  RETURN NEW;
END;
$$;

-- ── Trigger on INSERT (new challenge issued) ─────────────────────────────────

DROP TRIGGER IF EXISTS trg_debate_challenge_notify_insert ON debate_challenges;

CREATE TRIGGER trg_debate_challenge_notify_insert
  AFTER INSERT ON debate_challenges
  FOR EACH ROW EXECUTE FUNCTION notify_debate_challenge();

-- ── Trigger on UPDATE (accepted / declined) ──────────────────────────────────

DROP TRIGGER IF EXISTS trg_debate_challenge_notify_update ON debate_challenges;

CREATE TRIGGER trg_debate_challenge_notify_update
  AFTER UPDATE OF status ON debate_challenges
  FOR EACH ROW
  WHEN (OLD.status = 'pending' AND NEW.status IN ('accepted', 'declined'))
  EXECUTE FUNCTION notify_debate_challenge();
