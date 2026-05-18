import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ScoreboardUser {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  votes_1h: number
  arguments_1h: number
  activity_score: number
}

export interface ScoreboardTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  votes_1h: number
  arguments_1h: number
  heat_score: number
}

export interface CategoryHeat {
  category: string
  votes_1h: number
  arguments_1h: number
  topic_count: number
  heat_score: number
}

export interface SideMomentum {
  for_votes_1h: number
  against_votes_1h: number
  for_pct: number
  against_pct: number
  leading: 'for' | 'against' | 'tied'
  swing: number // absolute % swing from 50/50
}

export interface ScoreboardResponse {
  hot_users: ScoreboardUser[]
  hot_topics: ScoreboardTopic[]
  category_heat: CategoryHeat[]
  side_momentum: SideMomentum
  platform_pulse: {
    votes_1h: number
    arguments_1h: number
    active_users_1h: number
    laws_24h: number
    votes_24h: number
  }
  generated_at: string
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const now = Date.now()
  const since1h = new Date(now - 60 * 60 * 1000).toISOString()
  const since24h = new Date(now - 24 * 60 * 60 * 1000).toISOString()

  // ── 1. Recent votes ──────────────────────────────────────────────────────
  const { data: recentVotes } = await supabase
    .from('votes')
    .select('user_id, topic_id, side, created_at')
    .gte('created_at', since1h)
    .limit(5000)

  const votes1h = recentVotes ?? []

  // ── 2. Recent arguments ─────────────────────────────────────────────────
  const { data: recentArgs } = await supabase
    .from('topic_arguments')
    .select('author_id, topic_id, created_at')
    .gte('created_at', since1h)
    .limit(2000)

  const args1h = recentArgs ?? []

  // ── 3. 24h votes for pulse ───────────────────────────────────────────────
  const { data: votes24hData } = await supabase
    .from('votes')
    .select('created_at')
    .gte('created_at', since24h)
    .limit(50000)

  const votes24hCount = (votes24hData ?? []).length

  // ── 4. Recent laws ───────────────────────────────────────────────────────
  const { data: recentLaws } = await supabase
    .from('laws')
    .select('id')
    .gte('established_at', since24h)
    .limit(50)

  const laws24h = (recentLaws ?? []).length

  // ── 5. Active users in the last hour ────────────────────────────────────
  const activeUserIds = new Set<string>([
    ...votes1h.map((v) => v.user_id),
    ...args1h.map((a) => a.author_id),
  ])

  // ── 6. Per-user activity scores ─────────────────────────────────────────
  const userVoteCounts = new Map<string, number>()
  for (const v of votes1h) {
    userVoteCounts.set(v.user_id, (userVoteCounts.get(v.user_id) ?? 0) + 1)
  }

  const userArgCounts = new Map<string, number>()
  for (const a of args1h) {
    userArgCounts.set(a.author_id, (userArgCounts.get(a.author_id) ?? 0) + 1)
  }

  // Activity score: arguments worth 3x votes
  const userScores = new Map<string, number>()
  for (const [uid, vc] of userVoteCounts) {
    userScores.set(uid, (userScores.get(uid) ?? 0) + vc)
  }
  for (const [uid, ac] of userArgCounts) {
    userScores.set(uid, (userScores.get(uid) ?? 0) + ac * 3)
  }

  // Top 10 active users
  const topUserIds = [...userScores.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10)
    .map(([uid]) => uid)

  let hotUsers: ScoreboardUser[] = []
  if (topUserIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout')
      .in('id', topUserIds)

    hotUsers = (profiles ?? [])
      .map((p) => ({
        id: p.id,
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        role: p.role,
        clout: p.clout,
        votes_1h: userVoteCounts.get(p.id) ?? 0,
        arguments_1h: userArgCounts.get(p.id) ?? 0,
        activity_score: userScores.get(p.id) ?? 0,
      }))
      .sort((a, b) => b.activity_score - a.activity_score)
  }

  // ── 7. Per-topic activity ────────────────────────────────────────────────
  const topicVoteCounts = new Map<string, number>()
  for (const v of votes1h) {
    topicVoteCounts.set(v.topic_id, (topicVoteCounts.get(v.topic_id) ?? 0) + 1)
  }

  const topicArgCounts = new Map<string, number>()
  for (const a of args1h) {
    topicArgCounts.set(a.topic_id, (topicArgCounts.get(a.topic_id) ?? 0) + 1)
  }

  const topicHeat = new Map<string, number>()
  for (const [tid, vc] of topicVoteCounts) {
    topicHeat.set(tid, (topicHeat.get(tid) ?? 0) + vc)
  }
  for (const [tid, ac] of topicArgCounts) {
    topicHeat.set(tid, (topicHeat.get(tid) ?? 0) + ac * 2)
  }

  const topTopicIds = [...topicHeat.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([tid]) => tid)

  let hotTopics: ScoreboardTopic[] = []
  if (topTopicIds.length > 0) {
    const { data: topics } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .in('id', topTopicIds)

    hotTopics = (topics ?? [])
      .map((t) => ({
        id: t.id,
        statement: t.statement,
        category: t.category,
        status: t.status,
        blue_pct: t.blue_pct ?? 50,
        total_votes: t.total_votes ?? 0,
        votes_1h: topicVoteCounts.get(t.id) ?? 0,
        arguments_1h: topicArgCounts.get(t.id) ?? 0,
        heat_score: topicHeat.get(t.id) ?? 0,
      }))
      .sort((a, b) => b.heat_score - a.heat_score)
  }

  // ── 8. Category heat ─────────────────────────────────────────────────────
  // Map topics to categories to get category-level heat
  const topicCategories = new Map<string, string>()
  for (const t of hotTopics) {
    topicCategories.set(t.id, t.category ?? 'Uncategorized')
  }

  // For topics NOT in our hotTopics but appearing in votes/args, we need categories
  const allTopicIds = new Set<string>([
    ...topicVoteCounts.keys(),
    ...topicArgCounts.keys(),
  ])
  const unknownTopicIds = [...allTopicIds].filter((id) => !topicCategories.has(id))

  if (unknownTopicIds.length > 0) {
    const { data: catData } = await supabase
      .from('topics')
      .select('id, category')
      .in('id', unknownTopicIds.slice(0, 500))

    for (const t of catData ?? []) {
      topicCategories.set(t.id, t.category ?? 'Uncategorized')
    }
  }

  const catVotes = new Map<string, number>()
  const catArgs = new Map<string, number>()
  const catTopics = new Map<string, Set<string>>()

  for (const [tid, vc] of topicVoteCounts) {
    const cat = topicCategories.get(tid) ?? 'Uncategorized'
    catVotes.set(cat, (catVotes.get(cat) ?? 0) + vc)
    if (!catTopics.has(cat)) catTopics.set(cat, new Set())
    catTopics.get(cat)!.add(tid)
  }
  for (const [tid, ac] of topicArgCounts) {
    const cat = topicCategories.get(tid) ?? 'Uncategorized'
    catArgs.set(cat, (catArgs.get(cat) ?? 0) + ac)
    if (!catTopics.has(cat)) catTopics.set(cat, new Set())
    catTopics.get(cat)!.add(tid)
  }

  const categoryHeat: CategoryHeat[] = [...catVotes.keys()]
    .filter((c) => c !== 'Uncategorized')
    .map((cat) => {
      const vc = catVotes.get(cat) ?? 0
      const ac = catArgs.get(cat) ?? 0
      return {
        category: cat,
        votes_1h: vc,
        arguments_1h: ac,
        topic_count: catTopics.get(cat)?.size ?? 0,
        heat_score: vc + ac * 2,
      }
    })
    .sort((a, b) => b.heat_score - a.heat_score)
    .slice(0, 6)

  // ── 9. Side momentum ─────────────────────────────────────────────────────
  let forVotes1h = 0
  let againstVotes1h = 0
  for (const v of votes1h) {
    if (v.side === 'blue') forVotes1h++
    else againstVotes1h++
  }
  const totalSideVotes = forVotes1h + againstVotes1h
  const forPct = totalSideVotes > 0 ? Math.round((forVotes1h / totalSideVotes) * 100) : 50
  const againstPct = 100 - forPct

  const sideMomentum: SideMomentum = {
    for_votes_1h: forVotes1h,
    against_votes_1h: againstVotes1h,
    for_pct: forPct,
    against_pct: againstPct,
    leading: forPct > againstPct ? 'for' : againstPct > forPct ? 'against' : 'tied',
    swing: Math.abs(forPct - 50),
  }

  return NextResponse.json({
    hot_users: hotUsers,
    hot_topics: hotTopics,
    category_heat: categoryHeat,
    side_momentum: sideMomentum,
    platform_pulse: {
      votes_1h: votes1h.length,
      arguments_1h: args1h.length,
      active_users_1h: activeUserIds.size,
      laws_24h: laws24h,
      votes_24h: votes24hCount,
    },
    generated_at: new Date().toISOString(),
  } satisfies ScoreboardResponse)
}
