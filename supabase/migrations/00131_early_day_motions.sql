-- =============================================================================
-- Lobby Market: Early Day Motions (EDMs)
-- =============================================================================
-- Parliamentary notices filed by citizens on any civic matter.
-- An EDM is a formal written statement — not a vote, not a petition, but a
-- public declaration of civic concern that other users can "second" to show
-- support. EDMs with enough seconds may be elevated to the Order Paper for
-- formal debate consideration.
--
-- grounds options mirror Westminster parliamentary grounds for tabling EDMs:
--   'commendation'    — praising an action, law, or citizen
--   'concern'         — raising concern about an issue
--   'opposition'      — formally opposing a law or policy
--   'call_to_action'  — urging civic action
--   'information'     — informing the chamber of a civic matter
-- =============================================================================

CREATE TABLE IF NOT EXISTS early_day_motions (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  filed_by        UUID          NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,

  -- Content
  title           TEXT          NOT NULL CHECK (char_length(title) BETWEEN 10 AND 120),
  body            TEXT          NOT NULL CHECK (char_length(body) BETWEEN 30 AND 1000),
  category        TEXT          NOT NULL DEFAULT 'Politics'
                                CHECK (category IN (
                                  'Politics','Economics','Technology','Science',
                                  'Ethics','Philosophy','Culture','Health',
                                  'Education','Environment','Other'
                                )),

  -- Type of EDM
  grounds         TEXT          NOT NULL DEFAULT 'concern'
                                CHECK (grounds IN (
                                  'commendation','concern','opposition',
                                  'call_to_action','information'
                                )),

  -- Engagement counters (denormalised for fast reads)
  second_count    INT           NOT NULL DEFAULT 0 CHECK (second_count >= 0),

  -- Lifecycle
  -- 'open' → collects seconds. 'elevated' → moved to Order Paper. 'lapsed' → expired.
  status          TEXT          NOT NULL DEFAULT 'open'
                                CHECK (status IN ('open', 'elevated', 'lapsed', 'withdrawn')),

  -- EDMs auto-lapse after 14 days if not elevated
  expires_at      TIMESTAMPTZ   NOT NULL DEFAULT (now() + INTERVAL '14 days'),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),

  -- Optional link to a specific topic
  topic_id        UUID          REFERENCES topics(id) ON DELETE SET NULL
);

-- Users seconding an EDM (equivalent to co-signing in Westminster)
CREATE TABLE IF NOT EXISTS edm_seconds (
  edm_id      UUID        NOT NULL REFERENCES early_day_motions(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (edm_id, user_id)
);

-- ── Indexes ────────────────────────────────────────────────────────────────────
CREATE INDEX IF NOT EXISTS idx_edm_filed_by     ON early_day_motions (filed_by);
CREATE INDEX IF NOT EXISTS idx_edm_category     ON early_day_motions (category);
CREATE INDEX IF NOT EXISTS idx_edm_status       ON early_day_motions (status);
CREATE INDEX IF NOT EXISTS idx_edm_created_at   ON early_day_motions (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_edm_seconds_user ON edm_seconds (user_id);

-- ── Row Level Security ─────────────────────────────────────────────────────────
ALTER TABLE early_day_motions ENABLE ROW LEVEL SECURITY;
ALTER TABLE edm_seconds       ENABLE ROW LEVEL SECURITY;

-- Anyone can read EDMs
CREATE POLICY "edm_select_public"
  ON early_day_motions FOR SELECT USING (true);

-- Authenticated users can file an EDM
CREATE POLICY "edm_insert_authenticated"
  ON early_day_motions FOR INSERT
  WITH CHECK (auth.uid() = filed_by);

-- Only the filer can update their own EDM (to withdraw it)
CREATE POLICY "edm_update_own"
  ON early_day_motions FOR UPDATE
  USING (auth.uid() = filed_by);

-- Anyone can read seconds
CREATE POLICY "edm_seconds_select_public"
  ON edm_seconds FOR SELECT USING (true);

-- Authenticated users can second an EDM
CREATE POLICY "edm_seconds_insert"
  ON edm_seconds FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can withdraw their own second
CREATE POLICY "edm_seconds_delete_own"
  ON edm_seconds FOR DELETE
  USING (auth.uid() = user_id);

-- ── Triggers: keep second_count in sync ───────────────────────────────────────
CREATE OR REPLACE FUNCTION increment_edm_second_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE early_day_motions
     SET second_count = second_count + 1
   WHERE id = NEW.edm_id;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION decrement_edm_second_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  UPDATE early_day_motions
     SET second_count = GREATEST(0, second_count - 1)
   WHERE id = OLD.edm_id;
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_edm_second_inc ON edm_seconds;
CREATE TRIGGER trg_edm_second_inc
  AFTER INSERT ON edm_seconds
  FOR EACH ROW EXECUTE FUNCTION increment_edm_second_count();

DROP TRIGGER IF EXISTS trg_edm_second_dec ON edm_seconds;
CREATE TRIGGER trg_edm_second_dec
  AFTER DELETE ON edm_seconds
  FOR EACH ROW EXECUTE FUNCTION decrement_edm_second_count();
