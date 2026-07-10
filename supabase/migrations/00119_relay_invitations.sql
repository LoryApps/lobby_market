-- =============================================================================
-- Lobby Market: Relay Invitations
-- =============================================================================
-- Allows relay starters and leg authors to formally invite a specific user to
-- contribute the next leg in their relay chain.
--
-- Distinct from general relay_notifications (passive events) — this is an
-- active outreach to a named user saying "I want your argument here."
-- =============================================================================

-- ─── 1. Relay invitations table ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS relay_invitations (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),

  relay_id    UUID        NOT NULL REFERENCES civic_relays(id) ON DELETE CASCADE,
  inviter_id  UUID        NOT NULL REFERENCES profiles(id)     ON DELETE CASCADE,
  invitee_id  UUID        NOT NULL REFERENCES profiles(id)     ON DELETE CASCADE,

  -- Optional personal note from the inviter (max 280 chars)
  message     TEXT        CHECK (char_length(message) <= 280),

  status      TEXT        NOT NULL DEFAULT 'pending'
                          CHECK (status IN ('pending', 'accepted', 'declined', 'expired')),

  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ,
  -- Invitations expire after 3 days if not responded
  expires_at  TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '3 days'),

  -- One open invite per invitee per relay — prevent spam
  UNIQUE (relay_id, invitee_id)
);

ALTER TABLE relay_invitations ENABLE ROW LEVEL SECURITY;

-- Inviter can create invitations
CREATE POLICY "relay_invitations_insert"
  ON relay_invitations FOR INSERT
  WITH CHECK (inviter_id = auth.uid());

-- Invitee and inviter can read
CREATE POLICY "relay_invitations_select"
  ON relay_invitations FOR SELECT
  USING (inviter_id = auth.uid() OR invitee_id = auth.uid());

-- Only invitee can update status
CREATE POLICY "relay_invitations_update"
  ON relay_invitations FOR UPDATE
  USING (invitee_id = auth.uid())
  WITH CHECK (invitee_id = auth.uid());

COMMENT ON TABLE relay_invitations IS
  'Targeted invitations to add a leg to a specific relay chain.';

-- ─── 2. Extend notifications type constraint ──────────────────────────────────

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
    'new_follower',
    'argument_upvoted',
    'argument_cited',
    'topic_subscribed_update',
    'vote_phase_started',
    'direct_message',
    'new_topic_in_tag',
    'streak_at_risk',
    'weekly_digest',
    'qa_question_answered',
    'qa_answer_accepted',
    'ama_question_answered',
    'ama_session_starting',
    'relay_leg_added',
    'relay_completed',
    'relay_voted',
    'relay_invitation'
  ));

-- ─── 3. Add relay_invitation preference column ────────────────────────────────

ALTER TABLE user_notification_prefs
  ADD COLUMN IF NOT EXISTS relay_invitations BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN user_notification_prefs.relay_invitations IS
  'Send notifications when a user invites you to add a leg to their relay chain.';

-- ─── 4. Trigger: relay_invitation ────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_notify_relay_invitation()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_inviter_name TEXT;
  v_topic_stmt   TEXT;
  v_relay_side   TEXT;
BEGIN
  -- Load inviter username
  SELECT username INTO v_inviter_name
  FROM   profiles
  WHERE  id = NEW.inviter_id;

  -- Load relay details for the notification body
  SELECT
    CASE r.side WHEN 'for' THEN 'FOR' ELSE 'AGAINST' END,
    t.statement
  INTO v_relay_side, v_topic_stmt
  FROM civic_relays r
  LEFT JOIN topics t ON t.id = r.topic_id
  WHERE r.id = NEW.relay_id;

  -- Check invitee's preferences (default to notify if no pref row)
  IF EXISTS (
    SELECT 1 FROM user_notification_prefs
    WHERE  user_id = NEW.invitee_id
      AND  relay_invitations = false
  ) THEN
    RETURN NEW;
  END IF;

  INSERT INTO notifications (user_id, type, title, body, reference_id, reference_type)
  VALUES (
    NEW.invitee_id,
    'relay_invitation',
    '@' || v_inviter_name || ' invited you to join their relay',
    CASE
      WHEN v_topic_stmt IS NOT NULL THEN
        '@' || v_inviter_name || ' wants your '
        || v_relay_side || ' argument in their relay on "'
        || LEFT(v_topic_stmt, 70)
        || CASE WHEN LENGTH(v_topic_stmt) > 70 THEN '…"' ELSE '"' END
        || CASE WHEN NEW.message IS NOT NULL THEN ' — "' || LEFT(NEW.message, 60) || '"' ELSE '' END
      ELSE
        '@' || v_inviter_name || ' invited you to add a leg to their '
        || v_relay_side || ' relay'
        || CASE WHEN NEW.message IS NOT NULL THEN ': "' || LEFT(NEW.message, 80) || '"' ELSE '' END
    END,
    NEW.relay_id,
    'relay'
  );

  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_notify_relay_invitation ON relay_invitations;
CREATE TRIGGER trg_notify_relay_invitation
  AFTER INSERT ON relay_invitations
  FOR EACH ROW
  EXECUTE FUNCTION fn_notify_relay_invitation();

-- ─── 5. Index ─────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS relay_invitations_invitee_status_idx
  ON relay_invitations (invitee_id, status, created_at DESC);

CREATE INDEX IF NOT EXISTS relay_invitations_relay_status_idx
  ON relay_invitations (relay_id, status);
