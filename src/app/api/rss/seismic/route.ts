import { createClient } from '@/lib/supabase/server'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 120 // 2-minute cache — seismic data is time-sensitive

const BASE_URL = 'https://lobby.market'
const FEED_TITLE = 'Lobby Market — Civic Seismic Alert Feed'
const FEED_DESCRIPTION =
  'Real-time civic earthquake alerts: vote burst anomalies detected on Lobby Market. Rated on a 0–10 Richter-inspired magnitude scale.'
const FEED_LINK = `${BASE_URL}/seismic`

// ── Helpers ────────────────────────────────────────────────────────────────────

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

function computeMagnitude(multiplier: number, recent_votes: number): number {
  if (multiplier <= 1 || recent_votes < 2) return 0
  const raw = Math.log10(Math.max(1, multiplier)) * 5 + Math.log10(Math.max(1, recent_votes)) * 0.8
  return Math.min(10, Math.round(raw * 10) / 10)
}

function hoursAgo(iso: string): number {
  return (Date.now() - new Date(iso).getTime()) / 3_600_000
}

function eventTypeLabel(mag: number): string {
  if (mag >= 8) return 'MAJOR QUAKE'
  if (mag >= 6) return 'QUAKE'
  if (mag >= 3) return 'AFTERSHOCK'
  return 'RUMBLE'
}

function magnitudeEmoji(mag: number): string {
  if (mag >= 8) return '🔴'
  if (mag >= 6) return '🟠'
  if (mag >= 3) return '🟡'
  return '🟢'
}

// ── Route ──────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest) {
  const supabase = await createClient()

  const { data: topics } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, created_at, updated_at')
    .in('status', ['active', 'voting', 'proposed'])
    .gte('created_at', new Date(Date.now() - 90 * 24 * 3_600_000).toISOString())
    .order('total_votes', { ascending: false })
    .limit(300)

  const now = new Date()
  const twoHoursAgo = new Date(now.getTime() - 2 * 3_600_000).toISOString()
  const fortyEightHoursAgo = new Date(now.getTime() - 48 * 3_600_000).toISOString()
  const topicIds = (topics ?? []).map((t) => t.id)

  const { data: recentArgs } = await supabase
    .from('topic_arguments')
    .select('topic_id, created_at')
    .in('topic_id', topicIds.slice(0, 100))
    .gte('created_at', fortyEightHoursAgo)

  const argCounts2h: Record<string, number> = {}
  for (const arg of recentArgs ?? []) {
    if (arg.created_at >= twoHoursAgo) {
      const topicId = arg.topic_id as string
      argCounts2h[topicId] = (argCounts2h[topicId] ?? 0) + 1
    }
  }

  interface SeismicFeedEvent {
    id: string
    statement: string
    category: string | null
    blue_pct: number
    total_votes: number
    updated_at: string
    magnitude: number
    multiplier: number
    recent_votes: number
  }

  const enriched: SeismicFeedEvent[] = []

  for (const t of topics ?? []) {
    const ageHours = Math.max(0.25, hoursAgo(t.created_at))
    const hoursUpdated = hoursAgo(t.updated_at)
    const baseline_rate = t.total_votes / ageHours
    const args_2h = argCounts2h[t.id] ?? 0
    const recency_factor = Math.max(0, 2 - hoursUpdated) / 2
    const arg_signal = args_2h * 3
    const recent_votes = Math.max(0, Math.round(baseline_rate * 2 * recency_factor + arg_signal))
    const current_rate = recent_votes / 2
    const multiplier = baseline_rate > 0.05 ? current_rate / baseline_rate : current_rate > 0 ? 5 : 1
    const magnitude = computeMagnitude(multiplier, recent_votes)

    if (magnitude < 1) continue

    enriched.push({
      id: t.id,
      statement: t.statement,
      category: t.category ?? null,
      blue_pct: t.blue_pct ?? 50,
      total_votes: t.total_votes ?? 0,
      updated_at: t.updated_at,
      magnitude,
      multiplier: Math.round(multiplier * 10) / 10,
      recent_votes,
    })
  }

  enriched.sort((a, b) => b.magnitude - a.magnitude)
  const topEvents = enriched.slice(0, 40)

  const lastBuildDate = topEvents.length > 0 ? rfcDate(topEvents[0].updated_at) : rfcDate(now.toISOString())

  const items = topEvents.map((e) => {
    const label = eventTypeLabel(e.magnitude)
    const emoji = magnitudeEmoji(e.magnitude)
    const forPct = Math.round(e.blue_pct)
    const link = `${BASE_URL}/topic/${e.id}`
    const title = `${emoji} [${label} M${e.magnitude.toFixed(1)}] ${e.statement}`
    const desc =
      `${label} — Magnitude ${e.magnitude.toFixed(1)} · ${e.multiplier}× baseline vote rate · ` +
      `${forPct}% For / ${100 - forPct}% Against · ${e.total_votes.toLocaleString()} total votes.` +
      (e.category ? ` Category: ${e.category}.` : '')

    const categoryTag = e.category ? `    <category>${escapeXml(e.category)}</category>\n` : ''

    return `  <item>
    <guid isPermaLink="true">${escapeXml(link)}</guid>
    <title>${escapeXml(title)}</title>
    <link>${escapeXml(link)}</link>
    <description>${escapeXml(desc)}</description>
    <pubDate>${rfcDate(e.updated_at)}</pubDate>
${categoryTag}  </item>`
  })

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
  <title>${escapeXml(FEED_TITLE)}</title>
  <link>${escapeXml(FEED_LINK)}</link>
  <description>${escapeXml(FEED_DESCRIPTION)}</description>
  <language>en-US</language>
  <lastBuildDate>${lastBuildDate}</lastBuildDate>
  <ttl>2</ttl>
  <atom:link href="${BASE_URL}/api/rss/seismic" rel="self" type="application/rss+xml"/>
  <image>
    <url>${BASE_URL}/assets/logo-mark.png</url>
    <title>${escapeXml(FEED_TITLE)}</title>
    <link>${escapeXml(FEED_LINK)}</link>
  </image>
${items.join('\n')}
</channel>
</rss>`

  return new Response(rss, {
    status: 200,
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=240',
    },
  })
}
