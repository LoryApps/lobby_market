import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type Period = '30d' | '90d' | '180d' | '365d'

export interface RetroLaw {
  topic_id: string
  statement: string
  category: string | null
  established_at: string
  user_vote: 'blue' | 'red' | null
  correct: boolean
}

export interface RetroArgument {
  id: string
  content: string
  side: 'blue' | 'red'
  topic_statement: string
  topic_id: string
  upvotes: number
  created_at: string
}

export interface RetroCategoryEntry {
  category: string
  vote_count: number
  for_count: number
  against_count: number
  for_pct: number
}

export interface RetroMilestone {
  type: 'law_correct' | 'law_wrong' | 'streak' | 'argument_hit' | 'votes_milestone' | 'first_vote'
  label: string
  description: string
  date: string | null
  icon: string
  color: string
}

export interface RetroStats {
  votes_cast: number
  for_votes: number
  against_votes: number
  arguments_written: number
  argument_upvotes: number
  laws_established: number
  laws_correct: number
  laws_wrong: number
  accuracy_pct: number | null
  best_streak: number
  categories_active: number
  days_active: number
}

export interface RetrospectiveResponse {
  period: Period
  since: string
  until: string
  stats: RetroStats
  laws: RetroLaw[]
  top_arguments: RetroArgument[]
  category_breakdown: RetroCategoryEntry[]
  milestones: RetroMilestone[]
  authenticated: boolean
}

// ─── Period helpers ───────────────────────────────────────────────────────────

const PERIOD_DAYS: Record<Period, number> = {
  '30d': 30,
  '90d': 90,
  '180d': 180,
  '365d': 365,
}

function periodLabel(p: Period): string {
  return { '30d': '30 days', '90d': '90 days', '180d': '6 months', '365d': '1 year' }[p]
}

function sinceDate(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return d.toISOString()
}

// ─── GET /api/retrospective ───────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const sp = req.nextUrl.searchParams
  const rawPeriod = sp.get('period') ?? '90d'
  const period: Period = (['30d', '90d', '180d', '365d'] as Period[]).includes(rawPeriod as Period)
    ? (rawPeriod as Period)
    : '90d'

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    const empty: RetrospectiveResponse = {
      period,
      since: sinceDate(PERIOD_DAYS[period]),
      until: new Date().toISOString(),
      stats: {
        votes_cast: 0, for_votes: 0, against_votes: 0,
        arguments_written: 0, argument_upvotes: 0,
        laws_established: 0, laws_correct: 0, laws_wrong: 0,
        accuracy_pct: null, best_streak: 0,
        categories_active: 0, days_active: 0,
      },
      laws: [],
      top_arguments: [],
      category_breakdown: [],
      milestones: [],
      authenticated: false,
    }
    return NextResponse.json(empty)
  }

  const days = PERIOD_DAYS[period]
  const since = sinceDate(days)
  const until = new Date().toISOString()

  // ── 1. Votes cast in period ───────────────────────────────────────────────
  const { data: votes } = await supabase
    .from('votes')
    .select('side, category, created_at, topic_id')
    .eq('user_id', user.id)
    .gte('created_at', since)
    .order('created_at', { ascending: false })

  const voteList = votes ?? []
  const forVotes = voteList.filter((v) => v.side === 'blue').length
  const againstVotes = voteList.filter((v) => v.side === 'red').length

  // Days active (distinct calendar days)
  const activeDays = new Set(voteList.map((v) => v.created_at.slice(0, 10))).size

  // ── 2. Category breakdown ─────────────────────────────────────────────────
  const catMap = new Map<string, { votes: number; for: number; against: number }>()
  for (const v of voteList) {
    const cat = (v.category as string | null) ?? 'Uncategorised'
    const entry = catMap.get(cat) ?? { votes: 0, for: 0, against: 0 }
    entry.votes++
    if (v.side === 'blue') entry.for++
    else entry.against++
    catMap.set(cat, entry)
  }
  const category_breakdown: RetroCategoryEntry[] = Array.from(catMap.entries())
    .map(([category, e]) => ({
      category,
      vote_count: e.votes,
      for_count: e.for,
      against_count: e.against,
      for_pct: e.votes > 0 ? Math.round((e.for / e.votes) * 100) : 50,
    }))
    .sort((a, b) => b.vote_count - a.vote_count)
    .slice(0, 8)

  // ── 3. Laws established in period & user accuracy ────────────────────────
  const { data: rawLaws } = await supabase
    .from('laws')
    .select('id, topic_id, established_at, topics(statement, category)')
    .gte('established_at', since)
    .order('established_at', { ascending: false })
    .limit(50)

  const lawList = rawLaws ?? []

  // Get user's votes on those topics
  const lawTopicIds = lawList.map((l) => l.topic_id).filter(Boolean)
  let userVotesOnLaws: Record<string, 'blue' | 'red'> = {}
  if (lawTopicIds.length > 0) {
    const { data: uv } = await supabase
      .from('votes')
      .select('topic_id, side')
      .eq('user_id', user.id)
      .in('topic_id', lawTopicIds)
    for (const v of uv ?? []) {
      userVotesOnLaws[v.topic_id] = v.side as 'blue' | 'red'
    }
  }

  const laws: RetroLaw[] = lawList.map((l) => {
    const topic = l.topics as { statement: string; category: string | null } | null
    const userVote = userVotesOnLaws[l.topic_id] ?? null
    const correct = userVote === 'blue' // Laws pass by FOR consensus
    return {
      topic_id: l.topic_id,
      statement: topic?.statement ?? '',
      category: topic?.category ?? null,
      established_at: l.established_at,
      user_vote: userVote,
      correct: userVote !== null ? correct : false,
    }
  })

  const votedLaws = laws.filter((l) => l.user_vote !== null)
  const correctLaws = votedLaws.filter((l) => l.correct).length
  const wrongLaws = votedLaws.filter((l) => !l.correct).length
  const accuracyPct =
    votedLaws.length > 0 ? Math.round((correctLaws / votedLaws.length) * 100) : null

  // ── 4. Top arguments in period ────────────────────────────────────────────
  const { data: rawArgs } = await supabase
    .from('topic_arguments')
    .select('id, content, side, topic_id, upvotes, created_at, topics(statement)')
    .eq('user_id', user.id)
    .gte('created_at', since)
    .order('upvotes', { ascending: false })
    .limit(5)

  const top_arguments: RetroArgument[] = (rawArgs ?? []).map((a) => ({
    id: a.id,
    content: a.content,
    side: a.side as 'blue' | 'red',
    topic_statement: (a.topics as { statement: string } | null)?.statement ?? '',
    topic_id: a.topic_id,
    upvotes: a.upvotes ?? 0,
    created_at: a.created_at,
  }))

  const totalArgUpvotes = top_arguments.reduce((s, a) => s + a.upvotes, 0)

  // ── 5. Argument count in period ───────────────────────────────────────────
  const { count: argCount } = await supabase
    .from('topic_arguments')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .gte('created_at', since)

  // ── 6. Vote streak (best consecutive day streak in period) ───────────────
  const sortedDays = Array.from(
    new Set(voteList.map((v) => v.created_at.slice(0, 10))),
  ).sort()
  let bestStreak = 0
  let streak = 0
  let prevDay: Date | null = null
  for (const day of sortedDays) {
    const d = new Date(day)
    if (prevDay) {
      const diff = (d.getTime() - prevDay.getTime()) / 86_400_000
      streak = diff === 1 ? streak + 1 : 1
    } else {
      streak = 1
    }
    if (streak > bestStreak) bestStreak = streak
    prevDay = d
  }

  // ── 7. Milestones ─────────────────────────────────────────────────────────
  const milestones: RetroMilestone[] = []

  if (correctLaws >= 5) {
    milestones.push({
      type: 'law_correct',
      label: 'Civic Prophet',
      description: `You correctly predicted ${correctLaws} laws this period — top-tier civic foresight.`,
      date: null,
      icon: 'Gavel',
      color: 'gold',
    })
  } else if (correctLaws >= 1) {
    milestones.push({
      type: 'law_correct',
      label: `${correctLaws} Law${correctLaws > 1 ? 's' : ''} Predicted`,
      description: `You voted FOR on ${correctLaws} topic${correctLaws > 1 ? 's' : ''} that became law this period.`,
      date: laws.find((l) => l.correct)?.established_at ?? null,
      icon: 'CheckCircle2',
      color: 'emerald',
    })
  }

  if (bestStreak >= 14) {
    milestones.push({
      type: 'streak',
      label: `${bestStreak}-Day Streak`,
      description: `You maintained a ${bestStreak}-day voting streak — civic dedication at its finest.`,
      date: null,
      icon: 'Flame',
      color: 'against',
    })
  } else if (bestStreak >= 7) {
    milestones.push({
      type: 'streak',
      label: `${bestStreak}-Day Streak`,
      description: `A ${bestStreak}-day voting streak. The Lobby noticed.`,
      date: null,
      icon: 'Zap',
      color: 'for',
    })
  }

  if (totalArgUpvotes >= 50) {
    milestones.push({
      type: 'argument_hit',
      label: 'Influential Voice',
      description: `Your arguments earned ${totalArgUpvotes} upvotes this period — your reasoning resonated.`,
      date: top_arguments[0]?.created_at ?? null,
      icon: 'TrendingUp',
      color: 'purple',
    })
  } else if (totalArgUpvotes >= 10) {
    milestones.push({
      type: 'argument_hit',
      label: `${totalArgUpvotes} Argument Upvotes`,
      description: `Your arguments earned ${totalArgUpvotes} upvotes — people are listening.`,
      date: top_arguments[0]?.created_at ?? null,
      icon: 'ThumbsUp',
      color: 'for',
    })
  }

  if (voteList.length >= 100) {
    milestones.push({
      type: 'votes_milestone',
      label: `${voteList.length} Votes Cast`,
      description: `${voteList.length} votes in ${periodLabel(period)} — you're in the top tier of civic participation.`,
      date: null,
      icon: 'Vote',
      color: 'for',
    })
  }

  const stats: RetroStats = {
    votes_cast: voteList.length,
    for_votes: forVotes,
    against_votes: againstVotes,
    arguments_written: argCount ?? 0,
    argument_upvotes: totalArgUpvotes,
    laws_established: laws.length,
    laws_correct: correctLaws,
    laws_wrong: wrongLaws,
    accuracy_pct: accuracyPct,
    best_streak: bestStreak,
    categories_active: catMap.size,
    days_active: activeDays,
  }

  const payload: RetrospectiveResponse = {
    period,
    since,
    until,
    stats,
    laws,
    top_arguments,
    category_breakdown,
    milestones,
    authenticated: true,
  }

  return NextResponse.json(payload, {
    headers: { 'Cache-Control': 'private, no-store' },
  })
}
