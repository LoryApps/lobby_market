import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface JourneyChapter {
  id: string
  phase: 'origin' | 'discovery' | 'rising' | 'established' | 'legend'
  title: string
  subtitle: string
  date: string
  detail: string | null
  link: string | null
  meta: Record<string, string | number | null>
}

export interface JourneyStats {
  daysActive: number
  lawsContributed: number
  topCategory: string | null
  foeSide: 'blue' | 'red' | 'balanced'
  longestStreak: number
}

export interface JourneyResponse {
  profile: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    clout: number
    reputation_score: number
    total_votes: number
    total_arguments: number
    vote_streak: number
    civic_archetype: string | null
    created_at: string
  }
  chapters: JourneyChapter[]
  stats: JourneyStats
  isOwnProfile: boolean
}

// ─── Route ─────────────────────────────────────────────────────────────────────

export async function GET(
  _request: NextRequest,
  { params }: { params: { username: string } }
) {
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, clout, reputation_score, total_votes, total_arguments, blue_vote_count, red_vote_count, vote_streak, civic_archetype, category_preferences, created_at')
    .eq('username', params.username)
    .maybeSingle()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  const { data: { user } } = await supabase.auth.getUser()
  const isOwnProfile = user?.id === profile.id
  const userId = profile.id

  // ── Parallel data fetches ──────────────────────────────────────────────────

  const [
    firstVoteRes,
    firstArgRes,
    firstDebateRes,
    achievementsRes,
    topArgRes,
    lawContribRes,
    categoryVotesRes,
  ] = await Promise.all([
    // First vote ever cast
    supabase
      .from('votes')
      .select('id, side, created_at, topic_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1),

    // First argument ever posted (topic_arguments table, user_id field)
    supabase
      .from('topic_arguments')
      .select('id, side, created_at, upvotes, ai_score, topic_id')
      .eq('user_id', userId)
      .order('created_at', { ascending: true })
      .limit(1),

    // First debate participated in
    supabase
      .from('debate_participants')
      .select('id, joined_at, side, debate_id')
      .eq('user_id', userId)
      .order('joined_at', { ascending: true })
      .limit(1),

    // All achievements earned (chronological)
    supabase
      .from('user_achievements')
      .select('id, earned_at, achievement_id')
      .eq('user_id', userId)
      .order('earned_at', { ascending: true })
      .limit(50),

    // Top argument (most upvoted)
    supabase
      .from('topic_arguments')
      .select('id, side, upvotes, ai_score, created_at, topic_id')
      .eq('user_id', userId)
      .order('upvotes', { ascending: false })
      .limit(1),

    // Count laws the user voted FOR that passed (topics with status=law)
    supabase
      .from('votes')
      .select('topic_id')
      .eq('user_id', userId)
      .eq('side', 'blue')
      .limit(500),

    // Sample of votes to compute top category
    supabase
      .from('votes')
      .select('topic_id')
      .eq('user_id', userId)
      .limit(500),
  ])

  // ── Enrich first vote with topic info ─────────────────────────────────────

  const firstVote = firstVoteRes.data?.[0] ?? null
  let firstVoteStatement: string | null = null
  let firstVoteCategory: string | null = null

  if (firstVote?.topic_id) {
    const { data: topicData } = await supabase
      .from('topics')
      .select('statement, category')
      .eq('id', firstVote.topic_id)
      .maybeSingle()
    firstVoteStatement = topicData?.statement ?? null
    firstVoteCategory = topicData?.category ?? null
  }

  // ── Enrich first argument with topic info ─────────────────────────────────

  const firstArg = firstArgRes.data?.[0] ?? null
  let firstArgStatement: string | null = null

  if (firstArg?.topic_id) {
    const { data: topicData } = await supabase
      .from('topics')
      .select('statement')
      .eq('id', firstArg.topic_id)
      .maybeSingle()
    firstArgStatement = topicData?.statement ?? null
  }

  // ── Enrich top argument with topic info ──────────────────────────────────

  const topArg = topArgRes.data?.[0] ?? null
  let topArgStatement: string | null = null
  let topArgCategory: string | null = null

  if (topArg?.topic_id) {
    const { data: topicData } = await supabase
      .from('topics')
      .select('statement, category')
      .eq('id', topArg.topic_id)
      .maybeSingle()
    topArgStatement = topicData?.statement ?? null
    topArgCategory = topicData?.category ?? null
  }

  // ── Enrich top argument with topic info ──────────────────────────────────

  const firstDebate = firstDebateRes.data?.[0] ?? null
  let firstDebateStatement: string | null = null
  let firstDebateTopicId: string | null = null

  if (firstDebate?.debate_id) {
    const { data: debateData } = await supabase
      .from('debates')
      .select('topic_id')
      .eq('id', firstDebate.debate_id)
      .maybeSingle()
    if (debateData?.topic_id) {
      firstDebateTopicId = debateData.topic_id
      const { data: topicData } = await supabase
        .from('topics')
        .select('statement')
        .eq('id', debateData.topic_id)
        .maybeSingle()
      firstDebateStatement = topicData?.statement ?? null
    }
  }

  // ── Enrich first achievement ──────────────────────────────────────────────

  const firstUserAch = achievementsRes.data?.[0] ?? null
  let achName: string | null = null
  let achDescription: string | null = null
  let achTier: string | null = null

  if (firstUserAch?.achievement_id) {
    const { data: achData } = await supabase
      .from('achievements')
      .select('name, description, tier')
      .eq('id', firstUserAch.achievement_id)
      .maybeSingle()
    achName = achData?.name ?? null
    achDescription = achData?.description ?? null
    achTier = achData?.tier ?? null
  }

  // ── Count laws user contributed to ───────────────────────────────────────

  const lawTopicIds = (lawContribRes.data ?? []).map((r) => r.topic_id).filter(Boolean)
  let lawsContributed = 0
  let firstLawStatement: string | null = null
  let firstLawTopicId: string | null = null
  let firstLawDate: string | null = null

  if (lawTopicIds.length > 0) {
    const { data: lawTopics } = await supabase
      .from('topics')
      .select('id, statement, status, updated_at')
      .in('id', lawTopicIds.slice(0, 100))
      .eq('status', 'law')
      .limit(10)
    lawsContributed = lawTopics?.length ?? 0
    if (lawTopics && lawTopics.length > 0) {
      firstLawStatement = lawTopics[0].statement
      firstLawTopicId = lawTopics[0].id
      firstLawDate = lawTopics[0].updated_at
    }
  }

  // ── Compute top category from vote history ────────────────────────────────

  const voteTopicIds = (categoryVotesRes.data ?? []).map((r) => r.topic_id).filter(Boolean)
  const catCounts: Record<string, number> = {}
  let topCategory: string | null = null

  if (voteTopicIds.length > 0) {
    const { data: topicCats } = await supabase
      .from('topics')
      .select('category')
      .in('id', voteTopicIds.slice(0, 200))
    for (const row of topicCats ?? []) {
      if (row.category) catCounts[row.category] = (catCounts[row.category] ?? 0) + 1
    }
    topCategory = Object.entries(catCounts).sort((a, b) => b[1] - a[1])[0]?.[0] ?? null
  }

  // ── Derived stats ─────────────────────────────────────────────────────────

  const joinedAt = new Date(profile.created_at)
  const now = new Date()
  const daysActive = Math.floor((now.getTime() - joinedAt.getTime()) / 86_400_000)

  const blueVotes = profile.blue_vote_count ?? 0
  const redVotes = profile.red_vote_count ?? 0
  const totalVotes = blueVotes + redVotes
  let foeSide: 'blue' | 'red' | 'balanced' = 'balanced'
  if (totalVotes > 0) {
    if (blueVotes / totalVotes >= 0.6) foeSide = 'blue'
    else if (redVotes / totalVotes >= 0.6) foeSide = 'red'
  }

  // ── Build chapters ───────────────────────────────────────────────────────

  const chapters: JourneyChapter[] = []

  // Chapter: Origin
  const catPrefs = (profile.category_preferences as string[] | null) ?? []
  chapters.push({
    id: 'origin',
    phase: 'origin',
    title: 'Entered the Lobby',
    subtitle: 'Your civic journey began',
    date: profile.created_at,
    detail: catPrefs.length > 0
      ? `Initial interests: ${catPrefs.slice(0, 3).join(', ')}`
      : null,
    link: `/profile/${profile.username}`,
    meta: { daysAgo: daysActive },
  })

  // Chapter: First Vote
  if (firstVote) {
    chapters.push({
      id: 'first_vote',
      phase: 'discovery',
      title: 'Cast Your First Vote',
      subtitle: firstVoteStatement
        ? `"${firstVoteStatement.slice(0, 72)}${firstVoteStatement.length > 72 ? '…' : ''}"`
        : 'Your first civic act',
      date: firstVote.created_at,
      detail: firstVote.side === 'blue' ? 'You voted FOR' : 'You voted AGAINST',
      link: firstVote.topic_id ? `/topic/${firstVote.topic_id}` : null,
      meta: {
        side: firstVote.side,
        category: firstVoteCategory,
      },
    })
  }

  // Chapter: First Argument
  if (firstArg) {
    chapters.push({
      id: 'first_argument',
      phase: 'discovery',
      title: 'Wrote Your First Argument',
      subtitle: firstArgStatement
        ? `On: "${firstArgStatement.slice(0, 60)}${firstArgStatement.length > 60 ? '…' : ''}"`
        : 'Your voice entered the chamber',
      date: firstArg.created_at,
      detail: firstArg.ai_score != null
        ? `AI quality score: ${firstArg.ai_score}/100`
        : null,
      link: firstArg.id ? `/arguments/${firstArg.id}` : null,
      meta: {
        upvotes: firstArg.upvotes ?? 0,
        aiScore: firstArg.ai_score ?? null,
        side: firstArg.side,
      },
    })
  }

  // Chapter: First Debate
  if (firstDebate) {
    chapters.push({
      id: 'first_debate',
      phase: 'rising',
      title: 'Entered the Arena',
      subtitle: firstDebateStatement
        ? `Debated: "${firstDebateStatement.slice(0, 60)}${firstDebateStatement.length > 60 ? '…' : ''}"`
        : 'Stepped into the live debate arena',
      date: firstDebate.joined_at,
      detail: firstDebate.side === 'blue' ? 'Argued FOR' : 'Argued AGAINST',
      link: firstDebateTopicId ? `/topic/${firstDebateTopicId}/debate` : (firstDebate.debate_id ? `/debate/${firstDebate.debate_id}` : null),
      meta: { side: firstDebate.side },
    })
  }

  // Chapter: First Achievement
  if (firstUserAch) {
    chapters.push({
      id: 'first_achievement',
      phase: 'rising',
      title: `Earned: ${achName ?? 'First Achievement'}`,
      subtitle: achDescription ?? 'Your first badge of honour',
      date: firstUserAch.earned_at,
      detail: achTier ? `Tier: ${achTier}` : null,
      link: `/profile/${profile.username}/achievements`,
      meta: { tier: achTier },
    })
  }

  // Chapter: Top Argument
  if (topArg && (topArg.upvotes ?? 0) > 0 && topArg.id !== firstArg?.id) {
    chapters.push({
      id: 'top_argument',
      phase: 'established',
      title: 'Peak Persuasion',
      subtitle: topArgStatement
        ? `On: "${topArgStatement.slice(0, 60)}${topArgStatement.length > 60 ? '…' : ''}"`
        : 'Your most impactful argument',
      date: topArg.created_at,
      detail: `${topArg.upvotes ?? 0} upvotes${topArg.ai_score != null ? ` · AI score ${topArg.ai_score}/100` : ''}`,
      link: topArg.id ? `/arguments/${topArg.id}` : null,
      meta: {
        upvotes: topArg.upvotes ?? 0,
        aiScore: topArg.ai_score ?? null,
        category: topArgCategory,
      },
    })
  }

  // Chapter: Law contribution
  if (lawsContributed > 0 && firstLawStatement) {
    chapters.push({
      id: 'law_contribution',
      phase: 'legend',
      title: `Helped Write ${lawsContributed === 1 ? 'a Law' : `${lawsContributed} Laws`}`,
      subtitle: `"${firstLawStatement.slice(0, 68)}${firstLawStatement.length > 68 ? '…' : ''}"${lawsContributed > 1 ? ` +${lawsContributed - 1} more` : ''}`,
      date: firstLawDate ?? profile.created_at,
      detail: `${lawsContributed} established law${lawsContributed !== 1 ? 's' : ''} carry your vote`,
      link: firstLawTopicId ? `/topic/${firstLawTopicId}/laws` : `/profile/${profile.username}/laws`,
      meta: { lawCount: lawsContributed },
    })
  }

  // Chapter: Role milestone
  if (profile.role && profile.role !== 'person') {
    const roleLabels: Record<string, string> = {
      debator: 'Recognised as a Debator',
      troll_catcher: 'Appointed Troll Catcher',
      elder: 'Ascended to Elder',
    }
    const roleDetail: Record<string, string> = {
      debator: 'Your debate contributions earned you a title',
      troll_catcher: 'Trusted to maintain civic integrity',
      elder: 'A voice of authority in the Lobby',
    }
    chapters.push({
      id: 'role_upgrade',
      phase: 'legend',
      title: roleLabels[profile.role] ?? `Promoted: ${profile.role}`,
      subtitle: roleDetail[profile.role] ?? 'Your reputation earned you a new role',
      date: profile.created_at,
      detail: null,
      link: `/profile/${profile.username}`,
      meta: { role: profile.role },
    })
  }

  // Sort: keep origin first, sort rest chronologically
  const [origin, ...rest] = chapters
  rest.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  const sorted = [origin, ...rest]

  const stats: JourneyStats = {
    daysActive,
    lawsContributed,
    topCategory,
    foeSide,
    longestStreak: profile.vote_streak ?? 0,
  }

  const response: JourneyResponse = {
    profile: {
      id: profile.id,
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      role: profile.role,
      clout: profile.clout,
      reputation_score: profile.reputation_score,
      total_votes: profile.total_votes,
      total_arguments: profile.total_arguments,
      vote_streak: profile.vote_streak,
      civic_archetype: profile.civic_archetype,
      created_at: profile.created_at,
    },
    chapters: sorted,
    stats,
    isOwnProfile,
  }

  return NextResponse.json(response)
}
