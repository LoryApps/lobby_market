import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 300 // 5 minute cache

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DispatchLaw {
  id: string
  statement: string
  category: string | null
  total_votes: number
  blue_pct: number
  established_at: string
  scope: string | null
}

export interface DispatchTopic {
  id: string
  statement: string
  category: string | null
  status: string
  total_votes: number
  blue_pct: number
  scope: string | null
  is_closing_soon: boolean
  hours_until_close?: number
}

export interface DispatchDebate {
  id: string
  topic_id: string
  topic_statement: string
  topic_category: string | null
  scheduled_at: string
  status: string
  title: string | null
  debate_type: string
  participant_count: number
  hours_until_start: number | null
}

export interface DispatchArgument {
  id: string
  topic_id: string
  topic_statement: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  author_username: string
  author_display_name: string | null
  author_role: string
  created_at: string
}

export interface DispatchPetition {
  id: string
  topic_id: string
  topic_statement: string
  title: string
  signature_count: number
  category: string | null
  created_at: string
}

export interface DispatchStats {
  votes_cast_today: number
  arguments_posted_today: number
  new_topics_today: number
  debates_today: number
  laws_established_today: number
  active_citizens: number
}

export interface DispatchData {
  issued_at: string
  edition: string
  // Section 1: New laws (passed today or in last 48h)
  newLaws: DispatchLaw[]
  // Section 2: Topics on the brink (>= 70% consensus, enough votes, not yet law)
  nearConsensus: DispatchTopic[]
  // Section 3: Contested debates (near 50/50 with high engagement)
  contested: DispatchTopic[]
  // Section 4: Topics closing soon (voting phase, <24h remaining)
  closingSoon: DispatchTopic[]
  // Section 5: Upcoming debates in next 24h
  upcomingDebates: DispatchDebate[]
  // Section 6: Standout arguments posted today
  topArguments: DispatchArgument[]
  // Section 7: Platform stats for the day
  stats: DispatchStats
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient()

  const now = new Date()
  const todayStart = new Date(now)
  todayStart.setHours(0, 0, 0, 0)
  const todayIso = todayStart.toISOString()
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 60 * 60 * 1000).toISOString()
  const twentyFourHoursFromNow = new Date(now.getTime() + 24 * 60 * 60 * 1000).toISOString()

  // Format edition label: "Monday, 14 July 2026 — Issue No. 47"
  const dayOfYear = Math.floor(
    (now.getTime() - new Date(now.getFullYear(), 0, 0).getTime()) / 86_400_000,
  )
  const edition = now.toLocaleDateString('en-GB', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }) + ` — Issue No. ${dayOfYear}`

  // ── Parallel fetches ────────────────────────────────────────────────────────
  const [
    newLawsRes,
    topicsRes,
    debatesRes,
    argsRes,
  ] = await Promise.all([
    // New laws established in the last 48 hours
    supabase
      .from('laws')
      .select('id, topic_id, established_at')
      .eq('is_active', true)
      .gte('established_at', fortyEightHoursAgo)
      .order('established_at', { ascending: false })
      .limit(10),

    // Active/voting topics for near-consensus, contested, and closing-soon sections
    supabase
      .from('topics')
      .select('id, statement, category, status, total_votes, blue_pct, scope, voting_ends_at')
      .in('status', ['active', 'voting'])
      .gte('total_votes', 10)
      .order('total_votes', { ascending: false })
      .limit(100),

    // Upcoming debates in the next 24 hours
    supabase
      .from('debates')
      .select('id, topic_id, scheduled_at, status, title, type, participant_count, topics(statement, category)')
      .eq('status', 'scheduled')
      .gte('scheduled_at', now.toISOString())
      .lte('scheduled_at', twentyFourHoursFromNow)
      .order('scheduled_at', { ascending: true })
      .limit(5),

    // Top arguments posted today
    supabase
      .from('topic_arguments')
      .select('id, topic_id, content, side, upvotes, created_at, topics(statement), profiles!topic_arguments_author_id_fkey(username, display_name, role)')
      .gte('created_at', todayIso)
      .gte('upvotes', 1)
      .order('upvotes', { ascending: false })
      .limit(5),
  ])

  // ── Process new laws: join with topics for statement/category ───────────────
  const rawLaws = newLawsRes.data ?? []
  const lawTopicIds = rawLaws.map((l) => l.topic_id).filter(Boolean)

  const lawTopicsRes =
    lawTopicIds.length > 0
      ? await supabase
          .from('topics')
          .select('id, statement, category, total_votes, blue_pct, scope')
          .in('id', lawTopicIds)
      : { data: [] }

  const lawTopicMap = new Map(
    (lawTopicsRes.data ?? []).map((t) => [t.id, t]),
  )

  const newLaws: DispatchLaw[] = rawLaws
    .map((l) => {
      const t = lawTopicMap.get(l.topic_id)
      if (!t) return null
      return {
        id: l.id,
        statement: t.statement,
        category: t.category,
        total_votes: t.total_votes ?? 0,
        blue_pct: t.blue_pct ?? 50,
        established_at: l.established_at,
        scope: t.scope ?? null,
      } satisfies DispatchLaw
    })
    .filter((l): l is DispatchLaw => l !== null)

  // ── Process topics into sections ────────────────────────────────────────────
  const allTopics = topicsRes.data ?? []

  const nearConsensus: DispatchTopic[] = allTopics
    .filter((t) => {
      const pct = t.blue_pct ?? 50
      return (pct >= 70 || pct <= 30) && (t.total_votes ?? 0) >= 30
    })
    .sort((a, b) => {
      const aStrength = Math.abs((a.blue_pct ?? 50) - 50)
      const bStrength = Math.abs((b.blue_pct ?? 50) - 50)
      return bStrength - aStrength
    })
    .slice(0, 6)
    .map((t) => ({
      id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
      total_votes: t.total_votes ?? 0,
      blue_pct: t.blue_pct ?? 50,
      scope: t.scope ?? null,
      is_closing_soon: false,
    }))

  const contested: DispatchTopic[] = allTopics
    .filter((t) => {
      const pct = t.blue_pct ?? 50
      return pct >= 42 && pct <= 58 && (t.total_votes ?? 0) >= 20
    })
    .sort((a, b) => (b.total_votes ?? 0) - (a.total_votes ?? 0))
    .slice(0, 6)
    .map((t) => ({
      id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
      total_votes: t.total_votes ?? 0,
      blue_pct: t.blue_pct ?? 50,
      scope: t.scope ?? null,
      is_closing_soon: false,
    }))

  const closingSoon: DispatchTopic[] = allTopics
    .filter((t) => {
      if (t.status !== 'voting') return false
      if (!t.voting_ends_at) return false
      const hoursLeft =
        (new Date(t.voting_ends_at).getTime() - now.getTime()) / 3_600_000
      return hoursLeft > 0 && hoursLeft <= 24
    })
    .sort((a, b) => {
      const aEnd = a.voting_ends_at ? new Date(a.voting_ends_at).getTime() : Infinity
      const bEnd = b.voting_ends_at ? new Date(b.voting_ends_at).getTime() : Infinity
      return aEnd - bEnd
    })
    .slice(0, 5)
    .map((t) => {
      const hoursLeft = t.voting_ends_at
        ? (new Date(t.voting_ends_at).getTime() - now.getTime()) / 3_600_000
        : undefined
      return {
        id: t.id,
        statement: t.statement,
        category: t.category,
        status: t.status,
        total_votes: t.total_votes ?? 0,
        blue_pct: t.blue_pct ?? 50,
        scope: t.scope ?? null,
        is_closing_soon: true,
        hours_until_close: hoursLeft !== undefined ? Math.round(hoursLeft) : undefined,
      }
    })

  // ── Process debates ─────────────────────────────────────────────────────────
  const upcomingDebates: DispatchDebate[] = (debatesRes.data ?? []).map((d) => {
    const topic = Array.isArray(d.topics) ? d.topics[0] : d.topics
    const hoursUntil =
      (new Date(d.scheduled_at).getTime() - now.getTime()) / 3_600_000
    return {
      id: d.id,
      topic_id: d.topic_id,
      topic_statement: topic?.statement ?? 'Unknown topic',
      topic_category: topic?.category ?? null,
      scheduled_at: d.scheduled_at,
      status: d.status,
      title: d.title ?? null,
      debate_type: d.type ?? 'quick',
      participant_count: d.participant_count ?? 0,
      hours_until_start: Math.round(hoursUntil),
    }
  })

  // ── Process arguments ───────────────────────────────────────────────────────
  const topArguments: DispatchArgument[] = (argsRes.data ?? [])
    .map((a) => {
      const topic = Array.isArray(a.topics) ? a.topics[0] : a.topics
      const profile = Array.isArray(a.profiles) ? a.profiles[0] : a.profiles
      if (!profile?.username) return null
      return {
        id: a.id,
        topic_id: a.topic_id,
        topic_statement: topic?.statement ?? 'Unknown topic',
        content: a.content,
        side: a.side as 'blue' | 'red',
        upvotes: a.upvotes ?? 0,
        author_username: profile.username,
        author_display_name: profile.display_name ?? null,
        author_role: profile.role ?? 'person',
        created_at: a.created_at,
      } satisfies DispatchArgument
    })
    .filter((a): a is DispatchArgument => a !== null)

  // ── Platform stats for today ────────────────────────────────────────────────
  const [votesTodayRes, argsTodayRes, topicsTodayRes, debatesTodayRes] =
    await Promise.all([
      supabase
        .from('votes')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', todayIso),
      supabase
        .from('topic_arguments')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', todayIso),
      supabase
        .from('topics')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', todayIso),
      supabase
        .from('debates')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', todayIso),
    ])

  const stats: DispatchStats = {
    votes_cast_today: votesTodayRes.count ?? 0,
    arguments_posted_today: argsTodayRes.count ?? 0,
    new_topics_today: topicsTodayRes.count ?? 0,
    debates_today: debatesTodayRes.count ?? 0,
    laws_established_today: newLaws.filter((l) =>
      new Date(l.established_at) >= todayStart,
    ).length,
    active_citizens: 0, // placeholder – would need session data
  }

  const data: DispatchData = {
    issued_at: now.toISOString(),
    edition,
    newLaws,
    nearConsensus,
    contested,
    closingSoon,
    upcomingDebates,
    topArguments,
    stats,
  }

  return NextResponse.json(data)
}
