import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export type RepTier =
  | 'legend'
  | 'lawmaker'
  | 'senator'
  | 'elder'
  | 'debator'
  | 'citizen'

export interface RepLeaderEntry {
  rank: number
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  reputation_score: number
  total_votes: number
  topics_authored: number
  laws_authored: number
  tier: RepTier
}

export interface RepMyStats {
  reputation_score: number
  total_votes: number
  topics_authored: number
  laws_authored: number
  tier: RepTier
  rank: number | null
  percentile: number | null
}

export interface RepLeaderboardResponse {
  entries: RepLeaderEntry[]
  total_citizens: number
  my_stats: RepMyStats | null
  platform_avg: number
  generated_at: string
}

// ─── Tier assignment ──────────────────────────────────────────────────────────

function getTier(score: number): RepTier {
  if (score >= 10_000) return 'legend'
  if (score >= 5_000)  return 'lawmaker'
  if (score >= 2_000)  return 'senator'
  if (score >= 1_000)  return 'elder'
  if (score >= 500)    return 'debator'
  return 'citizen'
}

// ─── Handler ─────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()

  // ── 1. Fetch top profiles by reputation score ─────────────────────────────
  const { data: topProfiles, error: topError } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, clout, reputation_score, total_votes')
    .gt('reputation_score', 0)
    .order('reputation_score', { ascending: false })
    .limit(100)

  if (topError) {
    return NextResponse.json({ error: topError.message }, { status: 500 })
  }

  const profiles = topProfiles ?? []

  // ── 2. Get topic/law authorship counts ────────────────────────────────────
  // Count topics authored per user
  const { data: topicCounts } = await supabase
    .from('topics')
    .select('author_id')
    .in('author_id', profiles.map((p) => p.id))

  const topicMap = new Map<string, number>()
  for (const t of (topicCounts ?? [])) {
    if (t.author_id) topicMap.set(t.author_id, (topicMap.get(t.author_id) ?? 0) + 1)
  }

  // Count laws authored per user (laws have a separate table linked via topics)
  const { data: lawCounts } = await supabase
    .from('laws')
    .select('topic_id, topics!inner(author_id)')
    .in('topics.author_id', profiles.map((p) => p.id))

  const lawMap = new Map<string, number>()
  for (const l of (lawCounts ?? []) as unknown as { topics: { author_id: string } }[]) {
    const aid = l.topics?.author_id
    if (aid) lawMap.set(aid, (lawMap.get(aid) ?? 0) + 1)
  }

  // ── 3. Build ranked entries ───────────────────────────────────────────────
  const entries: RepLeaderEntry[] = profiles.map((p, i) => ({
    rank: i + 1,
    user_id: p.id,
    username: p.username,
    display_name: p.display_name,
    avatar_url: p.avatar_url,
    role: p.role ?? 'person',
    clout: p.clout ?? 0,
    reputation_score: p.reputation_score ?? 0,
    total_votes: p.total_votes ?? 0,
    topics_authored: topicMap.get(p.id) ?? 0,
    laws_authored: lawMap.get(p.id) ?? 0,
    tier: getTier(p.reputation_score ?? 0),
  }))

  // ── 4. Platform stats ─────────────────────────────────────────────────────
  const { count: totalCitizens } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })
    .gt('reputation_score', 0)

  const { data: avgRow } = await supabase
    .from('profiles')
    .select('reputation_score')
    .gt('reputation_score', 0)
    .limit(1000)

  const scores = (avgRow ?? []).map((r) => r.reputation_score ?? 0)
  const platform_avg = scores.length > 0
    ? Math.round(scores.reduce((s, v) => s + v, 0) / scores.length)
    : 0

  // ── 5. Personal stats ─────────────────────────────────────────────────────
  let my_stats: RepMyStats | null = null

  if (user) {
    const { data: myProfile } = await supabase
      .from('profiles')
      .select('reputation_score, total_votes')
      .eq('id', user.id)
      .maybeSingle()

    if (myProfile) {
      const myScore = myProfile.reputation_score ?? 0
      const myTopics = topicMap.get(user.id) ?? 0
      const myLaws = lawMap.get(user.id) ?? 0

      // Find rank by counting how many users have a higher score
      const { count: higherCount } = await supabase
        .from('profiles')
        .select('*', { count: 'exact', head: true })
        .gt('reputation_score', myScore)

      const myRank = (higherCount ?? 0) + 1

      // Percentile = fraction of citizens below you
      const total = totalCitizens ?? 1
      const percentile = total > 1
        ? Math.round(((total - myRank) / (total - 1)) * 100)
        : 100

      my_stats = {
        reputation_score: myScore,
        total_votes: myProfile.total_votes ?? 0,
        topics_authored: myTopics,
        laws_authored: myLaws,
        tier: getTier(myScore),
        rank: myRank,
        percentile,
      }
    }
  }

  return NextResponse.json({
    entries,
    total_citizens: totalCitizens ?? 0,
    my_stats,
    platform_avg,
    generated_at: new Date().toISOString(),
  } satisfies RepLeaderboardResponse)
}
