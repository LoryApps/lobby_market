-- =============================================================================
-- Lobby Market: Civic Ambassador Program
-- =============================================================================
-- Adds a referral code system so citizens can recruit new members and earn
-- Clout for each person who joins, onboards, and casts their first vote.
--
-- Flow:
--   1. Citizen gets a unique referral code at /ambassador (auto-generated).
--   2. They share  lobby.market/welcome?ref=<code>
--   3. New user signs up → referral_code is stored in their profile.
--   4. On first vote → referral_conversions row is inserted and ambassador
--      gets +50 Clout (CONVERTED).
-- =============================================================================

-- ─── 1. Referral code registry (one per user) ─────────────────────────────────

CREATE TABLE IF NOT EXISTS referral_codes (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  code        TEXT        NOT NULL UNIQUE,
  -- lifetime stats (denormalised for fast reads)
  times_clicked  INT      NOT NULL DEFAULT 0,
  times_signed_up INT     NOT NULL DEFAULT 0,
  times_converted INT     NOT NULL DEFAULT 0,  -- signed up AND cast ≥1 vote
  clout_earned   INT      NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id)
);

-- ─── 2. Individual referral events ────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS referral_conversions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  referrer_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  referee_id  UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  code        TEXT        NOT NULL,
  status      TEXT        NOT NULL DEFAULT 'signed_up'
                          CHECK (status IN ('signed_up', 'converted')),
  clout_awarded INT       NOT NULL DEFAULT 0,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  converted_at TIMESTAMPTZ,
  UNIQUE (referee_id)   -- each new user can only be referred once
);

-- ─── 3. Store referral code on the new user's profile ─────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS referral_code_used TEXT;   -- code they signed up with

-- ─── 4. Function: auto-generate a code when a profile is created ──────────────

CREATE OR REPLACE FUNCTION generate_referral_code(p_user_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
AS $$
DECLARE
  v_username TEXT;
  v_code     TEXT;
  v_attempt  INT := 0;
BEGIN
  SELECT username INTO v_username FROM profiles WHERE id = p_user_id;
  -- Try username first, then username+number
  LOOP
    IF v_attempt = 0 THEN
      v_code := lower(regexp_replace(v_username, '[^a-zA-Z0-9]', '', 'g'));
    ELSE
      v_code := lower(regexp_replace(v_username, '[^a-zA-Z0-9]', '', 'g'))
                || v_attempt::TEXT;
    END IF;
    -- truncate to 20 chars
    v_code := left(v_code, 20);
    BEGIN
      INSERT INTO referral_codes (user_id, code) VALUES (p_user_id, v_code);
      RETURN v_code;
    EXCEPTION WHEN unique_violation THEN
      v_attempt := v_attempt + 1;
      IF v_attempt > 99 THEN
        -- fallback: uuid prefix
        v_code := left(replace(gen_random_uuid()::TEXT, '-', ''), 12);
        INSERT INTO referral_codes (user_id, code) VALUES (p_user_id, v_code);
        RETURN v_code;
      END IF;
    END;
  END LOOP;
END;
$$;

-- ─── 5. Trigger: create referral_codes row when a profile is inserted ─────────

CREATE OR REPLACE FUNCTION trg_create_referral_code()
RETURNS TRIGGER
LANGUAGE plpgsql
AS $$
BEGIN
  -- Best-effort: if it fails, don't block signup
  BEGIN
    PERFORM generate_referral_code(NEW.id);
  EXCEPTION WHEN OTHERS THEN
    NULL;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_profile_create_referral_code ON profiles;
CREATE TRIGGER trg_profile_create_referral_code
  AFTER INSERT ON profiles
  FOR EACH ROW EXECUTE FUNCTION trg_create_referral_code();

-- ─── 6. Back-fill codes for existing profiles ─────────────────────────────────

DO $$
DECLARE
  r RECORD;
BEGIN
  FOR r IN SELECT id FROM profiles WHERE id NOT IN (SELECT user_id FROM referral_codes)
  LOOP
    BEGIN
      PERFORM generate_referral_code(r.id);
    EXCEPTION WHEN OTHERS THEN
      NULL;
    END;
  END LOOP;
END;
$$;

-- ─── 7. Indexes ───────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_referral_codes_code     ON referral_codes (code);
CREATE INDEX IF NOT EXISTS idx_referral_conversions_referrer ON referral_conversions (referrer_id);
CREATE INDEX IF NOT EXISTS idx_referral_conversions_referee  ON referral_conversions (referee_id);

-- ─── 8. RLS policies ──────────────────────────────────────────────────────────

ALTER TABLE referral_codes        ENABLE ROW LEVEL SECURITY;
ALTER TABLE referral_conversions  ENABLE ROW LEVEL SECURITY;

-- Anyone can read codes (needed for validation on signup)
CREATE POLICY "referral_codes_public_read"
  ON referral_codes FOR SELECT USING (true);

-- Owner can update click counts via API (service role bypasses RLS)
CREATE POLICY "referral_codes_owner_all"
  ON referral_codes FOR ALL
  USING (auth.uid() = user_id);

-- Users can see their own referral conversions
CREATE POLICY "referral_conversions_read_own"
  ON referral_conversions FOR SELECT
  USING (auth.uid() = referrer_id OR auth.uid() = referee_id);

COMMENT ON TABLE referral_codes IS
  'One referral code per user for the Civic Ambassador Program.';
COMMENT ON TABLE referral_conversions IS
  'Each row is a signed-up user who used a referral code.';
