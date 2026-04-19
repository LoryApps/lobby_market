-- =============================================================================
-- Lobby Market: Topic View Count Tracking
-- =============================================================================
-- Adds an atomic RPC to increment topic view counts and updates the
-- feed-score formula to factor in view engagement alongside votes.
-- =============================================================================

-- ── 1. Atomic view-count increment ───────────────────────────────────────────
-- Called from the API layer (rate-limited per session by the app).
-- SECURITY DEFINER so it can UPDATE topics regardless of the caller's RLS role.

CREATE OR REPLACE FUNCTION increment_topic_view(topic_uuid UUID)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  UPDATE topics
  SET view_count = view_count + 1
  WHERE id = topic_uuid
    AND status NOT IN ('failed', 'archived');
$$;

-- Allow both authenticated users and anonymous visitors to record views.
GRANT EXECUTE ON FUNCTION increment_topic_view(UUID) TO authenticated, anon;

-- ── 2. Feed-score formula update ──────────────────────────────────────────────
-- Adds a log-scaled view-count signal (weighted less than direct votes).

CREATE OR REPLACE FUNCTION calculate_feed_scores()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE topics
  SET feed_score =
      -- Primary engagement: votes + supports
      LOG(GREATEST(total_votes + support_count, 1)) * 10
      -- Secondary engagement: views (log-scaled, weaker signal)
      + LOG(GREATEST(view_count, 1)) * 2
      -- Controversy bonus: tighter margins score higher
      + (100 - ABS(blue_pct - 50) * 2) * 0.1
      -- Time decay: older topics lose score
      - EXTRACT(EPOCH FROM (now() - created_at)) / 3600.0 * 0.05
      -- Status-specific boost
      + CASE
          WHEN status = 'active'    OR status = 'voting' THEN 50
          WHEN status = 'proposed'                       THEN 20
          WHEN status = 'continued'                      THEN 40
          WHEN status = 'law'                            THEN 10
          ELSE 0
        END
  WHERE status IN ('proposed', 'active', 'voting', 'continued', 'law');
END;
$$;

COMMENT ON FUNCTION calculate_feed_scores() IS
  'Recomputes topics.feed_score using engagement (votes+views), controversy, time decay, and status';

COMMENT ON FUNCTION increment_topic_view(UUID) IS
  'Atomically increments view_count for a topic. Called from the API layer with session-level deduplication.';
