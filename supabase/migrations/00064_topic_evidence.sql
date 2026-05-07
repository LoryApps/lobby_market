-- =============================================================================
-- Lobby Market: Community Evidence Board
-- =============================================================================
-- Any authenticated user can submit external evidence (URL + title + side)
-- for a topic. Evidence is ranked by net upvotes. One vote per user per item.
-- =============================================================================

-- ── 1. Evidence table ─────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.topic_evidence (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id     UUID        NOT NULL REFERENCES public.topics(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  url          TEXT        NOT NULL CHECK (
    char_length(url) <= 2000
    AND url ~* '^https?://'
  ),
  title        TEXT        NOT NULL CHECK (char_length(title) BETWEEN 5 AND 200),
  description  TEXT             CHECK (char_length(description) <= 500),
  domain       TEXT GENERATED ALWAYS AS (
    regexp_replace(
      regexp_replace(url, '^https?://(www\.)?', ''),
      '/.*$', ''
    )
  ) STORED,
  side         TEXT        NOT NULL DEFAULT 'neutral'
                           CHECK (side IN ('for', 'against', 'neutral')),
  upvotes      INT         NOT NULL DEFAULT 0,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- One URL per topic (prevents duplicate submissions)
CREATE UNIQUE INDEX IF NOT EXISTS topic_evidence_topic_url_key
  ON public.topic_evidence(topic_id, url);

-- Fast lookup by topic ordered by votes
CREATE INDEX IF NOT EXISTS topic_evidence_topic_id_idx
  ON public.topic_evidence(topic_id, upvotes DESC);

-- ── 2. Votes table ────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.topic_evidence_votes (
  evidence_id  UUID        NOT NULL REFERENCES public.topic_evidence(id) ON DELETE CASCADE,
  user_id      UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (evidence_id, user_id)
);

-- ── 3. RLS ────────────────────────────────────────────────────────────────────

ALTER TABLE public.topic_evidence       ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.topic_evidence_votes ENABLE ROW LEVEL SECURITY;

-- Anyone can read evidence
CREATE POLICY "topic_evidence_select"
  ON public.topic_evidence FOR SELECT
  USING (true);

-- Authenticated users can submit evidence
CREATE POLICY "topic_evidence_insert"
  ON public.topic_evidence FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can delete their own submissions
CREATE POLICY "topic_evidence_delete"
  ON public.topic_evidence FOR DELETE
  USING (auth.uid() = user_id);

-- Anyone can read votes
CREATE POLICY "topic_evidence_votes_select"
  ON public.topic_evidence_votes FOR SELECT
  USING (true);

-- Authenticated users can vote
CREATE POLICY "topic_evidence_votes_insert"
  ON public.topic_evidence_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can remove their own vote
CREATE POLICY "topic_evidence_votes_delete"
  ON public.topic_evidence_votes FOR DELETE
  USING (auth.uid() = user_id);

-- ── 4. Trigger: keep upvotes count in sync ────────────────────────────────────

CREATE OR REPLACE FUNCTION sync_evidence_upvotes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.topic_evidence
    SET upvotes = upvotes + 1
    WHERE id = NEW.evidence_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.topic_evidence
    SET upvotes = GREATEST(upvotes - 1, 0)
    WHERE id = OLD.evidence_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS sync_evidence_upvotes_trigger ON public.topic_evidence_votes;
CREATE TRIGGER sync_evidence_upvotes_trigger
  AFTER INSERT OR DELETE ON public.topic_evidence_votes
  FOR EACH ROW EXECUTE FUNCTION sync_evidence_upvotes();
