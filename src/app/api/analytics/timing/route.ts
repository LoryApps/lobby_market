import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type TimingArchetype =
  | 'trailblazer'
  | 'pioneer'
  | 'mainstream'
  | 'late_majority'
  | 'archivist'

export interface HourBucket {
  hour: number          // 0–23 UTC
  label: string         // "12 AM", "1 PM", etc.
  count: number
  pct: number
}

export interface DayBucket {
  day: number           // 0 = Sunday … 6 = Saturday
  label: string
  shortLabel: string
  count: number
  pct: number
}

export interface EarlyVoteTopic {
  topic_id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  user_vote: 'blue' | 'red'
  delta_hours: number   // hours between topic creation and this vote
  voted_at: string
}

export interface TimingResponse {
  authenticated: true
  user: {
    username: string
    display_name: string | null
    avatar_url: string | null
  }
  total_votes: number
  avg_delta_hours: number          // mean hours from topic creation → user vote
  median_delta_hours: number
  early_adopter_score: number      // 0–100
  archetype: TimingArchetype
  archetype_label: string
  archetype_tagline: string
  archetype_description: string
  peak_hour: number | null         // UTC hour with most votes
  peak_day: number | null          // 0–6 weekday with most votes
  hour_distribution: HourBucket[]
  day_distribution: DayBucket[]
  fastest_votes: EarlyVoteTopic[]  // voted earliest relative to creation
  slowest_votes: EarlyVoteTopic[]  // voted latest relative to creation
  early_accuracy: number | null    // % of early votes that matched eventual majority
}

export interface TimingResponseUnauthenticated {
  authenticated: false
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const HOUR_LABELS: Record<number, string> = {}
for (let h = 0; h < 24; h++) {
  const suffix = h < 12 ? 'AM' : 'PM'
  const display = h === 0 ? 12 : h > 12 ? h - 12 : h
  HOUR_LABELS[h] = `${display} ${suffix}`
}

const DAY_CONFIG = [
  { label: 'Sunday',    shortLabel: 'Sun' },
  { label: 'Monday',    shortLabel: 'Mon' },
  { label: 'Tuesday',   shortLabel: 'Tue' },
  { label: 'Wednesday', shortLabel: 'Wed' },
  { label: 'Thursday',  shortLabel: 'Thu' },
  { label: 'Friday',    shortLabel: 'Fri' },
  { label: 'Saturday',  shortLabel: 'Sat' },
]

const ARCHETYPE_META: Record<
  TimingArchetype,
  { label: string; tagline: string; description: string }
> = {
  trailblazer: {
    label: 'The Trailblazer',
    tagline: 'First in, first out',
    description:
      'You discover debates before most people have even heard of them. Your votes land when topics are fresh, often shaping the early consensus that others inherit.',
  },
  pioneer: {
    label: 'The Pioneer',
    tagline: 'Ahead of the curve',
    description:
      'You engage early — before a topic hits the mainstream. Your voice carries weight during the formative hours when debate trajectories are still being set.',
  },
  mainstream: {
    label: 'The Mainstream Voter',
    tagline: 'In the thick of it',
    description:
      'You tend to vote while debates are in full swing. Your timing is perfectly calibrated to catch topics at their most vibrant — after enough context has formed but while the outcome is still undecided.',
  },
  late_majority: {
    label: 'The Deliberator',
    tagline: 'Patient and considered',
    description:
      'You prefer to let debates develop before weighing in. Your votes are more considered — shaped by a fuller picture of the arguments and community response.',
  },
  archivist: {
    label: 'The Archivist',
    tagline: 'History judges all',
    description:
      'You revisit older debates and settled questions. Whether rediscovering forgotten topics or adding a retrospective voice, your timing gives you unique historical perspective.',
  },
}

function classifyArchetype(avgDeltaHours: number): TimingArchetype {
  if (avgDeltaHours < 24) return 'trailblazer'
  if (avgDeltaHours < 72) return 'pioneer'
  if (avgDeltaHours < 168) return 'mainstream'   // < 7 days
  if (avgDeltaHours < 720) return 'late_majority' // < 30 days
  return 'archivist'
}

function median(sorted: number[]): number {
  if (sorted.length === 0) return 0
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

function earlyAdopterScore(avgDeltaHours: number): number {
  // Score 0–100: higher = earlier adopter
  // 0 h → 100, 24 h → 85, 72 h → 70, 168 h → 50, 720 h → 20, 8760 h → 0
  if (avgDeltaHours <= 0) return 100
  if (avgDeltaHours < 1) return 99
  // Logarithmic decay from 100 at t=0 to ~0 at t=8760 (1 year)
  const score = Math.max(0, Math.round(100 - (Math.log(avgDeltaHours + 1) / Math.log(8761)) * 100))
  return Math.min(100, score)
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient()

  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ authenticated: false } satisfies TimingResponseUnauthenticated)
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, avatar_url')
    .eq('id', user.id)
    .single()

  if (!profile) {
    return NextResponse.json({ authenticated: false } satisfies TimingResponseUnauthenticated)
  }

  // Fetch up to 1000 votes with topic creation timestamp
  const { data: rawVotes } = await supabase
    .from('votes')
    .select(`
      created_at,
      side,
      topics (
        id,
        statement,
        category,
        status,
        blue_pct,
        total_votes,
        created_at
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(1000)

  if (!rawVotes || rawVotes.length === 0) {
    return NextResponse.json({
      authenticated: true,
      user: {
        username: profile.username,
        display_name: profile.display_name,
        avatar_url: profile.avatar_url,
      },
      total_votes: 0,
      avg_delta_hours: 0,
      median_delta_hours: 0,
      early_adopter_score: 0,
      archetype: 'mainstream',
      ...ARCHETYPE_META.mainstream,
      peak_hour: null,
      peak_day: null,
      hour_distribution: [],
      day_distribution: [],
      fastest_votes: [],
      slowest_votes: [],
      early_accuracy: null,
    } satisfies TimingResponse)
  }

  // ── Delta calculations ─────────────────────────────────────────────────────

  type VoteRow = {
    created_at: string
    side: string
    topics: {
      id: string
      statement: string
      category: string | null
      status: string
      blue_pct: number
      total_votes: number
      created_at: string
    } | null
  }

  const votes = (rawVotes as unknown as VoteRow[]).filter((v) => v.topics !== null)

  const deltaHours: number[] = []
  const earlyTopics: EarlyVoteTopic[] = []

  for (const v of votes) {
    const t = v.topics!
    const votedMs = new Date(v.created_at).getTime()
    const createdMs = new Date(t.created_at).getTime()
    const dh = Math.max(0, (votedMs - createdMs) / 3_600_000)
    deltaHours.push(dh)

    earlyTopics.push({
      topic_id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
      blue_pct: t.blue_pct ?? 50,
      total_votes: t.total_votes ?? 0,
      user_vote: v.side === 'blue' ? 'blue' : 'red',
      delta_hours: parseFloat(dh.toFixed(1)),
      voted_at: v.created_at,
    })
  }

  const sortedDeltas = [...deltaHours].sort((a, b) => a - b)
  const avgDelta = deltaHours.length > 0
    ? deltaHours.reduce((s, n) => s + n, 0) / deltaHours.length
    : 0
  const medianDelta = median(sortedDeltas)

  // ── Hour distribution (UTC) ────────────────────────────────────────────────

  const hourCounts: Record<number, number> = {}
  const dayCounts: Record<number, number> = {}

  for (const v of votes) {
    const d = new Date(v.created_at)
    const h = d.getUTCHours()
    const dow = d.getUTCDay()
    hourCounts[h] = (hourCounts[h] ?? 0) + 1
    dayCounts[dow] = (dayCounts[dow] ?? 0) + 1
  }

  const total = votes.length
  const hourDistribution: HourBucket[] = Array.from({ length: 24 }, (_, h) => ({
    hour: h,
    label: HOUR_LABELS[h],
    count: hourCounts[h] ?? 0,
    pct: total > 0 ? Math.round(((hourCounts[h] ?? 0) / total) * 100) : 0,
  }))

  const dayDistribution: DayBucket[] = DAY_CONFIG.map((cfg, day) => ({
    day,
    label: cfg.label,
    shortLabel: cfg.shortLabel,
    count: dayCounts[day] ?? 0,
    pct: total > 0 ? Math.round(((dayCounts[day] ?? 0) / total) * 100) : 0,
  }))

  const peakHourEntry = hourDistribution.reduce(
    (best, cur) => (cur.count > best.count ? cur : best),
    hourDistribution[0]
  )
  const peakDayEntry = dayDistribution.reduce(
    (best, cur) => (cur.count > best.count ? cur : best),
    dayDistribution[0]
  )

  const peakHour = peakHourEntry.count > 0 ? peakHourEntry.hour : null
  const peakDay = peakDayEntry.count > 0 ? peakDayEntry.day : null

  // ── Fastest & slowest ─────────────────────────────────────────────────────

  const sortedByDelta = [...earlyTopics].sort((a, b) => a.delta_hours - b.delta_hours)
  const fastestVotes = sortedByDelta.slice(0, 10)
  const slowestVotes = sortedByDelta.slice(-10).reverse()

  // ── Early accuracy ────────────────────────────────────────────────────────
  // Among topics where the user voted within 24h AND is now resolved,
  // what % of their early votes matched the eventual majority?

  const earlyResolved = earlyTopics.filter(
    (t) =>
      t.delta_hours <= 24 &&
      (t.status === 'law' || t.status === 'failed') &&
      t.total_votes >= 10
  )

  let earlyAccuracy: number | null = null
  if (earlyResolved.length >= 3) {
    const correct = earlyResolved.filter((t) => {
      const majority = t.blue_pct >= 50 ? 'blue' : 'red'
      return t.user_vote === majority
    }).length
    earlyAccuracy = Math.round((correct / earlyResolved.length) * 100)
  }

  // ── Archetype ─────────────────────────────────────────────────────────────

  const archetype = classifyArchetype(avgDelta)
  const archetypeMeta = ARCHETYPE_META[archetype]

  return NextResponse.json({
    authenticated: true,
    user: {
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
    },
    total_votes: total,
    avg_delta_hours: parseFloat(avgDelta.toFixed(1)),
    median_delta_hours: parseFloat(medianDelta.toFixed(1)),
    early_adopter_score: earlyAdopterScore(avgDelta),
    archetype,
    archetype_label: archetypeMeta.label,
    archetype_tagline: archetypeMeta.tagline,
    archetype_description: archetypeMeta.description,
    peak_hour: peakHour,
    peak_day: peakDay,
    hour_distribution: hourDistribution,
    day_distribution: dayDistribution,
    fastest_votes: fastestVotes,
    slowest_votes: slowestVotes,
    early_accuracy: earlyAccuracy,
  } satisfies TimingResponse)
}
