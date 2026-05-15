import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const ALL_CATEGORIES = [
  'Politics', 'Economics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

export type LensArchetype =
  | 'contrarian' | 'maverick' | 'oracle' | 'specialist' | 'balanced' | 'newcomer'

const ARCHETYPE_META: Record<LensArchetype, { label: string; description: string; emoji: string }> = {
  contrarian: { label: 'The Contrarian',  description: 'You consistently break from majority opinion.', emoji: '⚡' },
  maverick:   { label: 'The Maverick',    description: 'Broad engagement with a strong independent streak.', emoji: '🦅' },
  oracle:     { label: 'The Oracle',      description: 'Wide-ranging and in tune with community consensus.', emoji: '🔮' },
  specialist: { label: 'The Specialist',  description: 'Deep focus in your chosen categories.', emoji: '🎯' },
  balanced:   { label: 'The Moderate',    description: 'Well-rounded civic presence across issues.', emoji: '⚖️' },
  newcomer:   { label: 'The Newcomer',    description: 'Still building your civic record.', emoji: '🌱' },
}

function resolveArchetype(
  totalVotes: number,
  diversityScore: number,
  alignmentScore: number,
  contrarianScore: number,
): LensArchetype {
  if (totalVotes < 10) return 'newcomer'
  if (diversityScore < 40 && contrarianScore > 60) return 'contrarian'
  if (diversityScore > 60 && contrarianScore > 50) return 'maverick'
  if (diversityScore > 60 && alignmentScore > 60) return 'oracle'
  if (diversityScore < 40 && alignmentScore > 60) return 'specialist'
  return 'balanced'
}

export interface TopCategory {
  category: string
  voteCount: number
  forPct: number
}

export interface SnapshotData {
  username: string
  displayName: string | null
  avatarUrl: string | null
  role: string
  memberSince: string
  totalVotes: number
  totalArguments: number
  clout: number
  reputationScore: number
  voteStreak: number
  followersCount: number
  forPct: number
  diversityScore: number
  alignmentScore: number
  contrarianScore: number
  categoriesEngaged: number
  archetype: LensArchetype
  archetypeLabel: string
  archetypeDescription: string
  archetypeEmoji: string
  topCategories: TopCategory[]
  topicVotes: number
  lawsHelped: number
  totalDebates: number
}

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // 1. Profile
  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'username, display_name, avatar_url, role, clout, reputation_score, ' +
      'total_votes, total_arguments, blue_vote_count, red_vote_count, ' +
      'vote_streak, followers_count, created_at',
    )
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  // 2. Vote breakdown by category (last 300 votes for performance)
  const { data: voteRows } = await supabase
    .from('votes')
    .select('side, created_at, topics(category, blue_pct, status)')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(300)

  const votes = (voteRows ?? []).map((v) => {
    const t = v.topics as { category?: string | null; blue_pct?: number | null; status?: string } | null
    return {
      side: v.side as 'blue' | 'red',
      category: t?.category ?? null,
      bluePct: t?.blue_pct ?? 50,
      status: t?.status ?? 'proposed',
    }
  })

  // 3. Category stats
  const catMap = new Map<string, { for: number; against: number }>()
  for (const v of votes) {
    if (!v.category) continue
    const cur = catMap.get(v.category) ?? { for: 0, against: 0 }
    if (v.side === 'blue') cur.for++; else cur.against++
    catMap.set(v.category, cur)
  }

  const topCategories: TopCategory[] = Array.from(catMap.entries())
    .map(([category, counts]) => ({
      category,
      voteCount: counts.for + counts.against,
      forPct: Math.round((counts.for / (counts.for + counts.against)) * 100),
    }))
    .sort((a, b) => b.voteCount - a.voteCount)
    .slice(0, 3)

  // 4. Lens scores
  const totalVotes = votes.length
  const categoriesEngaged = catMap.size

  const canonicalCoverage = ALL_CATEGORIES.filter((c) => catMap.has(c)).length
  const diversityScore = Math.round((canonicalCoverage / ALL_CATEGORIES.length) * 100)

  // Community FOR% per category (platform-wide blue_pct average per category)
  const { data: communityRows } = await supabase
    .from('topics')
    .select('category, blue_pct')
    .not('category', 'is', null)

  const communityMap = new Map<string, { sum: number; count: number }>()
  for (const row of communityRows ?? []) {
    if (!row.category || row.blue_pct == null) continue
    const cur = communityMap.get(row.category) ?? { sum: 0, count: 0 }
    cur.sum += row.blue_pct
    cur.count++
    communityMap.set(row.category, cur)
  }

  let alignmentSum = 0, alignmentWeight = 0
  for (const [cat, counts] of catMap.entries()) {
    const comm = communityMap.get(cat)
    if (!comm || comm.count === 0) continue
    const userForPct = (counts.for / (counts.for + counts.against)) * 100
    const commForPct = comm.sum / comm.count
    const divergence = Math.abs(userForPct - commForPct)
    alignmentSum += (100 - divergence) * (counts.for + counts.against)
    alignmentWeight += counts.for + counts.against
  }
  const alignmentScore = alignmentWeight > 0 ? Math.round(alignmentSum / alignmentWeight) : 50

  const contrarianCount = votes.filter((v) => {
    const sidePct = v.side === 'blue' ? v.bluePct : 100 - v.bluePct
    return sidePct < 45
  }).length
  const contrarianScore = totalVotes > 0 ? Math.round((contrarianCount / totalVotes) * 100) : 0

  const archetype = resolveArchetype(totalVotes, diversityScore, alignmentScore, contrarianScore)
  const archetypeMeta = ARCHETYPE_META[archetype]

  // 5. Laws helped (topics voted FOR that became law, or voted AGAINST that failed)
  const lawsHelped = votes.filter(
    (v) => (v.side === 'blue' && v.status === 'law') || (v.side === 'red' && v.status === 'failed'),
  ).length

  // 6. Debates count
  const { count: debateCount } = await supabase
    .from('debate_participants')
    .select('debate_id', { count: 'exact', head: true })
    .eq('user_id', user.id)

  // 7. FOR/AGAINST pct from profile
  const blueVotes = profile.blue_vote_count ?? 0
  const redVotes = profile.red_vote_count ?? 0
  const totalFromProfile = blueVotes + redVotes
  const forPct = totalFromProfile > 0 ? Math.round((blueVotes / totalFromProfile) * 100) : 50

  const result: SnapshotData = {
    username: profile.username,
    displayName: profile.display_name,
    avatarUrl: profile.avatar_url,
    role: profile.role,
    memberSince: profile.created_at,
    totalVotes: profile.total_votes ?? 0,
    totalArguments: profile.total_arguments ?? 0,
    clout: profile.clout ?? 0,
    reputationScore: profile.reputation_score ?? 0,
    voteStreak: profile.vote_streak ?? 0,
    followersCount: profile.followers_count ?? 0,
    forPct,
    diversityScore,
    alignmentScore,
    contrarianScore,
    categoriesEngaged,
    archetype,
    archetypeLabel: archetypeMeta.label,
    archetypeDescription: archetypeMeta.description,
    archetypeEmoji: archetypeMeta.emoji,
    topCategories,
    topicVotes: totalVotes,
    lawsHelped,
    totalDebates: debateCount ?? 0,
  }

  return NextResponse.json(result, {
    headers: { 'Cache-Control': 'private, max-age=120, stale-while-revalidate=240' },
  })
}
