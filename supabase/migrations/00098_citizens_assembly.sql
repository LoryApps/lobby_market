-- =============================================================================
-- Lobby Market: Citizens' Assembly — sortition-based deliberative bodies
-- =============================================================================
-- A Citizens' Assembly is a randomly convened body of citizens selected by
-- sortition (democratic lottery) to deliberate on a contested civic topic.
-- Unlike debates (adversarial) or votes (binary), an assembly deliberates
-- to produce a nuanced recommendation with reasoning.
--
-- Assembly lifecycle:
--   forming      — accepting member nominations / random selection
--   deliberating — members post deliberation turns (up to 5 rounds)
--   concluded    — assembly has reached a recommendation
--
-- Distinct from:
--   tribunal     — argument moderation (punitive)
--   relay        — collaborative argument chaining (building a case)
--   debate       — live adversarial event
-- =============================================================================

CREATE TYPE assembly_status AS ENUM ('forming', 'deliberating', 'concluded');
CREATE TYPE assembly_stance AS ENUM ('strong_for', 'lean_for', 'divided', 'lean_against', 'strong_against');

CREATE TABLE IF NOT EXISTS citizens_assemblies (
  id                UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  topic_id          UUID          REFERENCES topics(id) ON DELETE SET NULL,
  title             TEXT          NOT NULL,
  question          TEXT          NOT NULL,
  status            assembly_status NOT NULL DEFAULT 'forming',
  max_members       INT           NOT NULL DEFAULT 12,
  deliberation_rounds INT         NOT NULL DEFAULT 3,
  convened_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  concluded_at      TIMESTAMPTZ,
  recommendation    TEXT,
  stance            assembly_stance,
  recommendation_votes_for  INT  NOT NULL DEFAULT 0,
  recommendation_votes_against INT NOT NULL DEFAULT 0,
  created_by        UUID          REFERENCES profiles(id) ON DELETE SET NULL,
  created_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  updated_at        TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assembly_members (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id     UUID          NOT NULL REFERENCES citizens_assemblies(id) ON DELETE CASCADE,
  user_id         UUID          NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  joined_at       TIMESTAMPTZ   NOT NULL DEFAULT now(),
  is_chair        BOOLEAN       NOT NULL DEFAULT false,
  final_stance    assembly_stance,
  UNIQUE (assembly_id, user_id)
);

CREATE TABLE IF NOT EXISTS assembly_deliberations (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id     UUID          NOT NULL REFERENCES citizens_assemblies(id) ON DELETE CASCADE,
  author_id       UUID          NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  round_number    INT           NOT NULL DEFAULT 1,
  content         TEXT          NOT NULL,
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS assembly_observer_reactions (
  id              UUID          PRIMARY KEY DEFAULT gen_random_uuid(),
  assembly_id     UUID          NOT NULL REFERENCES citizens_assemblies(id) ON DELETE CASCADE,
  user_id         UUID          NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  reaction        TEXT          NOT NULL CHECK (reaction IN ('endorse', 'question', 'object')),
  created_at      TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (assembly_id, user_id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_citizens_assemblies_status ON citizens_assemblies(status);
CREATE INDEX IF NOT EXISTS idx_citizens_assemblies_topic ON citizens_assemblies(topic_id);
CREATE INDEX IF NOT EXISTS idx_assembly_members_assembly ON assembly_members(assembly_id);
CREATE INDEX IF NOT EXISTS idx_assembly_deliberations_assembly ON assembly_deliberations(assembly_id);

-- RLS
ALTER TABLE citizens_assemblies ENABLE ROW LEVEL SECURITY;
ALTER TABLE assembly_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE assembly_deliberations ENABLE ROW LEVEL SECURITY;
ALTER TABLE assembly_observer_reactions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anyone can view assemblies" ON citizens_assemblies FOR SELECT USING (true);
CREATE POLICY "anyone can view members" ON assembly_members FOR SELECT USING (true);
CREATE POLICY "anyone can view deliberations" ON assembly_deliberations FOR SELECT USING (true);
CREATE POLICY "anyone can view reactions" ON assembly_observer_reactions FOR SELECT USING (true);

CREATE POLICY "auth users can create assemblies" ON citizens_assemblies
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY "auth users can join assemblies" ON assembly_members
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "members can deliberate" ON assembly_deliberations
  FOR INSERT WITH CHECK (auth.uid() = author_id);

CREATE POLICY "auth users can react" ON assembly_observer_reactions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "auth users can update own reaction" ON assembly_observer_reactions
  FOR DELETE USING (auth.uid() = user_id);
