-- =============================================================================
-- Profile Pinned Arguments
-- =============================================================================
-- Lets users pin up to 3 of their own arguments to their public profile
-- as a "Spotlight" showcase. Pinned arguments appear at the top of the
-- profile overview in a dedicated card.
-- =============================================================================

CREATE TABLE IF NOT EXISTS profile_pinned_arguments (
  id           UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id      UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  argument_id  UUID        NOT NULL REFERENCES topic_arguments(id) ON DELETE CASCADE,
  pinned_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  position     SMALLINT    NOT NULL DEFAULT 1 CHECK (position BETWEEN 1 AND 3),
  UNIQUE (user_id, argument_id),
  UNIQUE (user_id, position)
);

ALTER TABLE profile_pinned_arguments ENABLE ROW LEVEL SECURITY;

-- Anyone can read pinned arguments
CREATE POLICY "pinned_arguments_select_public"
  ON profile_pinned_arguments FOR SELECT USING (true);

-- Users can only manage their own pins
CREATE POLICY "pinned_arguments_insert_own"
  ON profile_pinned_arguments FOR INSERT
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "pinned_arguments_update_own"
  ON profile_pinned_arguments FOR UPDATE
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "pinned_arguments_delete_own"
  ON profile_pinned_arguments FOR DELETE
  USING (user_id = auth.uid());

CREATE INDEX profile_pinned_arguments_user_idx
  ON profile_pinned_arguments (user_id, position);
