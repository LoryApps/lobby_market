import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MemoryVote {
  topic_id: string
  topic_statement: string
  topic_category: string | null
  topic_status: string
  side: string
  created_at: string
}

export interface MemoryArgument {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  topic_id: string
  topic_statement: string
  topic_category: string | null
  topic_status: string
  created_at: string
}

export interface MemoryDebate {
  id: string
  topic_id: string
  topic_statement: string
  topic_category: string | null
  side: string
  scheduled_at: string
}

export interface YearMemory {
  year: number
  years_ago: number
  votes: MemoryVote[]
  arguments: MemoryArgument[]
  debates: MemoryDebate[]
}

export interface PlatformMilestone {
  type: 'law' | 'topic_proposed' | 'debate'
  year: number
  years_ago: number
  title: string
  description: string
  category: string | null
  topic_id: string | null
  law_id: string | null
  created_at: string
}

export interface MemoriesResponse {
  personal: YearMemory[]
  platform: PlatformMilestone[]
  today_label: string
  has_personal_history: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function todayMonthDay(): { month: number; day: number } {
  const now = new Date()
  return { month: now.getUTCMonth() + 1, day: now.getUTCDate() }
}

function currentYear(): number {
  return new Date().getUTCFullYear()
}

function formatTodayLabel(month: number, day: number): string {
  const d = new Date(2000, month - 1, day)
  return d.toLocaleDateString('en-US', { month: 'long', day: 'numeric' })
}

// ─── GET /api/analytics/memories ─────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { month, day } = todayMonthDay()
  const year = currentYear()
  const todayLabel = formatTodayLabel(month, day)

  // ── Platform milestones (public, no auth needed) ──────────────────────────

  // Laws established on this calendar day in any past year
  const { data: lawsOnDay } = await supabase
    .from('laws')
    .select('id, statement, category, established_at, topic_id')
    .order('established_at', { ascending: false })

  const platformMilestones: PlatformMilestone[] = []

  for (const law of lawsOnDay ?? []) {
    const d = new Date(law.established_at)
    if (d.getUTCMonth() + 1 !== month || d.getUTCDate() !== day) continue
    const lawYear = d.getUTCFullYear()
    if (lawYear >= year) continue // exclude this year so it's truly "on this day"
    platformMilestones.push({
      type: 'law',
      year: lawYear,
      years_ago: year - lawYear,
      title: law.statement,
      description: `Passed into consensus law`,
      category: law.category ?? null,
      topic_id: law.topic_id,
      law_id: law.id,
      created_at: law.established_at,
    })
  }

  // Topics proposed on this calendar day in any past year
  const { data: topicsOnDay } = await supabase
    .from('topics')
    .select('id, statement, category, created_at')
    .order('created_at', { ascending: false })
    .limit(500)

  for (const topic of topicsOnDay ?? []) {
    const d = new Date(topic.created_at)
    if (d.getUTCMonth() + 1 !== month || d.getUTCDate() !== day) continue
    const topicYear = d.getUTCFullYear()
    if (topicYear >= year) continue
    if (platformMilestones.length >= 20) break
    platformMilestones.push({
      type: 'topic_proposed',
      year: topicYear,
      years_ago: year - topicYear,
      title: topic.statement,
      description: `Proposed as a civic debate`,
      category: topic.category ?? null,
      topic_id: topic.id,
      law_id: null,
      created_at: topic.created_at,
    })
  }

  // Sort by year desc then type (laws first)
  platformMilestones.sort((a, b) => {
    if (b.year !== a.year) return b.year - a.year
    if (a.type === 'law' && b.type !== 'law') return -1
    if (b.type === 'law' && a.type !== 'law') return 1
    return 0
  })

  // ── Personal memories (requires auth) ─────────────────────────────────────

  const personal: YearMemory[] = []
  let hasPersonalHistory = false

  if (user) {
    // Fetch votes on this calendar day across all years
    const { data: votesRaw } = await supabase
      .from('votes')
      .select('topic_id, side, created_at, topics(statement, category, status)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    // Fetch arguments on this calendar day across all years
    const { data: argsRaw } = await supabase
      .from('topic_arguments')
      .select('id, content, side, upvotes, topic_id, created_at, topics(statement, category, status)')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })

    // Group by year
    const byYear = new Map<number, YearMemory>()

    for (const vote of votesRaw ?? []) {
      const d = new Date(vote.created_at)
      if (d.getUTCMonth() + 1 !== month || d.getUTCDate() !== day) continue
      const voteYear = d.getUTCFullYear()
      if (voteYear >= year) continue

      if (!byYear.has(voteYear)) {
        byYear.set(voteYear, { year: voteYear, years_ago: year - voteYear, votes: [], arguments: [], debates: [] })
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const topicData = vote.topics as any
      byYear.get(voteYear)!.votes.push({
        topic_id: vote.topic_id,
        topic_statement: topicData?.statement ?? 'Unknown topic',
        topic_category: topicData?.category ?? null,
        topic_status: topicData?.status ?? 'unknown',
        side: vote.side,
        created_at: vote.created_at,
      })
    }

    for (const arg of argsRaw ?? []) {
      const d = new Date(arg.created_at)
      if (d.getUTCMonth() + 1 !== month || d.getUTCDate() !== day) continue
      const argYear = d.getUTCFullYear()
      if (argYear >= year) continue

      if (!byYear.has(argYear)) {
        byYear.set(argYear, { year: argYear, years_ago: year - argYear, votes: [], arguments: [], debates: [] })
      }

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const topicData = arg.topics as any
      byYear.get(argYear)!.arguments.push({
        id: arg.id,
        content: arg.content,
        side: arg.side as 'blue' | 'red',
        upvotes: arg.upvotes ?? 0,
        topic_id: arg.topic_id,
        topic_statement: topicData?.statement ?? 'Unknown topic',
        topic_category: topicData?.category ?? null,
        topic_status: topicData?.status ?? 'unknown',
        created_at: arg.created_at,
      })
    }

    // Sort years descending
    const sortedYears = Array.from(byYear.values()).sort((a, b) => b.year - a.year)
    personal.push(...sortedYears)
    hasPersonalHistory = sortedYears.length > 0
  }

  return NextResponse.json({
    personal,
    platform: platformMilestones.slice(0, 15),
    today_label: todayLabel,
    has_personal_history: hasPersonalHistory,
  } satisfies MemoriesResponse)
}
