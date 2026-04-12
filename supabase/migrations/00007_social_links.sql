-- Phase 7: Profile social links
-- Adds a JSONB column for optional social profile links (Twitter/X, GitHub, website).

ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS social_links JSONB DEFAULT NULL;

COMMENT ON COLUMN profiles.social_links IS
  'Optional social links, e.g. {"twitter":"handle","github":"user","website":"https://..."}';
