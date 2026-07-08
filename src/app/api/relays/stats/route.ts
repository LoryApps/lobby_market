import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CategoryStat {
  category: string
  count: number
  completed: number
  completion_rate: number
  compelling_rate: number
  for_count: number
  against_count: number
}

export interface WeekPoint {
  week: string   // ISO date of week start (Monday)
  label: string  // "Jun 2"
  created: number
  completed: number
}

export interface TopRelay {
  id: string
  topic_statement: string | null
  topic_category: string | null
  side: 'for' | 'against'
  status: string
  legs_filled: number
  max_legs: number
  vote_compelling: number
  vote_not_compelling: number
  created_at: string
  completed_at: string | null
  starter_username: string
  starter_display_name: string | null
  starter_avatar_url: string | null
}

export interface RelayStatsResponse {
  totals: {
    total: number
    open: number
    in_progress: number
    complete: number
    voted: number
    completion_rate: number
    compelling_rate: number
    total_legs: number
    avg_legs_per_relay: number
    unique_participants: number
    for_relays: number
    against_relays: number
  }
  by_category: CategoryStat[]
  by_week: WeekPoint[]
  top_relays: TopRelay[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function isoWeekStart(date: Date): string {
  const d = new Date(date)
  const day = d.getUTCDay() // 0=Sun, 1=Mon, …
  d.setUTCDate(d.getUTCDate() - ((day + 6) % 7)) // roll back to Monday
  return d.toISOString().slice(0, 10)
}

function weekLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00Z')
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' })
}

// ─── GET /api/relays/stats ────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  // ── 1. Fetch all relays (bounded to last year for performance) ────────────
  const cutoff = new Date()
  cutoff.setFullYear(cutoff.getFullYear() - 1)

  const { data: relays } = await supabase
    .from('civic_relays')
    .select(
      'id, topic_id, side, status, max_legs, ' +
      'vote_compelling, vote_not_compelling, created_at, completed_at, starter_id'
    )
    .gte('created_at', cutoff.toISOString())
    .order('created_at', { ascending: false })

  const rows = relays ?? []

  // ── 2. Fetch leg counts ───────────────────────────────────────────────────
  const relayIds = rows.map((r) => r.id)

  const legsByRelay = new Map<string, number>()
  const uniqueParticipants = new Set<string>()

  if (relayIds.length > 0) {
    const { data: legs } = await supabase
      .from('relay_legs')
      .select('relay_id, author_id')
      .in('relay_id', relayIds)

    for (const leg of legs ?? []) {
      legsByRelay.set(leg.relay_id, (legsByRelay.get(leg.relay_id) ?? 0) + 1)
      uniqueParticipants.add(leg.author_id)
    }
  }

  // Also count starters as participants
  for (const r of rows) uniqueParticipants.add(r.starter_id)

  // ── 3. Fetch topic categories ─────────────────────────────────────────────
  const topicIds = [...new Set(rows.map((r) => r.topic_id).filter(Boolean))] as string[]
  const categoryByTopic = new Map<string, string>()
  const statementByTopic = new Map<string, string>()

  if (topicIds.length > 0) {
    const { data: topics } = await supabase
      .from('topics')
      .select('id, statement, category')
      .in('id', topicIds)

    for (const t of topics ?? []) {
      categoryByTopic.set(t.id, t.category ?? 'Other')
      statementByTopic.set(t.id, t.statement)
    }
  }

  // ── 4. Fetch starter profiles for top relays ──────────────────────────────
  const starterIds = [...new Set(rows.map((r) => r.starter_id))]
  const profileMap = new Map<string, {
    username: string
    display_name: string | null
    avatar_url: string | null
  }>()

  if (starterIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', starterIds)

    for (const p of profiles ?? []) {
      profileMap.set(p.id, { username: p.username, display_name: p.display_name, avatar_url: p.avatar_url })
    }
  }

  // ── 5. Compute totals ─────────────────────────────────────────────────────
  const open = rows.filter((r) => r.status === 'open').length
  const in_progress = rows.filter((r) => r.status === 'in_progress').length
  const complete = rows.filter((r) => r.status === 'complete').length
  const voted = rows.filter((r) => r.status === 'voted').length
  const total = rows.length

  const completion_rate = total > 0 ? Math.round(((complete + voted) / total) * 100) : 0

  const totalCompelling = rows.reduce((s, r) => s + (r.vote_compelling ?? 0), 0)
  const totalNotCompelling = rows.reduce((s, r) => s + (r.vote_not_compelling ?? 0), 0)
  const totalVoted = totalCompelling + totalNotCompelling
  const compelling_rate = totalVoted > 0 ? Math.round((totalCompelling / totalVoted) * 100) : 0

  const total_legs = Array.from(legsByRelay.values()).reduce((s, n) => s + n, 0)
  const avg_legs_per_relay = total > 0 ? Math.round((total_legs / total) * 10) / 10 : 0

  const for_relays = rows.filter((r) => r.side === 'for').length
  const against_relays = rows.filter((r) => r.side === 'against').length

  // ── 6. By category ───────────────────────────────────────────────────────
  const catMap = new Map<string, {
    count: number; completed: number; compelling: number; notCompelling: number
    for_count: number; against_count: number
  }>()

  for (const r of rows) {
    const cat = r.topic_id ? (categoryByTopic.get(r.topic_id) ?? 'No Topic') : 'No Topic'
    const cur = catMap.get(cat) ?? { count: 0, completed: 0, compelling: 0, notCompelling: 0, for_count: 0, against_count: 0 }
    cur.count++
    if (r.status === 'complete' || r.status === 'voted') cur.completed++
    cur.compelling += r.vote_compelling ?? 0
    cur.notCompelling += r.vote_not_compelling ?? 0
    if (r.side === 'for') cur.for_count++
    else cur.against_count++
    catMap.set(cat, cur)
  }

  const by_category: CategoryStat[] = Array.from(catMap.entries())
    .map(([category, s]) => ({
      category,
      count: s.count,
      completed: s.completed,
      completion_rate: s.count > 0 ? Math.round((s.completed / s.count) * 100) : 0,
      compelling_rate: (s.compelling + s.notCompelling) > 0
        ? Math.round((s.compelling / (s.compelling + s.notCompelling)) * 100)
        : 0,
      for_count: s.for_count,
      against_count: s.against_count,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // ── 7. By week (last 8 weeks) ─────────────────────────────────────────────
  const now = new Date()
  const weekBuckets: Map<string, { created: number; completed: number }> = new Map()

  for (let i = 7; i >= 0; i--) {
    const d = new Date(now)
    d.setUTCDate(d.getUTCDate() - i * 7)
    const key = isoWeekStart(d)
    if (!weekBuckets.has(key)) weekBuckets.set(key, { created: 0, completed: 0 })
  }

  for (const r of rows) {
    const created = isoWeekStart(new Date(r.created_at))
    if (weekBuckets.has(created)) {
      weekBuckets.get(created)!.created++
    }
    if (r.completed_at) {
      const completed = isoWeekStart(new Date(r.completed_at))
      if (weekBuckets.has(completed)) {
        weekBuckets.get(completed)!.completed++
      }
    }
  }

  const by_week: WeekPoint[] = Array.from(weekBuckets.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([week, { created, completed }]) => ({
      week,
      label: weekLabel(week),
      created,
      completed,
    }))

  // ── 8. Top relays (by compelling votes, then completion) ──────────────────
  const top_relays: TopRelay[] = rows
    .filter((r) => r.status === 'voted' || r.status === 'complete')
    .sort((a, b) => {
      const aScore = (a.vote_compelling ?? 0) - (a.vote_not_compelling ?? 0)
      const bScore = (b.vote_compelling ?? 0) - (b.vote_not_compelling ?? 0)
      if (bScore !== aScore) return bScore - aScore
      return new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    })
    .slice(0, 5)
    .map((r) => {
      const starter = profileMap.get(r.starter_id)
      return {
        id: r.id,
        topic_statement: r.topic_id ? (statementByTopic.get(r.topic_id) ?? null) : null,
        topic_category: r.topic_id ? (categoryByTopic.get(r.topic_id) ?? null) : null,
        side: r.side as 'for' | 'against',
        status: r.status,
        legs_filled: legsByRelay.get(r.id) ?? 0,
        max_legs: r.max_legs,
        vote_compelling: r.vote_compelling ?? 0,
        vote_not_compelling: r.vote_not_compelling ?? 0,
        created_at: r.created_at,
        completed_at: r.completed_at,
        starter_username: starter?.username ?? 'unknown',
        starter_display_name: starter?.display_name ?? null,
        starter_avatar_url: starter?.avatar_url ?? null,
      }
    })

  // ── 9. Assemble response ──────────────────────────────────────────────────
  const response: RelayStatsResponse = {
    totals: {
      total,
      open,
      in_progress,
      complete,
      voted,
      completion_rate,
      compelling_rate,
      total_legs,
      avg_legs_per_relay,
      unique_participants: uniqueParticipants.size,
      for_relays,
      against_relays,
    },
    by_category,
    by_week,
    top_relays,
  }

  return NextResponse.json(response)
}
