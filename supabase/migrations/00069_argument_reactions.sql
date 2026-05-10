-- =============================================================================
-- Lobby Market: Argument Reactions
-- =============================================================================
-- Emoji-style reactions on individual arguments, separate from the binary
-- upvote. Each user can react with at most one reaction per argument, and
-- can change or remove their reaction. Reaction types mirror topic_reactions
-- but add "needs_evidence" to encourage citation.
-- =============================================================================

CREATE TYPE IF NOT EXISTS argument_reaction_type AS ENUM (
  'insightful',      -- 💡 "This shifted my thinking"
  'compelling',      -- 🔥 "Strong, well-made point"
  'balanced',        -- ⚖️  "Fair, considers both sides"
  'needs_evidence'   -- 🔍 "Good point — needs a source"
);

CREATE TABLE IF NOT EXISTS argument_reactions (
  id          uuid                   PRIMARY KEY DEFAULT gen_random_uuid(),
  argument_id uuid                   NOT NULL REFERENCES topic_arguments(id) ON DELETE CASCADE,
  user_id     uuid                   NOT NULL REFERENCES profiles(id)         ON DELETE CASCADE,
  reaction    argument_reaction_type NOT NULL,
  created_at  timestamptz            NOT NULL DEFAULT now(),

  UNIQUE (argument_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_arg_reactions_argument ON argument_reactions (argument_id);
CREATE INDEX IF NOT EXISTS idx_arg_reactions_user     ON argument_reactions (user_id);

-- Row-level security
ALTER TABLE argument_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "arg_reactions_read"
  ON argument_reactions FOR SELECT
  USING (true);

CREATE POLICY "arg_reactions_insert"
  ON argument_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "arg_reactions_update"
  ON argument_reactions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "arg_reactions_delete"
  ON argument_reactions FOR DELETE
  USING (auth.uid() = user_id);

-- Fast aggregate view: reaction counts per argument
CREATE VIEW argument_reaction_counts AS
SELECT
  argument_id,
  reaction,
  COUNT(*) AS count
FROM argument_reactions
GROUP BY argument_id, reaction;
