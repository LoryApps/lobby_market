-- =============================================================================
-- Lobby Market: The King's Speech — State Opening of Parliament
-- =============================================================================
-- The ceremonial opening of each civic session. The ruling coalition (or top
-- coalition by member clout) delivers a legislative programme listing the bills
-- they intend to champion. Citizens react with "Hear, hear" or "Shame!".
-- The opposition may respond with a formal counter-address.
-- =============================================================================

-- ─── Kings Speeches ───────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kings_speeches (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  session_name    TEXT        NOT NULL,                              -- e.g. "First Session 2026"
  coalition_id    UUID        REFERENCES coalitions(id) ON DELETE SET NULL,
  authored_by     UUID        REFERENCES profiles(id)   ON DELETE SET NULL,
  preamble        TEXT        NOT NULL CHECK (char_length(preamble) BETWEEN 50 AND 2000),
  -- JSON array of {topic_id, priority_label, note}
  -- priority_label: 'flagship' | 'priority' | 'secondary'
  legislative_programme  JSONB  NOT NULL DEFAULT '[]',
  delivered_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE kings_speeches ENABLE ROW LEVEL SECURITY;

CREATE POLICY "kings_speeches_select_all"
  ON kings_speeches FOR SELECT USING (true);

CREATE POLICY "kings_speeches_insert_auth"
  ON kings_speeches FOR INSERT
  WITH CHECK (auth.uid() = authored_by);

-- ─── Reactions ────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kings_speech_reactions (
  id          UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  speech_id   UUID        NOT NULL REFERENCES kings_speeches(id) ON DELETE CASCADE,
  user_id     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- 'hear_hear' = support / 'shame' = oppose
  reaction    TEXT        NOT NULL CHECK (reaction IN ('hear_hear', 'shame')),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (speech_id, user_id)
);

ALTER TABLE kings_speech_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ks_reactions_select_all"
  ON kings_speech_reactions FOR SELECT USING (true);

CREATE POLICY "ks_reactions_insert_self"
  ON kings_speech_reactions FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "ks_reactions_update_self"
  ON kings_speech_reactions FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "ks_reactions_delete_self"
  ON kings_speech_reactions FOR DELETE
  USING (auth.uid() = user_id);

-- ─── Opposition Responses ─────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS kings_speech_responses (
  id              UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  speech_id       UUID        NOT NULL REFERENCES kings_speeches(id) ON DELETE CASCADE,
  coalition_id    UUID        REFERENCES coalitions(id) ON DELETE SET NULL,
  authored_by     UUID        NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  -- 'gracious_address' = supporting motion / 'opposition' = formal rejection / 'amendment' = amendment motion
  response_type   TEXT        NOT NULL CHECK (response_type IN ('gracious_address', 'opposition', 'amendment')),
  content         TEXT        NOT NULL CHECK (char_length(content) BETWEEN 20 AND 1000),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE kings_speech_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "ks_responses_select_all"
  ON kings_speech_responses FOR SELECT USING (true);

CREATE POLICY "ks_responses_insert_auth"
  ON kings_speech_responses FOR INSERT
  WITH CHECK (auth.uid() = authored_by);

-- ─── Indexes ──────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_kings_speeches_delivered
  ON kings_speeches(delivered_at DESC);

CREATE INDEX IF NOT EXISTS idx_kings_speeches_coalition
  ON kings_speeches(coalition_id);

CREATE INDEX IF NOT EXISTS idx_ks_reactions_speech
  ON kings_speech_reactions(speech_id, reaction);

CREATE INDEX IF NOT EXISTS idx_ks_responses_speech
  ON kings_speech_responses(speech_id, created_at);
