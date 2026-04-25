import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

const BASE_URL = 'https://lobby.market'

const DEBATE_DURATION: Record<string, number> = {
  quick: 15,
  grand: 45,
  tribunal: 60,
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function icalDate(date: Date): string {
  return (
    date.getUTCFullYear() +
    pad(date.getUTCMonth() + 1) +
    pad(date.getUTCDate()) +
    'T' +
    pad(date.getUTCHours()) +
    pad(date.getUTCMinutes()) +
    pad(date.getUTCSeconds()) +
    'Z'
  )
}

function foldLine(line: string): string {
  const max = 75
  if (line.length <= max) return line
  let result = ''
  let remaining = line
  while (remaining.length > max) {
    result += remaining.slice(0, max) + '\r\n '
    remaining = remaining.slice(max)
  }
  result += remaining
  return result
}

function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

export async function GET() {
  const supabase = await createClient()

  // Fetch upcoming debates (scheduled + live) in the next 60 days
  const now = new Date()
  const cutoff = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)

  const { data: debates } = await supabase
    .from('debates')
    .select('id, title, description, type, status, scheduled_at, topic_id')
    .in('status', ['scheduled', 'live'])
    .gte('scheduled_at', now.toISOString())
    .lte('scheduled_at', cutoff.toISOString())
    .order('scheduled_at', { ascending: true })
    .limit(100)

  if (!debates || debates.length === 0) {
    const empty = [
      'BEGIN:VCALENDAR',
      'VERSION:2.0',
      'PRODID:-//Lobby Market//Civic Debate Platform//EN',
      'CALSCALE:GREGORIAN',
      'METHOD:PUBLISH',
      'X-WR-CALNAME:Lobby Market Debates',
      'X-WR-TIMEZONE:UTC',
      'X-WR-CALDESC:Upcoming debates from Lobby Market — where democracy debates.',
      'END:VCALENDAR',
    ].join('\r\n') + '\r\n'

    return new Response(empty, {
      status: 200,
      headers: {
        'Content-Type': 'text/calendar; charset=utf-8',
        'Cache-Control': 'public, max-age=1800',
      },
    })
  }

  // Fetch topic statements in batch
  const topicIds = Array.from(new Set(debates.map((d) => d.topic_id)))
  const { data: topicRows } = await supabase
    .from('topics')
    .select('id, statement, category')
    .in('id', topicIds)

  const topicMap = new Map(
    (topicRows ?? []).map((t) => [t.id, t] as const)
  )

  const now2 = new Date()
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Lobby Market//Civic Debate Platform//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Lobby Market Debates',
    'X-WR-TIMEZONE:UTC',
    'X-WR-CALDESC:Upcoming debates from Lobby Market — where democracy debates.',
  ]

  for (const debate of debates) {
    const start = new Date(debate.scheduled_at)
    const durationMins = DEBATE_DURATION[debate.type] ?? 30
    const end = new Date(start.getTime() + durationMins * 60_000)

    const topic = topicMap.get(debate.topic_id)
    const url = `${BASE_URL}/debate/${debate.id}`
    const uid = `debate-${debate.id}@lobby.market`

    const descParts: string[] = []
    if (topic?.statement) descParts.push(`Topic: ${topic.statement}`)
    if (debate.description) descParts.push(debate.description)
    descParts.push(`Join at: ${url}`)

    lines.push(
      'BEGIN:VEVENT',
      foldLine(`UID:${uid}`),
      foldLine(`DTSTART:${icalDate(start)}`),
      foldLine(`DTEND:${icalDate(end)}`),
      foldLine(`SUMMARY:${escapeText(debate.title)}`),
      foldLine(`DESCRIPTION:${descParts.join('\\n\\n')}`),
      foldLine(`URL:${url}`),
      foldLine(`LOCATION:${url}`),
      'STATUS:CONFIRMED',
      `CREATED:${icalDate(now2)}`,
      `DTSTAMP:${icalDate(now2)}`,
      'END:VEVENT'
    )
  }

  lines.push('END:VCALENDAR')

  const icsContent = lines.join('\r\n') + '\r\n'

  return new Response(icsContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': 'attachment; filename="lobby-market-debates.ics"',
      'Cache-Control': 'public, max-age=1800',
    },
  })
}
