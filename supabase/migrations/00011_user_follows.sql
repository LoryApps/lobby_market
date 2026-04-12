-- User follows system
-- Allows users to follow each other, with denormalized counts on profiles.

CREATE TABLE IF NOT EXISTS user_follows (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  follower_id UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id UUID       NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  UNIQUE (follower_id, following_id),
  CHECK  (follower_id != following_id)
);

CREATE INDEX IF NOT EXISTS idx_user_follows_follower   ON user_follows(follower_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_following  ON user_follows(following_id);

-- Denormalized counters on profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS followers_count  INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS following_count  INT NOT NULL DEFAULT 0;

-- Trigger function: keep counts in sync on follow / unfollow
CREATE OR REPLACE FUNCTION fn_update_follow_counts()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE profiles SET followers_count = followers_count + 1 WHERE id = NEW.following_id;
    UPDATE profiles SET following_count = following_count + 1 WHERE id = NEW.follower_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE profiles SET followers_count = GREATEST(0, followers_count - 1) WHERE id = OLD.following_id;
    UPDATE profiles SET following_count = GREATEST(0, following_count - 1) WHERE id = OLD.follower_id;
  END IF;
  RETURN NULL;
END;
$$;

DROP TRIGGER IF EXISTS tr_update_follow_counts ON user_follows;
CREATE TRIGGER tr_update_follow_counts
  AFTER INSERT OR DELETE ON user_follows
  FOR EACH ROW EXECUTE FUNCTION fn_update_follow_counts();

-- RLS
ALTER TABLE user_follows ENABLE ROW LEVEL SECURITY;

-- Anyone can read (needed for counts and checking follow status)
CREATE POLICY "user_follows_select"
  ON user_follows FOR SELECT
  USING (true);

-- Only the follower can insert their own follow
CREATE POLICY "user_follows_insert"
  ON user_follows FOR INSERT
  WITH CHECK (auth.uid() = follower_id);

-- Only the follower can remove their own follow
CREATE POLICY "user_follows_delete"
  ON user_follows FOR DELETE
  USING (auth.uid() = follower_id);
