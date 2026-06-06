-- =============================================================================
-- Lobby Market: Category Matrix — cross-category voter alignment function
-- =============================================================================
-- Computes pairwise voter alignment between each pair of topic categories.
-- For each (A, B) pair where ≥p_min_shared users voted in BOTH, returns the
-- Pearson correlation of their per-category FOR-fractions.
--
-- Positive correlation: voters who lean FOR in category A also lean FOR in B.
-- Negative correlation: voters who lean FOR in A tend to lean AGAINST in B.
-- Near zero: the two categories attract voters with independent stances.
--
-- Used by /api/stats/matrix → /matrix page.
-- =============================================================================

CREATE OR REPLACE FUNCTION get_category_matrix(
  p_min_shared int DEFAULT 5
)
RETURNS TABLE (
  cat_a          text,
  cat_b          text,
  shared_voters  bigint,
  correlation    float8      -- Pearson r: −1 to 1, NULL if < 2 distinct pairs
)
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  WITH category_votes AS (
    -- For each (user, category): compute fraction of FOR votes in that category
    SELECT
      v.user_id,
      t.category,
      AVG(CASE WHEN v.side = 'blue' THEN 1.0 ELSE 0.0 END) AS for_fraction
    FROM votes v
    JOIN topics t ON t.id = v.topic_id
    WHERE t.category IS NOT NULL
      AND t.total_votes >= 5
    GROUP BY v.user_id, t.category
    HAVING COUNT(*) >= 2   -- user voted on at least 2 topics in this category
  ),
  pairs AS (
    SELECT
      a.category                             AS cat_a,
      b.category                             AS cat_b,
      COUNT(*)                               AS shared_voters,
      CORR(a.for_fraction, b.for_fraction)   AS correlation
    FROM category_votes a
    JOIN category_votes b
      ON a.user_id = b.user_id
     AND a.category < b.category   -- avoid duplicates; upper triangle only
    GROUP BY a.category, b.category
    HAVING COUNT(*) >= p_min_shared
  )
  SELECT cat_a, cat_b, shared_voters, correlation
  FROM pairs
  ORDER BY cat_a, cat_b;
$$;

COMMENT ON FUNCTION get_category_matrix IS
  'Returns pairwise Pearson correlations between each pair of civic topic categories '
  'based on voter stance alignment. Used by the /matrix (Civic Matrix) page.';
