-- =============================================================================
-- Lobby Market: Server-synced notification preferences
-- =============================================================================
-- One row per user. All columns default to the same values as the client-side
-- defaults in settings/page.tsx. The client falls back to localStorage when the
-- row doesn't exist yet.
-- =============================================================================

CREATE TABLE IF NOT EXISTS user_notification_prefs (
  user_id            UUID        PRIMARY KEY REFERENCES profiles(id) ON DELETE CASCADE,
  achievement_earned BOOLEAN     NOT NULL DEFAULT true,
  debate_starting    BOOLEAN     NOT NULL DEFAULT true,
  law_established    BOOLEAN     NOT NULL DEFAULT true,
  topic_activated    BOOLEAN     NOT NULL DEFAULT true,
  vote_threshold     BOOLEAN     NOT NULL DEFAULT true,
  reply_received     BOOLEAN     NOT NULL DEFAULT true,
  role_promoted      BOOLEAN     NOT NULL DEFAULT true,
  lobby_update       BOOLEAN     NOT NULL DEFAULT false,
  updated_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- ── Row Level Security ─────────────────────────────────────────────────────────

ALTER TABLE user_notification_prefs ENABLE ROW LEVEL SECURITY;

-- Users can only read their own row.
CREATE POLICY "notif_prefs_select_own"
  ON user_notification_prefs FOR SELECT
  USING (auth.uid() = user_id);

-- Users can insert their own row.
CREATE POLICY "notif_prefs_insert_own"
  ON user_notification_prefs FOR INSERT
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own row.
CREATE POLICY "notif_prefs_update_own"
  ON user_notification_prefs FOR UPDATE
  USING (auth.uid() = user_id);

-- ── Index ──────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_user_notif_prefs_user ON user_notification_prefs (user_id);
