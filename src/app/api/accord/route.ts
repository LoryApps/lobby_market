import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface AccordTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  // The side that won (the direction of the accord)
  accord_side: 'for' | 'against'
  // How strong the agreement is (distance from 50%, scaled 0–100)
  accord_strength: number
  // Mandate: normalised score of votes × strength (higher = broader & stronger mandate)
  mandate_score: number
  // The most-upvoted argument on the winning side (if available)
  top_argument: {
    id: string
    content: string
    upvotes: number
    author_username: string | null
    author_display_name: string | null
  } | null
}

export interface AccordCategory {
  category: string
  accord_count: number
  avg_strength: number
  total_votes: number
  for_accords: number
  against_accords: number
}

export interface AccordResponse {
  topics: AccordTopic[]
  byCategory: AccordCategory[]
  totalAccords: number
  avgStrength: number
  strongestAccord: AccordTopic | null
  broadestAccord: AccordTopic | null
  // Platform-wide accord stats
  stats: {
    superMajorityCount: number   // ≥ 85%
    unanimousCount: number       // ≥ 95%
    forAccords: number
    againstAccords: number
    totalVotesCast: number
  }
  generatedAt: string
}

const ACCORD_THRESHOLD = 0.80  // topics must be ≥ 80% on one side
const MIN_VOTES = 10            // minimum votes to qualify

const VALID_CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category') ?? 'all'
  const sortBy = searchParams.get('sort') ?? 'strength' // strength | votes | mandate
  const statusFilter = searchParams.get('status') ?? 'any' // any | active | law

  const supabase = await createClient()

  // ── 1. Fetch topics with high one-sided vote splits ───────────────────────

  let query = supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .gte('total_votes', MIN_VOTES)
    .not('status', 'eq', 'proposed')  // must have meaningful votes
    .order('total_votes', { ascending: false })
    .limit(2000)

  if (statusFilter === 'active') {
    query = query.in('status', ['active', 'voting'])
  } else if (statusFilter === 'law') {
    query = query.eq('status', 'law')
  }

  if (category !== 'all' && VALID_CATEGORIES.includes(category)) {
    query = query.eq('category', category)
  }

  const { data: topicRows, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // ── 2. Filter to accord topics (≥80% on either side) ──────────────────────

  const accordTopics: AccordTopic[] = []

  for (const t of topicRows ?? []) {
    const forPct = t.blue_pct ?? 50
    const againstPct = 100 - forPct

    const isForAccord = forPct >= ACCORD_THRESHOLD * 100
    const isAgainstAccord = againstPct >= ACCORD_THRESHOLD * 100

    if (!isForAccord && !isAgainstAccord) continue

    const accordSide = isForAccord ? 'for' : 'against'
    const winningSidePct = isForAccord ? forPct : againstPct
    // Strength: how far past 50% is the winning side, scaled to 0–100
    const accordStrength = Math.min(100, ((winningSidePct - 50) / 50) * 100)
    // Mandate: geometric mean of votes and strength (rewards both broad AND strong mandates)
    const mandateScore = Math.sqrt(t.total_votes) * (accordStrength / 100)

    accordTopics.push({
      id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
      blue_pct: forPct,
      total_votes: t.total_votes ?? 0,
      accord_side: accordSide,
      accord_strength: Math.round(accordStrength),
      mandate_score: mandateScore,
      top_argument: null,
    })
  }

  // ── 3. Sort ────────────────────────────────────────────────────────────────

  accordTopics.sort((a, b) => {
    if (sortBy === 'votes') return b.total_votes - a.total_votes
    if (sortBy === 'mandate') return b.mandate_score - a.mandate_score
    return b.accord_strength - a.accord_strength
  })

  const topSlice = accordTopics.slice(0, 50)

  // ── 4. Enrich top 50 with top arguments ───────────────────────────────────

  if (topSlice.length > 0) {
    const topicIds = topSlice.map((t) => t.id)

    const { data: argRows } = await supabase
      .from('topic_arguments')
      .select(`
        id,
        topic_id,
        side,
        content,
        upvotes,
        profiles:user_id ( username, display_name )
      `)
      .in('topic_id', topicIds)
      .order('upvotes', { ascending: false })
      .limit(200)

    if (argRows) {
      // Group by topic, keep top arg on accord side
      const argByTopic = new Map<string, typeof argRows[number]>()
      for (const arg of argRows) {
        const topic = topSlice.find((t) => t.id === arg.topic_id)
        if (!topic) continue
        const wantedSide = topic.accord_side === 'for' ? 'blue' : 'red'
        if (arg.side !== wantedSide) continue
        if (!argByTopic.has(arg.topic_id)) {
          argByTopic.set(arg.topic_id, arg)
        }
      }

      for (const topic of topSlice) {
        const arg = argByTopic.get(topic.id)
        if (!arg) continue
        const profile = Array.isArray(arg.profiles) ? arg.profiles[0] : arg.profiles
        topic.top_argument = {
          id: arg.id,
          content: arg.content,
          upvotes: arg.upvotes ?? 0,
          author_username: profile?.username ?? null,
          author_display_name: profile?.display_name ?? null,
        }
      }
    }
  }

  // ── 5. Category breakdown ─────────────────────────────────────────────────

  const catMap = new Map<string, AccordCategory>()
  for (const t of accordTopics) {
    const cat = t.category ?? 'Other'
    const existing = catMap.get(cat)
    if (existing) {
      existing.accord_count++
      existing.avg_strength = (existing.avg_strength * (existing.accord_count - 1) + t.accord_strength) / existing.accord_count
      existing.total_votes += t.total_votes
      if (t.accord_side === 'for') existing.for_accords++
      else existing.against_accords++
    } else {
      catMap.set(cat, {
        category: cat,
        accord_count: 1,
        avg_strength: t.accord_strength,
        total_votes: t.total_votes,
        for_accords: t.accord_side === 'for' ? 1 : 0,
        against_accords: t.accord_side === 'against' ? 1 : 0,
      })
    }
  }

  const byCategory = Array.from(catMap.values()).sort((a, b) => b.accord_count - a.accord_count)

  // ── 6. Platform-wide stats ────────────────────────────────────────────────

  const superMajorityCount = accordTopics.filter((t) => t.accord_strength >= 70).length   // ≥85%
  const unanimousCount = accordTopics.filter((t) => t.accord_strength >= 90).length        // ≥95%
  const forAccords = accordTopics.filter((t) => t.accord_side === 'for').length
  const againstAccords = accordTopics.filter((t) => t.accord_side === 'against').length
  const totalVotesCast = accordTopics.reduce((s, t) => s + t.total_votes, 0)
  const avgStrength = accordTopics.length
    ? accordTopics.reduce((s, t) => s + t.accord_strength, 0) / accordTopics.length
    : 0

  const strongestAccord = accordTopics.reduce<AccordTopic | null>(
    (best, t) => (!best || t.accord_strength > best.accord_strength ? t : best),
    null,
  )
  const broadestAccord = accordTopics.reduce<AccordTopic | null>(
    (best, t) => (!best || t.total_votes > best.total_votes ? t : best),
    null,
  )

  const response: AccordResponse = {
    topics: topSlice,
    byCategory,
    totalAccords: accordTopics.length,
    avgStrength: Math.round(avgStrength),
    strongestAccord,
    broadestAccord,
    stats: {
      superMajorityCount,
      unanimousCount,
      forAccords,
      againstAccords,
      totalVotesCast,
    },
    generatedAt: new Date().toISOString(),
  }

  return NextResponse.json(response, {
    headers: {
      'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
    },
  })
}
