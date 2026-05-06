-- =============================================================================
-- Lobby Market: Topic Tags
-- =============================================================================
-- Adds a `tags` column (text[]) to topics and populates it automatically
-- via a before-insert trigger.  Tags are lowercase keywords extracted from
-- the statement against a curated civic vocabulary for precision, plus
-- category-derived tags for breadth.
-- =============================================================================

-- ── 1. Add the column ─────────────────────────────────────────────────────────

ALTER TABLE topics
  ADD COLUMN IF NOT EXISTS tags TEXT[] NOT NULL DEFAULT '{}';

COMMENT ON COLUMN topics.tags IS
  'Auto-generated keyword tags for discoverability (e.g., tax, climate, housing)';

-- ── 2. Civic keyword vocabulary ───────────────────────────────────────────────
-- Maps a canonical tag to the words/phrases that trigger it.
-- Checked against the lower-cased topic statement.

CREATE OR REPLACE FUNCTION generate_topic_tags(p_statement TEXT, p_category TEXT)
RETURNS TEXT[] AS $$
DECLARE
  stmt    TEXT := lower(p_statement);
  result  TEXT[] := '{}';

  -- Each entry: tag_name, match_terms (any match triggers the tag)
  vocab   TEXT[][] := ARRAY[
    -- Economy / Finance
    ARRAY['tax',              'tax,taxes,taxation,tariff,tariffs,fiscal,levy'],
    ARRAY['economy',          'economy,economic,gdp,recession,inflation,deflation,monetary'],
    ARRAY['trade',            'trade,import,export,tariff,wto,free trade,protectionism'],
    ARRAY['budget',           'budget,deficit,debt,spending,expenditure,fiscal'],
    ARRAY['income',           'income,wage,salary,earnings,minimum wage,living wage,ubi,basic income'],
    ARRAY['inequality',       'inequality,wealth gap,poverty,redistribution,disparity'],
    ARRAY['housing',          'housing,rent,mortgage,homelessness,homeless,affordable housing'],
    ARRAY['banking',          'bank,banking,finance,financial,interest rate,credit,loan'],
    -- Environment / Science
    ARRAY['climate',          'climate,carbon,emissions,greenhouse,global warming,fossil fuel,renewable'],
    ARRAY['environment',      'environment,pollution,waste,recycling,ecosystem,biodiversity,conservation'],
    ARRAY['energy',           'energy,electricity,solar,wind power,nuclear,oil,gas,coal'],
    ARRAY['water',            'water,drought,flood,irrigation,sanitation,clean water'],
    -- Health
    ARRAY['healthcare',       'healthcare,health care,medical,hospital,insurance,medication,pharmaceutical'],
    ARRAY['mental-health',    'mental health,depression,anxiety,therapy,psychiatry'],
    ARRAY['drugs',            'drug,cannabis,marijuana,addiction,opioid,substance'],
    ARRAY['pandemic',         'pandemic,epidemic,virus,vaccine,vaccination,covid'],
    -- Education
    ARRAY['education',        'education,school,university,college,student,teacher,curriculum'],
    ARRAY['student-debt',     'student loan,student debt,tuition,college debt'],
    -- Technology
    ARRAY['ai',               'artificial intelligence,machine learning,ai,algorithm,automation'],
    ARRAY['social-media',     'social media,facebook,twitter,instagram,tiktok,platform,content moderation'],
    ARRAY['privacy',          'privacy,surveillance,data collection,tracking,personal data'],
    ARRAY['cybersecurity',    'cybersecurity,cyber,hacking,data breach,encryption'],
    ARRAY['tech-regulation',  'big tech,platform,tech company,monopoly,antitrust'],
    -- Politics / Governance
    ARRAY['democracy',        'democracy,democratic,election,voting rights,electoral,ballot'],
    ARRAY['free-speech',      'free speech,speech,censorship,expression,first amendment,hate speech'],
    ARRAY['immigration',      'immigration,immigrant,border,visa,asylum,refugee,citizenship'],
    ARRAY['foreign-policy',   'foreign policy,diplomacy,international,sanctions,nato,united nations'],
    ARRAY['military',         'military,defense,army,navy,war,conflict,nuclear,weapon'],
    ARRAY['policing',         'police,policing,law enforcement,officer,crime,criminalization'],
    ARRAY['justice',          'justice,criminal justice,prison,incarceration,sentencing,parole'],
    ARRAY['corruption',       'corruption,bribery,lobbying,dark money,transparency'],
    -- Social / Culture
    ARRAY['gender',           'gender,transgender,lgbtq,feminism,equality,discrimination,identity'],
    ARRAY['race',             'race,racial,racism,discrimination,diversity,equity,inclusion'],
    ARRAY['religion',         'religion,religious,church,faith,secular,separation'],
    ARRAY['abortion',         'abortion,reproductive,pro-life,pro-choice,planned parenthood'],
    ARRAY['guns',             'gun,firearm,weapon,shooting,second amendment,nra,arms'],
    ARRAY['welfare',          'welfare,social security,benefits,entitlement,safety net,medicare,medicaid'],
    ARRAY['labor',            'labor,worker,union,employment,unemployment,strike,collective bargaining'],
    ARRAY['media',            'media,journalism,press,news,fake news,misinformation'],
    -- Other
    ARRAY['urbanization',     'urban,city,rural,suburban,infrastructure,transit,transportation'],
    ARRAY['food',             'food,agriculture,farming,gmo,organic,hunger,nutrition'],
    ARRAY['privacy',          'privacy,data,surveillance,tracking,collection']
  ];
  entry       TEXT[];
  tag_name    TEXT;
  terms       TEXT[];
  term        TEXT;
  matched     BOOLEAN;
BEGIN
  -- Category → tag
  IF p_category IS NOT NULL THEN
    result := array_append(result, lower(p_category));
  END IF;

  -- Vocabulary scan
  FOREACH entry SLICE 1 IN ARRAY vocab LOOP
    tag_name := entry[1];
    terms    := string_to_array(entry[2], ',');
    matched  := false;

    FOREACH term IN ARRAY terms LOOP
      term := btrim(term);
      IF stmt LIKE '%' || term || '%' THEN
        matched := true;
        EXIT;
      END IF;
    END LOOP;

    IF matched AND NOT (tag_name = ANY(result)) THEN
      result := array_append(result, tag_name);
    END IF;

    -- Cap at 6 tags
    IF array_length(result, 1) >= 6 THEN
      EXIT;
    END IF;
  END LOOP;

  RETURN result;
END;
$$ LANGUAGE plpgsql IMMUTABLE;

-- ── 3. Back-fill existing topics ──────────────────────────────────────────────

UPDATE topics
SET tags = generate_topic_tags(statement, category)
WHERE array_length(tags, 1) IS NULL OR tags = '{}';

-- ── 4. Trigger: auto-tag on INSERT ───────────────────────────────────────────

CREATE OR REPLACE FUNCTION auto_tag_topic()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.tags IS NULL OR NEW.tags = '{}' THEN
    NEW.tags := generate_topic_tags(NEW.statement, NEW.category);
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS topic_auto_tag_insert ON topics;
CREATE TRIGGER topic_auto_tag_insert
  BEFORE INSERT ON topics
  FOR EACH ROW EXECUTE FUNCTION auto_tag_topic();

-- ── 5. GIN index for array containment queries ────────────────────────────────

CREATE INDEX IF NOT EXISTS topics_tags_gin
  ON topics USING GIN(tags);
