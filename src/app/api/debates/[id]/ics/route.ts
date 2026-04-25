import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

const BASE_URL = 'https://lobby.market'

// Debate duration by type (minutes)
const DEBATE_DURATION: Record<string, number> = {
  quick: 15,
  grand: 45,
  tribunal: 60,
}

// Pad a number to 2 digits
function pad(n: number) {
  return String(n).padStart(2, '0')
}

// Format a Date as iCal UTC timestamp: 20260425T143000Z
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

// Fold long iCal lines at 75 octets per RFC 5545
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

// Escape iCal text values
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,')
    .replace(/\n/g, '\\n')
}

export async function GET(
  _request: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const { data: debate, error } = await supabase
    .from('debates')
    .select('id, title, description, type, status, scheduled_at, topic_id')
    .eq('id', params.id)
    .single()

  if (error || !debate) {
    return NextResponse.json({ error: 'Debate not found' }, { status: 404 })
  }

  if (!['scheduled', 'live'].includes(debate.status)) {
    return NextResponse.json(
      { error: 'Debate is not upcoming' },
      { status: 410 }
    )
  }

  // Fetch topic for richer calendar entry
  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category')
    .eq('id', debate.topic_id)
    .maybeSingle()

  const start = new Date(debate.scheduled_at)
  const durationMins = DEBATE_DURATION[debate.type] ?? 30
  const end = new Date(start.getTime() + durationMins * 60_000)

  const uid = `debate-${debate.id}@lobby.market`
  const url = `${BASE_URL}/debate/${debate.id}`

  const descriptionParts: string[] = []
  if (topic?.statement) descriptionParts.push(`Topic: ${topic.statement}`)
  if (debate.description) descriptionParts.push(debate.description)
  descriptionParts.push(`Join at: ${url}`)
  const description = descriptionParts.join('\\n\\n')

  const summary = debate.title
  const location = url

  const lines = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Lobby Market//Civic Debate Platform//EN',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    'X-WR-CALNAME:Lobby Market Debate',
    'X-WR-TIMEZONE:UTC',
    'BEGIN:VEVENT',
    foldLine(`UID:${uid}`),
    foldLine(`DTSTART:${icalDate(start)}`),
    foldLine(`DTEND:${icalDate(end)}`),
    foldLine(`SUMMARY:${escapeText(summary)}`),
    foldLine(`DESCRIPTION:${description}`),
    foldLine(`URL:${url}`),
    foldLine(`LOCATION:${location}`),
    'STATUS:CONFIRMED',
    `CREATED:${icalDate(new Date())}`,
    `DTSTAMP:${icalDate(new Date())}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ]

  const icsContent = lines.join('\r\n') + '\r\n'

  const filename = `debate-${debate.id}.ics`
  return new Response(icsContent, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Cache-Control': 'no-store',
    },
  })
}
