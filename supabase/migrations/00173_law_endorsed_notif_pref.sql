-- Add user notification preference for law endorsement milestones.
-- Migration 00172 added the law_endorsed notification type to the DB constraint
-- and the trigger, but never added the user opt-in column.

ALTER TABLE user_notification_prefs
  ADD COLUMN IF NOT EXISTS law_endorsed_notifications BOOLEAN NOT NULL DEFAULT true;

COMMENT ON COLUMN user_notification_prefs.law_endorsed_notifications IS
  'User opt-in for law endorsement milestone alerts (1, 5, 10, 25, 50 endorsements).';
