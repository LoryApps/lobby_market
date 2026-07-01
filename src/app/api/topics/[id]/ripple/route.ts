import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type RippleRelation = 'reinforces' | 'contradicts' | 'extends' | 'requires' | 'competes'

export interface RippleLaw {
  id: string
  statement: string
  category: string | null
  blue_pct: number
  established_at: string | null
  relation: RippleRelation
  relation_reason: string
}

export interface RippleTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  relation: RippleRelation
  relation_reason: string
}

export interface RippleResponse {
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
    scope: string
  }
  if_passes: {
    laws_reinforced: RippleLaw[]
    laws_contradicted: RippleLaw[]
    topics_enabled: RippleTopic[]
    topics_undermined: RippleTopic[]
  }
  if_fails: {
    topics_blocked: RippleTopic[]
    laws_preserved: RippleLaw[]
  }
  cascade_depth: number
  ecosystem_impact_score: number
}

// ─── Keyword extraction ───────────────────────────────────────────────────────

function extractKeywords(statement: string): string[] {
  const stopWords = new Set([
    'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
    'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
    'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would', 'should',
    'could', 'may', 'might', 'must', 'shall', 'can', 'that', 'this', 'these',
    'those', 'it', 'its', 'their', 'they', 'we', 'our', 'all', 'any', 'not',
    'no', 'nor', 'so', 'yet', 'both', 'either', 'neither', 'each', 'every',
    'more', 'most', 'other', 'into', 'through', 'during', 'before', 'after',
    'above', 'below', 'between', 'under', 'over', 'out', 'up', 'down',
    'than', 'then', 'when', 'where', 'who', 'which', 'what', 'how', 'if',
    'because', 'as', 'while', 'about', 'against', 'without', 'within', 'he',
    'she', 'him', 'her', 'his', 'your', 'my', 'me', 'us', 'them', 'upon',
    'such', 'being', 'having', 'there', 'here', 'across', 'along', 'among',
  ])

  return statement
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 3 && !stopWords.has(w))
    .slice(0, 12)
}

// ─── Relation inference ───────────────────────────────────────────────────────

function inferRelation(
  sourceStatement: string,
  targetStatement: string,
  sharedKeywords: string[],
): { relation: RippleRelation; reason: string } {
  const src = sourceStatement.toLowerCase()
  const tgt = targetStatement.toLowerCase()

  const requiresPatterns = [
    ['fund', 'tax'], ['require', 'enforce'], ['mandate', 'fund'],
    ['expand', 'increase'], ['create', 'staff'],
  ]
  const contradictPatterns = [
    ['ban', 'allow'], ['prohibit', 'permit'], ['restrict', 'expand'],
    ['reduce', 'increase'], ['end', 'extend'], ['abolish', 'maintain'],
    ['repeal', 'preserve'], ['defund', 'fund'],
  ]
  const extendsPatterns = [
    ['expand', 'increase'], ['extend', 'broaden'], ['strengthen', 'enhance'],
    ['improve', 'reform'],
  ]

  for (const [a, b] of contradictPatterns) {
    if ((src.includes(a) && tgt.includes(b)) || (src.includes(b) && tgt.includes(a))) {
      return { relation: 'contradicts', reason: `Opposing positions on ${sharedKeywords[0] ?? 'the same issue'}` }
    }
  }

  for (const [a, b] of requiresPatterns) {
    if (src.includes(a) && tgt.includes(b)) {
      return { relation: 'requires', reason: `This policy would depend on ${sharedKeywords[0] ?? 'related infrastructure'}` }
    }
  }

  for (const [a, b] of extendsPatterns) {
    if ((src.includes(a) || src.includes(b)) && sharedKeywords.length > 1) {
      return { relation: 'extends', reason: `Builds on the same policy area — ${sharedKeywords.slice(0, 2).join(', ')}` }
    }
  }

  if (sharedKeywords.length >= 3) {
    return { relation: 'reinforces', reason: `Shares key themes: ${sharedKeywords.slice(0, 3).join(', ')}` }
  }

  return { relation: 'competes', reason: `Competes for civic attention in ${sharedKeywords[0] ?? 'the same space'}` }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(
  _request: Request,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()

  const { data: topicRow } = await supabase
    .from('topics')
    .select('id, statement, category, scope, status, blue_pct, total_votes')
    .eq('id', params.id)
    .maybeSingle()

  if (!topicRow) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  const topic = topicRow as {
    id: string; statement: string; category: string | null; scope: string
    status: string; blue_pct: number; total_votes: number
  }

  const keywords = extractKeywords(topic.statement)

  // ── Fetch candidate laws ──────────────────────────────────────────────────
  type LawRow = { id: string; statement: string; category: string | null; blue_pct: number; established_at: string | null }
  const { data: rawLaws } = await supabase
    .from('topics')
    .select('id, statement, category, blue_pct, established_at:updated_at')
    .eq('status', 'law')
    .neq('id', topic.id)
    .order('updated_at', { ascending: false })
    .limit(200)

  const laws = (rawLaws ?? []) as LawRow[]

  // ── Fetch candidate active/voting topics ────────────────────────────────
  type ActiveRow = { id: string; statement: string; category: string | null; status: string; blue_pct: number; total_votes: number }
  const { data: rawTopics } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .in('status', ['proposed', 'active', 'voting'])
    .neq('id', topic.id)
    .order('total_votes', { ascending: false })
    .limit(200)

  const activeTopics = (rawTopics ?? []) as ActiveRow[]

  // ── Score and classify laws ──────────────────────────────────────────────
  const scoredLaws = laws
    .map((law) => {
      const lawKws = extractKeywords(law.statement)
      const shared = keywords.filter((k) => lawKws.includes(k))
      const categoryMatch = topic.category && law.category === topic.category ? 2 : 0
      const score = shared.length + categoryMatch
      return { law, shared, score }
    })
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 12)

  // ── Score and classify active topics ────────────────────────────────────
  const scoredTopics = activeTopics
    .map((t) => {
      const tKws = extractKeywords(t.statement)
      const shared = keywords.filter((k) => tKws.includes(k))
      const categoryMatch = topic.category && t.category === topic.category ? 2 : 0
      const score = shared.length + categoryMatch
      return { topic: t, shared, score }
    })
    .filter((x) => x.score >= 2)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10)

  // ── Classify each related law ───────────────────────────────────────────
  const rippleLaws: RippleLaw[] = scoredLaws.map(({ law, shared }) => {
    const { relation, reason } = inferRelation(topic.statement, law.statement, shared)
    return {
      id: law.id,
      statement: law.statement,
      category: law.category,
      blue_pct: law.blue_pct,
      established_at: law.established_at,
      relation,
      relation_reason: reason,
    }
  })

  // ── Classify each related active topic ─────────────────────────────────
  const rippleTopics: RippleTopic[] = scoredTopics.map(({ topic: t, shared }) => {
    const { relation, reason } = inferRelation(topic.statement, t.statement, shared)
    return {
      id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
      blue_pct: t.blue_pct,
      total_votes: t.total_votes,
      relation,
      relation_reason: reason,
    }
  })

  // ── Partition results ───────────────────────────────────────────────────
  const reinforcedLaws   = rippleLaws.filter((l) => l.relation === 'reinforces' || l.relation === 'extends' || l.relation === 'requires')
  const contradictedLaws = rippleLaws.filter((l) => l.relation === 'contradicts' || l.relation === 'competes')
  const enabledTopics    = rippleTopics.filter((t) => t.relation === 'reinforces' || t.relation === 'extends')
  const underminedTopics = rippleTopics.filter((t) => t.relation === 'contradicts' || t.relation === 'competes')
  const blockedTopics    = rippleTopics.filter((t) => t.relation === 'contradicts')
  const preservedLaws    = rippleLaws.filter((l) => l.relation === 'contradicts')

  // ── Ecosystem impact score ──────────────────────────────────────────────
  const ecosystemImpactScore = Math.min(
    100,
    Math.round(
      rippleLaws.length * 8 +
      rippleTopics.length * 5 +
      contradictedLaws.length * 3 +
      (topic.total_votes / 100),
    ),
  )

  const response: RippleResponse = {
    topic: {
      id: topic.id,
      statement: topic.statement,
      category: topic.category,
      status: topic.status,
      blue_pct: topic.blue_pct,
      total_votes: topic.total_votes,
      scope: topic.scope,
    },
    if_passes: {
      laws_reinforced:  reinforcedLaws.slice(0, 6),
      laws_contradicted: contradictedLaws.slice(0, 4),
      topics_enabled:   enabledTopics.slice(0, 5),
      topics_undermined: underminedTopics.slice(0, 4),
    },
    if_fails: {
      topics_blocked:  blockedTopics.slice(0, 4),
      laws_preserved:  preservedLaws.slice(0, 4),
    },
    cascade_depth: Math.min(3, Math.ceil(rippleLaws.length / 4)),
    ecosystem_impact_score: ecosystemImpactScore,
  }

  return NextResponse.json(response)
}
