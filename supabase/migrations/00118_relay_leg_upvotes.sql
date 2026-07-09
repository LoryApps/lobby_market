-- =============================================================================
-- Lobby Market: Relay Leg Stars
-- =============================================================================
-- Users can upvote individual relay legs to mark the most valuable
-- contributions in a chain. Enables per-leg quality signals and powers
-- the Relay Champions leaderboard (/relays/champions).
--
-- Distinct from relay_votes (compelling/not-compelling on the full chain) —
-- leg stars rate individual contributions within a relay.
-- =============================================================================

-- ─── 1. relay_leg_upvotes ────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS public.relay_leg_upvotes (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  leg_id     UUID        NOT NULL REFERENCES public.relay_legs(id) ON DELETE CASCADE,
  voter_id   UUID        NOT NULL REFERENCES public.profiles(id)   ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (leg_id, voter_id)
);

CREATE INDEX IF NOT EXISTS relay_leg_upvotes_leg_idx   ON public.relay_leg_upvotes (leg_id);
CREATE INDEX IF NOT EXISTS relay_leg_upvotes_voter_idx ON public.relay_leg_upvotes (voter_id);

COMMENT ON TABLE public.relay_leg_upvotes IS
  'Per-leg star upvotes within a relay chain. Aggregate counts power the Relay Champions leaderboard.';

-- ─── 2. Row-level security ───────────────────────────────────────────────────

ALTER TABLE public.relay_leg_upvotes ENABLE ROW LEVEL SECURITY;

-- Anyone can read upvote counts
CREATE POLICY "relay_leg_upvotes_select"
  ON public.relay_leg_upvotes FOR SELECT
  USING (true);

-- Authenticated users can upvote (once per leg)
CREATE POLICY "relay_leg_upvotes_insert"
  ON public.relay_leg_upvotes FOR INSERT
  WITH CHECK (auth.uid() = voter_id);

-- Users can remove their own upvote
CREATE POLICY "relay_leg_upvotes_delete"
  ON public.relay_leg_upvotes FOR DELETE
  USING (auth.uid() = voter_id);

-- ─── 3. upvote_count column on relay_legs (denormalised cache) ───────────────
-- Maintained by triggers below so champion queries are cheap (no subquery JOIN).

ALTER TABLE public.relay_legs
  ADD COLUMN IF NOT EXISTS upvote_count INT NOT NULL DEFAULT 0;

COMMENT ON COLUMN public.relay_legs.upvote_count IS
  'Denormalised count of relay_leg_upvotes rows for this leg. Kept in sync by triggers.';

-- ─── 4. Triggers: keep relay_legs.upvote_count accurate ─────────────────────

CREATE OR REPLACE FUNCTION fn_relay_leg_upvote_increment()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE relay_legs SET upvote_count = upvote_count + 1 WHERE id = NEW.leg_id;
  RETURN NEW;
EXCEPTION WHEN OTHERS THEN
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_relay_leg_upvote_inc ON public.relay_leg_upvotes;
CREATE TRIGGER trg_relay_leg_upvote_inc
  AFTER INSERT ON public.relay_leg_upvotes
  FOR EACH ROW EXECUTE FUNCTION fn_relay_leg_upvote_increment();

CREATE OR REPLACE FUNCTION fn_relay_leg_upvote_decrement()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE relay_legs
    SET upvote_count = GREATEST(0, upvote_count - 1)
  WHERE id = OLD.leg_id;
  RETURN OLD;
EXCEPTION WHEN OTHERS THEN
  RETURN OLD;
END;
$$;

DROP TRIGGER IF EXISTS trg_relay_leg_upvote_dec ON public.relay_leg_upvotes;
CREATE TRIGGER trg_relay_leg_upvote_dec
  AFTER DELETE ON public.relay_leg_upvotes
  FOR EACH ROW EXECUTE FUNCTION fn_relay_leg_upvote_decrement();
