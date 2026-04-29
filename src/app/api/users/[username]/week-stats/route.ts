import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WeekStatDay {
  date: string
  count: number
}

export interface WeekStatCategory {
  category: string
  count: number
}

export interface WeekTopArgument {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  topic_statement: string
}

export interface WeekAchievement {
  id: string
  name: string
  icon: string
}

export interface UserWeekStats {
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  week_start: string
  week_end: string
  votes_total: number
  votes_blue: number
  votes_red: number
  votes_by_day: WeekStatDay[]
  arguments_count: number
  top_argument: WeekTopArgument | null
  achievements: WeekAchievement[]
  top_categories: WeekStatCategory[]
  clout_current: number
  streak_current: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getWeekBounds(): { start: string; end: string } {
  const now = new Date()
  const dow = now.getUTCDay() // 0=Sun
  const monday = new Date(now)
  monday.setUTCDate(now.getUTCDate() - ((dow + 6) % 7))
  monday.setUTCHours(0, 0, 0, 0)
  const sunday = new Date(monday)
  sunday.setUTCDate(monday.getUTCDate() + 6)
  sunday.setUTCHours(23, 59, 59, 999)
  return {
    start: monday.toISOString(),
    end: sunday.toISOString(),
  }
}

// ─── GET /api/users/[username]/week-stats ─────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { username: string } }
) {
  const supabase = await createClient()
  const { username } = params

  // Look up profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, clout, vote_streak')
    .eq('username', username)
    .maybeSingle()

  if (!profile) {
    return NextResponse.json({ error: 'User not found' }, { status: 404 })
  }

  const { start, end } = getWeekBounds()
  const userId = profile.id

  // Fetch votes this week, arguments this week, achievements this week in parallel
  const [votesRes, argsRes, achRes] = await Promise.all([
    supabase
      .from('votes')
      .select('side, created_at, topics!inner(category)')
      .eq('user_id', userId)
      .gte('created_at', start)
      .lte('created_at', end)
      .order('created_at', { ascending: true }),

    supabase
      .from('topic_arguments')
      .select('id, content, side, upvotes, created_at, topics!inner(statement)')
      .eq('user_id', userId)
      .gte('created_at', start)
      .lte('created_at', end)
      .order('upvotes', { ascending: false })
      .limit(20),

    supabase
      .from('user_achievements')
      .select('achievements(id, name, icon_emoji)')
      .eq('user_id', userId)
      .gte('earned_at', start)
      .lte('earned_at', end)
      .limit(5),
  ])

  const voteRows = (votesRes.data ?? []) as unknown as Array<{
    side: string
    created_at: string
    topics: { category: string | null } | null
  }>

  const argRows = (argsRes.data ?? []) as unknown as Array<{
    id: string
    content: string
    side: string
    upvotes: number
    created_at: string
    topics: { statement: string } | null
  }>

  const achRows = (achRes.data ?? []) as unknown as Array<{
    achievements: { id: string; name: string; icon_emoji: string } | null
  }>

  // Aggregate votes
  const votesBlue = voteRows.filter((v) => v.side === 'blue').length
  const votesRed = voteRows.filter((v) => v.side === 'red').length

  // Votes by day (Mon–Sun)
  const dayMap: Record<string, number> = {}
  for (const v of voteRows) {
    const day = v.created_at.slice(0, 10)
    dayMap[day] = (dayMap[day] ?? 0) + 1
  }
  const votesByDay: WeekStatDay[] = Object.entries(dayMap)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, count]) => ({ date, count }))

  // Top categories
  const catMap: Record<string, number> = {}
  for (const v of voteRows) {
    const cat = v.topics?.category ?? 'Other'
    catMap[cat] = (catMap[cat] ?? 0) + 1
  }
  const topCategories: WeekStatCategory[] = Object.entries(catMap)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([category, count]) => ({ category, count }))

  // Top argument (highest upvotes this week)
  const topArgument: WeekTopArgument | null =
    argRows.length > 0
      ? {
          id: argRows[0].id,
          content: argRows[0].content.slice(0, 120),
          side: argRows[0].side as 'blue' | 'red',
          upvotes: argRows[0].upvotes,
          topic_statement: argRows[0].topics?.statement ?? '',
        }
      : null

  // Achievements
  const achievements: WeekAchievement[] = achRows
    .filter((r) => r.achievements)
    .map((r) => ({
      id: r.achievements!.id,
      name: r.achievements!.name,
      icon: r.achievements!.icon_emoji,
    }))

  const result: UserWeekStats = {
    username: profile.username,
    display_name: profile.display_name,
    avatar_url: profile.avatar_url,
    role: profile.role,
    week_start: start.slice(0, 10),
    week_end: end.slice(0, 10),
    votes_total: voteRows.length,
    votes_blue: votesBlue,
    votes_red: votesRed,
    votes_by_day: votesByDay,
    arguments_count: argRows.length,
    top_argument: topArgument,
    achievements,
    top_categories: topCategories,
    clout_current: profile.clout ?? 0,
    streak_current: profile.vote_streak ?? 0,
  }

  return NextResponse.json(result)
}
