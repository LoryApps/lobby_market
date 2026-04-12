-- =============================================================================
-- 00006_onboarding.sql
-- Onboarding quiz preferences and completion flag
-- =============================================================================

-- Add onboarding fields to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS onboarding_complete boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS category_preferences jsonb NOT NULL DEFAULT '[]'::jsonb;

-- Index for fast lookup of users who haven't completed onboarding
CREATE INDEX IF NOT EXISTS idx_profiles_onboarding
  ON profiles (onboarding_complete)
  WHERE onboarding_complete = false;

-- =============================================================================
-- End of 00006_onboarding.sql
-- =============================================================================
