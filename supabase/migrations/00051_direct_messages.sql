-- =============================================================================
-- Lobby Market: Direct Messages
-- =============================================================================
-- Adds private 1-to-1 messaging between platform users.
-- Includes: table, RLS, indexes, notification trigger.
-- =============================================================================

-- ── 1. Expand notifications.type constraint to include direct_message ─────────

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
    'direct_message'
  ));

-- ── 2. Direct messages table ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS direct_messages (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  sender_id   UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  receiver_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content     TEXT        NOT NULL CHECK (char_length(content) BETWEEN 1 AND 1000),
  is_read     BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),

  -- Prevent self-messaging
  CONSTRAINT dm_no_self_message CHECK (sender_id <> receiver_id)
);

-- ── 3. Indexes ────────────────────────────────────────────────────────────────

-- Inbox queries: latest messages for a user
CREATE INDEX IF NOT EXISTS idx_dm_receiver ON direct_messages (receiver_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_dm_sender   ON direct_messages (sender_id,   created_at DESC);

-- Thread queries: messages between exactly two users
CREATE INDEX IF NOT EXISTS idx_dm_thread ON direct_messages (
  LEAST(sender_id::text, receiver_id::text),
  GREATEST(sender_id::text, receiver_id::text),
  created_at ASC
);

-- ── 4. Row Level Security ─────────────────────────────────────────────────────

ALTER TABLE direct_messages ENABLE ROW LEVEL SECURITY;

-- Both sender and receiver can read their messages
CREATE POLICY "dm_select_own"
  ON direct_messages FOR SELECT
  USING (auth.uid() = sender_id OR auth.uid() = receiver_id);

-- Only the sender can insert (and they must be the sender)
CREATE POLICY "dm_insert_own"
  ON direct_messages FOR INSERT
  WITH CHECK (auth.uid() = sender_id);

-- Only the receiver can mark messages as read
CREATE POLICY "dm_update_read"
  ON direct_messages FOR UPDATE
  USING (auth.uid() = receiver_id);

-- Sender can unsend within 5 minutes
CREATE POLICY "dm_delete_recent"
  ON direct_messages FOR DELETE
  USING (
    auth.uid() = sender_id
    AND created_at > now() - INTERVAL '5 minutes'
  );

-- ── 5. Notification trigger ───────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION _notify_direct_message()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_sender_name TEXT;
BEGIN
  -- Resolve sender display name or username for the notification title
  SELECT COALESCE(display_name, username)
    INTO v_sender_name
    FROM profiles
   WHERE id = NEW.sender_id;

  -- Insert notification for the receiver (deduplication: 1 DM notification per sender per 5 min)
  INSERT INTO notifications (user_id, type, title, body, reference_id, reference_type)
  SELECT
    NEW.receiver_id,
    'direct_message',
    'Message from ' || COALESCE(v_sender_name, 'someone'),
    LEFT(NEW.content, 120),
    NEW.sender_id,
    'profile'
  WHERE NOT EXISTS (
    SELECT 1 FROM notifications
     WHERE user_id      = NEW.receiver_id
       AND type         = 'direct_message'
       AND reference_id = NEW.sender_id
       AND created_at   > now() - INTERVAL '5 minutes'
  );

  RETURN NEW;
END;
$$;

CREATE TRIGGER on_new_direct_message
  AFTER INSERT ON direct_messages
  FOR EACH ROW
  EXECUTE FUNCTION _notify_direct_message();
