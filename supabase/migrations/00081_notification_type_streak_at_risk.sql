-- =============================================================================
-- Lobby Market: Add streak_at_risk to notification type constraint
-- =============================================================================
-- The streak_at_risk notification type was used in the streak-reminder cron
-- (/api/cron/streak-reminder) but was never added to the notifications.type
-- check constraint.  This migration adds it so inserts succeed in production.
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
    'argument_cited',
    'topic_subscribed_update',
    'vote_phase_started',
    'direct_message',
    'new_topic_in_tag',
    'streak_at_risk'
  ));

COMMENT ON COLUMN notifications.type IS
  'Notification type. Valid values: topic_activated, vote_threshold, vote_started,
   law_established, debate_starting, achievement_earned, reply_received,
   lobby_update, role_promoted, coalition_invite, coalition_invite_accepted,
   bookmark_update, new_follower, argument_upvoted, argument_cited,
   topic_subscribed_update, vote_phase_started, direct_message,
   new_topic_in_tag, streak_at_risk.';
