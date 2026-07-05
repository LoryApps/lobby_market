-- =============================================================================
-- Lobby Market: AMA Request Board
-- =============================================================================
-- Community-driven system for requesting expert AMA sessions.
-- Users propose AMA topics and upvote the ones they want most.
-- Experts can browse high-demand requests and schedule sessions to fulfil them.
--
-- Distinct from:
--   ama_sessions   — actual scheduled AMA events (host-driven)
--   topic_questions — per-topic community Q&A (async, open-ended)
-- =============================================================================

-- ── Requests ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ama_requests (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  author_id       UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title           TEXT        NOT NULL CHECK (char_length(title) BETWEEN 10 AND 150),
  description     TEXT        CHECK (description IS NULL OR char_length(description) <= 500),
  category        TEXT,       -- mirrors topic category taxonomy
  topic_id        UUID        REFERENCES public.topics(id) ON DELETE SET NULL,
  upvote_count    INTEGER     NOT NULL DEFAULT 0,
  -- Set once an expert schedules a session that fulfils this request
  fulfilled_session_id UUID   REFERENCES public.ama_sessions(id) ON DELETE SET NULL,
  fulfilled_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (author_id, title)   -- prevent duplicate spam from the same user
);

CREATE INDEX IF NOT EXISTS ama_requests_category_idx
  ON public.ama_requests (category);
CREATE INDEX IF NOT EXISTS ama_requests_upvotes_idx
  ON public.ama_requests (upvote_count DESC);
CREATE INDEX IF NOT EXISTS ama_requests_author_idx
  ON public.ama_requests (author_id);
CREATE INDEX IF NOT EXISTS ama_requests_fulfilled_idx
  ON public.ama_requests (fulfilled_session_id) WHERE fulfilled_session_id IS NOT NULL;

-- ── Upvotes (one per user per request) ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ama_request_votes (
  request_id  UUID  NOT NULL REFERENCES public.ama_requests(id) ON DELETE CASCADE,
  user_id     UUID  NOT NULL REFERENCES public.profiles(id)     ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (request_id, user_id)
);

CREATE INDEX IF NOT EXISTS ama_request_votes_user_idx
  ON public.ama_request_votes (user_id);

-- ── Trigger: keep upvote_count denormalised ────────────────────────────────────

CREATE OR REPLACE FUNCTION public.sync_ama_request_upvotes()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.ama_requests
    SET upvote_count = upvote_count + 1
    WHERE id = NEW.request_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.ama_requests
    SET upvote_count = GREATEST(0, upvote_count - 1)
    WHERE id = OLD.request_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS trg_ama_request_votes ON public.ama_request_votes;
CREATE TRIGGER trg_ama_request_votes
AFTER INSERT OR DELETE ON public.ama_request_votes
FOR EACH ROW EXECUTE FUNCTION public.sync_ama_request_upvotes();

-- ── Row Level Security ─────────────────────────────────────────────────────────

ALTER TABLE public.ama_requests      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ama_request_votes ENABLE ROW LEVEL SECURITY;

-- Requests: public read
CREATE POLICY "ama_requests_select_public"
  ON public.ama_requests FOR SELECT USING (true);

-- Requests: authenticated users can create
CREATE POLICY "ama_requests_insert_auth"
  ON public.ama_requests FOR INSERT
  WITH CHECK (auth.uid() = author_id);

-- Requests: author can delete their own
CREATE POLICY "ama_requests_delete_own"
  ON public.ama_requests FOR DELETE
  USING (auth.uid() = author_id);

-- Requests: author can update (mark fulfilled via RPC in practice)
CREATE POLICY "ama_requests_update_own"
  ON public.ama_requests FOR UPDATE
  USING (auth.uid() = author_id);

-- Votes: public read
CREATE POLICY "ama_request_votes_select_public"
  ON public.ama_request_votes FOR SELECT USING (true);

-- Votes: authenticated users can vote
CREATE POLICY "ama_request_votes_insert_auth"
  ON public.ama_request_votes FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Votes: users can remove their own vote
CREATE POLICY "ama_request_votes_delete_own"
  ON public.ama_request_votes FOR DELETE
  USING (auth.uid() = user_id);
