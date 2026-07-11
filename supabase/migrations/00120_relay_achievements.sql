-- =============================================================================
-- Lobby Market: Relay Achievements
-- =============================================================================
-- Seeds 10 relay-specific achievements and wires up four PL/pgSQL triggers
-- that award them automatically when relay milestones are hit:
--
--   1. fn_grant_relay_start_achievements  — civic_relays INSERT
--   2. fn_grant_relay_leg_achievements    — relay_legs INSERT
--   3. fn_grant_relay_complete_achievement — civic_relays UPDATE (→ 'complete')
--   4. fn_grant_relay_vote_achievements   — relay_votes INSERT (compelling)
--   5. fn_grant_relay_star_achievement    — relay_leg_upvotes INSERT
-- =============================================================================

-- ── 1. Seed achievements ──────────────────────────────────────────────────────

INSERT INTO achievements (slug, name, description, icon, tier, category, criteria)
VALUES

  -- ── Relay branch — getting started ────────────────────────────────────────
  (
    'relay-spark',
    'Chain Spark',
    'Start your first civic relay chain.',
    'Radio',
    'common',
    'relay',
    '{"type":"relays_started","threshold":1}'::jsonb
  ),
  (
    'relay-link',
    'First Link',
    'Add your first leg to someone else''s relay chain.',
    'Link2',
    'common',
    'relay',
    '{"type":"relay_legs_added","threshold":1}'::jsonb
  ),
  (
    'relay-collaborator',
    'Chain Builder',
    'Contribute legs to 5 different relay chains.',
    'Users',
    'common',
    'relay',
    '{"type":"relay_legs_added","threshold":5}'::jsonb
  ),

  -- ── Relay branch — completing chains ──────────────────────────────────────
  (
    'relay-circuit',
    'Full Circuit',
    'Start a relay chain that reaches full completion — all legs filled.',
    'GitFork',
    'rare',
    'relay',
    '{"type":"relays_completed","threshold":1}'::jsonb
  ),
  (
    'relay-star',
    'Stellar Leg',
    'Earn 5 or more stars on a single relay leg.',
    'Star',
    'rare',
    'relay',
    '{"type":"relay_leg_stars","threshold":5}'::jsonb
  ),
  (
    'relay-compelling',
    'Compelling Case',
    'Have one of your relays voted "compelling" by the community.',
    'Zap',
    'rare',
    'relay',
    '{"type":"relay_compelling_votes","threshold":1}'::jsonb
  ),

  -- ── Relay branch — mastery ────────────────────────────────────────────────
  (
    'relay-architect',
    'Chain Architect',
    'Start 5 relay chains.',
    'Network',
    'epic',
    'relay',
    '{"type":"relays_started","threshold":5}'::jsonb
  ),
  (
    'relay-legend',
    'Relay Legend',
    'Earn "compelling" votes on 3 of your relay chains.',
    'Flame',
    'epic',
    'relay',
    '{"type":"relay_compelling_votes","threshold":3}'::jsonb
  ),
  (
    'relay-maestro',
    'Relay Maestro',
    'Start 10 relay chains.',
    'Activity',
    'epic',
    'relay',
    '{"type":"relays_started","threshold":10}'::jsonb
  ),

  -- ── Relay branch — legendary ──────────────────────────────────────────────
  (
    'relay-ovation',
    'Grand Relay',
    'Earn "compelling" votes on 10 of your relay chains — a civic institution.',
    'Trophy',
    'legendary',
    'relay',
    '{"type":"relay_compelling_votes","threshold":10}'::jsonb
  )

ON CONFLICT (slug) DO NOTHING;

-- ── 2. Trigger: relay started (civic_relays INSERT) ──────────────────────────

CREATE OR REPLACE FUNCTION fn_grant_relay_start_achievements()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_relay_count  INT;
  v_achievement  achievements%ROWTYPE;
  v_notify_pref  BOOLEAN;
BEGIN
  -- Check notification preference
  SELECT COALESCE(achievement_earned, TRUE)
  INTO   v_notify_pref
  FROM   user_notification_prefs
  WHERE  user_id = NEW.starter_id;

  v_notify_pref := COALESCE(v_notify_pref, TRUE);

  -- Count how many relays this user has started (including this one)
  SELECT COUNT(*) INTO v_relay_count
  FROM   civic_relays
  WHERE  starter_id = NEW.starter_id;

  -- relay-spark: first relay
  IF v_relay_count >= 1 THEN
    SELECT * INTO v_achievement FROM achievements WHERE slug = 'relay-spark';
    IF FOUND THEN
      PERFORM _grant_achievement(NEW.starter_id, v_achievement.id, v_notify_pref);
    END IF;
  END IF;

  -- relay-architect: 5 relays
  IF v_relay_count >= 5 THEN
    SELECT * INTO v_achievement FROM achievements WHERE slug = 'relay-architect';
    IF FOUND THEN
      PERFORM _grant_achievement(NEW.starter_id, v_achievement.id, v_notify_pref);
    END IF;
  END IF;

  -- relay-maestro: 10 relays
  IF v_relay_count >= 10 THEN
    SELECT * INTO v_achievement FROM achievements WHERE slug = 'relay-maestro';
    IF FOUND THEN
      PERFORM _grant_achievement(NEW.starter_id, v_achievement.id, v_notify_pref);
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_grant_relay_start_achievements ON civic_relays;
CREATE TRIGGER trg_grant_relay_start_achievements
  AFTER INSERT ON civic_relays
  FOR EACH ROW
  EXECUTE FUNCTION fn_grant_relay_start_achievements();

-- ── 3. Trigger: relay leg added (relay_legs INSERT) ──────────────────────────

CREATE OR REPLACE FUNCTION fn_grant_relay_leg_achievements()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_leg_count    INT;
  v_relay_count  INT;
  v_achievement  achievements%ROWTYPE;
  v_notify_pref  BOOLEAN;
BEGIN
  -- Only for non-starters (legs added to OTHER people's relays)
  -- We still grant relay-link even to starters (leg 1 on their own relay is still a leg)
  SELECT COALESCE(achievement_earned, TRUE)
  INTO   v_notify_pref
  FROM   user_notification_prefs
  WHERE  user_id = NEW.author_id;

  v_notify_pref := COALESCE(v_notify_pref, TRUE);

  -- Total legs this user has added (across all relays)
  SELECT COUNT(*) INTO v_leg_count
  FROM   relay_legs
  WHERE  author_id = NEW.author_id;

  -- relay-link: first leg ever
  IF v_leg_count >= 1 THEN
    SELECT * INTO v_achievement FROM achievements WHERE slug = 'relay-link';
    IF FOUND THEN
      PERFORM _grant_achievement(NEW.author_id, v_achievement.id, v_notify_pref);
    END IF;
  END IF;

  -- relay-collaborator: legs in 5 distinct relays
  SELECT COUNT(DISTINCT relay_id) INTO v_relay_count
  FROM   relay_legs
  WHERE  author_id = NEW.author_id;

  IF v_relay_count >= 5 THEN
    SELECT * INTO v_achievement FROM achievements WHERE slug = 'relay-collaborator';
    IF FOUND THEN
      PERFORM _grant_achievement(NEW.author_id, v_achievement.id, v_notify_pref);
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_grant_relay_leg_achievements ON relay_legs;
CREATE TRIGGER trg_grant_relay_leg_achievements
  AFTER INSERT ON relay_legs
  FOR EACH ROW
  EXECUTE FUNCTION fn_grant_relay_leg_achievements();

-- ── 4. Trigger: relay completed (civic_relays status → 'complete') ────────────

CREATE OR REPLACE FUNCTION fn_grant_relay_complete_achievement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_achievement  achievements%ROWTYPE;
  v_notify_pref  BOOLEAN;
BEGIN
  -- Only fire when status transitions to 'complete'
  IF NEW.status <> 'complete' OR OLD.status = 'complete' THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(achievement_earned, TRUE)
  INTO   v_notify_pref
  FROM   user_notification_prefs
  WHERE  user_id = NEW.starter_id;

  v_notify_pref := COALESCE(v_notify_pref, TRUE);

  SELECT * INTO v_achievement FROM achievements WHERE slug = 'relay-circuit';
  IF FOUND THEN
    PERFORM _grant_achievement(NEW.starter_id, v_achievement.id, v_notify_pref);
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_grant_relay_complete_achievement ON civic_relays;
CREATE TRIGGER trg_grant_relay_complete_achievement
  AFTER UPDATE OF status ON civic_relays
  FOR EACH ROW
  EXECUTE FUNCTION fn_grant_relay_complete_achievement();

-- ── 5. Trigger: relay voted 'compelling' (relay_votes INSERT) ────────────────

CREATE OR REPLACE FUNCTION fn_grant_relay_vote_achievements()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_starter_id        UUID;
  v_compelling_count  INT;
  v_achievement       achievements%ROWTYPE;
  v_notify_pref       BOOLEAN;
BEGIN
  -- Only care about "compelling" votes
  IF NEW.vote <> 'compelling' THEN
    RETURN NEW;
  END IF;

  -- Find the relay starter
  SELECT starter_id INTO v_starter_id
  FROM   civic_relays
  WHERE  id = NEW.relay_id;

  IF v_starter_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Don't credit self-votes
  IF v_starter_id = NEW.voter_id THEN
    RETURN NEW;
  END IF;

  SELECT COALESCE(achievement_earned, TRUE)
  INTO   v_notify_pref
  FROM   user_notification_prefs
  WHERE  user_id = v_starter_id;

  v_notify_pref := COALESCE(v_notify_pref, TRUE);

  -- Count how many distinct relays by this starter have ≥1 compelling vote
  SELECT COUNT(DISTINCT r.id) INTO v_compelling_count
  FROM   civic_relays r
  WHERE  r.starter_id = v_starter_id
    AND  EXISTS (
      SELECT 1 FROM relay_votes rv
      WHERE  rv.relay_id = r.id
        AND  rv.vote = 'compelling'
    );

  -- relay-compelling: first relay with a compelling vote
  IF v_compelling_count >= 1 THEN
    SELECT * INTO v_achievement FROM achievements WHERE slug = 'relay-compelling';
    IF FOUND THEN
      PERFORM _grant_achievement(v_starter_id, v_achievement.id, v_notify_pref);
    END IF;
  END IF;

  -- relay-legend: 3 relays with compelling votes
  IF v_compelling_count >= 3 THEN
    SELECT * INTO v_achievement FROM achievements WHERE slug = 'relay-legend';
    IF FOUND THEN
      PERFORM _grant_achievement(v_starter_id, v_achievement.id, v_notify_pref);
    END IF;
  END IF;

  -- relay-ovation: 10 relays with compelling votes
  IF v_compelling_count >= 10 THEN
    SELECT * INTO v_achievement FROM achievements WHERE slug = 'relay-ovation';
    IF FOUND THEN
      PERFORM _grant_achievement(v_starter_id, v_achievement.id, v_notify_pref);
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_grant_relay_vote_achievements ON relay_votes;
CREATE TRIGGER trg_grant_relay_vote_achievements
  AFTER INSERT ON relay_votes
  FOR EACH ROW
  EXECUTE FUNCTION fn_grant_relay_vote_achievements();

-- ── 6. Trigger: relay leg starred (relay_leg_upvotes INSERT) ─────────────────

CREATE OR REPLACE FUNCTION fn_grant_relay_star_achievement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_author_id    UUID;
  v_star_count   INT;
  v_achievement  achievements%ROWTYPE;
  v_notify_pref  BOOLEAN;
BEGIN
  -- Find this leg's author
  SELECT author_id INTO v_author_id
  FROM   relay_legs
  WHERE  id = NEW.leg_id;

  IF v_author_id IS NULL THEN
    RETURN NEW;
  END IF;

  -- Don't credit self-stars
  IF v_author_id = NEW.voter_id THEN
    RETURN NEW;
  END IF;

  -- Count total stars on this leg
  SELECT COUNT(*) INTO v_star_count
  FROM   relay_leg_upvotes
  WHERE  leg_id = NEW.leg_id;

  -- relay-star: 5+ stars on a single leg
  IF v_star_count >= 5 THEN
    SELECT COALESCE(achievement_earned, TRUE)
    INTO   v_notify_pref
    FROM   user_notification_prefs
    WHERE  user_id = v_author_id;

    v_notify_pref := COALESCE(v_notify_pref, TRUE);

    SELECT * INTO v_achievement FROM achievements WHERE slug = 'relay-star';
    IF FOUND THEN
      PERFORM _grant_achievement(v_author_id, v_achievement.id, v_notify_pref);
    END IF;
  END IF;

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_grant_relay_star_achievement ON relay_leg_upvotes;
CREATE TRIGGER trg_grant_relay_star_achievement
  AFTER INSERT ON relay_leg_upvotes
  FOR EACH ROW
  EXECUTE FUNCTION fn_grant_relay_star_achievement();

-- ── 7. Index helpers ──────────────────────────────────────────────────────────

-- Fast lookup: how many relays has a user started?
CREATE INDEX IF NOT EXISTS achievements_relay_slug_idx
  ON achievements (slug)
  WHERE slug LIKE 'relay-%';
