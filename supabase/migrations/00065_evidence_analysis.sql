-- =============================================================================
-- Lobby Market: AI Evidence Analysis Cache
-- =============================================================================
-- Stores Claude-generated quality analysis for each topic's evidence pool.
-- Keyed by topic_id + evidence_hash to invalidate when evidence changes.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public.topic_evidence_analysis (
  topic_id       UUID        NOT NULL PRIMARY KEY REFERENCES public.topics(id) ON DELETE CASCADE,
  quality_score  INT         NOT NULL CHECK (quality_score BETWEEN 0 AND 10),
  bias_score     INT         NOT NULL CHECK (bias_score BETWEEN 0 AND 10),
  evidence_count INT         NOT NULL DEFAULT 0,
  for_count      INT         NOT NULL DEFAULT 0,
  against_count  INT         NOT NULL DEFAULT 0,
  neutral_count  INT         NOT NULL DEFAULT 0,
  strongest_for  TEXT,
  strongest_against TEXT,
  missing_perspective TEXT   NOT NULL,
  key_claim      TEXT        NOT NULL,
  summary        TEXT        NOT NULL,
  evidence_hash  TEXT        NOT NULL,
  model          TEXT        NOT NULL DEFAULT 'claude-sonnet-4-6',
  generated_at   TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE public.topic_evidence_analysis ENABLE ROW LEVEL SECURITY;

CREATE POLICY "evidence_analysis_select"
  ON public.topic_evidence_analysis FOR SELECT
  USING (true);

CREATE POLICY "evidence_analysis_upsert"
  ON public.topic_evidence_analysis FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

CREATE POLICY "evidence_analysis_update"
  ON public.topic_evidence_analysis FOR UPDATE
  USING (auth.role() = 'authenticated');
