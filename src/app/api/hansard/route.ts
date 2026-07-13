import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type HansardEntryType = 'law' | 'edm' | 'pmq' | 'committee_report' | 'debate' | 'topic'

export interface HansardEntry {
  id: string
  type: HansardEntryType
  timestamp: string
  title: string
  summary: string
  category: string | null
  href: string
  meta: Record<string, string | number | null>
  author?: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

export interface HansardDay {
  date: string        // YYYY-MM-DD
  entries: HansardEntry[]
  stats: {
    laws: number
    edms: number
    debates: number
    reports: number
    pmqs: number
    topics: number
  }
}

export interface HansardResponse {
  days: HansardDay[]
  dateRange: { from: string; to: string }
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = new URL(req.url)

  const dateParam = searchParams.get('date') ?? null // YYYY-MM-DD
  const rangeParam = searchParams.get('range') ?? '1' // number of days to show

  const daysBack = Math.min(Math.max(parseInt(rangeParam, 10) || 1, 1), 7)

  // Determine date window
  const endDate = dateParam ? new Date(`${dateParam}T23:59:59Z`) : new Date()
  const startDate = new Date(endDate)
  startDate.setDate(startDate.getDate() - (daysBack - 1))
  startDate.setHours(0, 0, 0, 0)

  const fromISO = startDate.toISOString()
  const toISO = endDate.toISOString()

  // ── 1. Laws established ────────────────────────────────────────────────────
  const { data: lawRows } = await supabase
    .from('laws')
    .select(`
      id,
      statement,
      category,
      established_at,
      blue_pct,
      total_votes
    `)
    .gte('established_at', fromISO)
    .lte('established_at', toISO)
    .order('established_at', { ascending: false })
    .limit(50)

  // ── 2. Early Day Motions filed ────────────────────────────────────────────
  const { data: edmRows } = await supabase
    .from('early_day_motions')
    .select(`
      id,
      title,
      body,
      category,
      grounds,
      second_count,
      status,
      created_at,
      author:profiles!early_day_motions_filed_by_fkey(id, username, display_name, avatar_url, role)
    `)
    .gte('created_at', fromISO)
    .lte('created_at', toISO)
    .order('created_at', { ascending: false })
    .limit(50)

  // ── 3. PMQ Sessions opened/closed ────────────────────────────────────────
  const { data: pmqRows } = await supabase
    .from('pmq_sessions')
    .select(`
      id,
      session_number,
      title,
      status,
      created_at,
      coalition:coalitions!coalition_id(name, color)
    `)
    .gte('created_at', fromISO)
    .lte('created_at', toISO)
    .order('created_at', { ascending: false })
    .limit(20)

  // ── 4. Committee Reports published ───────────────────────────────────────
  const { data: reportRows } = await supabase
    .from('civic_committee_reports')
    .select(`
      id,
      title,
      summary,
      category,
      recommendation,
      endorsement_count,
      created_at,
      author:profiles!civic_committee_reports_author_id_fkey(id, username, display_name, avatar_url, role)
    `)
    .eq('status', 'published')
    .gte('created_at', fromISO)
    .lte('created_at', toISO)
    .order('created_at', { ascending: false })
    .limit(30)

  // ── 5. Debates concluded ─────────────────────────────────────────────────
  const { data: debateRows } = await supabase
    .from('debates')
    .select(`
      id,
      title,
      status,
      debate_type,
      scheduled_at,
      ended_at,
      topic:topics!debates_topic_id_fkey(statement, category)
    `)
    .in('status', ['ended'])
    .gte('ended_at', fromISO)
    .lte('ended_at', toISO)
    .order('ended_at', { ascending: false })
    .limit(30)

  // ── 6. New topics proposed ────────────────────────────────────────────────
  const { data: topicRows } = await supabase
    .from('topics')
    .select(`
      id,
      statement,
      category,
      status,
      created_at,
      blue_pct,
      total_votes,
      author:profiles!topics_author_id_fkey(id, username, display_name, avatar_url, role)
    `)
    .gte('created_at', fromISO)
    .lte('created_at', toISO)
    .order('created_at', { ascending: false })
    .limit(30)

  // ── Build entries ─────────────────────────────────────────────────────────

  const entries: HansardEntry[] = []

  for (const law of lawRows ?? []) {
    entries.push({
      id: law.id,
      type: 'law',
      timestamp: law.established_at ?? new Date().toISOString(),
      title: `LAW ESTABLISHED: ${law.statement}`,
      summary: `Passed into the Civic Codex with ${Math.round(law.blue_pct ?? 50)}% FOR on ${(law.total_votes ?? 0).toLocaleString()} votes.`,
      category: law.category,
      href: `/laws/${law.id}`,
      meta: { forPct: Math.round(law.blue_pct ?? 50), totalVotes: law.total_votes ?? 0 },
    })
  }

  for (const edm of edmRows ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const author = (edm as any).author as HansardEntry['author'] | null
    entries.push({
      id: edm.id,
      type: 'edm',
      timestamp: edm.created_at,
      title: `EDM: ${edm.title}`,
      summary: edm.body.slice(0, 160) + (edm.body.length > 160 ? '…' : ''),
      category: edm.category,
      href: `/edm#${edm.id}`,
      meta: { grounds: edm.grounds, secondCount: edm.second_count, status: edm.status },
      author,
    })
  }

  for (const pmq of pmqRows ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const coalition = (pmq as any).coalition as { name: string; color: string | null } | null
    entries.push({
      id: pmq.id,
      type: 'pmq',
      timestamp: pmq.created_at,
      title: `PMQ SESSION #${pmq.session_number}: ${pmq.title}`,
      summary: coalition
        ? `Session opened by ${coalition.name}. Status: ${pmq.status.replace('_', ' ')}.`
        : `Status: ${pmq.status.replace('_', ' ')}.`,
      category: null,
      href: `/pmqs`,
      meta: { sessionNumber: pmq.session_number, status: pmq.status },
    })
  }

  for (const report of reportRows ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const author = (report as any).author as HansardEntry['author'] | null
    entries.push({
      id: report.id,
      type: 'committee_report',
      timestamp: report.created_at,
      title: `COMMITTEE REPORT: ${report.title}`,
      summary: report.summary,
      category: report.category,
      href: `/committee-reports/${report.id}`,
      meta: { recommendation: report.recommendation, endorsements: report.endorsement_count },
      author,
    })
  }

  for (const debate of debateRows ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const topic = (debate as any).topic as { statement: string; category: string | null } | null
    entries.push({
      id: debate.id,
      type: 'debate',
      timestamp: debate.ended_at ?? debate.scheduled_at ?? new Date().toISOString(),
      title: `DEBATE CONCLUDED: ${debate.title ?? topic?.statement ?? 'Untitled Debate'}`,
      summary: topic
        ? `${(debate.debate_type ?? 'oxford').replace('_', ' ')} debate on "${topic.statement}" concluded.`
        : `${(debate.debate_type ?? 'oxford').replace('_', ' ')} debate concluded.`,
      category: topic?.category ?? null,
      href: `/debate/${debate.id}`,
      meta: { type: debate.debate_type ?? 'oxford' },
    })
  }

  for (const topic of topicRows ?? []) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const author = (topic as any).author as HansardEntry['author'] | null
    entries.push({
      id: topic.id,
      type: 'topic',
      timestamp: topic.created_at,
      title: `MOTION PROPOSED: ${topic.statement}`,
      summary: `New civic motion proposed in the ${topic.category ?? 'General'} category.`,
      category: topic.category,
      href: `/topic/${topic.id}`,
      meta: { status: topic.status },
      author,
    })
  }

  // ── Group by day ──────────────────────────────────────────────────────────

  const dayMap = new Map<string, HansardEntry[]>()

  for (let d = 0; d < daysBack; d++) {
    const day = new Date(endDate)
    day.setDate(day.getDate() - d)
    const key = day.toISOString().slice(0, 10)
    dayMap.set(key, [])
  }

  for (const entry of entries) {
    const key = entry.timestamp.slice(0, 10)
    if (!dayMap.has(key)) dayMap.set(key, [])
    dayMap.get(key)!.push(entry)
  }

  const days: HansardDay[] = Array.from(dayMap.entries())
    .sort(([a], [b]) => b.localeCompare(a))
    .map(([date, dayEntries]) => {
      const sorted = dayEntries.sort(
        (a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime()
      )
      return {
        date,
        entries: sorted,
        stats: {
          laws: sorted.filter((e) => e.type === 'law').length,
          edms: sorted.filter((e) => e.type === 'edm').length,
          debates: sorted.filter((e) => e.type === 'debate').length,
          reports: sorted.filter((e) => e.type === 'committee_report').length,
          pmqs: sorted.filter((e) => e.type === 'pmq').length,
          topics: sorted.filter((e) => e.type === 'topic').length,
        },
      }
    })

  return NextResponse.json({
    days,
    dateRange: { from: fromISO, to: toISO },
  } satisfies HansardResponse)
}
