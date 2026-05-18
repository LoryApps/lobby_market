import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Style dimension keywords (shared with /api/arguments/dna) ────────────────

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

const ARCHETYPES: Record<string, { id: string; name: string; tagline: string; color: string; bg: string; border: string; badge: string }> = {
  empiricist: { id: 'empiricist', name: 'The Empiricist', tagline: 'Data speaks louder than opinion', color: 'text-for-400', bg: 'bg-for-500/10', border: 'border-for-500/40', badge: 'text-for-400 bg-for-500/15 border-for-500/30' },
  moralist:   { id: 'moralist',   name: 'The Moralist',   tagline: 'Principles before pragmatics',    color: 'text-purple',  bg: 'bg-purple/10',    border: 'border-purple/40',    badge: 'text-purple bg-purple/15 border-purple/30' },
  economist:  { id: 'economist',  name: 'The Economist',  tagline: 'Every decision has a price tag',  color: 'text-gold',    bg: 'bg-gold/10',      border: 'border-gold/40',      badge: 'text-gold bg-gold/15 border-gold/30' },
  humanist:   { id: 'humanist',   name: 'The Humanist',   tagline: 'People are the point',            color: 'text-emerald', bg: 'bg-emerald/10',   border: 'border-emerald/40',   badge: 'text-emerald bg-emerald/15 border-emerald/30' },
  visionary:  { id: 'visionary',  name: 'The Visionary',  tagline: 'Eyes on the horizon',             color: 'text-against-300', bg: 'bg-against-500/10', border: 'border-against-400/40', badge: 'text-against-300 bg-against-500/15 border-against-400/30' },
  pragmatist: { id: 'pragmatist', name: 'The Pragmatist', tagline: 'What actually works matters',     color: 'text-surface-300', bg: 'bg-surface-300/10', border: 'border-surface-400/40', badge: 'text-surface-300 bg-surface-300/15 border-surface-400/30' },
  contrarian: { id: 'contrarian', name: 'The Contrarian', tagline: 'Challenge is the point',          color: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/40', badge: 'text-against-400 bg-against-500/15 border-against-500/30' },
  advocate:   { id: 'advocate',   name: 'The Advocate',   tagline: 'Champion of the case FOR',        color: 'text-for-300',  bg: 'bg-for-500/10',   border: 'border-for-500/40',   badge: 'text-for-300 bg-for-500/15 border-for-500/30' },
}

// ─── Shared computation helpers ───────────────────────────────────────────────

function analyzeStyleScores(texts: string[]): Record<string, number> {
  const combined = texts.join(' ').toLowerCase()
  const words = combined.split(/\s+/)
  const wordSet = new Set(words)
  const scores: Record<string, number> = {}
  for (const [dim, keywords] of Object.entries(STYLE_SIGNALS)) {
    const hits = keywords.filter((k) => wordSet.has(k)).length
    scores[dim] = Math.min(100, Math.round((hits / keywords.length) * 100 * 2.5))
  }
  return scores
}

function computeArchetype(scores: Record<string, number>, forCount: number, againstCount: number): string {
  const total = forCount + againstCount
  if (total > 2) {
    if (againstCount / total > 0.75) return 'contrarian'
    if (forCount / total > 0.85) return 'advocate'
  }
  const domEntry = Object.entries(scores).reduce((a, b) => (b[1] > a[1] ? b : a), ['pragmatic', 0])
  const MAP: Record<string, string> = {
    empirical: 'empiricist', moral: 'moralist', economic: 'economist',
    social: 'humanist', visionary: 'visionary', pragmatic: 'pragmatist',
  }
  return MAP[domEntry[0]] ?? 'pragmatist'
}

// ─── Types ───────────────────────────────────────────────────────────────────

export interface DnaProfile {
  userId: string
  username: string
  displayName: string | null
  avatarUrl: string | null
  role: string
  totalArguments: number
  forCount: number
  againstCount: number
  avgUpvotes: number
  avgWordCount: number
  styleScores: Record<string, number>
  archetypeId: string
  archetypeName: string
  archetypeTagline: string
  archetypeColor: string
  archetypeBg: string
  archetypeBorder: string
  archetypeBadge: string
  topCategories: { category: string; count: number }[]
  commonTopics: { topic_id: string; statement: string }[]
}

export interface DnaCompareResponse {
  me: DnaProfile | null
  them: DnaProfile | null
  compatibilityScore: number       // 0–100, higher = more similar style
  sharedStrengths: string[]        // dimensions where both score high
  contrastingTraits: string[]      // dimensions with big difference
  commonDebateCount: number        // topics both have argued on
  platformAvg: Record<string, number>
}

// ─── Build profile for a user ─────────────────────────────────────────────────

async function buildProfile(
  supabase: Awaited<ReturnType<typeof createClient>>,
  userId: string,
  username: string,
  displayName: string | null,
  avatarUrl: string | null,
  role: string,
): Promise<DnaProfile> {
  const { data: rawArgs } = await supabase
    .from('topic_arguments')
    .select('id, topic_id, side, content, upvotes, topics!inner(statement, category)')
    .eq('user_id', userId)
    .order('upvotes', { ascending: false })
    .limit(150)

  const args = (rawArgs ?? []) as Array<{
    id: string
    topic_id: string
    side: string
    content: string
    upvotes: number
    topics: { statement: string; category: string | null } | null
  }>

  if (args.length === 0) {
    return {
      userId, username, displayName, avatarUrl, role,
      totalArguments: 0, forCount: 0, againstCount: 0,
      avgUpvotes: 0, avgWordCount: 0,
      styleScores: { empirical: 0, moral: 0, economic: 0, social: 0, visionary: 0, pragmatic: 0 },
      archetypeId: 'pragmatist',
      archetypeName: ARCHETYPES.pragmatist.name,
      archetypeTagline: ARCHETYPES.pragmatist.tagline,
      archetypeColor: ARCHETYPES.pragmatist.color,
      archetypeBg: ARCHETYPES.pragmatist.bg,
      archetypeBorder: ARCHETYPES.pragmatist.border,
      archetypeBadge: ARCHETYPES.pragmatist.badge,
      topCategories: [],
      commonTopics: [],
    }
  }

  const forCount = args.filter((a) => a.side === 'blue').length
  const againstCount = args.filter((a) => a.side === 'red').length
  const avgUpvotes = parseFloat((args.reduce((s, a) => s + a.upvotes, 0) / args.length).toFixed(1))
  const avgWordCount = Math.round(args.reduce((s, a) => s + a.content.split(/\s+/).length, 0) / args.length)

  const styleScores = analyzeStyleScores(args.map((a) => a.content))
  const archetypeId = computeArchetype(styleScores, forCount, againstCount)
  const archetype = ARCHETYPES[archetypeId] ?? ARCHETYPES.pragmatist

  // Top categories
  const catCounts: Record<string, number> = {}
  for (const a of args) {
    const cat = a.topics?.category
    if (cat) catCounts[cat] = (catCounts[cat] ?? 0) + 1
  }
  const topCategories = Object.entries(catCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([category, count]) => ({ category, count }))

  // Deduplicated topic list for overlap calculation
  const topTopics = args
    .filter((a, i, arr) => arr.findIndex((b) => b.topic_id === a.topic_id) === i)
    .slice(0, 20)
    .map((a) => ({ topic_id: a.topic_id, statement: a.topics?.statement ?? '' }))
    .filter((t) => t.statement)

  return {
    userId, username, displayName, avatarUrl, role,
    totalArguments: args.length, forCount, againstCount,
    avgUpvotes, avgWordCount, styleScores,
    archetypeId: archetype.id,
    archetypeName: archetype.name,
    archetypeTagline: archetype.tagline,
    archetypeColor: archetype.color,
    archetypeBg: archetype.bg,
    archetypeBorder: archetype.border,
    archetypeBadge: archetype.badge,
    topCategories,
    commonTopics: topTopics,
  }
}

// ─── GET /api/arguments/dna/compare?username=X ───────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { searchParams } = new URL(req.url)
  const targetUsername = (searchParams.get('username') ?? '').trim().toLowerCase()

  if (!targetUsername) {
    return NextResponse.json({ error: 'username is required' }, { status: 400 })
  }

  // Load target profile
  const { data: targetProfile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role')
    .ilike('username', targetUsername)
    .single()

  if (!targetProfile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  // Build target DNA
  const them = await buildProfile(
    supabase,
    targetProfile.id,
    targetProfile.username,
    targetProfile.display_name,
    targetProfile.avatar_url,
    targetProfile.role,
  )

  // Build current user DNA (if authenticated)
  let me: DnaProfile | null = null
  if (user && user.id !== targetProfile.id) {
    const { data: myProfile } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .eq('id', user.id)
      .single()

    if (myProfile) {
      me = await buildProfile(
        supabase,
        myProfile.id,
        myProfile.username,
        myProfile.display_name,
        myProfile.avatar_url,
        myProfile.role,
      )
    }
  }

  // Compute compatibility and shared traits
  const platformAvg: Record<string, number> = {
    empirical: 22, moral: 31, economic: 18, social: 27, visionary: 15, pragmatic: 24,
  }

  let compatibilityScore = 0
  const sharedStrengths: string[] = []
  const contrastingTraits: string[] = []
  let commonDebateCount = 0

  if (me) {
    const dims = Object.keys(platformAvg)
    let totalDiff = 0
    for (const dim of dims) {
      const myScore = me.styleScores[dim] ?? 0
      const theirScore = them.styleScores[dim] ?? 0
      const diff = Math.abs(myScore - theirScore)
      totalDiff += diff
      if (myScore >= 25 && theirScore >= 25) sharedStrengths.push(dim)
      if (diff > 30) contrastingTraits.push(dim)
    }
    // Compatibility: 100 minus average difference (0–100 scale)
    compatibilityScore = Math.max(0, Math.round(100 - (totalDiff / dims.length)))

    // Common debates — topics where both users have argued
    const myTopicIds = new Set(me.commonTopics.map((t) => t.topic_id))
    const theirTopicIds = new Set(them.commonTopics.map((t) => t.topic_id))
    for (const id of myTopicIds) {
      if (theirTopicIds.has(id)) commonDebateCount++
    }
  }

  return NextResponse.json({
    me,
    them,
    compatibilityScore,
    sharedStrengths,
    contrastingTraits,
    commonDebateCount,
    platformAvg,
  } satisfies DnaCompareResponse)
}
