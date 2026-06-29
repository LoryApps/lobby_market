-- =============================================================================
-- Lobby Market: Civic Veto — collective democratic override of established laws
-- =============================================================================
-- Citizens who believe an established law is unjust or outdated can launch a
-- formal Civic Veto challenge.  When the veto gathers enough signatories
-- (default: 10 % of the law's original voter count, min 50) within 21 days,
-- the law is queued for re-examination through a new voting round.
--
-- Distinct from:
--   civic_petitions — citizen-initiated escalation (hearings, referendums, etc.)
--   law_reopen_requests — lightweight individual request to reopen a topic
--   law_reviews — qualitative star-rating after a law passes
--
-- A Civic Veto is a HIGH-SIGNAL collective action: it requires gathering real
-- signatures, has a strict deadline, and produces a measurable outcome.
-- =============================================================================

CREATE TABLE IF NOT EXISTS civic_vetoes (
  id                UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  law_id            UUID        NOT NULL REFERENCES laws(id) ON DELETE CASCADE,
  challenger_id     UUID        REFERENCES profiles(id) ON DELETE SET NULL,

  -- The substantive case for why this law should be reconsidered.
  title             TEXT        NOT NULL CHECK (char_length(title) BETWEEN 10 AND 150),
  grounds           TEXT        NOT NULL CHECK (char_length(grounds) BETWEEN 30 AND 2000),

  -- 'unconstitutional' | 'ineffective' | 'harmful' | 'outdated' | 'procedural'
  grounds_type      TEXT        NOT NULL DEFAULT 'ineffective'
                    CHECK (grounds_type IN ('unconstitutional','ineffective','harmful','outdated','procedural')),

  -- Signature target is computed at creation time as max(50, floor(0.10 * law.total_votes))
  target_signatures INT         NOT NULL DEFAULT 50 CHECK (target_signatures >= 10),
  signature_count   INT         NOT NULL DEFAULT 0  CHECK (signature_count >= 0),

  -- Lifecycle: open → succeeded (threshold met) | failed (expired without threshold) | withdrawn
  status            TEXT        NOT NULL DEFAULT 'open'
                    CHECK (status IN ('open','succeeded','failed','withdrawn')),

  closes_at         TIMESTAMPTZ NOT NULL DEFAULT (now() + INTERVAL '21 days'),
  created_at        TIMESTAMPTZ NOT NULL DEFAULT now(),
  resolved_at       TIMESTAMPTZ
);

CREATE TABLE IF NOT EXISTS civic_veto_signatures (
  veto_id    UUID        NOT NULL REFERENCES civic_vetoes(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (veto_id, user_id)
);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_civic_vetoes_status
  ON civic_vetoes (status, closes_at DESC);

CREATE INDEX IF NOT EXISTS idx_civic_vetoes_law
  ON civic_vetoes (law_id);

CREATE INDEX IF NOT EXISTS idx_civic_vetoes_challenger
  ON civic_vetoes (challenger_id);

CREATE INDEX IF NOT EXISTS idx_civic_veto_signatures_veto
  ON civic_veto_signatures (veto_id);

CREATE INDEX IF NOT EXISTS idx_civic_veto_signatures_user
  ON civic_veto_signatures (user_id);

-- ─── RLS ─────────────────────────────────────────────────────────────────────

ALTER TABLE civic_vetoes           ENABLE ROW LEVEL SECURITY;
ALTER TABLE civic_veto_signatures  ENABLE ROW LEVEL SECURITY;

-- Anyone can read vetoes
CREATE POLICY "civic_vetoes_select_public"
  ON civic_vetoes FOR SELECT USING (true);

-- Authenticated users can create vetoes
CREATE POLICY "civic_vetoes_insert_auth"
  ON civic_vetoes FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND challenger_id = auth.uid());

-- Challenger can withdraw their own open veto
CREATE POLICY "civic_vetoes_update_challenger"
  ON civic_vetoes FOR UPDATE
  USING (challenger_id = auth.uid() AND status = 'open')
  WITH CHECK (status = 'withdrawn');

-- Anyone can read signatures
CREATE POLICY "civic_veto_signatures_select_public"
  ON civic_veto_signatures FOR SELECT USING (true);

-- Authenticated users can sign a veto
CREATE POLICY "civic_veto_signatures_insert_auth"
  ON civic_veto_signatures FOR INSERT
  WITH CHECK (auth.uid() IS NOT NULL AND user_id = auth.uid());

-- Users can unsign
CREATE POLICY "civic_veto_signatures_delete_own"
  ON civic_veto_signatures FOR DELETE
  USING (user_id = auth.uid());

-- ─── Trigger: keep signature_count in sync ────────────────────────────────────

CREATE OR REPLACE FUNCTION increment_veto_signature_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE civic_vetoes
  SET    signature_count = signature_count + 1,
         status = CASE
           WHEN signature_count + 1 >= target_signatures THEN 'succeeded'
           ELSE status
         END,
         resolved_at = CASE
           WHEN signature_count + 1 >= target_signatures THEN now()
           ELSE resolved_at
         END
  WHERE  id = NEW.veto_id AND status = 'open';
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION decrement_veto_signature_count()
RETURNS TRIGGER LANGUAGE plpgsql SECURITY DEFINER AS $$
BEGIN
  UPDATE civic_vetoes
  SET signature_count = GREATEST(0, signature_count - 1)
  WHERE id = OLD.veto_id AND status = 'open';
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_veto_sig_insert ON civic_veto_signatures;
CREATE TRIGGER trg_veto_sig_insert
  AFTER INSERT ON civic_veto_signatures
  FOR EACH ROW EXECUTE FUNCTION increment_veto_signature_count();

DROP TRIGGER IF EXISTS trg_veto_sig_delete ON civic_veto_signatures;
CREATE TRIGGER trg_veto_sig_delete
  AFTER DELETE ON civic_veto_signatures
  FOR EACH ROW EXECUTE FUNCTION decrement_veto_signature_count();

-- ─── Seed: realistic sample vetoes ───────────────────────────────────────────
-- Only inserted if there are existing laws to reference.
DO $$
DECLARE
  _law1 UUID;
  _law2 UUID;
  _law3 UUID;
BEGIN
  SELECT id INTO _law1 FROM laws ORDER BY established_at DESC LIMIT 1 OFFSET 0;
  SELECT id INTO _law2 FROM laws ORDER BY established_at DESC LIMIT 1 OFFSET 1;
  SELECT id INTO _law3 FROM laws ORDER BY established_at DESC LIMIT 1 OFFSET 2;

  IF _law1 IS NOT NULL THEN
    INSERT INTO civic_vetoes (law_id, title, grounds, grounds_type, target_signatures, signature_count, status)
    VALUES (
      _law1,
      'Reconsider enforcement mechanisms',
      'The law as written lacks clear enforcement mechanisms and measurable outcomes. Since its establishment the practical impact has been negligible — we need either stronger teeth or a revised approach that actually moves the needle on the underlying issue.',
      'ineffective',
      50,
      23,
      'open'
    ) ON CONFLICT DO NOTHING;
  END IF;

  IF _law2 IS NOT NULL THEN
    INSERT INTO civic_vetoes (law_id, title, grounds, grounds_type, target_signatures, signature_count, status, closes_at)
    VALUES (
      _law2,
      'Outdated in light of recent developments',
      'Significant developments since this law was established have rendered its core assumptions obsolete. The original context that motivated the vote no longer exists. Continuing to enforce this consensus without revisiting it is a disservice to the community.',
      'outdated',
      50,
      47,
      'open',
      now() + INTERVAL '4 days'
    ) ON CONFLICT DO NOTHING;
  END IF;

  IF _law3 IS NOT NULL THEN
    INSERT INTO civic_vetoes (law_id, title, grounds, grounds_type, target_signatures, signature_count, status, closes_at, resolved_at)
    VALUES (
      _law3,
      'Procedural irregularity during voting phase',
      'Credible evidence of coordinated voting during the final 24 hours of the voting phase. The integrity of the result is in question and warrants an independent review before this law is treated as binding consensus.',
      'procedural',
      50,
      50,
      'succeeded',
      now() - INTERVAL '2 days',
      now() - INTERVAL '2 days'
    ) ON CONFLICT DO NOTHING;
  END IF;
END;
$$;

COMMENT ON TABLE civic_vetoes IS
  'Civic Veto challenges: collective democratic override mechanism.
   When a veto gathers target_signatures within closes_at, status flips to succeeded
   and the law is queued for mandatory reconsideration.';

COMMENT ON TABLE civic_veto_signatures IS
  'Individual signatures on a Civic Veto. One per (veto, user).';
