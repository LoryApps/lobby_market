-- =============================================================================
-- Lobby Market: Achievement Granting Triggers
-- =============================================================================
-- Adds two PL/pgSQL triggers that complement the application-level
-- achievement checks already wired into the vote/topic-creation API routes:
--
--   1. tr_grant_law_achievements   — fires when a topic's status becomes
--      'law', immediately grants any qualifying law-related achievements
--      (laws_authored, chain_depth) to the topic's author.
--
--   2. tr_grant_signup_achievement — fires after a new profile row is
--      inserted, grants the 'founding-member' achievement if the user
--      registered in the first 100 members.
-- =============================================================================

-- ── Helper: grant one achievement + notification (idempotent) ────────────────

CREATE OR REPLACE FUNCTION _grant_achievement(
  p_user_id       UUID,
  p_achievement_id UUID,
  p_notify        BOOLEAN DEFAULT TRUE
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_achievement achievements%ROWTYPE;
BEGIN
  -- Insert only if not already earned (conflict = do nothing)
  INSERT INTO user_achievements (user_id, achievement_id)
  VALUES (p_user_id, p_achievement_id)
  ON CONFLICT DO NOTHING;

  -- If the row was actually new (not a duplicate), create a notification
  IF FOUND AND p_notify THEN
    SELECT * INTO v_achievement FROM achievements WHERE id = p_achievement_id;

    PERFORM _safe_notify(
      p_user_id,
      'achievement_earned',
      'Achievement Unlocked: ' || v_achievement.name,
      'tier: ' || v_achievement.tier || E'\n' || v_achievement.description,
      p_achievement_id,
      'achievement'
    );
  END IF;
END;
$$;

-- ── Trigger 1: law-related achievements when topic → law ────────────────────

CREATE OR REPLACE FUNCTION fn_grant_law_achievements()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_author_id     UUID;
  v_laws_count    INT;
  v_chain_depth   INT;
  v_achievement   achievements%ROWTYPE;
  v_notify_pref   BOOLEAN;
BEGIN
  -- Only fire when status changes TO 'law'
  IF NEW.status <> 'law' OR OLD.status = 'law' THEN
    RETURN NEW;
  END IF;

  v_author_id := NEW.author_id;

  -- Check if author wants achievement notifications (default TRUE)
  SELECT COALESCE(achievement_earned, TRUE)
  INTO   v_notify_pref
  FROM   user_notification_prefs
  WHERE  user_id = v_author_id;

  IF v_notify_pref IS NULL THEN
    v_notify_pref := TRUE;
  END IF;

  -- Count how many laws the author now has
  SELECT COUNT(*) INTO v_laws_count
  FROM   topics
  WHERE  author_id = v_author_id
    AND  status    = 'law';

  -- Grant 'first-law' (laws_authored threshold=1)
  SELECT * INTO v_achievement FROM achievements WHERE slug = 'first-law';
  IF FOUND AND v_laws_count >= v_achievement.criteria->>'threshold'::INT THEN
    PERFORM _grant_achievement(v_author_id, v_achievement.id, v_notify_pref);
  END IF;

  -- Grant 'chain-master' based on chain_depth of this topic's chain root
  v_chain_depth := NEW.chain_depth;
  SELECT * INTO v_achievement FROM achievements WHERE slug = 'chain-master';
  IF FOUND AND v_chain_depth >= (v_achievement.criteria->>'threshold')::INT THEN
    PERFORM _grant_achievement(v_author_id, v_achievement.id, v_notify_pref);
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_grant_law_achievements ON topics;
CREATE TRIGGER tr_grant_law_achievements
  AFTER UPDATE OF status ON topics
  FOR EACH ROW
  EXECUTE FUNCTION fn_grant_law_achievements();

-- ── Trigger 2: founding-member achievement on signup ────────────────────────

CREATE OR REPLACE FUNCTION fn_grant_signup_achievement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_rank        INT;
  v_achievement achievements%ROWTYPE;
BEGIN
  -- Count how many profiles existed at or before this signup moment
  SELECT COUNT(*) INTO v_rank
  FROM   profiles
  WHERE  created_at <= NEW.created_at;

  SELECT * INTO v_achievement FROM achievements WHERE slug = 'founding-member';

  IF FOUND AND v_rank <= (v_achievement.criteria->>'threshold')::INT THEN
    PERFORM _grant_achievement(NEW.id, v_achievement.id, FALSE);
    -- FALSE = skip notification on signup (watcher will pick it up on first poll)
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS tr_grant_signup_achievement ON profiles;
CREATE TRIGGER tr_grant_signup_achievement
  AFTER INSERT ON profiles
  FOR EACH ROW
  EXECUTE FUNCTION fn_grant_signup_achievement();
