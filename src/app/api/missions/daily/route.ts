import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type MissionId =
  | 'vote_5'
  | 'vote_10'
  | 'write_argument'
  | 'write_cited_argument'
  | 'explore_category'
  | 'vote_voting_phase'
  | 'upvote_argument'
  | 'support_proposal'
  | 'streak_protect'

export type MissionIcon =
  | 'vote'
  | 'argument'
  | 'compass'
  | 'scale'
  | 'book'
  | 'thumbsup'
  | 'flame'
  | 'star'

export interface DailyMission {
  id: MissionId
  title: string
  description: string
  icon: MissionIcon
  reward_clout: number
  progress: number
  target: number
  completed: boolean
}

export interface DailyMissionsResponse {
  missions: DailyMission[]
  total_clout: number
  completed_count: number
  all_completed: boolean
  bonus_earned: boolean
  next_reset: string
  vote_streak: number
  is_authenticated: boolean
}

// ─── Mission pool ─────────────────────────────────────────────────────────────

interface MissionTemplate {
  id: MissionId
  title: string
  description: string
  icon: MissionIcon
  reward_clout: number
  target: number
}

const VOTE_SMALL: MissionTemplate = {
  id: 'vote_5', title: 'Five Votes',
  description: 'Cast 5 votes on any topics today',
  icon: 'vote', reward_clout: 10, target: 5,
}
const VOTE_LARGE: MissionTemplate = {
  id: 'vote_10', title: 'Ten Votes',
  description: 'Cast 10 votes on any topics today',
  icon: 'vote', reward_clout: 20, target: 10,
}
const WRITE_ARG: MissionTemplate = {
  id: 'write_argument', title: 'Make Your Case',
  description: 'Write an argument on any debate topic',
  icon: 'argument', reward_clout: 15, target: 1,
}
const WRITE_CITED: MissionTemplate = {
  id: 'write_cited_argument', title: 'Evidence-Based',
  description: 'Write an argument with a source URL attached',
  icon: 'argument', reward_clout: 25, target: 1,
}
const EXPLORE_CAT: MissionTemplate = {
  id: 'explore_category', title: 'Explore Broadly',
  description: 'Vote on topics in 3 different categories today',
  icon: 'compass', reward_clout: 15, target: 3,
}
const VOTING_PHASE: MissionTemplate = {
  id: 'vote_voting_phase', title: 'Shape the Outcome',
  description: 'Vote on 3 topics currently in the Voting phase',
  icon: 'scale', reward_clout: 20, target: 3,
}
const UPVOTE_ARG: MissionTemplate = {
  id: 'upvote_argument', title: 'Recognise Quality',
  description: 'Upvote 5 arguments you find compelling',
  icon: 'thumbsup', reward_clout: 5, target: 5,
}
const SUPPORT_PROP: MissionTemplate = {
  id: 'support_proposal', title: 'Back a Proposal',
  description: 'Support a proposed topic to help it activate',
  icon: 'star', reward_clout: 10, target: 1,
}
const STREAK_PROT: MissionTemplate = {
  id: 'streak_protect', title: 'Keep the Flame',
  description: 'Cast at least 1 vote to protect your streak',
  icon: 'flame', reward_clout: 5, target: 1,
}

// 7 daily sets indexed by UTC day-of-week (0=Sunday)
const DAILY_SETS: MissionTemplate[][] = [
  [VOTE_SMALL, WRITE_ARG, EXPLORE_CAT],       // Sunday
  [STREAK_PROT, VOTE_SMALL, WRITE_ARG],        // Monday
  [VOTE_LARGE, WRITE_CITED, VOTING_PHASE],     // Tuesday
  [VOTING_PHASE, WRITE_ARG, UPVOTE_ARG],       // Wednesday
  [VOTE_SMALL, EXPLORE_CAT, SUPPORT_PROP],     // Thursday
  [WRITE_CITED, VOTE_LARGE, UPVOTE_ARG],       // Friday
  [EXPLORE_CAT, VOTE_SMALL, WRITE_ARG],        // Saturday
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function utcDayStart(): string {
  const now = new Date()
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate())).toISOString()
}

function nextUtcMidnight(): string {
  const now = new Date()
  const tomorrow = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate() + 1))
  return tomorrow.toISOString()
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const dayStart = utcDayStart()
  const dayOfWeek = new Date().getUTCDay()
  const templates = DAILY_SETS[dayOfWeek]

  // ── Anonymous: static missions with zero progress ─────────────────────────
  if (!user) {
    const missions: DailyMission[] = templates.map((t) => ({
      id: t.id, title: t.title, description: t.description,
      icon: t.icon, reward_clout: t.reward_clout,
      progress: 0, target: t.target, completed: false,
    }))
    return NextResponse.json({
      missions,
      total_clout: missions.reduce((s, m) => s + m.reward_clout, 0),
      completed_count: 0,
      all_completed: false,
      bonus_earned: false,
      next_reset: nextUtcMidnight(),
      vote_streak: 0,
      is_authenticated: false,
    } satisfies DailyMissionsResponse)
  }

  // ── Authenticated: fetch progress in parallel ─────────────────────────────

  const [
    votesRes,
    argsRes,
    citedArgsRes,
    upvotesRes,
    supportsRes,
    profileRes,
  ] = await Promise.all([
    // All user votes today — we'll derive sub-metrics from this list
    supabase
      .from('votes')
      .select('id, topic_id')
      .eq('user_id', user.id)
      .gte('created_at', dayStart),

    // Arguments written today
    supabase
      .from('topic_arguments')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', dayStart),

    // Arguments with citations today
    supabase
      .from('topic_arguments')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .not('source_url', 'is', null)
      .gte('created_at', dayStart),

    // Argument upvotes today
    supabase
      .from('topic_argument_votes')
      .select('argument_id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', dayStart),

    // Proposal supports today
    supabase
      .from('topic_supports')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', dayStart),

    // Profile for streak
    supabase
      .from('profiles')
      .select('vote_streak')
      .eq('id', user.id)
      .maybeSingle(),
  ])

  const votesToday = votesRes.data ?? []
  const totalVotesToday = votesToday.length
  const argsToday = argsRes.count ?? 0
  const citedArgsToday = citedArgsRes.count ?? 0
  const upvotesToday = upvotesRes.count ?? 0
  const supportsToday = supportsRes.count ?? 0
  const voteStreak = profileRes.data?.vote_streak ?? 0

  // Fetch categories + statuses for today's voted topic_ids if any votes exist
  const categoriesVotedToday = new Set<string>()
  let votingPhaseVotesToday = 0

  if (votesToday.length > 0) {
    const topicIds = [...new Set(votesToday.map((v) => v.topic_id))]
    const { data: topicData } = await supabase
      .from('topics')
      .select('id, category, status')
      .in('id', topicIds)

    for (const t of topicData ?? []) {
      if (t.category) categoriesVotedToday.add(t.category)
      // Count votes per voting-phase topic
      if (t.status === 'voting') {
        votingPhaseVotesToday += votesToday.filter((v) => v.topic_id === t.id).length
      }
    }
  }

  // ── Resolve mission progress ───────────────────────────────────────────────
  function progress(id: MissionId): number {
    switch (id) {
      case 'vote_5':
      case 'vote_10':      return totalVotesToday
      case 'write_argument':    return argsToday
      case 'write_cited_argument': return citedArgsToday
      case 'explore_category': return categoriesVotedToday.size
      case 'vote_voting_phase': return votingPhaseVotesToday
      case 'upvote_argument':  return upvotesToday
      case 'support_proposal': return supportsToday
      case 'streak_protect':   return Math.min(totalVotesToday, 1)
      default: return 0
    }
  }

  const missions: DailyMission[] = templates.map((t) => {
    const p = Math.min(progress(t.id), t.target)
    return {
      id: t.id, title: t.title, description: t.description,
      icon: t.icon, reward_clout: t.reward_clout,
      progress: p, target: t.target, completed: p >= t.target,
    }
  })

  const completedCount = missions.filter((m) => m.completed).length
  const allCompleted = completedCount === missions.length

  return NextResponse.json({
    missions,
    total_clout: missions.reduce((s, m) => s + m.reward_clout, 0),
    completed_count: completedCount,
    all_completed: allCompleted,
    bonus_earned: allCompleted,
    next_reset: nextUtcMidnight(),
    vote_streak: voteStreak,
    is_authenticated: true,
  } satisfies DailyMissionsResponse)
}
