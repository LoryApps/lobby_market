-- =============================================================================
-- Lobby Market: Expert AMA Sessions
-- =============================================================================
-- Scheduled "Ask Me Anything" sessions where expert users answer community
-- questions live. Distinct from per-topic Q&A (topic_questions/topic_answers),
-- which are asynchronous and topic-scoped. AMAs are event-driven, expert-led,
-- and cross-topic within a civic category.
--
-- Status flow:  upcoming → live → ended
--               upcoming → cancelled
-- =============================================================================

-- ── Sessions ──────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ama_sessions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  host_id       UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  title         TEXT        NOT NULL CHECK (char_length(title) BETWEEN 5 AND 120),
  description   TEXT        CHECK (description IS NULL OR char_length(description) <= 600),
  category      TEXT,
  scheduled_at  TIMESTAMPTZ NOT NULL,
  started_at    TIMESTAMPTZ,
  ended_at      TIMESTAMPTZ,
  status        TEXT        NOT NULL DEFAULT 'upcoming'
                            CHECK (status IN ('upcoming', 'live', 'ended', 'cancelled')),
  question_count INTEGER    NOT NULL DEFAULT 0,
  answer_count  INTEGER     NOT NULL DEFAULT 0,
  rsvp_count    INTEGER     NOT NULL DEFAULT 0,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ama_sessions_status_idx      ON public.ama_sessions(status);
CREATE INDEX IF NOT EXISTS ama_sessions_host_idx        ON public.ama_sessions(host_id);
CREATE INDEX IF NOT EXISTS ama_sessions_scheduled_idx   ON public.ama_sessions(scheduled_at);
CREATE INDEX IF NOT EXISTS ama_sessions_category_idx    ON public.ama_sessions(category);

-- ── Questions submitted during a session ──────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ama_questions (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID        NOT NULL REFERENCES public.ama_sessions(id) ON DELETE CASCADE,
  author_id     UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content       TEXT        NOT NULL CHECK (char_length(content) BETWEEN 10 AND 300),
  upvotes       INTEGER     NOT NULL DEFAULT 0,
  is_answered   BOOLEAN     NOT NULL DEFAULT FALSE,
  is_pinned     BOOLEAN     NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS ama_questions_session_idx   ON public.ama_questions(session_id);
CREATE INDEX IF NOT EXISTS ama_questions_author_idx    ON public.ama_questions(author_id);
CREATE INDEX IF NOT EXISTS ama_questions_upvotes_idx   ON public.ama_questions(session_id, upvotes DESC);

-- ── Host answers ──────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ama_answers (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  question_id   UUID        NOT NULL REFERENCES public.ama_questions(id) ON DELETE CASCADE,
  session_id    UUID        NOT NULL REFERENCES public.ama_sessions(id) ON DELETE CASCADE,
  host_id       UUID        NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  content       TEXT        NOT NULL CHECK (char_length(content) BETWEEN 10 AND 1200),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (question_id)
);

CREATE INDEX IF NOT EXISTS ama_answers_session_idx    ON public.ama_answers(session_id);

-- ── RSVPs ─────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ama_rsvps (
  session_id    UUID        NOT NULL REFERENCES public.ama_sessions(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES public.profiles(id)  ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (session_id, user_id)
);

-- ── Question upvotes ──────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.ama_question_votes (
  question_id   UUID        NOT NULL REFERENCES public.ama_questions(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES public.profiles(id)   ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (question_id, user_id)
);

-- ── RLS ───────────────────────────────────────────────────────────────────────

ALTER TABLE public.ama_sessions         ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ama_questions        ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ama_answers          ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ama_rsvps            ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.ama_question_votes   ENABLE ROW LEVEL SECURITY;

-- Sessions: public read, any auth user can create, host can update
CREATE POLICY "Public can read sessions"
  ON public.ama_sessions FOR SELECT USING (true);
CREATE POLICY "Auth users can create sessions"
  ON public.ama_sessions FOR INSERT WITH CHECK (auth.uid() = host_id);
CREATE POLICY "Host can update their session"
  ON public.ama_sessions FOR UPDATE USING (auth.uid() = host_id);

-- Questions: public read, auth users can submit
CREATE POLICY "Public can read questions"
  ON public.ama_questions FOR SELECT USING (true);
CREATE POLICY "Auth users can submit questions"
  ON public.ama_questions FOR INSERT WITH CHECK (auth.uid() = author_id);

-- Answers: public read, host only can insert
CREATE POLICY "Public can read answers"
  ON public.ama_answers FOR SELECT USING (true);
CREATE POLICY "Host can post answers"
  ON public.ama_answers FOR INSERT WITH CHECK (
    auth.uid() = host_id
    AND EXISTS (
      SELECT 1 FROM public.ama_sessions s
      WHERE s.id = session_id AND s.host_id = auth.uid()
    )
  );
CREATE POLICY "Host can update answers"
  ON public.ama_answers FOR UPDATE USING (auth.uid() = host_id);

-- RSVPs: public read, auth users can rsvp their own
CREATE POLICY "Public can read RSVPs"
  ON public.ama_rsvps FOR SELECT USING (true);
CREATE POLICY "Auth users can RSVP"
  ON public.ama_rsvps FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Auth users can cancel RSVP"
  ON public.ama_rsvps FOR DELETE USING (auth.uid() = user_id);

-- Question votes: public read, auth can vote
CREATE POLICY "Public can read question votes"
  ON public.ama_question_votes FOR SELECT USING (true);
CREATE POLICY "Auth users can vote on questions"
  ON public.ama_question_votes FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Auth users can unvote"
  ON public.ama_question_votes FOR DELETE USING (auth.uid() = user_id);
