import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type VelocityLabel =
  | 'evergreen'    // old argument still earning upvotes at a consistent rate
  | 'surging'      // recent argument gaining fast
  | 'peaked'       // strong burst early, now quiet
  | 'steady'       // consistent moderate pace
  | 'dormant'      // old with low velocity

export interface VelocityArgument {
  id: string
  topic_id: string
  statement: string
  category: string | null
  side: 'blue' | 'red'
  content: string
  upvotes: number
  reply_count: number
  age_days: number
  velocity: number        // upvotes per day (rounded to 2dp)
  label: VelocityLabel
  topic_status: string
  created_at: string
}

export interface VelocityCategory {
  category: string
  arguments: number
  avg_velocity: number
  total_upvotes: number
  avg_upvotes: number
}

export interface VelocityResponse {
  total_arguments: number
  avg_velocity: number | null
  peak_velocity: number | null
  evergreen_count: number
  surging_count: number
  peaked_count: number
  dormant_count: number
  top_by_velocity: VelocityArgument[]
  evergreen: VelocityArgument[]
  peaked: VelocityArgument[]
  category_velocity: VelocityCategory[]
  viewer_has_arguments: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function velocityLabel(
  upvotes: number,
  ageDays: number,
  velocity: number,
): VelocityLabel {
  if (ageDays <= 7) {
    // Recent arguments
    if (velocity >= 2) return 'surging'
    return 'steady'
  }
  // Older arguments (> 7 days)
  if (velocity >= 0.5) return 'evergreen'
  if (upvotes >= 5 && velocity < 0.1) return 'peaked'
  if (upvotes < 3 && ageDays >= 30) return 'dormant'
  return 'steady'
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 1. Fetch user's arguments with topic context
  const { data: rawArgs } = await supabase
    .from('topic_arguments')
    .select(`
      id,
      topic_id,
      side,
      content,
      upvotes,
      created_at,
      topics!inner (
        statement,
        category,
        status
      )
    `)
    .eq('user_id', user.id)
    .order('upvotes', { ascending: false })
    .limit(300)

  const args = (rawArgs ?? []) as Array<{
    id: string
    topic_id: string
    side: 'blue' | 'red'
    content: string
    upvotes: number
    created_at: string
    topics: { statement: string; category: string | null; status: string }
  }>

  if (args.length === 0) {
    return NextResponse.json({
      total_arguments: 0,
      avg_velocity: null,
      peak_velocity: null,
      evergreen_count: 0,
      surging_count: 0,
      peaked_count: 0,
      dormant_count: 0,
      top_by_velocity: [],
      evergreen: [],
      peaked: [],
      category_velocity: [],
      viewer_has_arguments: false,
    } satisfies VelocityResponse)
  }

  // 2. Reply counts
  const argIds = args.map((a) => a.id)
  const { data: replyRows } = await supabase
    .from('argument_replies')
    .select('argument_id')
    .in('argument_id', argIds)

  const replyCount: Record<string, number> = {}
  for (const r of replyRows ?? []) {
    replyCount[r.argument_id] = (replyCount[r.argument_id] ?? 0) + 1
  }

  // 3. Compute velocity for each argument
  const now = Date.now()
  const enriched: VelocityArgument[] = args.map((a) => {
    const ageMs = now - new Date(a.created_at).getTime()
    const ageDays = Math.max(ageMs / (1000 * 60 * 60 * 24), 0.5) // min 0.5 days to avoid division by near-zero
    const velocity = Math.round((a.upvotes / ageDays) * 100) / 100
    const label = velocityLabel(a.upvotes, ageDays, velocity)

    return {
      id: a.id,
      topic_id: a.topic_id,
      statement: a.topics.statement,
      category: a.topics.category,
      side: a.side,
      content: a.content,
      upvotes: a.upvotes,
      reply_count: replyCount[a.id] ?? 0,
      age_days: Math.round(ageDays),
      velocity,
      label,
      topic_status: a.topics.status,
      created_at: a.created_at,
    }
  })

  // 4. Aggregate stats
  const velocities = enriched.map((a) => a.velocity)
  const avgVelocity = velocities.length
    ? Math.round((velocities.reduce((s, v) => s + v, 0) / velocities.length) * 100) / 100
    : null
  const peakVelocity = velocities.length ? Math.max(...velocities) : null

  const evergreenCount = enriched.filter((a) => a.label === 'evergreen').length
  const surgingCount = enriched.filter((a) => a.label === 'surging').length
  const peakedCount = enriched.filter((a) => a.label === 'peaked').length
  const dormantCount = enriched.filter((a) => a.label === 'dormant').length

  // 5. Top by velocity (all labels, sorted by velocity desc)
  const topByVelocity = [...enriched]
    .sort((a, b) => b.velocity - a.velocity)
    .slice(0, 10)

  // 6. Evergreen: old (>30d) with velocity >= 0.5
  const evergreen = enriched
    .filter((a) => a.label === 'evergreen' && a.age_days > 30)
    .sort((a, b) => b.velocity - a.velocity)
    .slice(0, 6)

  // 7. Peaked: high upvotes but very low velocity now
  const peaked = enriched
    .filter((a) => a.label === 'peaked')
    .sort((a, b) => b.upvotes - a.upvotes)
    .slice(0, 6)

  // 8. Category velocity breakdown
  const catMap = new Map<string, { count: number; totalVelocity: number; totalUpvotes: number }>()
  for (const a of enriched) {
    const cat = a.category ?? 'Other'
    const cur = catMap.get(cat) ?? { count: 0, totalVelocity: 0, totalUpvotes: 0 }
    catMap.set(cat, {
      count: cur.count + 1,
      totalVelocity: cur.totalVelocity + a.velocity,
      totalUpvotes: cur.totalUpvotes + a.upvotes,
    })
  }
  const categoryVelocity: VelocityCategory[] = Array.from(catMap.entries())
    .map(([category, s]) => ({
      category,
      arguments: s.count,
      avg_velocity: Math.round((s.totalVelocity / s.count) * 100) / 100,
      total_upvotes: s.totalUpvotes,
      avg_upvotes: Math.round((s.totalUpvotes / s.count) * 10) / 10,
    }))
    .sort((a, b) => b.avg_velocity - a.avg_velocity)

  return NextResponse.json({
    total_arguments: enriched.length,
    avg_velocity: avgVelocity,
    peak_velocity: peakVelocity,
    evergreen_count: evergreenCount,
    surging_count: surgingCount,
    peaked_count: peakedCount,
    dormant_count: dormantCount,
    top_by_velocity: topByVelocity,
    evergreen,
    peaked,
    category_velocity: categoryVelocity,
    viewer_has_arguments: true,
  } satisfies VelocityResponse)
}
