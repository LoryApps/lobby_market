-- =============================================================================
-- APNs Device Tokens — iOS Push Notification Registration
-- =============================================================================
-- Stores Apple Push Notification service (APNs) device tokens so the server
-- can deliver native iOS push notifications.
--
-- Separate from push_subscriptions which stores Web Push (VAPID) endpoints.
-- Each user can have multiple active tokens (one per device).
-- =============================================================================

CREATE TABLE IF NOT EXISTS apns_tokens (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  token        TEXT        NOT NULL,
  environment  TEXT        NOT NULL DEFAULT 'production' CHECK (environment IN ('sandbox', 'production')),
  bundle_id    TEXT        NOT NULL DEFAULT 'com.lobbymarket.app',
  device_name  TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (user_id, token)
);

ALTER TABLE apns_tokens ENABLE ROW LEVEL SECURITY;

CREATE POLICY "apns_tokens_select_own"
  ON apns_tokens FOR SELECT
  USING (user_id = auth.uid());

CREATE POLICY "apns_tokens_insert_own"
  ON apns_tokens FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "apns_tokens_update_own"
  ON apns_tokens FOR UPDATE
  USING (user_id = auth.uid());

CREATE POLICY "apns_tokens_delete_own"
  ON apns_tokens FOR DELETE
  USING (user_id = auth.uid());

-- Service role reads all tokens for delivery
CREATE POLICY "apns_tokens_service_read"
  ON apns_tokens FOR SELECT
  TO service_role
  USING (true);

CREATE INDEX apns_tokens_user_idx  ON apns_tokens (user_id);
CREATE INDEX apns_tokens_token_idx ON apns_tokens (token);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_apns_token_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$;

CREATE TRIGGER apns_tokens_updated_at
  BEFORE UPDATE ON apns_tokens
  FOR EACH ROW EXECUTE FUNCTION update_apns_token_updated_at();

COMMENT ON TABLE apns_tokens IS
  'APNs device tokens for native iOS push notification delivery. '
  'Populated by the iOS app after the user grants notification permission.';
