-- 00036_topic_reactions.sql
-- Quick emoji reactions on topics (separate from binary FOR/AGAINST votes).
-- Each user can react with at most one reaction type per topic.

CREATE TYPE IF NOT EXISTS reaction_type AS ENUM (
  'insightful',   -- 💡
  'controversial', -- 🔥
  'complex',      -- ⚖️
  'surprising'    -- 😮
);

CREATE TABLE IF NOT EXISTS topic_reactions (
  id          uuid        PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id    uuid        NOT NULL REFERENCES topics(id) ON DELETE CASCADE,
  user_id     uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reaction    reaction_type NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),

  -- One reaction per user per topic
  UNIQUE (topic_id, user_id)
);

-- Indexes for quick lookups
CREATE INDEX IF NOT EXISTS idx_topic_reactions_topic ON topic_reactions(topic_id);
CREATE INDEX IF NOT EXISTS idx_topic_reactions_user  ON topic_reactions(user_id);

-- Row-level security
ALTER TABLE topic_reactions ENABLE ROW LEVEL SECURITY;

-- Anyone can read reactions
CREATE POLICY "topic_reactions_read"
  ON topic_reactions FOR SELECT
  USING (true);

-- Authenticated users can insert their own reactions
CREATE POLICY "topic_reactions_insert"
  ON topic_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own reaction (change type)
CREATE POLICY "topic_reactions_update"
  ON topic_reactions FOR UPDATE
  USING (auth.uid() = user_id);

-- Users can delete their own reaction
CREATE POLICY "topic_reactions_delete"
  ON topic_reactions FOR DELETE
  USING (auth.uid() = user_id);

-- Aggregated reaction counts per topic (for fast display)
CREATE VIEW topic_reaction_counts AS
SELECT
  topic_id,
  reaction,
  COUNT(*) AS count
FROM topic_reactions
GROUP BY topic_id, reaction;
