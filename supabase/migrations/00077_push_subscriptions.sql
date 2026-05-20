-- =============================================================================
-- Web Push Subscriptions
-- =============================================================================
-- Stores browser push subscription objects so the server can send Web Push
-- notifications to users even when they don't have the tab open.
-- Each user can have multiple active subscriptions (one per device/browser).
-- =============================================================================

CREATE TABLE IF NOT EXISTS push_subscriptions (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  endpoint     TEXT        NOT NULL UNIQUE,
  p256dh       TEXT        NOT NULL,
  auth         TEXT        NOT NULL,
  user_agent   TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  last_used_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE push_subscriptions ENABLE ROW LEVEL SECURITY;

-- Users can only see and manage their own subscriptions
CREATE POLICY "push_subs_select_own"
  ON push_subscriptions FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "push_subs_insert_own"
  ON push_subscriptions FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "push_subs_delete_own"
  ON push_subscriptions FOR DELETE
  USING (user_id = auth.uid());

-- Service role (used by API routes) can read all subscriptions for sending
CREATE POLICY "push_subs_service_read"
  ON push_subscriptions FOR SELECT
  TO service_role
  USING (true);

CREATE INDEX push_subscriptions_user_idx ON push_subscriptions (user_id);
