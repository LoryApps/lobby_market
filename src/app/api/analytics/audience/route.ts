import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TopSupporter {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  upvote_count: number
  first_upvote_at: string
  last_upvote_at: string
}

export interface RoleBreakdown {
  role: string
  upvoter_count: number
  upvote_count: number
  pct: number
}

export interface CategoryAffinity {
  category: string
  upvote_count: number
  argument_count: number
  avg_upvotes_per_arg: number
  pct: number
}

export interface MonthlyEngagement {
  month: string           // "2024-01"
  upvotes_received: number
  unique_upvoters: number
}

export interface AudienceResponse {
  authenticated: true
  user: {
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    clout: number
    total_arguments: number
  }
  // Summary stats
  total_upvotes_received: number
  unique_supporters: number
  avg_upvotes_per_argument: number
  support_rate: number             // 0–100: pct of your args that have ≥1 upvote
  for_upvotes: number
  against_upvotes: number
  // Detailed breakdowns
  top_supporters: TopSupporter[]
  role_breakdown: RoleBreakdown[]
  category_affinity: CategoryAffinity[]
  monthly_engagement: MonthlyEngagement[]
  // Engagement tier
  audience_tier: 'micro' | 'rising' | 'established' | 'prominent' | 'civic_voice'
  audience_tier_label: string
  audience_tier_desc: string
}

// ─── Tier config ──────────────────────────────────────────────────────────────

interface TierConfig {
  label: string
  desc: string
}

const TIER_CONFIG: Record<string, TierConfig> = {
  micro:       { label: 'Micro Presence',   desc: 'You\'re building a following. Every upvote is a step forward.' },
  rising:      { label: 'Rising Voice',     desc: 'Your arguments are gaining traction. Keep the quality high.' },
  established: { label: 'Established Voice',desc: 'A consistent audience recognises your civic perspective.' },
  prominent:   { label: 'Prominent Voice',  desc: 'Your arguments regularly shape debate across the Lobby.' },
  civic_voice: { label: 'Civic Voice',      desc: 'You\'re a pillar of the civic discourse. The Lobby listens.' },
}

function classifyTier(uniqueSupporters: number, totalUpvotes: number): string {
  const score = uniqueSupporters + totalUpvotes * 0.5
  if (score >= 500)  return 'civic_voice'
  if (score >= 150)  return 'prominent'
  if (score >= 50)   return 'established'
  if (score >= 15)   return 'rising'
  return 'micro'
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const uid = user.id

  // ── 1. Fetch current user profile ─────────────────────────────────────────

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, avatar_url, role, clout, total_arguments')
    .eq('id', uid)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  // ── 2. Fetch all of the user's arguments ──────────────────────────────────

  const { data: myArgs } = await supabase
    .from('topic_arguments')
    .select('id, side, upvotes, topic_id, created_at')
    .eq('user_id', uid)

  const args = myArgs ?? []

  if (args.length === 0) {
    const tier = 'micro'
    const tierMeta = TIER_CONFIG[tier]
    return NextResponse.json({
      authenticated: true,
      user: {
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
        role: profile.role,
        clout: profile.clout ?? 0,
        total_arguments: profile.total_arguments ?? 0,
      },
      total_upvotes_received: 0,
      unique_supporters: 0,
      avg_upvotes_per_argument: 0,
      support_rate: 0,
      for_upvotes: 0,
      against_upvotes: 0,
      top_supporters: [],
      role_breakdown: [],
      category_affinity: [],
      monthly_engagement: [],
      audience_tier: tier,
      audience_tier_label: tierMeta.label,
      audience_tier_desc: tierMeta.desc,
    } satisfies AudienceResponse)
  }

  const argIds = args.map((a) => a.id)

  // ── 3. Fetch all upvotes on user's arguments + upvoter profiles ───────────

  const { data: upvoteRows } = await supabase
    .from('topic_argument_votes')
    .select(`
      argument_id,
      user_id,
      created_at,
      profiles!topic_argument_votes_user_id_fkey (
        username,
        display_name,
        avatar_url,
        role,
        clout
      )
    `)
    .in('argument_id', argIds)
    .neq('user_id', uid)              // exclude self-upvotes

  const upvotes = (upvoteRows ?? []) as Array<{
    argument_id: string
    user_id: string
    created_at: string
    profiles: {
      username: string
      display_name: string | null
      avatar_url: string | null
      role: string
      clout: number
    } | null
  }>

  // ── 4. Build summary stats ────────────────────────────────────────────────

  const argMap = new Map(args.map((a) => [a.id, a]))
  const totalUpvotesReceived = upvotes.length
  const uniqueSupporterSet = new Set(upvotes.map((u) => u.user_id))
  const uniqueSupporters = uniqueSupporterSet.size
  const argsWithUpvotes = new Set(upvotes.map((u) => u.argument_id)).size
  const supportRate = args.length > 0
    ? Math.round((argsWithUpvotes / args.length) * 100)
    : 0
  const avgUpvotesPerArg = args.length > 0
    ? Math.round((totalUpvotesReceived / args.length) * 10) / 10
    : 0

  let forUpvotes = 0
  let againstUpvotes = 0
  for (const u of upvotes) {
    const arg = argMap.get(u.argument_id)
    if (arg?.side === 'blue') forUpvotes++
    else againstUpvotes++
  }

  // ── 5. Top supporters ─────────────────────────────────────────────────────

  const supporterMap = new Map<string, {
    profile: typeof upvotes[0]['profiles']
    count: number
    first: string
    last: string
  }>()

  for (const u of upvotes) {
    const existing = supporterMap.get(u.user_id)
    if (!existing) {
      supporterMap.set(u.user_id, {
        profile: u.profiles,
        count: 1,
        first: u.created_at,
        last: u.created_at,
      })
    } else {
      existing.count++
      if (u.created_at < existing.first) existing.first = u.created_at
      if (u.created_at > existing.last)  existing.last  = u.created_at
    }
  }

  const topSupporters: TopSupporter[] = Array.from(supporterMap.entries())
    .map(([user_id, { profile: p, count, first, last }]) => ({
      user_id,
      username:       p?.username       ?? 'unknown',
      display_name:   p?.display_name   ?? null,
      avatar_url:     p?.avatar_url     ?? null,
      role:           p?.role           ?? 'citizen',
      clout:          p?.clout          ?? 0,
      upvote_count:   count,
      first_upvote_at: first,
      last_upvote_at:  last,
    }))
    .sort((a, b) => b.upvote_count - a.upvote_count)
    .slice(0, 20)

  // ── 6. Role breakdown ─────────────────────────────────────────────────────

  const roleUpvoteMap = new Map<string, { upvoters: Set<string>; count: number }>()
  for (const u of upvotes) {
    const role = u.profiles?.role ?? 'citizen'
    if (!roleUpvoteMap.has(role)) {
      roleUpvoteMap.set(role, { upvoters: new Set(), count: 0 })
    }
    const entry = roleUpvoteMap.get(role)!
    entry.upvoters.add(u.user_id)
    entry.count++
  }

  const roleBreakdown: RoleBreakdown[] = Array.from(roleUpvoteMap.entries())
    .map(([role, { upvoters, count }]) => ({
      role,
      upvoter_count: upvoters.size,
      upvote_count: count,
      pct: totalUpvotesReceived > 0 ? Math.round((count / totalUpvotesReceived) * 100) : 0,
    }))
    .sort((a, b) => b.upvote_count - a.upvote_count)

  // ── 7. Category affinity ──────────────────────────────────────────────────

  // Fetch topic categories for the args
  const topicIds = Array.from(new Set(args.map((a) => a.topic_id)))
  const { data: topicsData } = await supabase
    .from('topics')
    .select('id, category')
    .in('id', topicIds)

  const topicCategoryMap = new Map<string, string | null>(
    (topicsData ?? []).map((t) => [t.id, t.category])
  )

  const catArgMap = new Map<string, { argIds: Set<string>; upvotes: number }>()
  for (const arg of args) {
    const cat = topicCategoryMap.get(arg.topic_id) ?? 'Other'
    if (!catArgMap.has(cat)) catArgMap.set(cat, { argIds: new Set(), upvotes: 0 })
    catArgMap.get(cat)!.argIds.add(arg.id)
  }

  for (const u of upvotes) {
    const arg = argMap.get(u.argument_id)
    if (!arg) continue
    const cat = topicCategoryMap.get(arg.topic_id) ?? 'Other'
    if (!catArgMap.has(cat)) catArgMap.set(cat, { argIds: new Set(), upvotes: 0 })
    catArgMap.get(cat)!.upvotes++
  }

  const categoryAffinity: CategoryAffinity[] = Array.from(catArgMap.entries())
    .map(([category, { argIds: catArgIds, upvotes: catUpvotes }]) => ({
      category,
      upvote_count: catUpvotes,
      argument_count: catArgIds.size,
      avg_upvotes_per_arg: catArgIds.size > 0
        ? Math.round((catUpvotes / catArgIds.size) * 10) / 10
        : 0,
      pct: totalUpvotesReceived > 0
        ? Math.round((catUpvotes / totalUpvotesReceived) * 100)
        : 0,
    }))
    .sort((a, b) => b.upvote_count - a.upvote_count)
    .slice(0, 10)

  // ── 8. Monthly engagement trend ───────────────────────────────────────────

  const monthlyMap = new Map<string, { upvotes: number; upvoters: Set<string> }>()
  for (const u of upvotes) {
    const month = u.created_at.slice(0, 7) // "YYYY-MM"
    if (!monthlyMap.has(month)) {
      monthlyMap.set(month, { upvotes: 0, upvoters: new Set() })
    }
    const entry = monthlyMap.get(month)!
    entry.upvotes++
    entry.upvoters.add(u.user_id)
  }

  // Build last 12 months
  const now = new Date()
  const monthlyEngagement: MonthlyEngagement[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const entry = monthlyMap.get(key)
    monthlyEngagement.push({
      month: key,
      upvotes_received: entry?.upvotes ?? 0,
      unique_upvoters: entry?.upvoters.size ?? 0,
    })
  }

  // ── 9. Classify tier ──────────────────────────────────────────────────────

  const tier = classifyTier(uniqueSupporters, totalUpvotesReceived)
  const tierMeta = TIER_CONFIG[tier]

  return NextResponse.json({
    authenticated: true,
    user: {
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      role: profile.role,
      clout: profile.clout ?? 0,
      total_arguments: profile.total_arguments ?? 0,
    },
    total_upvotes_received: totalUpvotesReceived,
    unique_supporters: uniqueSupporters,
    avg_upvotes_per_argument: avgUpvotesPerArg,
    support_rate: supportRate,
    for_upvotes: forUpvotes,
    against_upvotes: againstUpvotes,
    top_supporters: topSupporters,
    role_breakdown: roleBreakdown,
    category_affinity: categoryAffinity,
    monthly_engagement: monthlyEngagement,
    audience_tier: tier,
    audience_tier_label: tierMeta.label,
    audience_tier_desc: tierMeta.desc,
  } satisfies AudienceResponse)
}
