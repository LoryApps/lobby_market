-- =============================================================================
-- Lobby Market: Add debate_challenge_notifications to user_notification_prefs
-- =============================================================================
-- The settings UI has always had this toggle, but the DB column and API route
-- were missing, causing the preference to be silently dropped on server sync.
-- =============================================================================

ALTER TABLE user_notification_prefs
  ADD COLUMN IF NOT EXISTS debate_challenge_notifications BOOLEAN NOT NULL DEFAULT true;
