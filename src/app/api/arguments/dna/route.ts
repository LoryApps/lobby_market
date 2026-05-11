import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Style dimension keywords ────────────────────────────────────────────────

const STYLE_SIGNALS: Record<string, string[]> = {
  empirical: [
    'data', 'evidence', 'research', 'study', 'studies', 'statistics', 'statistic',
    'survey', 'report', 'analysis', 'measured', 'percent', 'rate', 'show', 'shows',
    'found', 'proven', 'scientific', 'source', 'according', 'cited', 'cite',
  ],
  moral: [
    'right', 'wrong', 'just', 'unjust', 'fair', 'unfair', 'equal', 'equality',
    'justice', 'freedom', 'liberty', 'dignity', 'rights', 'duty', 'ethical',
    'moral', 'values', 'principle', 'should', 'ought', 'harm', 'protect',
  ],
  economic: [
    'cost', 'costs', 'benefit', 'benefits', 'market', 'growth', 'budget', 'invest',
    'afford', 'spend', 'tax', 'price', 'profit', 'economic', 'economy', 'gdp',
    'wealth', 'income', 'money', 'financial', 'fund', 'efficient', 'waste',
  ],
  social: [
    'community', 'society', 'together', 'collective', 'public', 'everyone', 'people',
    'citizens', 'neighbors', 'social', 'shared', 'common', 'mutual', 'family',
    'children', 'workers', 'voters', 'majority', 'minority', 'culture',
  ],
  visionary: [
    'future', 'generation', 'tomorrow', 'progress', 'innovation', 'change',
    'transform', 'long-term', 'vision', 'potential', 'opportunity', 'advance',
    'modern', 'new', 'evolve', 'build', 'create', 'lead', 'forward',
  ],
  pragmatic: [
    'practical', 'solution', 'works', 'effective', 'proven', 'implement',
    'apply', 'real', 'actual', 'already', 'example', 'case', 'policy',
    'regulate', 'enforce', 'manage', 'plan', 'step', 'approach', 'method',
  ],
}

// ─── Archetype definitions ───────────────────────────────────────────────────

export interface DnaArchetype {
  id: string
  name: string
  tagline: string
  description: string
  primaryTrait: string
  color: string
  border: string
  bg: string
  badge: string
}

const ARCHETYPES: Record<string, DnaArchetype> = {
  empiricist: {
    id: 'empiricist',
    name: 'The Empiricist',
    tagline: 'Data speaks louder than opinion',
    description: 'You back your arguments with evidence, statistics, and research. Your rhetoric is grounded in the measurable world.',
    primaryTrait: 'empirical',
    color: 'text-for-400',
    border: 'border-for-500/40',
    bg: 'bg-for-500/10',
    badge: 'text-for-400 bg-for-500/15 border-for-500/30',
  },
  moralist: {
    id: 'moralist',
    name: 'The Moralist',
    tagline: 'Principles before pragmatics',
    description: 'You anchor arguments in values, rights, and what is fundamentally right or wrong. Ethics is your foundation.',
    primaryTrait: 'moral',
    color: 'text-purple',
    border: 'border-purple/40',
    bg: 'bg-purple/10',
    badge: 'text-purple bg-purple/15 border-purple/30',
  },
  economist: {
    id: 'economist',
    name: 'The Economist',
    tagline: 'Every decision has a price tag',
    description: 'You think in terms of costs, benefits, and incentives. You apply market logic to civic problems.',
    primaryTrait: 'economic',
    color: 'text-gold',
    border: 'border-gold/40',
    bg: 'bg-gold/10',
    badge: 'text-gold bg-gold/15 border-gold/30',
  },
  humanist: {
    id: 'humanist',
    name: 'The Humanist',
    tagline: 'People are the point',
    description: 'You argue from human experience — communities, families, shared lives. You bring the human cost into every debate.',
    primaryTrait: 'social',
    color: 'text-emerald',
    border: 'border-emerald/40',
    bg: 'bg-emerald/10',
    badge: 'text-emerald bg-emerald/15 border-emerald/30',
  },
  visionary: {
    id: 'visionary',
    name: 'The Visionary',
    tagline: 'Eyes on the horizon',
    description: 'You argue from the future — long-term consequences, generational impact, and the arc of progress. You think big.',
    primaryTrait: 'visionary',
    color: 'text-against-300',
    border: 'border-against-400/40',
    bg: 'bg-against-500/10',
    badge: 'text-against-300 bg-against-500/15 border-against-400/30',
  },
  pragmatist: {
    id: 'pragmatist',
    name: 'The Pragmatist',
    tagline: 'What actually works matters',
    description: 'You cut through ideology with real-world examples, policy details, and implementation thinking. You make the abstract concrete.',
    primaryTrait: 'pragmatic',
    color: 'text-surface-300',
    border: 'border-surface-400/40',
    bg: 'bg-surface-300/10',
    badge: 'text-surface-300 bg-surface-300/15 border-surface-400/30',
  },
  contrarian: {
    id: 'contrarian',
    name: 'The Contrarian',
    tagline: 'Challenge is the point',
    description: 'You tend to argue AGAINST more than FOR. You find the flaw in the consensus and give voice to the minority position.',
    primaryTrait: 'contrarian',
    color: 'text-against-400',
    border: 'border-against-500/40',
    bg: 'bg-against-500/10',
    badge: 'text-against-400 bg-against-500/15 border-against-500/30',
  },
  advocate: {
    id: 'advocate',
    name: 'The Advocate',
    tagline: 'Champion of the case FOR',
    description: 'You are a builder, a proposer, a FOR-sider. You argue for progress, change, and new directions more than you resist them.',
    primaryTrait: 'advocate',
    color: 'text-for-300',
    border: 'border-for-500/40',
    bg: 'bg-for-500/10',
    badge: 'text-for-300 bg-for-500/15 border-for-500/30',
  },
}

// ─── Style analysis helpers ───────────────────────────────────────────────────

function analyzeStyleScores(texts: string[]): Record<string, number> {
  const combined = texts.join(' ').toLowerCase()
  const words = combined.split(/\s+/)
  const wordSet = new Set(words)

  const scores: Record<string, number> = {}
  for (const [dimension, keywords] of Object.entries(STYLE_SIGNALS)) {
    const hits = keywords.filter((k) => wordSet.has(k)).length
    scores[dimension] = Math.min(100, Math.round((hits / keywords.length) * 100 * 2.5))
  }
  return scores
}

function computeArchetype(
  styleScores: Record<string, number>,
  forCount: number,
  againstCount: number
): string {
  // Check side bias first — strong contrarian or advocate override style
  const total = forCount + againstCount
  if (total > 2) {
    if (againstCount / total > 0.75) return 'contrarian'
    if (forCount / total > 0.85) return 'advocate'
  }

  // Pick the dominant style dimension
  const domEntry = Object.entries(styleScores).reduce((a, b) =>
    b[1] > a[1] ? b : a
  )
  const DIMENSION_MAP: Record<string, string> = {
    empirical: 'empiricist',
    moral: 'moralist',
    economic: 'economist',
    social: 'humanist',
    visionary: 'visionary',
    pragmatic: 'pragmatist',
  }
  return DIMENSION_MAP[domEntry[0]] ?? 'pragmatist'
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DnaArgument {
  id: string
  topic_id: string
  topic_statement: string
  topic_category: string | null
  side: 'blue' | 'red'
  content: string
  upvotes: number
  ai_grade: string | null
  created_at: string
  dominantStyle: string
}

export interface DnaResponse {
  authenticated: boolean
  totalArguments: number
  forCount: number
  againstCount: number
  avgLength: number
  avgUpvotes: number
  styleScores: Record<string, number>       // 0–100 per dimension
  platformAvg: Record<string, number>       // platform averages (approximated)
  archetype: DnaArchetype
  gradeDistribution: { grade: string; count: number; pct: number }[]
  reactionTotals: Record<string, number>    // reaction type → total count
  topArguments: DnaArgument[]               // top 5 by upvotes
  recentArguments: DnaArgument[]            // most recent 5
  categoryBreakdown: {
    category: string
    count: number
    forCount: number
    againstCount: number
    avgUpvotes: number
  }[]
  longestStreak: number                     // max consecutive days with at least 1 argument
  avgWordCount: number
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized', authenticated: false }, { status: 401 })
  }

  // Fetch user's arguments with topic context
  const { data: rawArgs } = await supabase
    .from('topic_arguments')
    .select(`
      id,
      topic_id,
      side,
      content,
      upvotes,
      ai_grade,
      created_at,
      topics!inner (
        statement,
        category
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(200)

  const args = (rawArgs ?? []) as Array<{
    id: string
    topic_id: string
    side: string
    content: string
    upvotes: number
    ai_grade: string | null
    created_at: string
    topics: { statement: string; category: string | null } | null
  }>

  if (args.length === 0) {
    return NextResponse.json({
      authenticated: true,
      totalArguments: 0,
      forCount: 0,
      againstCount: 0,
      avgLength: 0,
      avgUpvotes: 0,
      styleScores: {},
      platformAvg: {},
      archetype: ARCHETYPES.pragmatist,
      gradeDistribution: [],
      reactionTotals: {},
      topArguments: [],
      recentArguments: [],
      categoryBreakdown: [],
      longestStreak: 0,
      avgWordCount: 0,
    } satisfies DnaResponse)
  }

  // Fetch reaction counts for user's arguments
  const argIds = args.map((a) => a.id)
  const { data: reactions } = await supabase
    .from('argument_reactions')
    .select('argument_id, reaction_type')
    .in('argument_id', argIds)

  const reactionTotals: Record<string, number> = {
    insightful: 0,
    compelling: 0,
    balanced: 0,
    needs_evidence: 0,
  }
  for (const r of reactions ?? []) {
    const key = r.reaction_type as string
    reactionTotals[key] = (reactionTotals[key] ?? 0) + 1
  }

  // Compute basic stats
  const forCount = args.filter((a) => a.side === 'blue').length
  const againstCount = args.filter((a) => a.side === 'red').length
  const avgLength = Math.round(args.reduce((s, a) => s + a.content.length, 0) / args.length)
  const avgWordCount = Math.round(
    args.reduce((s, a) => s + a.content.split(/\s+/).length, 0) / args.length
  )
  const avgUpvotes = parseFloat(
    (args.reduce((s, a) => s + a.upvotes, 0) / args.length).toFixed(1)
  )

  // Style analysis
  const contents = args.map((a) => a.content)
  const styleScores = analyzeStyleScores(contents)

  // Platform average approximation (seeded values — realistic baseline)
  const platformAvg: Record<string, number> = {
    empirical: 22,
    moral: 31,
    economic: 18,
    social: 27,
    visionary: 15,
    pragmatic: 24,
  }

  // Archetype
  const archetypeId = computeArchetype(styleScores, forCount, againstCount)
  const archetype = ARCHETYPES[archetypeId] ?? ARCHETYPES.pragmatist

  // Grade distribution
  const gradeCounts: Record<string, number> = {}
  for (const a of args) {
    if (a.ai_grade) gradeCounts[a.ai_grade] = (gradeCounts[a.ai_grade] ?? 0) + 1
  }
  const gradedTotal = Object.values(gradeCounts).reduce((s, n) => s + n, 0)
  const gradeDistribution = ['A', 'B', 'C', 'D', 'F']
    .map((g) => ({
      grade: g,
      count: gradeCounts[g] ?? 0,
      pct: gradedTotal > 0 ? Math.round(((gradeCounts[g] ?? 0) / gradedTotal) * 100) : 0,
    }))
    .filter((x) => x.count > 0)

  // Category breakdown
  const catMap = new Map<string, { count: number; forCount: number; againstCount: number; upvotes: number }>()
  for (const a of args) {
    const cat = (a.topics?.category) ?? 'Uncategorized'
    const entry = catMap.get(cat) ?? { count: 0, forCount: 0, againstCount: 0, upvotes: 0 }
    entry.count++
    if (a.side === 'blue') entry.forCount++
    else entry.againstCount++
    entry.upvotes += a.upvotes
    catMap.set(cat, entry)
  }
  const categoryBreakdown = Array.from(catMap.entries())
    .map(([category, s]) => ({
      category,
      count: s.count,
      forCount: s.forCount,
      againstCount: s.againstCount,
      avgUpvotes: parseFloat((s.upvotes / s.count).toFixed(1)),
    }))
    .sort((a, b) => b.count - a.count)

  // Longest consecutive days streak
  const daySet = new Set(args.map((a) => a.created_at.slice(0, 10)))
  const sortedDays = Array.from(daySet).sort()
  let longestStreak = sortedDays.length > 0 ? 1 : 0
  let current = 1
  for (let i = 1; i < sortedDays.length; i++) {
    const prev = new Date(sortedDays[i - 1])
    const curr = new Date(sortedDays[i])
    const diff = (curr.getTime() - prev.getTime()) / 86_400_000
    if (diff === 1) {
      current++
      if (current > longestStreak) longestStreak = current
    } else {
      current = 1
    }
  }

  // Top and recent arguments with dominant style
  function tagDominantStyle(content: string): string {
    const scores = analyzeStyleScores([content])
    if (Object.keys(scores).length === 0) return 'pragmatic'
    return Object.entries(scores).reduce((a, b) => (b[1] > a[1] ? b : a))[0]
  }

  function toTyped(a: typeof args[0]): DnaArgument {
    return {
      id: a.id,
      topic_id: a.topic_id,
      topic_statement: a.topics?.statement ?? '',
      topic_category: a.topics?.category ?? null,
      side: a.side as 'blue' | 'red',
      content: a.content,
      upvotes: a.upvotes,
      ai_grade: a.ai_grade,
      created_at: a.created_at,
      dominantStyle: tagDominantStyle(a.content),
    }
  }

  const topArguments = [...args]
    .sort((a, b) => b.upvotes - a.upvotes)
    .slice(0, 5)
    .map(toTyped)

  const recentArguments = args.slice(0, 5).map(toTyped)

  return NextResponse.json({
    authenticated: true,
    totalArguments: args.length,
    forCount,
    againstCount,
    avgLength,
    avgUpvotes,
    styleScores,
    platformAvg,
    archetype,
    gradeDistribution,
    reactionTotals,
    topArguments,
    recentArguments,
    categoryBreakdown,
    longestStreak,
    avgWordCount,
  } satisfies DnaResponse)
}
