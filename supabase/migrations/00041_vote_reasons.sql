-- =============================================================================
-- Lobby Market: Vote reasons ("hot takes")
-- =============================================================================
-- Adds an optional free-text reason column to the votes table so users can
-- briefly explain their stance when casting a vote.
-- Max 140 characters — think of it as a civic "hot take".
-- =============================================================================

ALTER TABLE votes
  ADD COLUMN IF NOT EXISTS reason TEXT
    CHECK (reason IS NULL OR (char_length(reason) >= 1 AND char_length(reason) <= 140));

COMMENT ON COLUMN votes.reason IS 'Optional short explanation (≤140 chars) for the vote';
