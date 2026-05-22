-- =============================================================================
-- Lobby Market: Streak Reminder Notification Preference
-- =============================================================================
-- Adds a streak_reminder column to user_notification_prefs so users can
-- opt out of the 8 PM UTC streak-at-risk push notification.
-- =============================================================================

ALTER TABLE user_notification_prefs
  ADD COLUMN IF NOT EXISTS streak_reminder BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN user_notification_prefs.streak_reminder IS
  'Send a push notification at 8 PM UTC when the user has an active streak but has not voted today.';
