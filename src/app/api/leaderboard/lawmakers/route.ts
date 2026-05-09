import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 300

export interface LawmakerEntry {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  reputation_score: number
  laws_contributed: number
  total_for_votes: number
  contribution_rate: number // % of FOR votes that became law
  signature_laws: SignatureLaw[]
}

export interface SignatureLaw {
  id: string
  statement: string
  category: string | null
  established_at: string
  total_votes: number
  blue_pct: number
}

export interface LawmakersResponse {
  entries: LawmakerEntry[]
  period: 'all' | '90d' | '30d'
  total_laws: number
  generated_at: string
}

const LIMIT = 50

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url)
  const period = (searchParams.get('period') ?? 'all') as 'all' | '90d' | '30d'

  const supabase = await createClient()

  // ── Date cutoff ───────────────────────────────────────────────────────────
  let cutoff: string | null = null
  if (period === '30d') {
    const d = new Date()
    d.setDate(d.getDate() - 30)
    cutoff = d.toISOString()
  } else if (period === '90d') {
    const d = new Date()
    d.setDate(d.getDate() - 90)
    cutoff = d.toISOString()
  }

  // ── Fetch all FOR votes on topics that are now laws ───────────────────────
  // We join votes → topics where side='blue' AND status='law'.
  // For period filtering, we filter by topic.updated_at (when it became law).
  const voteQuery = supabase
    .from('votes')
    .select('user_id, topic_id, created_at')
    .eq('side', 'blue')

  const { data: lawTopicsRaw } = cutoff
    ? await supabase
        .from('topics')
        .select('id, statement, category, total_votes, blue_pct, updated_at')
        .eq('status', 'law')
        .gte('updated_at', cutoff)
        .order('updated_at', { ascending: false })
    : await supabase
        .from('topics')
        .select('id, statement, category, total_votes, blue_pct, updated_at')
        .eq('status', 'law')
        .order('updated_at', { ascending: false })

  const lawTopics = lawTopicsRaw ?? []
  const lawTopicIds = lawTopics.map((t) => t.id)

  if (lawTopicIds.length === 0) {
    return NextResponse.json({
      entries: [],
      period,
      total_laws: 0,
      generated_at: new Date().toISOString(),
    } satisfies LawmakersResponse)
  }

  // Fetch all FOR votes on these law topics
  const { data: votesRaw } = await voteQuery.in('topic_id', lawTopicIds)
  const votes = votesRaw ?? []

  // ── Aggregate per user ────────────────────────────────────────────────────
  // laws_contributed: distinct topics the user voted FOR that are now laws
  // Also track which specific laws they contributed to (for signature laws)
  const userLawsMap = new Map<string, Set<string>>() // userId → Set<topicId>

  for (const vote of votes) {
    if (!userLawsMap.has(vote.user_id)) {
      userLawsMap.set(vote.user_id, new Set())
    }
    userLawsMap.get(vote.user_id)!.add(vote.topic_id)
  }

  if (userLawsMap.size === 0) {
    return NextResponse.json({
      entries: [],
      period,
      total_laws: lawTopicIds.length,
      generated_at: new Date().toISOString(),
    } satisfies LawmakersResponse)
  }

  // Sort users by laws_contributed descending, take top LIMIT
  const sorted = Array.from(userLawsMap.entries())
    .sort((a, b) => b[1].size - a[1].size)
    .slice(0, LIMIT)

  const topUserIds = sorted.map(([userId]) => userId)

  // ── Fetch profiles ────────────────────────────────────────────────────────
  const { data: profilesRaw } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, clout, reputation_score, total_votes, blue_vote_count')
    .in('id', topUserIds)

  const profileMap = new Map<string, typeof profilesRaw extends (infer T)[] | null ? T : never>()
  for (const p of profilesRaw ?? []) {
    profileMap.set(p.id, p)
  }

  // Build law lookup map
  const lawMap = new Map<string, (typeof lawTopicsRaw extends (infer T)[] | null ? T : never)>()
  for (const t of lawTopics) lawMap.set(t.id, t)

  // ── Build entries ─────────────────────────────────────────────────────────
  const entries: LawmakerEntry[] = []

  for (const [userId, topicIdsSet] of sorted) {
    const profile = profileMap.get(userId)
    if (!profile) continue

    const lawsContributed = topicIdsSet.size
    // Rough contribution rate: laws_contributed / max(blue_vote_count, 1)
    const totalForVotes = (profile as { blue_vote_count?: number }).blue_vote_count ?? 0
    const contributionRate =
      totalForVotes > 0 ? Math.min(100, Math.round((lawsContributed / totalForVotes) * 100)) : 0

    // Top 3 signature laws — most recent first
    const sigLaws: SignatureLaw[] = Array.from(topicIdsSet)
      .map((tid) => lawMap.get(tid))
      .filter(Boolean)
      .sort((a, b) =>
        new Date(b!.updated_at).getTime() - new Date(a!.updated_at).getTime()
      )
      .slice(0, 3)
      .map((t) => ({
        id: t!.id,
        statement: t!.statement,
        category: t!.category,
        established_at: t!.updated_at,
        total_votes: t!.total_votes ?? 0,
        blue_pct: Math.round(t!.blue_pct ?? 50),
      }))

    entries.push({
      user_id: userId,
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      role: profile.role,
      clout: profile.clout ?? 0,
      reputation_score: profile.reputation_score ?? 0,
      laws_contributed: lawsContributed,
      total_for_votes: totalForVotes,
      contribution_rate: contributionRate,
      signature_laws: sigLaws,
    })
  }

  return NextResponse.json({
    entries,
    period,
    total_laws: lawTopicIds.length,
    generated_at: new Date().toISOString(),
  } satisfies LawmakersResponse)
}
