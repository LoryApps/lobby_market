-- =============================================================================
-- Lobby Market: Civic Correlations — cross-topic vote alignment function
-- =============================================================================
-- Computes pairwise vote alignment between the platform's most-voted topics.
-- For each pair (A, B) where ≥p_min_shared users voted on both, returns the
-- alignment rate (% who voted the same side on both) and correlation score.
--
-- Used by /api/stats/correlations → /correlations page.
-- =============================================================================

CREATE OR REPLACE FUNCTION get_topic_correlations(
  p_limit      int     DEFAULT 30,
  p_min_shared int     DEFAULT 5,
  p_category   text    DEFAULT NULL
)
RETURNS TABLE (
  topic_a_id          uuid,
  topic_b_id          uuid,
  shared_voters       bigint,
  both_blue           bigint,
  both_red            bigint,
  alignment_rate      float8,
  correlation         float8,     -- −1 to 1: positive = aligned, negative = opposed
  topic_a_statement   text,
  topic_a_category    text,
  topic_a_status      text,
  topic_a_blue_pct    float8,
  topic_a_total_votes bigint,
  topic_b_statement   text,
  topic_b_category    text,
  topic_b_status      text,
  topic_b_blue_pct    float8,
  topic_b_total_votes bigint
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH popular_topics AS (
    SELECT
      t.id,
      t.statement,
      t.category,
      t.status,
      t.blue_pct,
      t.total_votes
    FROM topics t
    WHERE t.total_votes >= 10
      AND (p_category IS NULL OR t.category = p_category)
    ORDER BY t.total_votes DESC
    LIMIT 60
  ),
  vote_pairs AS (
    SELECT
      v1.topic_id                                                           AS topic_a_id,
      v2.topic_id                                                           AS topic_b_id,
      COUNT(*)                                                              AS shared_voters,
      COUNT(*) FILTER (WHERE v1.side = 'blue' AND v2.side = 'blue')        AS both_blue,
      COUNT(*) FILTER (WHERE v1.side = 'red'  AND v2.side = 'red')         AS both_red,
      COUNT(*) FILTER (WHERE v1.side = 'blue')                             AS a_blue,
      COUNT(*) FILTER (WHERE v1.side = 'red')                              AS a_red,
      COUNT(*) FILTER (WHERE v2.side = 'blue')                             AS b_blue,
      COUNT(*) FILTER (WHERE v2.side = 'red')                              AS b_red
    FROM votes v1
    JOIN votes v2
      ON  v1.user_id   = v2.user_id
      AND v1.topic_id  < v2.topic_id   -- enforce A < B to avoid duplicates
    WHERE v1.topic_id IN (SELECT id FROM popular_topics)
      AND v2.topic_id IN (SELECT id FROM popular_topics)
    GROUP BY v1.topic_id, v2.topic_id
    HAVING COUNT(*) >= p_min_shared
  ),
  scored AS (
    SELECT
      vp.topic_a_id,
      vp.topic_b_id,
      vp.shared_voters,
      vp.both_blue,
      vp.both_red,
      (vp.both_blue + vp.both_red)::float8 / vp.shared_voters            AS alignment_rate,
      -- phi coefficient: (p11*p00 - p10*p01) style, simplified to alignment - 0.5
      ((vp.both_blue + vp.both_red)::float8 / vp.shared_voters - 0.5) * 2 AS correlation,
      ta.statement::text   AS topic_a_statement,
      ta.category::text    AS topic_a_category,
      ta.status::text      AS topic_a_status,
      ta.blue_pct::float8  AS topic_a_blue_pct,
      ta.total_votes       AS topic_a_total_votes,
      tb.statement::text   AS topic_b_statement,
      tb.category::text    AS topic_b_category,
      tb.status::text      AS topic_b_status,
      tb.blue_pct::float8  AS topic_b_blue_pct,
      tb.total_votes       AS topic_b_total_votes
    FROM vote_pairs vp
    JOIN popular_topics ta ON vp.topic_a_id = ta.id
    JOIN popular_topics tb ON vp.topic_b_id = tb.id
  )
  SELECT *
  FROM   scored
  ORDER  BY ABS(correlation) DESC
  LIMIT  p_limit;
$$;

COMMENT ON FUNCTION get_topic_correlations IS
  'Returns the strongest pairwise vote-alignment signals across popular topics.
   alignment_rate: fraction of shared voters who chose the same side on both topics.
   correlation: -1 (perfectly opposed) to +1 (perfectly aligned); 0 = independent.';
