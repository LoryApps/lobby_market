import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface AccountAgeband {
  label: string      // "< 7 days", "7-30 days", "30-90 days", "90d-1y", "> 1 year"
  days_min: number
  days_max: number | null
  count: number
  pct: number
  for_pct: number    // % of this band that voted FOR
}

export interface RoleBand {
  role: string
  label: string
  count: number
  pct: number
  for_pct: number
}

export interface DailyVote {
  date: string       // YYYY-MM-DD
  total: number
  for_count: number
  against_count: number
}

export interface IntegrityFlag {
  severity: 'info' | 'warning' | 'concern'
  code: string
  message: string
}

export interface AuditResponse {
  topic_id: string
  statement: string
  category: string | null
  status: string
  total_votes: number
  blue_pct: number
  argument_count: number
  argument_with_source_count: number
  citation_rate: number           // 0–100
  account_age_bands: AccountAgeband[]
  role_bands: RoleBand[]
  daily_votes: DailyVote[]
  integrity_score: number         // 0–100
  flags: IntegrityFlag[]
  generated_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  person:        'Citizen',
  debator:       'Debator',
  troll_catcher: 'Troll Catcher',
  elder:         'Elder',
  lawmaker:      'Lawmaker',
  senator:       'Senator',
}

function daysBetween(a: string, b: string): number {
  return Math.floor((new Date(b).getTime() - new Date(a).getTime()) / 86_400_000)
}

// ─── GET /api/topics/[id]/audit ───────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const { id } = params

  const supabase = await createClient()

  // ── Fetch topic ────────────────────────────────────────────────────────────
  const { data: topic, error } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, created_at')
    .eq('id', id)
    .maybeSingle()

  if (error || !topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  // ── Fetch votes (join profiles for account age + role) ─────────────────────
  const { data: votes } = await supabase
    .from('votes')
    .select('side, created_at, user_id')
    .eq('topic_id', id)
    .order('created_at', { ascending: true })
    .limit(5000)

  const voteRows = votes ?? []

  // Batch-fetch voter profiles
  const voterIds = [...new Set(voteRows.map((v) => v.user_id))].filter(Boolean)

  const profileMap = new Map<string, { created_at: string; role: string }>()
  if (voterIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, created_at, role')
      .in('id', voterIds)
    for (const p of profiles ?? []) {
      profileMap.set(p.id, { created_at: p.created_at, role: p.role ?? 'person' })
    }
  }

  // ── Arguments + citation rate ─────────────────────────────────────────────
  const { data: args } = await supabase
    .from('topic_arguments')
    .select('id, source_url')
    .eq('topic_id', id)

  const argRows = args ?? []
  const argument_count = argRows.length
  const argument_with_source_count = argRows.filter((a) => !!a.source_url).length
  const citation_rate =
    argument_count > 0
      ? Math.round((argument_with_source_count / argument_count) * 100)
      : 0

  // ── Account age bands ─────────────────────────────────────────────────────
  const BANDS: { label: string; min: number; max: number | null }[] = [
    { label: '< 7 days',   min: 0,   max: 7 },
    { label: '7–30 days',  min: 7,   max: 30 },
    { label: '30–90 days', min: 30,  max: 90 },
    { label: '90d – 1yr',  min: 90,  max: 365 },
    { label: '> 1 year',   min: 365, max: null },
  ]

  const now = new Date().toISOString()
  const bandCounters: { total: number; for_count: number }[] = BANDS.map(() => ({
    total: 0,
    for_count: 0,
  }))

  for (const vote of voteRows) {
    const profile = profileMap.get(vote.user_id)
    if (!profile) continue
    const age = daysBetween(profile.created_at, now)
    const bandIdx = BANDS.findIndex(
      (b) => age >= b.min && (b.max === null || age < b.max),
    )
    if (bandIdx === -1) continue
    bandCounters[bandIdx].total++
    if (vote.side === 'blue') bandCounters[bandIdx].for_count++
  }

  const totalWithProfile = bandCounters.reduce((s, b) => s + b.total, 0) || 1
  const account_age_bands: AccountAgeband[] = BANDS.map((b, i) => ({
    label: b.label,
    days_min: b.min,
    days_max: b.max,
    count: bandCounters[i].total,
    pct: Math.round((bandCounters[i].total / totalWithProfile) * 100),
    for_pct:
      bandCounters[i].total > 0
        ? Math.round((bandCounters[i].for_count / bandCounters[i].total) * 100)
        : 0,
  }))

  // ── Role breakdown ────────────────────────────────────────────────────────
  const roleMap = new Map<string, { total: number; for_count: number }>()
  for (const vote of voteRows) {
    const profile = profileMap.get(vote.user_id)
    const role = profile?.role ?? 'person'
    const entry = roleMap.get(role) ?? { total: 0, for_count: 0 }
    entry.total++
    if (vote.side === 'blue') entry.for_count++
    roleMap.set(role, entry)
  }

  const role_bands: RoleBand[] = Array.from(roleMap.entries())
    .sort((a, b) => b[1].total - a[1].total)
    .map(([role, { total, for_count }]) => ({
      role,
      label: ROLE_LABELS[role] ?? role,
      count: total,
      pct: Math.round((total / totalWithProfile) * 100),
      for_pct: total > 0 ? Math.round((for_count / total) * 100) : 0,
    }))

  // ── Daily vote pattern ────────────────────────────────────────────────────
  const dailyMap = new Map<string, { total: number; for_count: number }>()
  for (const vote of voteRows) {
    const day = vote.created_at.slice(0, 10)
    const entry = dailyMap.get(day) ?? { total: 0, for_count: 0 }
    entry.total++
    if (vote.side === 'blue') entry.for_count++
    dailyMap.set(day, entry)
  }

  const daily_votes: DailyVote[] = Array.from(dailyMap.entries())
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([date, { total, for_count }]) => ({
      date,
      total,
      for_count,
      against_count: total - for_count,
    }))
    .slice(-30) // last 30 days

  // ── Integrity flags ───────────────────────────────────────────────────────
  const flags: IntegrityFlag[] = []

  // New account surge
  const newAccountPct = account_age_bands[0]?.pct ?? 0
  const weekOldPct = (account_age_bands[0]?.pct ?? 0) + (account_age_bands[1]?.pct ?? 0)
  if (newAccountPct >= 20) {
    flags.push({
      severity: 'concern',
      code: 'NEW_ACCOUNT_SURGE',
      message: `${newAccountPct}% of voters created their account within 7 days of voting.`,
    })
  } else if (weekOldPct >= 30) {
    flags.push({
      severity: 'warning',
      code: 'YOUNG_VOTER_CONCENTRATION',
      message: `${weekOldPct}% of voters registered within 30 days of casting their vote.`,
    })
  }

  // Vote burst detection (single day > 40% of all votes)
  const maxDayVotes = Math.max(...daily_votes.map((d) => d.total), 0)
  const totalVotes = topic.total_votes ?? 0
  if (totalVotes > 10 && maxDayVotes / totalVotes > 0.4) {
    const burstDay = daily_votes.find((d) => d.total === maxDayVotes)
    flags.push({
      severity: 'warning',
      code: 'VOTE_BURST',
      message: `${Math.round((maxDayVotes / totalVotes) * 100)}% of votes arrived on a single day (${burstDay?.date ?? 'unknown'}).`,
    })
  }

  // Low argument citation rate
  if (argument_count >= 5 && citation_rate < 20) {
    flags.push({
      severity: 'info',
      code: 'LOW_CITATION_RATE',
      message: `Only ${citation_rate}% of arguments include external sources.`,
    })
  }

  // One-sided new account voting
  const newAcctBand = account_age_bands[0]
  if (newAcctBand && newAcctBand.count >= 10 && (newAcctBand.for_pct >= 85 || newAcctBand.for_pct <= 15)) {
    flags.push({
      severity: 'concern',
      code: 'COORDINATED_NEW_ACCOUNTS',
      message: `New accounts (< 7 days old) voted ${newAcctBand.for_pct >= 85 ? 'FOR' : 'AGAINST'} at ${newAcctBand.for_pct >= 85 ? newAcctBand.for_pct : 100 - newAcctBand.for_pct}% — unusually lopsided.`,
    })
  }

  if (flags.length === 0 && totalVotes > 5) {
    flags.push({
      severity: 'info',
      code: 'NO_FLAGS',
      message: 'No integrity concerns detected. Voting patterns appear organic.',
    })
  }

  // ── Integrity score ───────────────────────────────────────────────────────
  let integrity_score = 100
  for (const flag of flags) {
    if (flag.severity === 'concern') integrity_score -= 25
    if (flag.severity === 'warning') integrity_score -= 10
    // info flags are neutral
  }
  // boost for older account majority
  const establishedPct =
    (account_age_bands[3]?.pct ?? 0) + (account_age_bands[4]?.pct ?? 0)
  if (establishedPct >= 70) integrity_score = Math.min(100, integrity_score + 5)
  // boost for citation rate
  if (citation_rate >= 50) integrity_score = Math.min(100, integrity_score + 5)
  integrity_score = Math.max(0, integrity_score)

  return NextResponse.json({
    topic_id: topic.id,
    statement: topic.statement,
    category: topic.category ?? null,
    status: topic.status,
    total_votes: topic.total_votes ?? 0,
    blue_pct: Math.round(topic.blue_pct ?? 50),
    argument_count,
    argument_with_source_count,
    citation_rate,
    account_age_bands,
    role_bands,
    daily_votes,
    integrity_score,
    flags,
    generated_at: new Date().toISOString(),
  } satisfies AuditResponse)
}
