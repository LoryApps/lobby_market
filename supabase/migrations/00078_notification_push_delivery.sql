-- =============================================================================
-- Notification Push Delivery Tracking
-- =============================================================================
-- Adds a push_sent_at column to notifications so the delivery cron job can
-- find which in-app notifications still need to be forwarded to the user's
-- push-subscribed devices.
--
-- Flow:
--   1. DB trigger (00016_notification_triggers.sql) inserts a notification row.
--   2. push_sent_at is NULL on insert.
--   3. Vercel Cron calls /api/cron/push-deliver every minute.
--   4. The cron route finds rows WHERE push_sent_at IS NULL,
--      sends a Web Push to every matching push_subscription for that user,
--      and stamps push_sent_at = NOW().
-- =============================================================================

ALTER TABLE notifications
  ADD COLUMN IF NOT EXISTS push_sent_at TIMESTAMPTZ;

-- Index for the cron query: unsent, recent notifications
CREATE INDEX IF NOT EXISTS idx_notifications_push_pending
  ON notifications (user_id, created_at DESC)
  WHERE push_sent_at IS NULL;
