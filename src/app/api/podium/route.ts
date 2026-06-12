import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const CATEGORIES = [
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

export type PodiumCategory = (typeof CATEGORIES)[number]

export interface PodiumEntry {
  rank: 1 | 2 | 3
  user: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    clout: number
  }
  score: number
  weekly_votes: number
  weekly_arguments: number
  weekly_upvotes: number
}

export interface PodiumCategoryResult {
  category: PodiumCategory
  entries: PodiumEntry[]
  total_votes_this_week: number
  total_arguments_this_week: number
}

export interface PodiumResponse {
  week_start: string
  week_end: string
  categories: PodiumCategoryResult[]
  generated_at: string
}

// Monday of the current week at 00:00 UTC
function getWeekStart(): Date {
  const now = new Date()
  const day = now.getUTCDay() // 0=Sun, 1=Mon...
  const diff = day === 0 ? -6 : 1 - day // days back to Monday
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() + diff)
  monday.setUTCHours(0, 0, 0, 0)
  return monday
}

export async function GET() {
  const supabase = await createClient()

  const weekStart = getWeekStart()
  const weekEnd = new Date(weekStart)
  weekEnd.setUTCDate(weekEnd.getUTCDate() + 7)

  const weekStartIso = weekStart.toISOString()
  const weekEndIso = weekEnd.toISOString()

  // ── Fetch all votes this week with topic category ─────────────────────────

  const { data: votesRaw, error: votesErr } = await supabase
    .from('votes')
    .select(`
      user_id,
      topic:topics!inner(category)
    `)
    .gte('created_at', weekStartIso)
    .lt('created_at', weekEndIso)

  if (votesErr) {
    return NextResponse.json({ error: votesErr.message }, { status: 500 })
  }

  // ── Fetch all arguments this week with topic category ─────────────────────

  const { data: argsRaw, error: argsErr } = await supabase
    .from('topic_arguments')
    .select(`
      user_id,
      upvotes,
      topic:topics!inner(category)
    `)
    .gte('created_at', weekStartIso)
    .lt('created_at', weekEndIso)

  if (argsErr) {
    return NextResponse.json({ error: argsErr.message }, { status: 500 })
  }

  // ── Aggregate per-user per-category scores ────────────────────────────────

  // score = votes * 1 + arguments * 3 + upvotes * 2
  type UserCategoryStats = {
    votes: number
    arguments: number
    upvotes: number
    score: number
  }

  const stats = new Map<string, Map<string, UserCategoryStats>>() // userId -> category -> stats

  function getUserCatStats(userId: string, category: string): UserCategoryStats {
    if (!stats.has(userId)) stats.set(userId, new Map())
    const catMap = stats.get(userId)!
    if (!catMap.has(category)) {
      catMap.set(category, { votes: 0, arguments: 0, upvotes: 0, score: 0 })
    }
    return catMap.get(category)!
  }

  for (const row of (votesRaw ?? []) as Array<{ user_id: string; topic: { category: string | null } | null }>) {
    const cat = row.topic?.category
    if (!cat || !CATEGORIES.includes(cat as PodiumCategory)) continue
    const s = getUserCatStats(row.user_id, cat)
    s.votes++
    s.score += 1
  }

  for (const row of (argsRaw ?? []) as Array<{ user_id: string; upvotes: number; topic: { category: string | null } | null }>) {
    const cat = row.topic?.category
    if (!cat || !CATEGORIES.includes(cat as PodiumCategory)) continue
    const s = getUserCatStats(row.user_id, cat)
    s.arguments++
    s.upvotes += row.upvotes ?? 0
    s.score += 3 + (row.upvotes ?? 0) * 2
  }

  // ── Collect top 3 per category ────────────────────────────────────────────

  type RawEntry = { userId: string; stats: UserCategoryStats }
  const categoryTopUsers = new Map<string, RawEntry[]>()

  for (const [userId, catMap] of stats.entries()) {
    for (const [cat, catStats] of catMap.entries()) {
      if (catStats.score === 0) continue
      if (!categoryTopUsers.has(cat)) categoryTopUsers.set(cat, [])
      categoryTopUsers.get(cat)!.push({ userId, stats: catStats })
    }
  }

  // Sort each category by score descending, take top 3
  const topUserIdsByCat = new Map<string, RawEntry[]>()
  for (const [cat, entries] of categoryTopUsers.entries()) {
    topUserIdsByCat.set(
      cat,
      entries.sort((a, b) => b.stats.score - a.stats.score).slice(0, 3)
    )
  }

  // ── Collect all user IDs that appear in the top 3 ────────────────────────

  const allUserIds = new Set<string>()
  for (const entries of topUserIdsByCat.values()) {
    for (const e of entries) allUserIds.add(e.userId)
  }

  const profileMap = new Map<string, {
    id: string; username: string; display_name: string | null;
    avatar_url: string | null; role: string; clout: number
  }>()

  if (allUserIds.size > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout')
      .in('id', Array.from(allUserIds))

    for (const p of (profiles ?? [])) {
      profileMap.set(p.id, p as typeof profileMap extends Map<string, infer V> ? V : never)
    }
  }

  // ── Category-level vote/arg totals for context ────────────────────────────

  const catTotalVotes = new Map<string, number>()
  const catTotalArgs = new Map<string, number>()

  for (const row of (votesRaw ?? []) as Array<{ topic: { category: string | null } | null }>) {
    const cat = row.topic?.category
    if (!cat) continue
    catTotalVotes.set(cat, (catTotalVotes.get(cat) ?? 0) + 1)
  }
  for (const row of (argsRaw ?? []) as Array<{ topic: { category: string | null } | null }>) {
    const cat = row.topic?.category
    if (!cat) continue
    catTotalArgs.set(cat, (catTotalArgs.get(cat) ?? 0) + 1)
  }

  // ── Build response ────────────────────────────────────────────────────────

  const categories: PodiumCategoryResult[] = CATEGORIES.map((cat) => {
    const entries = topUserIdsByCat.get(cat) ?? []
    return {
      category: cat,
      total_votes_this_week: catTotalVotes.get(cat) ?? 0,
      total_arguments_this_week: catTotalArgs.get(cat) ?? 0,
      entries: entries.slice(0, 3).map((e, idx) => {
        const profile = profileMap.get(e.userId)
        return {
          rank: (idx + 1) as 1 | 2 | 3,
          user: profile ?? {
            id: e.userId,
            username: 'unknown',
            display_name: null,
            avatar_url: null,
            role: 'person',
            clout: 0,
          },
          score: e.stats.score,
          weekly_votes: e.stats.votes,
          weekly_arguments: e.stats.arguments,
          weekly_upvotes: e.stats.upvotes,
        }
      }),
    }
  })

  const response: PodiumResponse = {
    week_start: weekStartIso,
    week_end: weekEndIso,
    categories,
    generated_at: new Date().toISOString(),
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 's-maxage=300, stale-while-revalidate=60' },
  })
}
