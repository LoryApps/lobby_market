import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TopAmplifier {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  followers_count: number
  upvotes_given: number
  potential_reach: number   // followers_count (people they could expose your arg to)
}

export interface CategoryReach {
  category: string
  argument_count: number
  direct_reach: number      // unique upvoters
  network_reach: number     // sum of upvoter follower counts + direct
  avg_reach_per_arg: number
  pct: number               // share of total network reach
}

export interface MonthlyReach {
  month: string             // "YYYY-MM"
  direct_reach: number      // unique upvoters that month
  network_reach: number     // sum of upvoters' follower counts
}

export interface ReachResponse {
  authenticated: true
  user: {
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    clout: number
    followers_count: number
    total_arguments: number
  }
  // Core metrics
  total_upvotes_received: number
  unique_amplifiers: number
  estimated_network_reach: number
  amplification_multiplier: number
  avg_reach_per_argument: number
  your_own_followers: number
  // Breakdowns
  top_amplifiers: TopAmplifier[]
  category_reach: CategoryReach[]
  monthly_reach: MonthlyReach[]
  // Tier
  reach_tier: 'local' | 'district' | 'regional' | 'national' | 'civic_broadcast'
  reach_tier_label: string
  reach_tier_desc: string
}

// ─── Tier config ──────────────────────────────────────────────────────────────

interface TierConfig {
  label: string
  desc: string
}

const TIER_CONFIG: Record<string, TierConfig> = {
  local:           { label: 'Local Voice',       desc: 'Your arguments are reaching their first audience. Keep writing.' },
  district:        { label: 'District Voice',    desc: 'Your arguments are spreading beyond your immediate circle.' },
  regional:        { label: 'Regional Voice',    desc: 'Influential upvoters are amplifying your arguments widely.' },
  national:        { label: 'National Voice',    desc: 'Your arguments reach thousands through the civic network.' },
  civic_broadcast: { label: 'Civic Broadcast',   desc: 'Your arguments propagate to a massive audience. The Lobby amplifies you.' },
}

function classifyTier(networkReach: number): string {
  if (networkReach >= 50_000)  return 'civic_broadcast'
  if (networkReach >= 10_000)  return 'national'
  if (networkReach >=  2_000)  return 'regional'
  if (networkReach >=    500)  return 'district'
  return 'local'
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const uid = user.id

  // ── 1. Fetch user profile ─────────────────────────────────────────────────

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, avatar_url, role, clout, followers_count, total_arguments')
    .eq('id', uid)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const ownFollowers = profile.followers_count ?? 0

  // ── 2. Fetch user's arguments ─────────────────────────────────────────────

  const { data: myArgs } = await supabase
    .from('topic_arguments')
    .select('id, side, topic_id, created_at')
    .eq('user_id', uid)

  const args = myArgs ?? []

  const emptyPayload: ReachResponse = {
    authenticated: true,
    user: {
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      role: profile.role,
      clout: profile.clout ?? 0,
      followers_count: ownFollowers,
      total_arguments: profile.total_arguments ?? 0,
    },
    total_upvotes_received: 0,
    unique_amplifiers: 0,
    estimated_network_reach: ownFollowers,
    amplification_multiplier: 1,
    avg_reach_per_argument: 0,
    your_own_followers: ownFollowers,
    top_amplifiers: [],
    category_reach: [],
    monthly_reach: buildEmptyMonthly(),
    reach_tier: 'local',
    reach_tier_label: TIER_CONFIG['local'].label,
    reach_tier_desc: TIER_CONFIG['local'].desc,
  }

  if (args.length === 0) return NextResponse.json(emptyPayload)

  const argIds = args.map((a) => a.id)

  // ── 3. Fetch upvotes on user's arguments + upvoter profiles ──────────────

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
        followers_count
      )
    `)
    .in('argument_id', argIds)
    .neq('user_id', uid)

  const upvotes = (upvoteRows ?? []) as Array<{
    argument_id: string
    user_id: string
    created_at: string
    profiles: {
      username: string
      display_name: string | null
      avatar_url: string | null
      role: string
      followers_count: number
    } | null
  }>

  // ── 4. Core reach metrics ─────────────────────────────────────────────────

  const totalUpvotes = upvotes.length

  // Map upvoter_id → their follower count (use max seen, consistent per user)
  const amplifierMap = new Map<string, {
    profile: typeof upvotes[0]['profiles']
    upvotesGiven: number
    followerCount: number
  }>()

  for (const u of upvotes) {
    const fc = u.profiles?.followers_count ?? 0
    const existing = amplifierMap.get(u.user_id)
    if (!existing) {
      amplifierMap.set(u.user_id, { profile: u.profiles, upvotesGiven: 1, followerCount: fc })
    } else {
      existing.upvotesGiven++
      // take max in case of inconsistency
      if (fc > existing.followerCount) existing.followerCount = fc
    }
  }

  const uniqueAmplifiers = amplifierMap.size

  // Network reach = sum of each unique upvoter's follower count + direct upvoters
  // The idea: when someone with N followers upvotes, N people could see the argument
  let networkReachFromAmplifiers = 0
  for (const [, { followerCount }] of amplifierMap) {
    networkReachFromAmplifiers += followerCount
  }
  const estimatedNetworkReach = ownFollowers + uniqueAmplifiers + networkReachFromAmplifiers
  const amplificationMultiplier = uniqueAmplifiers > 0
    ? Math.round((estimatedNetworkReach / Math.max(uniqueAmplifiers, 1)) * 10) / 10
    : 1
  const avgReachPerArg = args.length > 0
    ? Math.round(estimatedNetworkReach / args.length)
    : 0

  // ── 5. Top amplifiers ─────────────────────────────────────────────────────

  const topAmplifiers: TopAmplifier[] = Array.from(amplifierMap.entries())
    .map(([user_id, { profile: p, upvotesGiven, followerCount }]) => ({
      user_id,
      username: p?.username ?? 'unknown',
      display_name: p?.display_name ?? null,
      avatar_url: p?.avatar_url ?? null,
      role: p?.role ?? 'citizen',
      followers_count: followerCount,
      upvotes_given: upvotesGiven,
      potential_reach: followerCount,
    }))
    .sort((a, b) => b.followers_count - a.followers_count)
    .slice(0, 20)

  // ── 6. Category reach ─────────────────────────────────────────────────────

  const topicIds = Array.from(new Set(args.map((a) => a.topic_id)))
  const { data: topicsData } = await supabase
    .from('topics')
    .select('id, category')
    .in('id', topicIds)

  const topicCatMap = new Map<string, string | null>(
    (topicsData ?? []).map((t) => [t.id, t.category])
  )
  const argIdToTopic = new Map(args.map((a) => [a.id, a.topic_id]))

  // Per-category: track unique upvoters and their follower counts
  const catMap = new Map<string, {
    argIds: Set<string>
    upvoterIds: Set<string>
    upvoterFollowers: Map<string, number>  // user_id → followers_count
  }>()

  for (const arg of args) {
    const cat = topicCatMap.get(arg.topic_id) ?? 'Other'
    if (!catMap.has(cat)) catMap.set(cat, { argIds: new Set(), upvoterIds: new Set(), upvoterFollowers: new Map() })
    catMap.get(cat)!.argIds.add(arg.id)
  }

  for (const u of upvotes) {
    const topicId = argIdToTopic.get(u.argument_id)
    if (!topicId) continue
    const cat = topicCatMap.get(topicId) ?? 'Other'
    if (!catMap.has(cat)) catMap.set(cat, { argIds: new Set(), upvoterIds: new Set(), upvoterFollowers: new Map() })
    const entry = catMap.get(cat)!
    entry.upvoterIds.add(u.user_id)
    const fc = u.profiles?.followers_count ?? 0
    const existing = entry.upvoterFollowers.get(u.user_id) ?? 0
    if (fc > existing) entry.upvoterFollowers.set(u.user_id, fc)
  }

  let totalNetworkReach = 0
  const rawCategoryReach = Array.from(catMap.entries()).map(([category, { argIds: catArgIds, upvoterIds, upvoterFollowers }]) => {
    const directReach = upvoterIds.size
    let followersSum = 0
    for (const [, fc] of upvoterFollowers) followersSum += fc
    const networkReach = directReach + followersSum
    totalNetworkReach += networkReach
    return {
      category,
      argument_count: catArgIds.size,
      direct_reach: directReach,
      network_reach: networkReach,
      avg_reach_per_arg: catArgIds.size > 0 ? Math.round(networkReach / catArgIds.size) : 0,
      pct: 0,  // filled below
    }
  })

  const categoryReach: CategoryReach[] = rawCategoryReach
    .map((c) => ({
      ...c,
      pct: totalNetworkReach > 0 ? Math.round((c.network_reach / totalNetworkReach) * 100) : 0,
    }))
    .sort((a, b) => b.network_reach - a.network_reach)
    .slice(0, 10)

  // ── 7. Monthly reach trend ────────────────────────────────────────────────

  const monthlyMap = new Map<string, {
    upvoterIds: Set<string>
    followerSum: Map<string, number>  // user_id → followers_count
  }>()

  for (const u of upvotes) {
    const month = u.created_at.slice(0, 7)
    if (!monthlyMap.has(month)) {
      monthlyMap.set(month, { upvoterIds: new Set(), followerSum: new Map() })
    }
    const entry = monthlyMap.get(month)!
    entry.upvoterIds.add(u.user_id)
    const fc = u.profiles?.followers_count ?? 0
    const existing = entry.followerSum.get(u.user_id) ?? 0
    if (fc > existing) entry.followerSum.set(u.user_id, fc)
  }

  const now = new Date()
  const monthlyReach: MonthlyReach[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    const entry = monthlyMap.get(key)
    let followersSum = 0
    if (entry) {
      for (const [, fc] of entry.followerSum) followersSum += fc
    }
    monthlyReach.push({
      month: key,
      direct_reach: entry?.upvoterIds.size ?? 0,
      network_reach: (entry?.upvoterIds.size ?? 0) + followersSum,
    })
  }

  // ── 8. Classify tier ──────────────────────────────────────────────────────

  const tier = classifyTier(estimatedNetworkReach)
  const tierMeta = TIER_CONFIG[tier]

  return NextResponse.json({
    authenticated: true,
    user: {
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      role: profile.role,
      clout: profile.clout ?? 0,
      followers_count: ownFollowers,
      total_arguments: profile.total_arguments ?? 0,
    },
    total_upvotes_received: totalUpvotes,
    unique_amplifiers: uniqueAmplifiers,
    estimated_network_reach: estimatedNetworkReach,
    amplification_multiplier: amplificationMultiplier,
    avg_reach_per_argument: avgReachPerArg,
    your_own_followers: ownFollowers,
    top_amplifiers: topAmplifiers,
    category_reach: categoryReach,
    monthly_reach: monthlyReach,
    reach_tier: tier as ReachResponse['reach_tier'],
    reach_tier_label: tierMeta.label,
    reach_tier_desc: tierMeta.desc,
  } satisfies ReachResponse)
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildEmptyMonthly(): MonthlyReach[] {
  const now = new Date()
  const months: MonthlyReach[] = []
  for (let i = 11; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    months.push({ month: key, direct_reach: 0, network_reach: 0 })
  }
  return months
}
