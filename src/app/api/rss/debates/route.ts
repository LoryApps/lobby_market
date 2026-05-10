import { createClient } from '@/lib/supabase/server'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 120

const BASE_URL = 'https://lobby.market'

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

function rfcDate(iso: string): string {
  return new Date(iso).toUTCString()
}

const TYPE_LABEL: Record<string, string> = {
  oxford: 'Oxford Debate',
  town_hall: 'Town Hall',
  rapid_fire: 'Rapid Fire',
  panel: 'Panel',
}

const STATUS_LABEL: Record<string, string> = {
  scheduled: 'Scheduled',
  live: 'Live Now',
  ended: 'Ended',
}

interface DebateRow {
  id: string
  title: string | null
  description: string | null
  type: string
  status: string
  scheduled_at: string | null
  created_at: string
  viewer_count: number | null
  topic: {
    id: string
    statement: string
    category: string | null
  } | null
}

export async function GET(_req: NextRequest) {
  const supabase = await createClient()

  const { data: debates } = await supabase
    .from('debates')
    .select(`
      id, title, description, type, status, scheduled_at, created_at, viewer_count,
      topics!inner ( id, statement, category )
    `)
    .in('status', ['scheduled', 'live'])
    .order('scheduled_at', { ascending: true })
    .limit(40)

  const items = ((debates ?? []) as unknown as DebateRow[]).map((d) => {
    const typeLabel = TYPE_LABEL[d.type] ?? d.type
    const statusLabel = STATUS_LABEL[d.status] ?? d.status
    const title = d.title ?? d.topic?.statement ?? 'Untitled Debate'
    const link = `${BASE_URL}/debate/${d.id}`

    const desc = [
      `${typeLabel} · ${statusLabel}`,
      d.topic ? `On: ${d.topic.statement}` : null,
      d.description ? d.description.slice(0, 200) : null,
      d.viewer_count ? `${d.viewer_count} viewers` : null,
    ]
      .filter(Boolean)
      .join(' — ')

    const pubDate = d.scheduled_at ?? d.created_at
    const categoryTag = d.topic?.category
      ? `    <category>${escapeXml(d.topic.category)}</category>\n`
      : ''

    return `  <item>
    <guid isPermaLink="true">${escapeXml(link)}</guid>
    <title>${escapeXml(`[${statusLabel.toUpperCase()}] ${title}`)}</title>
    <link>${escapeXml(link)}</link>
    <description>${escapeXml(desc)}</description>
    <pubDate>${rfcDate(pubDate)}</pubDate>
${categoryTag}  </item>`
  })

  const lastBuildDate = rfcDate(new Date().toISOString())

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
  <title>Lobby Market — Live &amp; Upcoming Debates</title>
  <link>${BASE_URL}/debate</link>
  <description>Live and scheduled civic debates on Lobby Market — real-time deliberation on the issues that matter.</description>
  <language>en-US</language>
  <lastBuildDate>${lastBuildDate}</lastBuildDate>
  <atom:link href="${BASE_URL}/api/rss/debates" rel="self" type="application/rss+xml"/>
  <image>
    <url>${BASE_URL}/assets/logo-mark.png</url>
    <title>Lobby Market — Live &amp; Upcoming Debates</title>
    <link>${BASE_URL}/debate</link>
  </image>
${items.join('\n')}
</channel>
</rss>`

  return new Response(rss, {
    status: 200,
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
    },
  })
}
