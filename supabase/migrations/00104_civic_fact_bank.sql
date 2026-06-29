-- =============================================================================
-- Lobby Market Ch. 421: The Civic Fact Bank
-- =============================================================================
-- A crowd-sourced, community-verified database of verifiable civic facts.
-- Citizens submit factual claims with sources; the community upvotes or
-- disputes them; highly-verified facts earn the "Verified" badge and can
-- be cited in arguments.
--
-- Distinct from:
--   argument_citations — links arguments to external sources
--   topic_sources      — source references on topic pages
--   civic_facts        — stand-alone verifiable claim records (this table)
-- =============================================================================

-- ─── Fact status ──────────────────────────────────────────────────────────────
-- pending   — newly submitted, under community review
-- verified  — net upvotes ≥ 10, community considers it reliable
-- disputed  — significant disagreement (downvote ratio > 40%)
-- retracted — author withdrew or moderator removed

-- ─── Main facts table ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS civic_facts (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  author_id     uuid        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  claim         text        NOT NULL CHECK (char_length(claim) BETWEEN 10 AND 500),
  category      text        NOT NULL DEFAULT 'General',
  source_url    text,
  source_title  text,
  context       text,                          -- optional elaboration / nuance
  upvotes       integer     NOT NULL DEFAULT 0,
  downvotes     integer     NOT NULL DEFAULT 0,
  status        text        NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'verified', 'disputed', 'retracted')),
  created_at    timestamptz DEFAULT now()      NOT NULL,
  updated_at    timestamptz DEFAULT now()      NOT NULL
);

CREATE INDEX IF NOT EXISTS civic_facts_category_idx    ON civic_facts(category);
CREATE INDEX IF NOT EXISTS civic_facts_status_idx      ON civic_facts(status);
CREATE INDEX IF NOT EXISTS civic_facts_author_idx      ON civic_facts(author_id);
CREATE INDEX IF NOT EXISTS civic_facts_upvotes_idx     ON civic_facts(upvotes DESC);
CREATE INDEX IF NOT EXISTS civic_facts_created_at_idx  ON civic_facts(created_at DESC);

-- Full-text search
ALTER TABLE civic_facts
  ADD COLUMN IF NOT EXISTS fts tsvector
    GENERATED ALWAYS AS (
      to_tsvector('english', coalesce(claim, '') || ' ' || coalesce(source_title, '') || ' ' || coalesce(context, ''))
    ) STORED;

CREATE INDEX IF NOT EXISTS civic_facts_fts_idx ON civic_facts USING gin(fts);

-- ─── Per-user votes ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS civic_fact_votes (
  fact_id    uuid        NOT NULL REFERENCES civic_facts(id) ON DELETE CASCADE,
  user_id    uuid        NOT NULL REFERENCES profiles(id)    ON DELETE CASCADE,
  vote       smallint    NOT NULL CHECK (vote IN (-1, 1)),
  created_at timestamptz DEFAULT now() NOT NULL,
  PRIMARY KEY (fact_id, user_id)
);

CREATE INDEX IF NOT EXISTS civic_fact_votes_user_idx ON civic_fact_votes(user_id);

-- ─── RPC: cast or change vote ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION cast_fact_vote(
  p_fact_id uuid,
  p_vote    smallint   -- 1 = upvote, -1 = downvote
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_uid         uuid := auth.uid();
  v_old_vote    smallint;
  v_up_delta    integer := 0;
  v_down_delta  integer := 0;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'not authenticated';
  END IF;

  -- What was the previous vote (if any)?
  SELECT vote INTO v_old_vote
  FROM civic_fact_votes
  WHERE fact_id = p_fact_id AND user_id = v_uid;

  IF v_old_vote IS NOT NULL AND v_old_vote = p_vote THEN
    -- Toggle off: remove the vote
    DELETE FROM civic_fact_votes WHERE fact_id = p_fact_id AND user_id = v_uid;
    v_up_delta   := CASE WHEN p_vote =  1 THEN -1 ELSE 0 END;
    v_down_delta := CASE WHEN p_vote = -1 THEN -1 ELSE 0 END;
  ELSIF v_old_vote IS NOT NULL THEN
    -- Flip the vote
    UPDATE civic_fact_votes SET vote = p_vote
    WHERE fact_id = p_fact_id AND user_id = v_uid;
    v_up_delta   := CASE WHEN p_vote =  1 THEN  1 ELSE -1 END;
    v_down_delta := CASE WHEN p_vote = -1 THEN  1 ELSE -1 END;
  ELSE
    -- New vote
    INSERT INTO civic_fact_votes (fact_id, user_id, vote) VALUES (p_fact_id, v_uid, p_vote);
    v_up_delta   := CASE WHEN p_vote =  1 THEN  1 ELSE 0 END;
    v_down_delta := CASE WHEN p_vote = -1 THEN  1 ELSE 0 END;
  END IF;

  -- Update counters
  UPDATE civic_facts
  SET
    upvotes   = GREATEST(0, upvotes   + v_up_delta),
    downvotes = GREATEST(0, downvotes + v_down_delta),
    updated_at = now()
  WHERE id = p_fact_id;

  -- Auto-update status based on vote thresholds
  UPDATE civic_facts
  SET status = CASE
    WHEN status = 'retracted' THEN 'retracted'   -- moderator retraction is sticky
    WHEN upvotes >= 10 AND (downvotes::float / NULLIF(upvotes + downvotes, 0)) < 0.25
      THEN 'verified'
    WHEN (downvotes::float / NULLIF(upvotes + downvotes, 0)) > 0.40
      THEN 'disputed'
    ELSE 'pending'
  END
  WHERE id = p_fact_id;
END;
$$;

-- ─── RLS ──────────────────────────────────────────────────────────────────────

ALTER TABLE civic_facts       ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic_fact_votes  ENABLE ROW LEVEL SECURITY;

-- Facts: public read; authenticated insert; author update
CREATE POLICY "civic_facts_select"  ON civic_facts FOR SELECT USING (true);
CREATE POLICY "civic_facts_insert"  ON civic_facts FOR INSERT
  WITH CHECK (author_id = auth.uid());
CREATE POLICY "civic_facts_update"  ON civic_facts FOR UPDATE
  USING (author_id = auth.uid());

-- Votes: public read; cast_fact_vote() handles mutations via SECURITY DEFINER
CREATE POLICY "civic_fact_votes_select" ON civic_fact_votes FOR SELECT USING (true);
