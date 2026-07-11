-- =============================================================================
-- Lobby Market: Delegate Vote Notifications
-- =============================================================================
-- When a user's delegate casts a vote on a topic that falls within an active
-- delegation scope, the delegator receives a 'delegate_voted' notification.
-- This closes the loop on liquid democracy: delegators are kept informed of
-- what their delegates are deciding on their behalf.
--
-- Scope matching logic:
--   - Topic-scoped delegation:   trigger only fires for that exact topic.
--   - Category-scoped delegation: trigger fires for any topic in that category.
--   - Global delegation:          trigger fires for every vote the delegate casts.
--
-- Duplicate guard: one notification per (delegator, delegate, topic). If the
-- delegator already has a pending notification for this (delegate, topic) pair
-- it is updated (upsert on the unique index) rather than creating a duplicate.
-- =============================================================================

-- ── 1. Expand notification type constraint ────────────────────────────────────

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
    'delegate_voted'
  ));

-- ── 2. Trigger function ───────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION notify_delegators_on_delegate_vote()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  topic_category TEXT;
BEGIN
  -- Fetch the topic's category for scope matching
  SELECT category INTO topic_category
  FROM topics
  WHERE id = NEW.topic_id;

  -- Insert a notification for every delegator who has an active delegation
  -- from this voter (NEW.user_id) that covers this topic.
  INSERT INTO notifications (user_id, type, data, read, created_at)
  SELECT
    vd.delegator_id,
    'delegate_voted',
    jsonb_build_object(
      'delegate_id',       NEW.user_id,
      'topic_id',          NEW.topic_id,
      'side',              NEW.side,
      'delegation_scope',  CASE
                             WHEN vd.topic_id IS NOT NULL   THEN 'topic'
                             WHEN vd.category IS NOT NULL   THEN 'category'
                             ELSE                                'global'
                           END,
      'category',          vd.category
    ),
    FALSE,
    NOW()
  FROM vote_delegations vd
  WHERE
    vd.delegate_id   = NEW.user_id
    AND vd.revoked_at IS NULL
    AND (
      -- Exact topic match
      vd.topic_id = NEW.topic_id
      OR
      -- Category match (category-scoped delegation covers any topic in that category)
      (vd.topic_id IS NULL AND vd.category IS NOT NULL AND vd.category = topic_category)
      OR
      -- Global delegation (no scope constraints)
      (vd.topic_id IS NULL AND vd.category IS NULL)
    )
    -- Don't notify the delegate about their own vote
    AND vd.delegator_id <> NEW.user_id
  ON CONFLICT DO NOTHING;

  RETURN NEW;
END;
$$;

-- ── 3. Attach trigger to votes table ─────────────────────────────────────────

DROP TRIGGER IF EXISTS trg_delegate_vote_notification ON votes;

CREATE TRIGGER trg_delegate_vote_notification
  AFTER INSERT ON votes
  FOR EACH ROW
  EXECUTE FUNCTION notify_delegators_on_delegate_vote();

-- ── 4. Index for fast delegator lookup by delegate ───────────────────────────

CREATE INDEX IF NOT EXISTS idx_vote_delegations_delegate_notify
  ON vote_delegations (delegate_id, revoked_at)
  WHERE revoked_at IS NULL;
