import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface CivicGoal {
  id: string
  label: string
  description: string
  target: number
  current: number
  unit: string
  completed: boolean
  pct: number
}

export interface GoalsResponse {
  authenticated: boolean
  weekStart: string
  weekEnd: string
  goals: CivicGoal[]
  completedCount: number
  allComplete: boolean
  streak: number
  clout: number
  encouragement: string
}

const ENCOURAGEMENTS_NONE = [
  'Every citizen journey starts with a single vote.',
  'The Lobby needs your voice. Start with one vote today.',
  'Great civic minds begin here. Cast your first vote.',
]

const ENCOURAGEMENTS_PARTIAL = [
  "You're making a difference. Keep going.",
  'Solid civic engagement this week. Push through to the finish.',
  "You're building something real. The Lobby needs your voice.",
  'Every vote, every argument moves the needle.',
]

const ENCOURAGEMENTS_ALL = [
  'Full civic duty achieved. The Lobby salutes you.',
  'Perfect week. You are what democracy looks like.',
  'All goals complete. Your influence grows with every session.',
  'The people have spoken — and you were among them.',
]

function pick<T>(arr: T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

/** ISO date string for Monday of the current week (UTC) */
function weekBounds(): { start: Date; end: Date } {
  const now = new Date()
  const dow = now.getUTCDay() // 0=Sun
  const daysSinceMonday = dow === 0 ? 6 : dow - 1
  const start = new Date(now)
  start.setUTCHours(0, 0, 0, 0)
  start.setUTCDate(now.getUTCDate() - daysSinceMonday)
  const end = new Date(start)
  end.setUTCDate(start.getUTCDate() + 7)
  return { start, end }
}

export async function GET() {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    if (!user) {
      return NextResponse.json<GoalsResponse>({
        authenticated: false,
        weekStart: '',
        weekEnd: '',
        goals: [],
        completedCount: 0,
        allComplete: false,
        streak: 0,
        clout: 0,
        encouragement: pick(ENCOURAGEMENTS_NONE),
      })
    }

    const { start, end } = weekBounds()
    const startISO = start.toISOString()
    const endISO = end.toISOString()

    // ── Parallel queries ──────────────────────────────────────────────────
    const [profileRes, votesRes, argsRes, debatesRes, upvotesRes] = await Promise.all([
      supabase
        .from('profiles')
        .select('vote_streak, clout, total_votes')
        .eq('id', user.id)
        .maybeSingle(),

      // Votes this week
      supabase
        .from('votes')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', startISO)
        .lt('created_at', endISO),

      // Arguments written this week
      supabase
        .from('arguments')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('created_at', startISO)
        .lt('created_at', endISO),

      // Debate participations this week
      supabase
        .from('debate_participants')
        .select('debate_id', { count: 'exact', head: true })
        .eq('user_id', user.id)
        .gte('joined_at', startISO)
        .lt('joined_at', endISO),

      // Argument upvotes received this week — count upvotes on the user's arguments
      supabase
        .from('argument_upvotes')
        .select('argument_id, arguments!inner(user_id)', { count: 'exact', head: true })
        .eq('arguments.user_id', user.id)
        .gte('created_at', startISO)
        .lt('created_at', endISO),
    ])

    const profile = profileRes.data
    const streak = profile?.vote_streak ?? 0
    const clout = profile?.clout ?? 0
    const totalVotes = profile?.total_votes ?? 0

    const votesThisWeek = votesRes.count ?? 0
    const argsThisWeek = argsRes.count ?? 0
    const debatesThisWeek = debatesRes.count ?? 0
    const upvotesThisWeek = upvotesRes.count ?? 0

    // ── Goal targets scale to engagement level ────────────────────────────
    // New users get gentler targets; veterans get more ambitious ones.
    const voteTarget = totalVotes < 10 ? 3 : totalVotes < 50 ? 5 : 7
    const argTarget = totalVotes < 10 ? 1 : totalVotes < 50 ? 2 : 3
    const streakTarget = streak < 7 ? Math.max(streak + 1, 3) : 7

    function goal(
      id: string,
      label: string,
      description: string,
      current: number,
      target: number,
      unit: string,
    ): CivicGoal {
      const pct = Math.min(100, Math.round((current / target) * 100))
      return { id, label, description, target, current, unit, completed: current >= target, pct }
    }

    const goals: CivicGoal[] = [
      goal('votes', 'Cast Votes', `Vote on ${voteTarget} topics this week`, votesThisWeek, voteTarget, 'votes'),
      goal('arguments', 'Write Arguments', `Contribute ${argTarget} arguments this week`, argsThisWeek, argTarget, 'arguments'),
      goal('debates', 'Attend a Debate', 'Join at least one live debate this week', debatesThisWeek, 1, 'debates'),
      goal('streak', 'Keep Your Streak', `Maintain a ${streakTarget}-day vote streak`, Math.min(streak, streakTarget), streakTarget, 'days'),
      goal('influence', 'Earn Upvotes', 'Get 5 upvotes on your arguments this week', upvotesThisWeek, 5, 'upvotes'),
    ]

    const completedCount = goals.filter((g) => g.completed).length
    const allComplete = completedCount === goals.length

    const encouragement = allComplete
      ? pick(ENCOURAGEMENTS_ALL)
      : completedCount === 0
      ? pick(ENCOURAGEMENTS_NONE)
      : pick(ENCOURAGEMENTS_PARTIAL)

    return NextResponse.json<GoalsResponse>({
      authenticated: true,
      weekStart: start.toISOString(),
      weekEnd: end.toISOString(),
      goals,
      completedCount,
      allComplete,
      streak,
      clout,
      encouragement,
    })
  } catch (err) {
    console.error('[/api/me/goals]', err)
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
