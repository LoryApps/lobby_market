import { createClient } from '@/lib/supabase/server'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'
// Revalidate every 15 minutes at the CDN
export const revalidate = 900

const BASE_URL = 'https://lobby.market'

// Debate duration in minutes by type (mirrors per-debate ics route)
const DEBATE_DURATION_MIN: Record<string, number> = {
  quick: 15,
  grand: 45,
  tribunal: 60,
  oxford: 50,
  rapid_fire: 20,
  town_hall: 60,
  panel: 45,
}
const CALENDAR_NAME = 'Lobby Market — Civic Calendar'
const CALENDAR_DESC = 'Upcoming debates, voting deadlines, and new laws from Lobby Market'
const PROD_ID = '-//Lobby Market//Civic Calendar//EN'

// ─── iCal helpers ─────────────────────────────────────────────────────────────

function escIcal(s: string): string {
  // RFC 5545 §3.3.11: escape commas, semicolons, backslashes; fold long lines
  return s
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

function foldLine(line: string): string {
  // RFC 5545 §3.1: lines MUST be no longer than 75 octets; fold with CRLF + HTAB
  if (line.length <= 75) return line
  const chunks: string[] = []
  let pos = 0
  while (pos < line.length) {
    const chunk = pos === 0 ? line.slice(0, 75) : ' ' + line.slice(pos, pos + 74)
    chunks.push(chunk)
    pos += pos === 0 ? 75 : 74
  }
  return chunks.join('\r\n')
}

function icalDate(iso: string): string {
  // Full DATE-TIME in UTC: 20250101T120000Z
  const d = new Date(iso)
  return d.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}Z$/, 'Z')
}

function icalDateOnly(iso: string): string {
  // DATE-only: 20250101
  return iso.replace(/-/g, '').slice(0, 8)
}

function nowStamp(): string {
  return icalDate(new Date().toISOString())
}

interface VEvent {
  uid: string
  summary: string
  description: string
  url: string
  dtstart: string // already formatted
  dtend: string   // already formatted
  isAllDay?: boolean
  location?: string
  categories?: string
}

function buildVEvent(ev: VEvent): string {
  const lines: string[] = [
    'BEGIN:VEVENT',
    foldLine(`UID:${ev.uid}`),
    foldLine(`DTSTAMP:${nowStamp()}`),
    foldLine(ev.isAllDay ? `DTSTART;VALUE=DATE:${ev.dtstart}` : `DTSTART:${ev.dtstart}`),
    foldLine(ev.isAllDay ? `DTEND;VALUE=DATE:${ev.dtend}` : `DTEND:${ev.dtend}`),
    foldLine(`SUMMARY:${escIcal(ev.summary)}`),
    foldLine(`DESCRIPTION:${escIcal(ev.description)}`),
    foldLine(`URL:${ev.url}`),
  ]
  if (ev.location) lines.push(foldLine(`LOCATION:${escIcal(ev.location)}`))
  if (ev.categories) lines.push(foldLine(`CATEGORIES:${escIcal(ev.categories)}`))
  lines.push('END:VEVENT')
  return lines.join('\r\n')
}

// ─── Route handler ─────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest) {
  const supabase = await createClient()

  const now = new Date()
  const threeMonthsOut = new Date(now)
  threeMonthsOut.setMonth(threeMonthsOut.getMonth() + 3)

  const thirtyDaysAgo = new Date(now)
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)

  const [debatesRes, votingTopicsRes, lawsRes] = await Promise.all([
    supabase
      .from('debates')
      .select('id, title, type, status, scheduled_at, topic_id, description')
      .in('status', ['scheduled', 'live'])
      .gte('scheduled_at', now.toISOString())
      .lte('scheduled_at', threeMonthsOut.toISOString())
      .order('scheduled_at', { ascending: true })
      .limit(200),

    supabase
      .from('topics')
      .select('id, statement, category, status, voting_ends_at')
      .eq('status', 'voting')
      .not('voting_ends_at', 'is', null)
      .gte('voting_ends_at', now.toISOString())
      .lte('voting_ends_at', threeMonthsOut.toISOString())
      .order('voting_ends_at', { ascending: true })
      .limit(100),

    supabase
      .from('laws')
      .select('id, statement, category, established_at')
      .eq('is_active', true)
      .gte('established_at', thirtyDaysAgo.toISOString())
      .order('established_at', { ascending: false })
      .limit(50),
  ])

  const debates = debatesRes.data ?? []
  const votingTopics = votingTopicsRes.data ?? []
  const laws = lawsRes.data ?? []

  const vevents: string[] = []

  // ── 1. Upcoming debates ────────────────────────────────────────────────────
  for (const debate of debates) {
    if (!debate.scheduled_at) continue
    const start = new Date(debate.scheduled_at)
    const durationMs = (DEBATE_DURATION_MIN[debate.type as string] ?? 30) * 60_000
    const end = new Date(start.getTime() + durationMs)

    const debateHref = `${BASE_URL}/debate/${debate.id}`

    const typeLabel =
      debate.type === 'oxford'        ? 'Oxford Debate'
      : debate.type === 'rapid_fire'  ? 'Rapid Fire'
      : debate.type === 'town_hall'   ? 'Town Hall'
      : debate.type === 'panel'       ? 'Panel'
      : debate.type === 'tribunal'    ? 'Tribunal'
      : debate.type === 'quick'       ? 'Quick Debate'
      : debate.type === 'grand'       ? 'Grand Debate'
      : 'Debate'

    const desc = [
      `${typeLabel} on Lobby Market`,
      debate.description ? debate.description.slice(0, 200) : '',
      `Join the debate: ${debateHref}`,
    ]
      .filter(Boolean)
      .join('\n')

    vevents.push(buildVEvent({
      uid: `debate-${debate.id}@lobby.market`,
      summary: `${typeLabel}: ${debate.title}`,
      description: desc,
      url: debateHref,
      dtstart: icalDate(start.toISOString()),
      dtend: icalDate(end.toISOString()),
      location: debateHref,
      categories: 'Debate',
    }))
  }

  // ── 2. Voting deadlines ────────────────────────────────────────────────────
  for (const topic of votingTopics) {
    if (!topic.voting_ends_at) continue
    const end = new Date(topic.voting_ends_at)
    // Alarm window: 1 hour before voting closes
    const start = new Date(end.getTime() - 60 * 60 * 1000)

    const href = `${BASE_URL}/topic/${topic.id}`
    const catLabel = topic.category ? `[${topic.category}] ` : ''

    vevents.push(buildVEvent({
      uid: `vote-end-${topic.id}@lobby.market`,
      summary: `${catLabel}Voting closes: ${topic.statement}`,
      description: `Voting deadline on Lobby Market.\nCast your vote before it closes: ${href}`,
      url: href,
      dtstart: icalDate(start.toISOString()),
      dtend: icalDate(end.toISOString()),
      categories: 'Voting Deadline',
      location: topic.category ?? undefined,
    }))
  }

  // ── 3. Recently established laws ──────────────────────────────────────────
  for (const law of laws) {
    if (!law.established_at) continue
    const day = law.established_at.slice(0, 10) // YYYY-MM-DD
    const nextDay = new Date(day)
    nextDay.setDate(nextDay.getDate() + 1)
    const nextDayStr = nextDay.toISOString().slice(0, 10).replace(/-/g, '')

    const href = `${BASE_URL}/law/${law.id}`
    const catLabel = law.category ? `[${law.category}] ` : ''

    vevents.push(buildVEvent({
      uid: `law-${law.id}@lobby.market`,
      summary: `${catLabel}New Law: ${law.statement}`,
      description: `Consensus law established on Lobby Market.\nRead the full Codex entry: ${href}`,
      url: href,
      dtstart: icalDateOnly(day),
      dtend: nextDayStr,
      isAllDay: true,
      categories: 'New Law',
      location: law.category ?? undefined,
    }))
  }

  // ── Build iCal document ────────────────────────────────────────────────────
  const icalBody = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    `PRODID:${PROD_ID}`,
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    foldLine(`X-WR-CALNAME:${CALENDAR_NAME}`),
    foldLine(`X-WR-CALDESC:${CALENDAR_DESC}`),
    'X-WR-TIMEZONE:UTC',
    'X-PUBLISHED-TTL:PT15M',
    'REFRESH-INTERVAL;VALUE=DURATION:PT15M',
    ...vevents,
    'END:VCALENDAR',
  ].join('\r\n')

  return new Response(icalBody, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="lobby-market-civic-calendar.ics"',
      'Cache-Control': 'public, max-age=900, stale-while-revalidate=300',
    },
  })
}
