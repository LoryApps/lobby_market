import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const DEBATE_DURATION_MS: Record<string, number> = {
  oxford: 60 * 60 * 1000,
  town_hall: 90 * 60 * 1000,
  rapid_fire: 30 * 60 * 1000,
  panel: 60 * 60 * 1000,
  quick: 15 * 60 * 1000,
  grand: 45 * 60 * 1000,
  tribunal: 60 * 60 * 1000,
}

function toICSDate(iso: string): string {
  // Returns UTC datetime in YYYYMMDDTHHMMSSZ format
  const d = new Date(iso)
  return d
    .toISOString()
    .replace(/[-:]/g, '')
    .replace(/\.\d{3}/, '')
}

function escapeICS(text: string): string {
  return text
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

function foldLine(line: string): string {
  // RFC 5545: lines longer than 75 octets should be folded
  if (line.length <= 75) return line
  const parts: string[] = []
  while (line.length > 75) {
    parts.push(line.slice(0, 75))
    line = ' ' + line.slice(75)
  }
  parts.push(line)
  return parts.join('\r\n')
}

export async function GET() {
  const supabase = await createClient()

  const now = new Date()
  const sixMonthsLater = new Date(now)
  sixMonthsLater.setMonth(sixMonthsLater.getMonth() + 6)

  // Fetch upcoming and live debates with topic details
  const { data: rawDebates } = await supabase
    .from('debates')
    .select('id, title, description, type, status, scheduled_at, topic_id')
    .in('status', ['scheduled', 'live'])
    .gte('scheduled_at', now.toISOString())
    .lte('scheduled_at', sixMonthsLater.toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(100)

  const debates = rawDebates ?? []

  // Fetch topic statements for debate context
  const topicIds = [...new Set(debates.map((d) => d.topic_id))]
  const topicMap = new Map<string, string>()
  if (topicIds.length) {
    const { data: topics } = await supabase
      .from('topics')
      .select('id, statement')
      .in('id', topicIds)
    for (const t of topics ?? []) topicMap.set(t.id, t.statement)
  }

  // Build iCalendar content
  const now_stamp = toICSDate(now.toISOString())

  const events = debates
    .map((debate) => {
      if (!debate.scheduled_at) return null

      const startISO = debate.scheduled_at
      const durationMs = DEBATE_DURATION_MS[debate.type] ?? 60 * 60 * 1000
      const endISO = new Date(new Date(startISO).getTime() + durationMs).toISOString()

      const topicStatement = topicMap.get(debate.topic_id) ?? ''
      const title = debate.title ?? `Debate: ${topicStatement.slice(0, 60)}`
      const description =
        (debate.description ? debate.description + ' | ' : '') +
        (topicStatement ? `Topic: ${topicStatement} | ` : '') +
        `lobby.market/debate/${debate.id}`

      const lines = [
        'BEGIN:VEVENT',
        foldLine(`UID:${debate.id}@lobby.market`),
        foldLine(`DTSTAMP:${now_stamp}`),
        foldLine(`DTSTART:${toICSDate(startISO)}`),
        foldLine(`DTEND:${toICSDate(endISO)}`),
        foldLine(`SUMMARY:${escapeICS(title)}`),
        foldLine(`DESCRIPTION:${escapeICS(description)}`),
        foldLine(`URL:https://lobby.market/debate/${debate.id}`),
        foldLine(`CATEGORIES:Civic Debate`),
        'STATUS:CONFIRMED',
        'END:VEVENT',
      ]

      return lines.join('\r\n')
    })
    .filter(Boolean)

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Lobby Market//Civic Debates//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    foldLine('X-WR-CALNAME:Lobby Market — Upcoming Debates'),
    foldLine('X-WR-CALDESC:Live and scheduled civic debates on Lobby Market'),
    'X-WR-TIMEZONE:UTC',
    ...events,
    'END:VCALENDAR',
  ].join('\r\n')

  return new NextResponse(ics, {
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="lobby-market-debates.ics"',
      'Cache-Control': 'public, max-age=900, s-maxage=900',
    },
  })
}
