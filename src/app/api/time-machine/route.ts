import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TimeMachineTopic {
  id: string
  statement: string
  category: string | null
  scope: string
  status: string
  total_votes: number
  blue_pct: number
  creator_username: string | null
  creator_display_name: string | null
}

export interface TimeMachineLaw {
  id: string
  topic_id: string
  statement: string
  category: string | null
  total_votes: number
  blue_pct: number
  established_at: string
}

export interface TimeMachineArgument {
  id: string
  content: string
  side: string
  upvotes: number
  topic_id: string
  topic_statement: string
  topic_status: string
  author_username: string | null
  author_display_name: string | null
  author_avatar_url: string | null
  created_at: string
}

export interface TimeMachineDebate {
  id: string
  title: string
  topic_id: string | null
  topic_statement: string | null
  scheduled_at: string
  status: string
  debater_for_username: string | null
  debater_for_display_name: string | null
  debater_against_username: string | null
  debater_against_display_name: string | null
}

export interface TimeMachineSnapshot {
  date: string
  new_topics: TimeMachineTopic[]
  new_laws: TimeMachineLaw[]
  top_arguments: TimeMachineArgument[]
  debates: TimeMachineDebate[]
  stats: {
    votes_cast: number
    arguments_written: number
    new_users: number
    topics_proposed: number
    laws_passed: number
    debates_held: number
  }
  has_data: boolean
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function dayBounds(dateStr: string): { start: string; end: string } {
  const d = new Date(dateStr + 'T00:00:00Z')
  const start = d.toISOString()
  d.setUTCDate(d.getUTCDate() + 1)
  const end = d.toISOString()
  return { start, end }
}

// ─── Route ───────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const dateParam = searchParams.get('date')

  // Validate and clamp date
  let targetDate: string
  try {
    const d = dateParam ? new Date(dateParam + 'T00:00:00Z') : new Date()
    if (isNaN(d.getTime())) throw new Error('invalid')
    // Don't allow future dates
    if (d > new Date()) {
      const today = new Date()
      targetDate = today.toISOString().slice(0, 10)
    } else {
      targetDate = d.toISOString().slice(0, 10)
    }
  } catch {
    targetDate = new Date().toISOString().slice(0, 10)
  }

  const { start, end } = dayBounds(targetDate)

  const supabase = await createClient()

  // Run all queries in parallel
  const [
    topicsRes,
    lawsRes,
    argumentsRes,
    votesCountRes,
    argsCountRes,
    usersCountRes,
    debatesRes,
  ] = await Promise.all([
    // Topics created on this day
    supabase
      .from('topics')
      .select('id, statement, category, scope, status, total_votes, blue_pct, created_by')
      .gte('created_at', start)
      .lt('created_at', end)
      .order('total_votes', { ascending: false })
      .limit(10),

    // Laws established on this day
    supabase
      .from('laws')
      .select('id, topic_id, statement, category, total_votes, blue_pct, established_at')
      .gte('established_at', start)
      .lt('established_at', end)
      .order('total_votes', { ascending: false })
      .limit(10),

    // Top arguments written on this day
    supabase
      .from('topic_arguments')
      .select('id, content, side, upvotes, topic_id, author_id, created_at')
      .gte('created_at', start)
      .lt('created_at', end)
      .order('upvotes', { ascending: false })
      .limit(8),

    // Vote count for this day
    supabase
      .from('votes')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', start)
      .lt('created_at', end),

    // Arguments count for this day
    supabase
      .from('topic_arguments')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', start)
      .lt('created_at', end),

    // New users for this day
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true })
      .gte('created_at', start)
      .lt('created_at', end),

    // Debates scheduled/held on this day
    supabase
      .from('debates')
      .select('id, title, topic_id, scheduled_at, status, debater_for, debater_against')
      .gte('scheduled_at', start)
      .lt('scheduled_at', end)
      .order('scheduled_at', { ascending: true })
      .limit(5),
  ])

  const rawTopics = topicsRes.data ?? []
  const rawLaws = lawsRes.data ?? []
  const rawArguments = argumentsRes.data ?? []
  const rawDebates = debatesRes.data ?? []

  // Collect profile IDs to fetch
  const profileIds = new Set<string>()
  rawTopics.forEach((t) => { if ((t as { created_by?: string }).created_by) profileIds.add((t as { created_by: string }).created_by) })
  rawArguments.forEach((a) => { if (a.author_id) profileIds.add(a.author_id) })
  rawDebates.forEach((d) => {
    if ((d as { debater_for?: string }).debater_for) profileIds.add((d as { debater_for: string }).debater_for)
    if ((d as { debater_against?: string }).debater_against) profileIds.add((d as { debater_against: string }).debater_against)
  })

  // Collect topic IDs for argument enrichment
  const argTopicIds = [...new Set(rawArguments.map((a) => a.topic_id).filter(Boolean))]

  const [profilesRes, argTopicsRes] = await Promise.all([
    profileIds.size > 0
      ? supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', [...profileIds])
      : Promise.resolve({ data: [] }),
    argTopicIds.length > 0
      ? supabase
          .from('topics')
          .select('id, statement, status')
          .in('id', argTopicIds)
      : Promise.resolve({ data: [] }),
  ])

  const profileMap = new Map<string, { username: string; display_name: string | null; avatar_url: string | null }>()
  for (const p of profilesRes.data ?? []) {
    profileMap.set(p.id, { username: p.username, display_name: p.display_name, avatar_url: p.avatar_url })
  }

  const topicMap = new Map<string, { statement: string; status: string }>()
  for (const t of argTopicsRes.data ?? []) {
    topicMap.set(t.id, { statement: t.statement, status: t.status })
  }

  // Build response
  const newTopics: TimeMachineTopic[] = rawTopics.map((t) => {
    const createdBy = (t as { created_by?: string }).created_by
    const creator = createdBy ? profileMap.get(createdBy) : null
    return {
      id: t.id,
      statement: t.statement,
      category: t.category,
      scope: t.scope,
      status: t.status,
      total_votes: t.total_votes ?? 0,
      blue_pct: t.blue_pct ?? 50,
      creator_username: creator?.username ?? null,
      creator_display_name: creator?.display_name ?? null,
    }
  })

  const newLaws: TimeMachineLaw[] = rawLaws.map((l) => ({
    id: l.id,
    topic_id: l.topic_id,
    statement: l.statement,
    category: l.category,
    total_votes: l.total_votes ?? 0,
    blue_pct: l.blue_pct ?? 50,
    established_at: l.established_at,
  }))

  const topArguments: TimeMachineArgument[] = rawArguments.map((a) => {
    const topic = topicMap.get(a.topic_id)
    const author = a.author_id ? profileMap.get(a.author_id) : null
    return {
      id: a.id,
      content: a.content,
      side: a.side,
      upvotes: a.upvotes ?? 0,
      topic_id: a.topic_id,
      topic_statement: topic?.statement ?? 'Unknown topic',
      topic_status: topic?.status ?? 'proposed',
      author_username: author?.username ?? null,
      author_display_name: author?.display_name ?? null,
      author_avatar_url: author?.avatar_url ?? null,
      created_at: a.created_at,
    }
  })

  const debates: TimeMachineDebate[] = rawDebates.map((d) => {
    const debaterFor = (d as { debater_for?: string }).debater_for
    const debaterAgainst = (d as { debater_against?: string }).debater_against
    const forProfile = debaterFor ? profileMap.get(debaterFor) : null
    const againstProfile = debaterAgainst ? profileMap.get(debaterAgainst) : null
    return {
      id: d.id,
      title: d.title,
      topic_id: d.topic_id,
      topic_statement: null,
      scheduled_at: d.scheduled_at,
      status: d.status,
      debater_for_username: forProfile?.username ?? null,
      debater_for_display_name: forProfile?.display_name ?? null,
      debater_against_username: againstProfile?.username ?? null,
      debater_against_display_name: againstProfile?.display_name ?? null,
    }
  })

  const stats = {
    votes_cast: votesCountRes.count ?? 0,
    arguments_written: argsCountRes.count ?? 0,
    new_users: usersCountRes.count ?? 0,
    topics_proposed: rawTopics.length,
    laws_passed: rawLaws.length,
    debates_held: rawDebates.length,
  }

  const hasData =
    stats.votes_cast > 0 ||
    stats.arguments_written > 0 ||
    newTopics.length > 0 ||
    newLaws.length > 0

  const snapshot: TimeMachineSnapshot = {
    date: targetDate,
    new_topics: newTopics,
    new_laws: newLaws,
    top_arguments: topArguments,
    debates,
    stats,
    has_data: hasData,
  }

  return NextResponse.json(snapshot)
}
