-- =============================================================================
-- Lobby Market: Royal Assent
-- =============================================================================
-- The final ceremonial stage of the legislative process. After the House of
-- Lords reviews a law, the platform's most distinguished Elders (clout >= 750)
-- may grant Royal Assent — formally proclaiming the law and cementing its
-- place in the Civic Codex with a gold seal.
--
-- Only one Royal Assent is issued per law. Elders may add a short proclamation
-- message that becomes part of the law's permanent record.
-- =============================================================================

-- ─── Royal Assent Records ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS royal_assent (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  law_id          UUID        NOT NULL REFERENCES laws(id) ON DELETE CASCADE,
  granted_by      UUID        NOT NULL REFERENCES profiles(id) ON DELETE SET NULL,
  proclamation    TEXT        CHECK (char_length(proclamation) <= 400),
  -- Ceremony date (when assent was formally granted)
  granted_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (law_id)  -- each law receives assent only once
);

ALTER TABLE royal_assent ENABLE ROW LEVEL SECURITY;

-- Anyone can read Royal Assent records (public transparency)
CREATE POLICY "royal_assent_select_all"
  ON royal_assent FOR SELECT USING (true);

-- Only sufficiently senior users (Elders) can grant assent.
-- The clout check is enforced in the API layer for flexibility;
-- the RLS merely requires the granter is authenticated.
CREATE POLICY "royal_assent_insert_elder"
  ON royal_assent FOR INSERT
  WITH CHECK (auth.uid() = granted_by);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_royal_assent_law
  ON royal_assent(law_id);

CREATE INDEX IF NOT EXISTS idx_royal_assent_granted_by
  ON royal_assent(granted_by, granted_at DESC);

CREATE INDEX IF NOT EXISTS idx_royal_assent_granted_at
  ON royal_assent(granted_at DESC);

-- ─── View: Laws with their assent status ──────────────────────────────────────

CREATE OR REPLACE VIEW laws_with_assent AS
SELECT
  l.*,
  ra.id              AS assent_id,
  ra.granted_by      AS assent_granted_by,
  ra.proclamation    AS assent_proclamation,
  ra.granted_at      AS assent_granted_at,
  p.username         AS assent_granter_username,
  p.display_name     AS assent_granter_display_name,
  p.avatar_url       AS assent_granter_avatar_url,
  p.clout            AS assent_granter_clout,
  (ra.id IS NOT NULL) AS has_assent
FROM laws l
LEFT JOIN royal_assent ra ON ra.law_id = l.id
LEFT JOIN profiles p ON p.id = ra.granted_by;
