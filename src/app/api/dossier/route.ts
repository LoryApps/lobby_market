import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface DossierCategory {
  name: string
  voteCount: number
  pct: number
  forPct: number
}

export interface DossierData {
  username: string
  displayName: string | null
  avatarUrl: string | null
  role: string
  archetype: string | null
  clout: number
  reputation: number
  totalVotes: number
  totalArguments: number
  voteStreak: number
  memberDays: number
  memberSince: string
  lawsContributed: number
  predictionsCorrect: number
  predictionsTotal: number
  predictionAccuracy: number | null
  topCategories: DossierCategory[]
  forBias: number
  isOwnProfile: boolean
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()

  const { searchParams } = new URL(req.url)
  const targetUsername = searchParams.get('username')

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Resolve which profile to load
  let profileQuery = supabase
    .from('profiles')
    .select(
      'id, username, display_name, avatar_url, role, civic_archetype, clout, reputation_score, total_votes, total_arguments, vote_streak, blue_vote_count, red_vote_count, created_at'
    )

  if (targetUsername) {
    profileQuery = profileQuery.eq('username', targetUsername)
  } else if (user) {
    profileQuery = profileQuery.eq('id', user.id)
  } else {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: profile } = await profileQuery.maybeSingle()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const isOwnProfile = !!(user && user.id === profile.id)

  const memberDays = Math.max(
    1,
    Math.floor((Date.now() - new Date(profile.created_at).getTime()) / 86_400_000)
  )

  // ── Laws contributed (voted FOR on topics that became law) ────────────────
  const { count: lawsContributed } = await supabase
    .from('votes')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', profile.id)
    .eq('side', 'blue')
    .in(
      'topic_id',
      (
        await supabase
          .from('topics')
          .select('id')
          .eq('status', 'law')
      ).data?.map((t) => t.id) ?? []
    )

  // ── Category distribution from votes ──────────────────────────────────────
  const { data: voteRows } = await supabase
    .from('votes')
    .select('side, topics!inner(category)')
    .eq('user_id', profile.id)
    .not('topics.category', 'is', null)
    .limit(2000)

  const catMap = new Map<string, { total: number; blue: number }>()
  for (const row of (voteRows ?? []) as Array<{ side: string; topics: { category: string } }>) {
    const cat = row.topics?.category
    if (!cat) continue
    const existing = catMap.get(cat) ?? { total: 0, blue: 0 }
    existing.total++
    if (row.side === 'blue') existing.blue++
    catMap.set(cat, existing)
  }

  const totalCatVotes = Array.from(catMap.values()).reduce((s, v) => s + v.total, 0)
  const topCategories: DossierCategory[] = Array.from(catMap.entries())
    .map(([name, { total, blue }]) => ({
      name,
      voteCount: total,
      pct: totalCatVotes > 0 ? Math.round((total / totalCatVotes) * 100) : 0,
      forPct: total > 0 ? Math.round((blue / total) * 100) : 50,
    }))
    .sort((a, b) => b.voteCount - a.voteCount)
    .slice(0, 5)

  // ── Prediction accuracy ───────────────────────────────────────────────────
  const { data: predRows } = await supabase
    .from('topic_predictions')
    .select('correct')
    .eq('user_id', profile.id)
    .not('correct', 'is', null)

  const predictionsTotal = predRows?.length ?? 0
  const predictionsCorrect = predRows?.filter((p) => p.correct).length ?? 0
  const predictionAccuracy =
    predictionsTotal > 0 ? Math.round((predictionsCorrect / predictionsTotal) * 100) : null

  // ── FOR bias: (blue_votes / total_votes) ──────────────────────────────────
  const totalVotes = profile.total_votes ?? 0
  const forBias =
    totalVotes > 0
      ? Math.round(((profile.blue_vote_count ?? 0) / totalVotes) * 100)
      : 50

  return NextResponse.json({
    username: profile.username,
    displayName: profile.display_name,
    avatarUrl: profile.avatar_url,
    role: profile.role,
    archetype: profile.civic_archetype,
    clout: profile.clout ?? 0,
    reputation: Math.round(profile.reputation_score ?? 0),
    totalVotes: profile.total_votes ?? 0,
    totalArguments: profile.total_arguments ?? 0,
    voteStreak: profile.vote_streak ?? 0,
    memberDays,
    memberSince: profile.created_at,
    lawsContributed: lawsContributed ?? 0,
    predictionsCorrect,
    predictionsTotal,
    predictionAccuracy,
    topCategories,
    forBias,
    isOwnProfile,
  } satisfies DossierData)
}
