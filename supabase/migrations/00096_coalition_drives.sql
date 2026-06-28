-- Coalition Voting Drives
-- A coordinated stance drive where coalition leaders rally members to vote
-- together on specific topics, with participation tracking and deadlines.

CREATE TABLE IF NOT EXISTS coalition_drives (
  id            uuid        DEFAULT gen_random_uuid() PRIMARY KEY,
  coalition_id  uuid        NOT NULL REFERENCES coalitions(id) ON DELETE CASCADE,
  topic_id      uuid        NOT NULL REFERENCES topics(id)     ON DELETE CASCADE,
  created_by    uuid        NOT NULL REFERENCES profiles(id)   ON DELETE SET NULL,
  title         text        NOT NULL,
  description   text,
  target_vote   text        NOT NULL DEFAULT 'for' CHECK (target_vote IN ('for', 'against')),
  target_count  int         NOT NULL DEFAULT 10 CHECK (target_count > 0),
  participant_count int     NOT NULL DEFAULT 0,
  status        text        NOT NULL DEFAULT 'active'
                              CHECK (status IN ('active', 'completed', 'cancelled')),
  ends_at       timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX coalition_drives_coalition_id_idx ON coalition_drives(coalition_id);
CREATE INDEX coalition_drives_status_idx       ON coalition_drives(status);
CREATE INDEX coalition_drives_topic_id_idx     ON coalition_drives(topic_id);

-- Tracks which members have pledged to participate in a drive
CREATE TABLE IF NOT EXISTS coalition_drive_participants (
  drive_id  uuid        NOT NULL REFERENCES coalition_drives(id) ON DELETE CASCADE,
  user_id   uuid        NOT NULL REFERENCES profiles(id)         ON DELETE CASCADE,
  joined_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (drive_id, user_id)
);

-- Row-level security
ALTER TABLE coalition_drives             ENABLE ROW LEVEL SECURITY;
ALTER TABLE coalition_drive_participants ENABLE ROW LEVEL SECURITY;

-- Anyone can read drives
CREATE POLICY "coalition_drives_select"
  ON coalition_drives FOR SELECT USING (true);

-- Only coalition leaders / officers can create drives
CREATE POLICY "coalition_drives_insert"
  ON coalition_drives FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM coalition_members
      WHERE coalition_id = coalition_drives.coalition_id
        AND user_id      = auth.uid()
        AND role IN ('leader', 'officer')
    )
  );

-- Drive creator or coalition leaders/officers can update (status, etc.)
CREATE POLICY "coalition_drives_update"
  ON coalition_drives FOR UPDATE USING (
    created_by = auth.uid()
    OR EXISTS (
      SELECT 1 FROM coalition_members
      WHERE coalition_id = coalition_drives.coalition_id
        AND user_id      = auth.uid()
        AND role IN ('leader', 'officer')
    )
  );

-- Anyone can read participation
CREATE POLICY "coalition_drive_participants_select"
  ON coalition_drive_participants FOR SELECT USING (true);

-- Coalition members can pledge to participate
CREATE POLICY "coalition_drive_participants_insert"
  ON coalition_drive_participants FOR INSERT WITH CHECK (
    user_id = auth.uid()
    AND EXISTS (
      SELECT 1
      FROM coalition_members   cm
      JOIN coalition_drives    cd ON cd.id = coalition_drive_participants.drive_id
      WHERE cm.coalition_id = cd.coalition_id
        AND cm.user_id      = auth.uid()
    )
  );

-- Members can withdraw their participation
CREATE POLICY "coalition_drive_participants_delete"
  ON coalition_drive_participants FOR DELETE USING (user_id = auth.uid());

-- Auto-update participant_count via trigger
CREATE OR REPLACE FUNCTION update_drive_participant_count()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE coalition_drives
       SET participant_count = participant_count + 1
     WHERE id = NEW.drive_id;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE coalition_drives
       SET participant_count = GREATEST(participant_count - 1, 0)
     WHERE id = OLD.drive_id;
  END IF;
  RETURN NULL;
END;
$$;

CREATE TRIGGER trg_drive_participant_count
AFTER INSERT OR DELETE ON coalition_drive_participants
FOR EACH ROW EXECUTE FUNCTION update_drive_participant_count();
