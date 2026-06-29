-- =============================================================================
-- Lobby Market: Civic Oath — permanent civic commitment ceremony
-- =============================================================================
-- Each citizen may take the Civic Oath once.  They choose one of five core
-- civic values, read the oath, and confirm.  The oath timestamp and chosen
-- value are stored permanently on their profile.
--
-- Distinct from:
--   pledges          — public action commitments (repeatable)
--   onboarding       — calibration quiz (first-run only)
--   proclamations    — platform-wide governance announcements
-- =============================================================================

-- ── Add oath columns to profiles ──────────────────────────────────────────────

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS civic_oath_at    TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS civic_oath_value TEXT
    CHECK (civic_oath_value IN ('truth','justice','liberty','community','progress'));

COMMENT ON COLUMN profiles.civic_oath_at    IS
  'Timestamp when the citizen took the Civic Oath. NULL = oath not yet taken.';
COMMENT ON COLUMN profiles.civic_oath_value IS
  'The core civic value the citizen pledged their oath to: truth | justice | liberty | community | progress.';

-- Index used by the Oath Roll (list of oath-holders ordered by date)
CREATE INDEX IF NOT EXISTS idx_profiles_civic_oath
  ON profiles (civic_oath_at DESC)
  WHERE civic_oath_at IS NOT NULL;
