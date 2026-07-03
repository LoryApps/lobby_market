-- =============================================================================
-- Lobby Market: Q&A Category Expertise
-- =============================================================================
-- Tracks per-(user, category) accepted-answer counts and derives a tier:
--   contributor  — 1+ accepted answers in the category
--   expert       — 3+ accepted answers
--   sage         — 10+ accepted answers
--
-- Exposed as a simple view so it stays in sync with accepted-answer state
-- without any additional triggers or scheduled jobs.
-- =============================================================================

CREATE OR REPLACE VIEW qa_user_expertise AS
SELECT
  ta.author_id                                        AS user_id,
  t.category,
  COUNT(*)::INTEGER                                   AS accepted_count,
  CASE
    WHEN COUNT(*) >= 10 THEN 'sage'
    WHEN COUNT(*) >= 3  THEN 'expert'
    ELSE                     'contributor'
  END                                                 AS tier
FROM  topic_answers  ta
JOIN  topics         t  ON t.id = ta.topic_id
WHERE ta.is_accepted = TRUE
  AND t.category IS NOT NULL
GROUP BY ta.author_id, t.category;

COMMENT ON VIEW qa_user_expertise IS
  'Per-(user, category) Q&A expertise derived from accepted answers. '
  'Tiers: contributor (1+), expert (3+), sage (10+).';
