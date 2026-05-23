import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ResonantArgument {
  argument_id: string
  topic_id: string
  topic_statement: string
  topic_category: string | null
  topic_status: string
  argument_content: string
  argument_side: 'blue' | 'red'
  total_upvotes: number
  cross_upvotes: number        // upvotes from people who voted the OPPOSITE side
  cross_upvote_pct: number     // cross_upvotes / total_upvotes * 100
  resonance_score: number      // weighted: cross_upvotes * sqrt(total_upvotes)
  created_at: string
}

export interface CrossPartisanVoice {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  upvoted_args: number
}

export interface CategoryResonance {
  category: string
  total_args: number
  resonant_args: number
  avg_cross_pct: number
}

export interface ResonanceStats {
  total_arguments: number
  arguments_with_cross_upvotes: number
  total_cross_upvotes: number
  avg_cross_pct: number
  resonance_archetype: string
  archetype_desc: string
}

export interface ResonanceResponse {
  stats: ResonanceStats
  top_resonant: ResonantArgument[]
  category_breakdown: CategoryResonance[]
  top_cross_upvoters: CrossPartisanVoice[]
  has_data: boolean
}

// ─── Archetype classification ─────────────────────────────────────────────────

function classifyArchetype(
  resonantCount: number,
  avgCrossPct: number,
): { archetype: string; desc: string } {
  if (resonantCount === 0) {
    return {
      archetype: 'Silent Partisan',
      desc: 'Your arguments haven\'t yet crossed the divide — keep writing to find your voice.',
    }
  }
  if (avgCrossPct >= 40) {
    return {
      archetype: 'Bridge Builder',
      desc: 'You write arguments that opposing voters actually respect. Rare, and remarkable.',
    }
  }
  if (avgCrossPct >= 25) {
    return {
      archetype: 'Cross-Aisle Advocate',
      desc: 'A healthy share of your upvotes come from the other side — your arguments have genuine persuasive power.',
    }
  }
  if (avgCrossPct >= 12) {
    return {
      archetype: 'Emerging Persuader',
      desc: 'You occasionally break through partisan lines. Focus on evidence and nuance to increase your reach.',
    }
  }
  return {
    archetype: 'Choir Preacher',
    desc: 'Your arguments mostly resonate with allies. Try steelmanning opposing views to win over new audiences.',
  }
}

// ─── GET /api/analytics/resonance ────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── 1. Fetch user's arguments (last 500, only on voted topics) ─────────────
  const { data: argRows } = await supabase
    .from('topic_arguments')
    .select('id, topic_id, content, side, upvotes, created_at')
    .eq('user_id', user.id)
    .gt('upvotes', 0)
    .order('upvotes', { ascending: false })
    .limit(200)

  const args = argRows ?? []

  if (args.length === 0) {
    const stats: ResonanceStats = {
      total_arguments: 0,
      arguments_with_cross_upvotes: 0,
      total_cross_upvotes: 0,
      avg_cross_pct: 0,
      resonance_archetype: 'Silent Partisan',
      archetype_desc: 'Post arguments and earn upvotes to unlock your Resonance Report.',
    }
    return NextResponse.json({
      stats,
      top_resonant: [],
      category_breakdown: [],
      top_cross_upvoters: [],
      has_data: false,
    } satisfies ResonanceResponse)
  }

  const argIds = args.map((a) => a.id)
  const topicIds = Array.from(new Set(args.map((a) => a.topic_id)))

  // ── 2. Fetch topics for context ────────────────────────────────────────────
  const { data: topicRows } = await supabase
    .from('topics')
    .select('id, statement, category, status')
    .in('id', topicIds)

  const topicMap = new Map<string, { statement: string; category: string | null; status: string }>()
  for (const t of topicRows ?? []) {
    topicMap.set(t.id, { statement: t.statement, category: t.category, status: t.status })
  }

  // ── 3. Who upvoted user's arguments? ──────────────────────────────────────
  const { data: upvoteRows } = await supabase
    .from('topic_argument_votes')
    .select('argument_id, user_id')
    .in('argument_id', argIds)

  // Group upvoters by argument
  const upvotersByArg = new Map<string, string[]>()
  for (const row of upvoteRows ?? []) {
    const existing = upvotersByArg.get(row.argument_id) ?? []
    existing.push(row.user_id)
    upvotersByArg.set(row.argument_id, existing)
  }

  // ── 4. Fetch how those upvoters voted on the same topics ─────────────────
  // Build a set of (topic_id, voter_id) pairs to look up
  const allUpvoterIds = Array.from(
    new Set((upvoteRows ?? []).map((r) => r.user_id))
  )

  let voterTopicSides: { user_id: string; topic_id: string; side: string }[] = []
  if (allUpvoterIds.length > 0) {
    const { data: voteRows } = await supabase
      .from('votes')
      .select('user_id, topic_id, side')
      .in('user_id', allUpvoterIds)
      .in('topic_id', topicIds)

    voterTopicSides = voteRows ?? []
  }

  // Create lookup: "userId:topicId" → side
  const voteSideLookup = new Map<string, string>()
  for (const v of voterTopicSides) {
    voteSideLookup.set(`${v.user_id}:${v.topic_id}`, v.side)
  }

  // ── 5. Compute cross-partisan upvotes per argument ────────────────────────
  const resonantArgs: ResonantArgument[] = []
  const crossUpvoterCount = new Map<string, number>()

  for (const arg of args) {
    const upvoters = upvotersByArg.get(arg.id) ?? []
    const topic = topicMap.get(arg.topic_id)
    if (!topic) continue

    // Opposite side: if arg is 'blue' (FOR), cross votes come from 'red' voters, and vice versa
    const oppositeSide = arg.side === 'blue' ? 'red' : 'blue'

    let crossCount = 0
    for (const voterId of upvoters) {
      const voterSide = voteSideLookup.get(`${voterId}:${arg.topic_id}`)
      if (voterSide === oppositeSide) {
        crossCount++
        crossUpvoterCount.set(voterId, (crossUpvoterCount.get(voterId) ?? 0) + 1)
      }
    }

    if (crossCount === 0) continue

    const totalUp = arg.upvotes ?? upvoters.length
    const crossPct = totalUp > 0 ? Math.round((crossCount / totalUp) * 100) : 0
    const resonanceScore = crossCount * Math.sqrt(Math.max(totalUp, 1))

    resonantArgs.push({
      argument_id: arg.id,
      topic_id: arg.topic_id,
      topic_statement: topic.statement,
      topic_category: topic.category,
      topic_status: topic.status,
      argument_content: arg.content,
      argument_side: arg.side as 'blue' | 'red',
      total_upvotes: totalUp,
      cross_upvotes: crossCount,
      cross_upvote_pct: crossPct,
      resonance_score: Math.round(resonanceScore * 10) / 10,
      created_at: arg.created_at,
    })
  }

  // Sort by resonance score
  resonantArgs.sort((a, b) => b.resonance_score - a.resonance_score)

  // ── 6. Overall stats ───────────────────────────────────────────────────────
  const totalCrossUpvotes = resonantArgs.reduce((s, a) => s + a.cross_upvotes, 0)
  const avgCrossPct =
    resonantArgs.length > 0
      ? Math.round(
          resonantArgs.reduce((s, a) => s + a.cross_upvote_pct, 0) / resonantArgs.length
        )
      : 0

  const { archetype, desc } = classifyArchetype(resonantArgs.length, avgCrossPct)

  const stats: ResonanceStats = {
    total_arguments: args.length,
    arguments_with_cross_upvotes: resonantArgs.length,
    total_cross_upvotes: totalCrossUpvotes,
    avg_cross_pct: avgCrossPct,
    resonance_archetype: archetype,
    archetype_desc: desc,
  }

  // ── 7. Category breakdown ──────────────────────────────────────────────────
  const catMap = new Map<
    string,
    { total: number; resonant: number; crossPctSum: number }
  >()
  for (const arg of args) {
    const cat = topicMap.get(arg.topic_id)?.category ?? 'Other'
    const ex = catMap.get(cat) ?? { total: 0, resonant: 0, crossPctSum: 0 }
    ex.total++
    catMap.set(cat, ex)
  }
  for (const ra of resonantArgs) {
    const cat = ra.topic_category ?? 'Other'
    const ex = catMap.get(cat) ?? { total: 0, resonant: 0, crossPctSum: 0 }
    ex.resonant++
    ex.crossPctSum += ra.cross_upvote_pct
    catMap.set(cat, ex)
  }

  const category_breakdown: CategoryResonance[] = Array.from(catMap.entries())
    .filter(([, v]) => v.resonant > 0)
    .map(([category, v]) => ({
      category,
      total_args: v.total,
      resonant_args: v.resonant,
      avg_cross_pct: v.resonant > 0 ? Math.round(v.crossPctSum / v.resonant) : 0,
    }))
    .sort((a, b) => b.avg_cross_pct - a.avg_cross_pct)
    .slice(0, 5)

  // ── 8. Top cross-upvoters ─────────────────────────────────────────────────
  const topCrossIds = Array.from(crossUpvoterCount.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([id]) => id)

  let top_cross_upvoters: CrossPartisanVoice[] = []
  if (topCrossIds.length > 0) {
    const { data: profileRows } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .in('id', topCrossIds)

    top_cross_upvoters = (profileRows ?? []).map((p) => ({
      user_id: p.id,
      username: p.username,
      display_name: p.display_name,
      avatar_url: p.avatar_url,
      role: p.role,
      upvoted_args: crossUpvoterCount.get(p.id) ?? 0,
    }))
    top_cross_upvoters.sort((a, b) => b.upvoted_args - a.upvoted_args)
  }

  return NextResponse.json({
    stats,
    top_resonant: resonantArgs.slice(0, 10),
    category_breakdown,
    top_cross_upvoters,
    has_data: resonantArgs.length > 0,
  } satisfies ResonanceResponse)
}
