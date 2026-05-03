import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LadderEntry {
  rank: number
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  total_upvotes: number
  argument_count: number
  topics_covered: number
  specialty_category: string | null
  best_argument: {
    id: string
    content: string
    side: 'blue' | 'red'
    upvotes: number
    topic_id: string
    topic_statement: string
    topic_category: string | null
  } | null
  for_upvotes: number
  against_upvotes: number
}

export interface LadderResponse {
  entries: LadderEntry[]
  total: number
  period: string
  category: string
  side: string
}

// ─── Valid params ─────────────────────────────────────────────────────────────

const VALID_PERIODS = ['all', 'month', 'week'] as const
const VALID_SIDES = ['all', 'for', 'against'] as const
const VALID_CATEGORIES = [
  'all',
  'Politics',
  'Economics',
  'Technology',
  'Science',
  'Ethics',
  'Philosophy',
  'Culture',
  'Health',
  'Environment',
  'Education',
] as const

type Period = (typeof VALID_PERIODS)[number]
type Side = (typeof VALID_SIDES)[number]

function isValid<T extends string>(arr: readonly T[], val: string): val is T {
  return (arr as readonly string[]).includes(val)
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const rawPeriod = searchParams.get('period') ?? 'all'
  const rawSide = searchParams.get('side') ?? 'all'
  const rawCategory = searchParams.get('category') ?? 'all'
  const limit = Math.min(Math.max(1, parseInt(searchParams.get('limit') ?? '50', 10)), 100)

  const period: Period = isValid(VALID_PERIODS, rawPeriod) ? rawPeriod : 'all'
  const side: Side = isValid(VALID_SIDES, rawSide) ? rawSide : 'all'
  const category = isValid(VALID_CATEGORIES, rawCategory) ? rawCategory : 'all'

  const supabase = await createClient()

  // ── Date filter ──────────────────────────────────────────────────────────
  let sinceDate: string | null = null
  if (period === 'week') {
    const d = new Date()
    d.setDate(d.getDate() - 7)
    sinceDate = d.toISOString()
  } else if (period === 'month') {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    sinceDate = d.toISOString()
  }

  // ── Query arguments with topic category ──────────────────────────────────
  let query = supabase
    .from('topic_arguments')
    .select(
      `
      id,
      topic_id,
      user_id,
      side,
      content,
      upvotes,
      created_at,
      topics!inner(id, statement, category)
    `
    )
    .gt('upvotes', 0)

  if (sinceDate) {
    query = query.gte('created_at', sinceDate)
  }
  if (side === 'for') {
    query = query.eq('side', 'blue')
  } else if (side === 'against') {
    query = query.eq('side', 'red')
  }
  if (category !== 'all') {
    query = query.eq('topics.category', category)
  }

  const { data: argRows, error } = await query.order('upvotes', { ascending: false }).limit(2000)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = (argRows ?? []) as Array<{
    id: string
    topic_id: string
    user_id: string
    side: 'blue' | 'red'
    content: string
    upvotes: number
    created_at: string
    topics: { id: string; statement: string; category: string | null }
  }>

  // ── Aggregate by user ─────────────────────────────────────────────────────
  const userMap = new Map<
    string,
    {
      total_upvotes: number
      argument_count: number
      topic_ids: Set<string>
      category_upvotes: Map<string, number>
      for_upvotes: number
      against_upvotes: number
      best_argument: {
        id: string
        content: string
        side: 'blue' | 'red'
        upvotes: number
        topic_id: string
        topic_statement: string
        topic_category: string | null
      } | null
    }
  >()

  for (const row of rows) {
    if (!userMap.has(row.user_id)) {
      userMap.set(row.user_id, {
        total_upvotes: 0,
        argument_count: 0,
        topic_ids: new Set(),
        category_upvotes: new Map(),
        for_upvotes: 0,
        against_upvotes: 0,
        best_argument: null,
      })
    }
    const u = userMap.get(row.user_id)!
    u.total_upvotes += row.upvotes
    u.argument_count += 1
    u.topic_ids.add(row.topic_id)

    if (row.side === 'blue') u.for_upvotes += row.upvotes
    else u.against_upvotes += row.upvotes

    const cat = row.topics?.category ?? 'Unknown'
    u.category_upvotes.set(cat, (u.category_upvotes.get(cat) ?? 0) + row.upvotes)

    if (!u.best_argument || row.upvotes > u.best_argument.upvotes) {
      u.best_argument = {
        id: row.id,
        content: row.content,
        side: row.side,
        upvotes: row.upvotes,
        topic_id: row.topic_id,
        topic_statement: row.topics?.statement ?? '',
        topic_category: row.topics?.category ?? null,
      }
    }
  }

  // Sort by total upvotes
  const sorted = [...userMap.entries()]
    .sort(([, a], [, b]) => b.total_upvotes - a.total_upvotes)
    .slice(0, limit)

  if (sorted.length === 0) {
    return NextResponse.json({
      entries: [],
      total: 0,
      period,
      category,
      side,
    } satisfies LadderResponse)
  }

  // ── Fetch profiles ────────────────────────────────────────────────────────
  const userIds = sorted.map(([id]) => id)
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role')
    .in('id', userIds)

  const profileMap = new Map(
    (profiles ?? []).map((p) => [
      p.id,
      p as {
        id: string
        username: string
        display_name: string | null
        avatar_url: string | null
        role: string
      },
    ])
  )

  const entries: LadderEntry[] = sorted
    .map(([userId, stats], idx) => {
      const profile = profileMap.get(userId)
      if (!profile) return null

      // Find specialty (category with most upvotes)
      let specialty: string | null = null
      let maxCatUpvotes = 0
      for (const [cat, upvotes] of stats.category_upvotes) {
        if (upvotes > maxCatUpvotes) {
          maxCatUpvotes = upvotes
          specialty = cat
        }
      }

      return {
        rank: idx + 1,
        user_id: userId,
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        role: profile.role,
        total_upvotes: stats.total_upvotes,
        argument_count: stats.argument_count,
        topics_covered: stats.topic_ids.size,
        specialty_category: specialty,
        best_argument: stats.best_argument,
        for_upvotes: stats.for_upvotes,
        against_upvotes: stats.against_upvotes,
      } satisfies LadderEntry
    })
    .filter((e): e is LadderEntry => e !== null)

  return NextResponse.json({
    entries,
    total: userMap.size,
    period,
    category,
    side,
  } satisfies LadderResponse)
}
