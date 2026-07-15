-- Exchange Price Alerts
-- Users can set threshold alerts on specific markets.
-- When a topic's blue_pct crosses the threshold in the specified direction
-- an in-app notification is delivered (handled by application logic or future cron).

CREATE TABLE IF NOT EXISTS exchange_price_alerts (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  topic_id     UUID        NOT NULL REFERENCES topics(id)   ON DELETE CASCADE,
  threshold    INTEGER     NOT NULL CHECK (threshold BETWEEN 1 AND 99),
  direction    TEXT        NOT NULL CHECK (direction IN ('above', 'below')),
  is_triggered BOOLEAN     NOT NULL DEFAULT FALSE,
  triggered_at TIMESTAMPTZ,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (user_id, topic_id, threshold, direction)
);

-- Users can only read/write their own alerts
ALTER TABLE exchange_price_alerts ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own price alerts"
  ON exchange_price_alerts
  FOR ALL
  USING  (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Fast lookup when scanning for triggered alerts or listing user alerts
CREATE INDEX idx_epa_user_id   ON exchange_price_alerts (user_id);
CREATE INDEX idx_epa_topic_id  ON exchange_price_alerts (topic_id);
CREATE INDEX idx_epa_triggered ON exchange_price_alerts (is_triggered) WHERE is_triggered = FALSE;
