-- =============================================================================
-- Lobby Market: Exchange Alert notification type
-- =============================================================================
-- Adds 'exchange_alert' to the notifications.type constraint so the
-- /api/cron/exchange-alerts endpoint can insert price-threshold notifications
-- for the Civic Exchange watchlist feature.
-- =============================================================================

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
    'argument_reply',
    'tag_topic_new',
    'streak_at_risk',
    'relay_invited',
    'relay_completed',
    'relay_leg_starred',
    'argument_mentioned',
    'phase_change',
    'topic_bookmarked',
    'vote_phase_started',
    'argument_reply_nested',
    'follow_new_topic',
    'delegate_voted',
    'exchange_alert'
  ));

-- Index for fast untriggered-alert lookups (already created in 00154, but
-- add IF NOT EXISTS guard in case migrations run out of order).
CREATE INDEX IF NOT EXISTS idx_epa_triggered
  ON exchange_price_alerts (is_triggered)
  WHERE is_triggered = FALSE;
