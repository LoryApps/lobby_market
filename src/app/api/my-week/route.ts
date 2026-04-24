import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface WeekVoteStat {
  date: string   // YYYY-MM-DD
  count: number
}

export interface WeekCategory {
  category: string
  count: number
  blue: number
  red: number
}

export interface WeekLaw {
  id: string
  statement: string
  category: string | null
  established_at: string
  your_vote: 'blue' | 'red' | null
}

export interface WeekArgument {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  topic_id: string
  topic_statement: string
  created_at: string
}

export interface WeekAchievement {
  id: string
  name: string
  description: string
  icon: string
  earned_at: string
}

export interface MyWeekData {
  weekStart: string
  weekEnd: string
  votes: {
    total: number
    blue: number
    red: number
    byDay: WeekVoteStat[]
  }
  accuracy: {
    resolved: number
    correct: number
    pct: number | null
  }
  clout: {
    current: number
    change: number
  }
  streak: {
    current: number
    active_days: number
  }
  laws: WeekLaw[]
  topArgument: WeekArgument | null
  achievements: WeekAchievement[]
  categories: WeekCategory[]
  prevWeekVotes: number
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function toDateStr(d: Date): string {
  return d.toISOString().slice(0, 10)
}

function addDays(d: Date, n: number): Date {
  const r = new Date(d)
  r.setDate(r.getDate() + n)
  return r
}

export async function GET() {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Week window: last 7 full days (Mon–Sun or rolling 7d)
  const now = new Date()
  const weekEnd = now
  const weekStart = addDays(now, -7)
  const prevWeekStart = addDays(now, -14)

  const weekStartISO = weekStart.toISOString()
  const weekEndISO = weekEnd.toISOString()
  const prevWeekStartISO = prevWeekStart.toISOString()

  // ── Fetch in parallel ──────────────────────────────────────────────────────

  const [
    profileRes,
    votesRes,
    prevVotesRes,
    argumentsRes,
    achievementsRes,
    cloutRes,
  ] = await Promise.all([
    supabase
      .from('profiles')
      .select('clout, vote_streak, reputation_score')
      .eq('id', user.id)
      .maybeSingle(),

    supabase
      .from('votes')
      .select('id, side, created_at, topic_id')
      .eq('user_id', user.id)
      .gte('created_at', weekStartISO)
      .lte('created_at', weekEndISO)
      .order('created_at', { ascending: true }),

    supabase
      .from('votes')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gte('created_at', prevWeekStartISO)
      .lt('created_at', weekStartISO),

    supabase
      .from('topic_arguments')
      .select('id, content, side, upvotes, topic_id, created_at')
      .eq('user_id', user.id)
      .gte('created_at', weekStartISO)
      .order('upvotes', { ascending: false })
      .limit(1),

    supabase
      .from('user_achievements')
      .select('earned_at, achievement:achievements(id, name, description, icon)')
      .eq('user_id', user.id)
      .gte('earned_at', weekStartISO)
      .order('earned_at', { ascending: false })
      .limit(10),

    supabase
      .from('clout_transactions')
      .select('amount')
      .eq('user_id', user.id)
      .gte('created_at', weekStartISO),
  ])

  const profile = profileRes.data
  const votes = votesRes.data ?? []
  const prevWeekVotes = prevVotesRes.count ?? 0

  // ── Votes by day ───────────────────────────────────────────────────────────

  const dayMap = new Map<string, number>()
  for (let i = 0; i < 7; i++) {
    dayMap.set(toDateStr(addDays(weekStart, i)), 0)
  }
  let blueCt = 0, redCt = 0
  for (const v of votes) {
    const day = toDateStr(new Date(v.created_at))
    dayMap.set(day, (dayMap.get(day) ?? 0) + 1)
    if (v.side === 'blue') blueCt++
    else redCt++
  }
  const byDay: { date: string; count: number }[] = Array.from(dayMap.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date))

  // ── Categories ─────────────────────────────────────────────────────────────

  const topicIds = Array.from(new Set(votes.map((v) => v.topic_id)))
  let topicMap = new Map<string, { status: string; category: string | null; blue_pct: number; statement: string }>()

  if (topicIds.length > 0) {
    const { data: topics } = await supabase
      .from('topics')
      .select('id, status, category, blue_pct, statement')
      .in('id', topicIds)
    if (topics) {
      topicMap = new Map(topics.map((t) => [t.id, t]))
    }
  }

  const catMap = new Map<string, { count: number; blue: number; red: number }>()
  for (const v of votes) {
    const t = topicMap.get(v.topic_id)
    const cat = t?.category ?? 'Uncategorized'
    const c = catMap.get(cat) ?? { count: 0, blue: 0, red: 0 }
    c.count++
    if (v.side === 'blue') c.blue++
    else c.red++
    catMap.set(cat, c)
  }
  const categories: { category: string; count: number; blue: number; red: number }[] = Array.from(catMap.entries())
    .map(([category, s]) => ({ category, ...s }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 5)

  // ── Accuracy on resolved topics ────────────────────────────────────────────

  const resolvedVotes = votes.filter((v) => {
    const t = topicMap.get(v.topic_id)
    return t && (t.status === 'law' || t.status === 'failed')
  })
  const correctVotes = resolvedVotes.filter((v) => {
    const t = topicMap.get(v.topic_id)!
    return (t.status === 'law' && v.side === 'blue') || (t.status === 'failed' && v.side === 'red')
  })
  const accuracy = {
    resolved: resolvedVotes.length,
    correct: correctVotes.length,
    pct: resolvedVotes.length > 0 ? Math.round((correctVotes.length / resolvedVotes.length) * 100) : null,
  }

  // ── Laws established this week from topics you voted on ───────────────────

  const lawTopicIds = votes
    .filter((v) => topicMap.get(v.topic_id)?.status === 'law')
    .map((v) => v.topic_id)
  const uniqueLawIds = Array.from(new Set(lawTopicIds))

  let laws: {
    id: string; statement: string; category: string | null
    established_at: string; your_vote: 'blue' | 'red' | null
  }[] = []

  if (uniqueLawIds.length > 0) {
    const { data: lawRows } = await supabase
      .from('laws')
      .select('id, statement, category, established_at')
      .in('topic_id', uniqueLawIds)
      .gte('established_at', weekStartISO)
      .order('established_at', { ascending: false })
      .limit(5)

    if (lawRows) {
      const lawTopicMap = new Map<string, string>()
      const voteByTopic = new Map(votes.map((v) => [v.topic_id, v.side as 'blue' | 'red']))

      const { data: lawTopics } = await supabase
        .from('laws')
        .select('id, topic_id')
        .in('id', lawRows.map((l) => l.id))

      if (lawTopics) {
        for (const lt of lawTopics) {
          lawTopicMap.set(lt.id, lt.topic_id)
        }
      }

      laws = lawRows.map((l) => {
        const tid = lawTopicMap.get(l.id)
        return {
          id: l.id,
          statement: l.statement,
          category: l.category,
          established_at: l.established_at,
          your_vote: tid ? (voteByTopic.get(tid) ?? null) : null,
        }
      })
    }
  }

  // ── Top argument this week ─────────────────────────────────────────────────

  let topArgument: {
    id: string; content: string; side: 'blue' | 'red'; upvotes: number
    topic_id: string; topic_statement: string; created_at: string
  } | null = null

  if (argumentsRes.data && argumentsRes.data.length > 0) {
    const arg = argumentsRes.data[0]
    const topic = topicMap.get(arg.topic_id)
    if (!topic) {
      const { data: tRow } = await supabase
        .from('topics')
        .select('statement')
        .eq('id', arg.topic_id)
        .maybeSingle()
      topArgument = {
        id: arg.id,
        content: arg.content,
        side: arg.side as 'blue' | 'red',
        upvotes: arg.upvotes ?? 0,
        topic_id: arg.topic_id,
        topic_statement: tRow?.statement ?? '',
        created_at: arg.created_at,
      }
    } else {
      topArgument = {
        id: arg.id,
        content: arg.content,
        side: arg.side as 'blue' | 'red',
        upvotes: arg.upvotes ?? 0,
        topic_id: arg.topic_id,
        topic_statement: topic.statement,
        created_at: arg.created_at,
      }
    }
  }

  // ── Achievements ───────────────────────────────────────────────────────────

  const achievements: {
    id: string; name: string; description: string; icon: string; earned_at: string
  }[] = []
  for (const row of achievementsRes.data ?? []) {
    if (!row.achievement) continue
    const ach = Array.isArray(row.achievement) ? row.achievement[0] : row.achievement
    achievements.push({
      id: ach.id,
      name: ach.name,
      description: ach.description,
      icon: ach.icon,
      earned_at: row.earned_at,
    })
  }

  // ── Clout change this week ─────────────────────────────────────────────────

  const cloutChange = (cloutRes.data ?? []).reduce((sum, t) => sum + (t.amount ?? 0), 0)

  const result: MyWeekData = {
    weekStart: toDateStr(weekStart),
    weekEnd: toDateStr(weekEnd),
    votes: {
      total: votes.length,
      blue: blueCt,
      red: redCt,
      byDay,
    },
    accuracy,
    clout: {
      current: profile?.clout ?? 0,
      change: cloutChange,
    },
    streak: {
      current: profile?.vote_streak ?? 0,
      active_days: byDay.filter((d) => d.count > 0).length,
    },
    laws,
    topArgument,
    achievements,
    categories,
    prevWeekVotes,
  }

  return NextResponse.json(result)
}
