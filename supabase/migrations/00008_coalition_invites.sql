-- Coalition invite & membership management

-- ─────────────────────────────────────────────────────────────────────────────
-- coalition_invites
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS coalition_invites (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  coalition_id  UUID        NOT NULL REFERENCES coalitions(id) ON DELETE CASCADE,
  inviter_id    UUID        NOT NULL REFERENCES profiles(id)   ON DELETE CASCADE,
  invitee_id    UUID        NOT NULL REFERENCES profiles(id)   ON DELETE CASCADE,
  status        TEXT        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'accepted', 'declined')),
  message       TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at  TIMESTAMPTZ,

  -- One open invite per (coalition, invitee) at a time
  UNIQUE (coalition_id, invitee_id)
);

CREATE INDEX IF NOT EXISTS idx_coalition_invites_invitee
  ON coalition_invites (invitee_id, status);

CREATE INDEX IF NOT EXISTS idx_coalition_invites_coalition
  ON coalition_invites (coalition_id, status);

-- ─────────────────────────────────────────────────────────────────────────────
-- join_requests  (anyone asking to join a public coalition without invite)
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS coalition_join_requests (
  id            UUID        PRIMARY KEY DEFAULT gen_random_uuid(),
  coalition_id  UUID        NOT NULL REFERENCES coalitions(id) ON DELETE CASCADE,
  user_id       UUID        NOT NULL REFERENCES profiles(id)   ON DELETE CASCADE,
  status        TEXT        NOT NULL DEFAULT 'pending'
                            CHECK (status IN ('pending', 'approved', 'rejected')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  responded_at  TIMESTAMPTZ,

  UNIQUE (coalition_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_coalition_join_requests_coalition
  ON coalition_join_requests (coalition_id, status);
