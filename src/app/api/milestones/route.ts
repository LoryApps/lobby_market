import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ─────────────────────────────────────────────────────────────────────

export type MilestoneType =
  | 'joined'
  | 'first_vote'
  | 'first_argument'
  | 'first_debate'
  | 'first_law_vote'
  | 'first_achievement'
  | 'vote_100'
  | 'vote_500'
  | 'vote_1000'
  | 'vote_5000'
  | 'argument_10_upvotes'
  | 'argument_50_upvotes'
  | 'argument_100_upvotes'
  | 'first_follower'
  | 'streak_7'
  | 'streak_30'
  | 'clout_100'
  | 'clout_500'
  | 'clout_1000'
  | 'influencer'
  | 'first_prediction'
  | 'first_topic_created'

export interface Milestone {
  type: MilestoneType
  title: string
  description: string
  date: string
  /** context data: topic statement, law title, etc. */
  context?: {
    topicId?: string
    topicStatement?: string
    topicCategory?: string | null
    lawId?: string
    argumentId?: string
    argumentContent?: string
    debateId?: string
    achievementName?: string
  }
  achieved: boolean
}

export interface MilestonesResponse {
  milestones: Milestone[]
  stats: {
    memberSince: string
    totalVotes: number
    totalArguments: number
    clout: number
    bestStreak: number
    currentStreak: number
    followers: number
    reputation: number
  }
  nextMilestone: Milestone | null
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Fetch profile ────────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select(
      'created_at, total_votes, total_arguments, clout, vote_streak, ' +
      'followers_count, following_count, reputation_score, is_influencer'
    )
    .eq('id', user.id)
    .maybeSingle()

  if (!profile) {
    return NextResponse.json({ error: 'Profile not found' }, { status: 404 })
  }

  // ── Parallel fetches ─────────────────────────────────────────────────────
  const [
    firstVoteRes,
    firstArgRes,
    firstDebateRes,
    topArgRes,
    firstAchRes,
    firstPredRes,
    firstTopicRes,
  ] = await Promise.all([
    // First vote ever
    supabase
      .from('votes')
      .select('id, topic_id, side, created_at, topics!inner(statement, category, status)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),

    // First argument ever
    supabase
      .from('topic_arguments')
      .select('id, content, upvotes, topic_id, side, created_at, topics!inner(statement, category)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),

    // First debate joined
    supabase
      .from('debate_participants')
      .select('id, debate_id, side, joined_at, debates!inner(id, title, topic_id)')
      .eq('user_id', user.id)
      .order('joined_at', { ascending: true })
      .limit(1)
      .maybeSingle(),

    // Best upvoted argument
    supabase
      .from('topic_arguments')
      .select('id, content, upvotes, topic_id, created_at, topics!inner(statement, category)')
      .eq('user_id', user.id)
      .order('upvotes', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // First achievement earned
    supabase
      .from('user_achievements')
      .select('id, achievement_id, earned_at, achievements!inner(id, name, description, icon, rarity)')
      .eq('user_id', user.id)
      .order('earned_at', { ascending: true })
      .limit(1)
      .maybeSingle(),

    // First prediction
    supabase
      .from('predictions')
      .select('id, topic_id, created_at, topics!inner(statement, category)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),

    // First topic created
    supabase
      .from('topics')
      .select('id, statement, category, status, created_at')
      .eq('author_id', user.id)
      .order('created_at', { ascending: true })
      .limit(1)
      .maybeSingle(),
  ])

  // ── First law vote: user voted FOR a topic that became law ───────────────
  const { data: lawVoteRows } = await supabase
    .from('votes')
    .select('id, topic_id, created_at, topics!inner(id, statement, category, status)')
    .eq('user_id', user.id)
    .eq('side', 'blue')
    .eq('topics.status', 'law')
    .order('created_at', { ascending: true })
    .limit(1)

  const firstLawVote = lawVoteRows?.[0] ?? null

  // ── Build milestones ─────────────────────────────────────────────────────
  const milestones: Milestone[] = []
  const totalVotes = profile.total_votes ?? 0
  const totalArgs = profile.total_arguments ?? 0
  const clout = profile.clout ?? 0
  const bestUpvotes = topArgRes.data?.upvotes ?? 0

  // Joined
  milestones.push({
    type: 'joined',
    title: 'Joined the Lobby',
    description: 'You became a citizen of Lobby Market.',
    date: profile.created_at,
    achieved: true,
  })

  // First vote
  const fv = firstVoteRes.data as typeof firstVoteRes.data & {
    topics?: { statement: string; category: string | null; status: string } | null
  } | null
  if (fv) {
    const topic = Array.isArray(fv.topics) ? fv.topics[0] : fv.topics
    milestones.push({
      type: 'first_vote',
      title: 'First Vote Cast',
      description: `You voted ${fv.side === 'blue' ? 'FOR' : 'AGAINST'} your first debate.`,
      date: fv.created_at,
      context: {
        topicId: fv.topic_id,
        topicStatement: topic?.statement,
        topicCategory: topic?.category,
      },
      achieved: true,
    })
  } else {
    milestones.push({
      type: 'first_vote',
      title: 'Cast Your First Vote',
      description: 'Vote on any debate topic to unlock this milestone.',
      date: '',
      achieved: false,
    })
  }

  // First argument
  const fa = firstArgRes.data as typeof firstArgRes.data & {
    topics?: { statement: string; category: string | null } | null
  } | null
  if (fa) {
    const topic = Array.isArray(fa.topics) ? fa.topics[0] : fa.topics
    milestones.push({
      type: 'first_argument',
      title: 'First Argument Made',
      description: `You entered the debate with your first argument.`,
      date: fa.created_at,
      context: {
        topicId: fa.topic_id,
        topicStatement: topic?.statement,
        topicCategory: topic?.category,
        argumentId: fa.id,
        argumentContent: fa.content,
      },
      achieved: true,
    })
  } else {
    milestones.push({
      type: 'first_argument',
      title: 'Make Your First Argument',
      description: 'Submit an argument on any debate to unlock this milestone.',
      date: '',
      achieved: false,
    })
  }

  // First debate
  const fd = firstDebateRes.data as typeof firstDebateRes.data & {
    debates?: { id: string; title: string; topic_id: string } | null
  } | null
  if (fd) {
    const debate = Array.isArray(fd.debates) ? fd.debates[0] : fd.debates
    milestones.push({
      type: 'first_debate',
      title: 'First Debate Joined',
      description: 'You stepped into the live debate arena.',
      date: fd.joined_at,
      context: {
        debateId: debate?.id,
        topicId: debate?.topic_id,
      },
      achieved: true,
    })
  } else {
    milestones.push({
      type: 'first_debate',
      title: 'Join Your First Debate',
      description: 'Participate in a live debate to unlock this milestone.',
      date: '',
      achieved: false,
    })
  }

  // First law vote
  const flv = firstLawVote as typeof firstLawVote & {
    topics?: { id: string; statement: string; category: string | null; status: string } | null
  } | null
  if (flv) {
    const topic = Array.isArray(flv.topics) ? flv.topics[0] : flv.topics
    milestones.push({
      type: 'first_law_vote',
      title: 'Voted for a Law',
      description: 'You voted FOR a debate that became an established Law.',
      date: flv.created_at,
      context: {
        topicId: flv.topic_id,
        topicStatement: topic?.statement,
        topicCategory: topic?.category,
      },
      achieved: true,
    })
  } else {
    milestones.push({
      type: 'first_law_vote',
      title: 'Vote on a Future Law',
      description: 'Vote FOR a debate that eventually becomes an established Law.',
      date: '',
      achieved: false,
    })
  }

  // First achievement
  const fach = firstAchRes.data as typeof firstAchRes.data & {
    achievements?: { id: string; name: string; description: string; icon: string; rarity: string } | null
  } | null
  if (fach) {
    const ach = Array.isArray(fach.achievements) ? fach.achievements[0] : fach.achievements
    milestones.push({
      type: 'first_achievement',
      title: 'First Achievement Earned',
      description: ach?.name ? `You earned "${ach.name}".` : 'You earned your first achievement.',
      date: fach.earned_at,
      context: { achievementName: ach?.name },
      achieved: true,
    })
  } else {
    milestones.push({
      type: 'first_achievement',
      title: 'Earn Your First Achievement',
      description: 'Complete any civic action to unlock your first achievement badge.',
      date: '',
      achieved: false,
    })
  }

  // Vote count milestones
  const VOTE_MILESTONES: Array<{ type: MilestoneType; count: number; title: string }> = [
    { type: 'vote_100', count: 100, title: '100 Votes Cast' },
    { type: 'vote_500', count: 500, title: '500 Votes Cast' },
    { type: 'vote_1000', count: 1000, title: '1,000 Votes Cast' },
    { type: 'vote_5000', count: 5000, title: '5,000 Votes Cast' },
  ]
  for (const vm of VOTE_MILESTONES) {
    milestones.push({
      type: vm.type,
      title: vm.title,
      description: `You have cast ${vm.count.toLocaleString()} votes across all debates.`,
      date: totalVotes >= vm.count ? profile.created_at : '',
      achieved: totalVotes >= vm.count,
    })
  }

  // Argument upvote milestones
  const ARG_MILESTONES: Array<{ type: MilestoneType; count: number; title: string }> = [
    { type: 'argument_10_upvotes', count: 10, title: 'Argument Resonated' },
    { type: 'argument_50_upvotes', count: 50, title: 'Argument Went Viral' },
    { type: 'argument_100_upvotes', count: 100, title: 'Argument Iconic' },
  ]
  for (const am of ARG_MILESTONES) {
    const achieved = bestUpvotes >= am.count
    const topArg = topArgRes.data as typeof topArgRes.data & {
      topics?: { statement: string; category: string | null } | null
    } | null
    const argTopic = topArg ? (Array.isArray(topArg.topics) ? topArg.topics[0] : topArg.topics) : null
    milestones.push({
      type: am.type,
      title: am.title,
      description: `One of your arguments received ${am.count}+ upvotes.`,
      date: achieved && topArg ? topArg.created_at : '',
      context: achieved && topArg
        ? {
            argumentId: topArg.id,
            argumentContent: topArg.content,
            topicId: topArg.topic_id,
            topicStatement: argTopic?.statement,
            topicCategory: argTopic?.category,
          }
        : undefined,
      achieved,
    })
  }

  // Clout milestones
  const CLOUT_MILESTONES: Array<{ type: MilestoneType; amount: number; title: string }> = [
    { type: 'clout_100', amount: 100, title: '100 Clout Earned' },
    { type: 'clout_500', amount: 500, title: '500 Clout Earned' },
    { type: 'clout_1000', amount: 1000, title: '1,000 Clout Earned' },
  ]
  for (const cm of CLOUT_MILESTONES) {
    milestones.push({
      type: cm.type,
      title: cm.title,
      description: `You have earned ${cm.amount.toLocaleString()} clout points.`,
      date: clout >= cm.amount ? profile.created_at : '',
      achieved: clout >= cm.amount,
    })
  }

  // Streak milestones
  const streak = profile.vote_streak ?? 0
  milestones.push({
    type: 'streak_7',
    title: '7-Day Vote Streak',
    description: 'You voted every day for 7 consecutive days.',
    date: streak >= 7 ? profile.created_at : '',
    achieved: streak >= 7,
  })
  milestones.push({
    type: 'streak_30',
    title: '30-Day Vote Streak',
    description: 'A full month of daily civic participation.',
    date: streak >= 30 ? profile.created_at : '',
    achieved: streak >= 30,
  })

  // Influencer
  milestones.push({
    type: 'influencer',
    title: 'Became an Influencer',
    description: 'Your civic reputation qualified you as a platform influencer.',
    date: profile.is_influencer ? profile.created_at : '',
    achieved: !!profile.is_influencer,
  })

  // First prediction
  const fp = firstPredRes.data as typeof firstPredRes.data & {
    topics?: { statement: string; category: string | null } | null
  } | null
  if (fp) {
    const topic = Array.isArray(fp.topics) ? fp.topics[0] : fp.topics
    milestones.push({
      type: 'first_prediction',
      title: 'First Prediction Made',
      description: 'You predicted the outcome of a civic debate.',
      date: fp.created_at,
      context: {
        topicId: fp.topic_id,
        topicStatement: topic?.statement,
        topicCategory: topic?.category,
      },
      achieved: true,
    })
  } else {
    milestones.push({
      type: 'first_prediction',
      title: 'Make Your First Prediction',
      description: 'Predict the outcome of any debate to unlock this milestone.',
      date: '',
      achieved: false,
    })
  }

  // First topic created
  const ftc = firstTopicRes.data
  if (ftc) {
    milestones.push({
      type: 'first_topic_created',
      title: 'First Topic Proposed',
      description: 'You proposed a debate for the community to vote on.',
      date: ftc.created_at,
      context: {
        topicId: ftc.id,
        topicStatement: ftc.statement,
        topicCategory: ftc.category,
      },
      achieved: true,
    })
  } else {
    milestones.push({
      type: 'first_topic_created',
      title: 'Propose a Debate Topic',
      description: 'Submit a new topic for the community to debate.',
      date: '',
      achieved: false,
    })
  }

  // First follower
  milestones.push({
    type: 'first_follower',
    title: 'First Follower',
    description: 'Another citizen followed your civic journey.',
    date: (profile.followers_count ?? 0) >= 1 ? profile.created_at : '',
    achieved: (profile.followers_count ?? 0) >= 1,
  })

  // ── Sort: achieved milestones first (by date), then unachieved ──────────
  const achieved = milestones
    .filter((m) => m.achieved && m.date)
    .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  const unachieved = milestones.filter((m) => !m.achieved)

  const sorted = [...achieved, ...unachieved]

  // Next milestone: first unachieved
  const nextMilestone = unachieved[0] ?? null

  const response: MilestonesResponse = {
    milestones: sorted,
    stats: {
      memberSince: profile.created_at,
      totalVotes,
      totalArguments: totalArgs,
      clout,
      bestStreak: streak,
      currentStreak: streak,
      followers: profile.followers_count ?? 0,
      reputation: profile.reputation_score ?? 0,
    },
    nextMilestone,
  }

  return NextResponse.json(response)
}
