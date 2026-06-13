-- =============================================================================
-- Lobby Market: Law Reviews — star ratings + short reviews for established laws
-- =============================================================================
-- After a topic becomes law, citizens can leave a 1-5 star rating and an
-- optional short review (max 280 chars) reflecting on whether they believe
-- the law is good civic policy.  One review per user per law; editable.
--
-- Distinct from:
--   argument_upvotes   — vote on argument quality during debate
--   blueprint_notes    — annotate implementation plans
--   amendments         — propose formal changes to the law
-- =============================================================================

CREATE TABLE IF NOT EXISTS law_reviews (
  id         UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  law_id     UUID        NOT NULL REFERENCES laws(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stars      SMALLINT    NOT NULL CHECK (stars BETWEEN 1 AND 5),
  body       TEXT        CHECK (char_length(body) <= 280),
  helpful    INTEGER     NOT NULL DEFAULT 0,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT law_reviews_one_per_user UNIQUE (law_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_law_reviews_law
  ON law_reviews (law_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_law_reviews_user
  ON law_reviews (user_id, created_at DESC);

-- ── Row Level Security ─────────────────────────────────────────────────────────

ALTER TABLE law_reviews ENABLE ROW LEVEL SECURITY;

CREATE POLICY "law_reviews_select_public"
  ON law_reviews FOR SELECT USING (true);

CREATE POLICY "law_reviews_insert_auth"
  ON law_reviews FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "law_reviews_update_own"
  ON law_reviews FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "law_reviews_delete_own"
  ON law_reviews FOR DELETE
  USING (auth.uid() = user_id);

-- ── Helpful votes junction ──────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS law_review_helpful (
  review_id  UUID        NOT NULL REFERENCES law_reviews(id) ON DELETE CASCADE,
  user_id    UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (review_id, user_id)
);

ALTER TABLE law_review_helpful ENABLE ROW LEVEL SECURITY;

CREATE POLICY "law_review_helpful_select_public"
  ON law_review_helpful FOR SELECT USING (true);

CREATE POLICY "law_review_helpful_insert_auth"
  ON law_review_helpful FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "law_review_helpful_delete_own"
  ON law_review_helpful FOR DELETE
  USING (auth.uid() = user_id);

-- ── RPC: toggle helpful vote ─────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION toggle_review_helpful(p_review_id UUID)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER AS $$
DECLARE
  v_user UUID := auth.uid();
  v_exists BOOLEAN;
  v_delta  INT;
BEGIN
  IF v_user IS NULL THEN
    RETURN jsonb_build_object('error', 'not authenticated');
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM law_review_helpful
    WHERE review_id = p_review_id AND user_id = v_user
  ) INTO v_exists;

  IF v_exists THEN
    DELETE FROM law_review_helpful WHERE review_id = p_review_id AND user_id = v_user;
    v_delta := -1;
  ELSE
    INSERT INTO law_review_helpful (review_id, user_id) VALUES (p_review_id, v_user);
    v_delta := 1;
  END IF;

  UPDATE law_reviews
  SET helpful = GREATEST(0, helpful + v_delta)
  WHERE id = p_review_id;

  RETURN jsonb_build_object('helpful', NOT v_exists);
END;
$$;
