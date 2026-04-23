import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TrendingArgument {
  id: string
  topic_id: string
  user_id: string
  side: 'blue' | 'red'
  content: string
  upvotes: number
  velocity: number    // upvotes per hour since creation (velocity score)
  heat: 'fire' | 'hot' | 'warm'
  created_at: string
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  } | null
}

export interface TrendingArgumentsResponse {
  for: TrendingArgument[]
  against: TrendingArgument[]
  topCategory: string | null
  generatedAt: string
}

const VALID_CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science', 'Ethics',
  'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

/**
 * GET /api/arguments/trending
 *
 * Returns the arguments with the highest upvote velocity (upvotes per hour
 * since creation) for arguments created in the last 7 days. Velocity rewards
 * newer arguments that are gaining traction faster.
 *
 * Query params:
 *   category — filter by category (optional)
 *   limit    — number per side, 1–20 (default: 10)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const rawCategory = searchParams.get('category') ?? ''
  const rawLimit = parseInt(searchParams.get('limit') ?? '10', 10)
  const limit = Math.min(20, Math.max(1, isNaN(rawLimit) ? 10 : rawLimit))

  const category = VALID_CATEGORIES.includes(rawCategory) ? rawCategory : ''

  const supabase = await createClient()

  // Fetch candidate arguments from last 7 days with upvotes > 0
  const since = new Date()
  since.setDate(since.getDate() - 7)

  const { data: rawArgs, error } = await supabase
    .from('topic_arguments')
    .select('id, topic_id, user_id, side, content, upvotes, created_at')
    .gte('created_at', since.toISOString())
    .gt('upvotes', 0)
    .order('upvotes', { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch arguments' }, { status: 500 })
  }

  const args = rawArgs ?? []

  if (args.length === 0) {
    return NextResponse.json({
      for: [],
      against: [],
      topCategory: null,
      generatedAt: new Date().toISOString(),
    } satisfies TrendingArgumentsResponse)
  }

  // Compute velocity: upvotes / max(1, hours_since_creation)
  const now = Date.now()
  const withVelocity = args.map((a) => {
    const ageMsRaw = now - new Date(a.created_at).getTime()
    const ageHours = Math.max(1, ageMsRaw / 3_600_000)
    const velocity = a.upvotes / ageHours
    return { ...a, velocity }
  })

  // Sort by velocity descending
  withVelocity.sort((a, b) => b.velocity - a.velocity)

  // Batch-fetch topics and profiles
  const topicIds = Array.from(new Set(withVelocity.map((a) => a.topic_id)))
  const userIds = Array.from(new Set(withVelocity.map((a) => a.user_id)))

  let topicsQuery = supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .in('id', topicIds)

  if (category) topicsQuery = topicsQuery.eq('category', category)

  const [topicsRes, profilesRes] = await Promise.all([
    topicsQuery,
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .in('id', userIds),
  ])

  const topicMap = new Map(
    (topicsRes.data ?? []).map((t) => [t.id, t])
  )
  const profileMap = new Map(
    (profilesRes.data ?? []).map((p) => [p.id, p])
  )

  // Filter by category at topic level and enrich
  const enriched = withVelocity
    .filter((a) => topicMap.has(a.topic_id))
    .map((a) => {
      // Assign heat tier based on velocity
      const heat: TrendingArgument['heat'] =
        a.velocity >= 2 ? 'fire' : a.velocity >= 0.5 ? 'hot' : 'warm'

      return {
        id: a.id,
        topic_id: a.topic_id,
        user_id: a.user_id,
        side: a.side as 'blue' | 'red',
        content: a.content,
        upvotes: a.upvotes,
        velocity: Math.round(a.velocity * 100) / 100,
        heat,
        created_at: a.created_at,
        author: profileMap.get(a.user_id) ?? null,
        topic: topicMap.get(a.topic_id) ?? null,
      } satisfies TrendingArgument
    })

  // Split FOR vs AGAINST
  const forArgs = enriched.filter((a) => a.side === 'blue').slice(0, limit)
  const againstArgs = enriched.filter((a) => a.side === 'red').slice(0, limit)

  // Compute the most-represented category among top results
  const catCounts = new Map<string, number>()
  for (const a of [...forArgs, ...againstArgs]) {
    const cat = a.topic?.category
    if (cat) catCounts.set(cat, (catCounts.get(cat) ?? 0) + 1)
  }
  const catEntries = Array.from(catCounts.entries())
  const topCategory =
    catEntries.length > 0
      ? catEntries.sort((a, b) => b[1] - a[1])[0][0]
      : null

  return NextResponse.json({
    for: forArgs,
    against: againstArgs,
    topCategory,
    generatedAt: new Date().toISOString(),
  } satisfies TrendingArgumentsResponse)
}
