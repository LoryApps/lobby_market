-- =============================================================================
-- Lobby Market: Public Manifesto Gallery
-- =============================================================================
-- Stores user-published civic manifestos. Each user can have one published
-- manifesto (updated in place). The gallery lets citizens discover peers
-- with similar civic archetypes.
-- =============================================================================

CREATE TABLE IF NOT EXISTS public_manifestos (
  id                    UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id               UUID         NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  username              TEXT         NOT NULL,
  display_name          TEXT,

  -- Manifesto content (from Claude generation)
  title                 TEXT         NOT NULL CHECK (char_length(title) > 0),
  archetype             TEXT         NOT NULL CHECK (char_length(archetype) > 0),
  archetype_description TEXT         NOT NULL,
  declaration           TEXT         NOT NULL,
  signoff               TEXT         NOT NULL DEFAULT '',
  sections              JSONB        NOT NULL DEFAULT '[]',

  -- Stats snapshot at time of generation
  total_votes           INTEGER      NOT NULL DEFAULT 0,
  categories_covered    INTEGER      NOT NULL DEFAULT 0,
  for_pct               INTEGER      NOT NULL DEFAULT 50,
  laws_supported        INTEGER      NOT NULL DEFAULT 0,
  top_category          TEXT,

  is_public             BOOLEAN      NOT NULL DEFAULT true,
  published_at          TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at            TIMESTAMPTZ  NOT NULL DEFAULT now(),

  -- One published manifesto per user; republishing overwrites in place
  UNIQUE (user_id)
);

ALTER TABLE public_manifestos ENABLE ROW LEVEL SECURITY;

-- Anyone can read public manifestos
CREATE POLICY "public_manifestos_select" ON public_manifestos
  FOR SELECT USING (is_public = true);

-- Only the owner can publish/update their manifesto
CREATE POLICY "public_manifestos_insert" ON public_manifestos
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "public_manifestos_update" ON public_manifestos
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "public_manifestos_delete" ON public_manifestos
  FOR DELETE USING (auth.uid() = user_id);

-- Index for browsing by archetype and recency
CREATE INDEX IF NOT EXISTS idx_public_manifestos_published_at
  ON public_manifestos (published_at DESC) WHERE is_public = true;

CREATE INDEX IF NOT EXISTS idx_public_manifestos_archetype
  ON public_manifestos (archetype, published_at DESC) WHERE is_public = true;
