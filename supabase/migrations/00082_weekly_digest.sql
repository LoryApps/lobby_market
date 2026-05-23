-- =============================================================================
-- Lobby Market: Weekly Civic Digest
-- =============================================================================
-- Adds the weekly_digest notification type and preference so the
-- /api/cron/weekly-digest endpoint (runs Mondays at 6 AM UTC) can send
-- each user a personalized summary of their past 7 days in the Lobby.
-- =============================================================================

-- ─── 1. Extend the notification type constraint ───────────────────────────────

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
    'weekly_digest'
  ));

COMMENT ON COLUMN notifications.type IS
  'Notification type. Includes weekly_digest for Monday morning civic summary.';

-- ─── 2. Add weekly_digest preference to notification prefs ───────────────────

ALTER TABLE user_notification_prefs
  ADD COLUMN IF NOT EXISTS weekly_digest BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN user_notification_prefs.weekly_digest IS
  'Send a weekly summary notification every Monday morning with the past 7 days highlights.';

-- ─── 3. Track when each user last received a weekly digest ───────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS last_weekly_digest_sent_at TIMESTAMPTZ;

COMMENT ON COLUMN profiles.last_weekly_digest_sent_at IS
  'Timestamp of the most recent weekly_digest notification sent to this user.';
