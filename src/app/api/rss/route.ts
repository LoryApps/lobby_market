import { createClient } from '@/lib/supabase/server'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'
// Revalidate the feed every 5 minutes at the CDN level
export const revalidate = 300

const BASE_URL = 'https://lobby.market'
const FEED_TITLE = 'Lobby Market — Laws & Active Topics'
const FEED_DESCRIPTION =
  'The latest laws established and active topics on Lobby Market — where ideas compete, votes decide, and the best arguments become law.'
const FEED_LINK = `${BASE_URL}/law`

// ── Helpers ───────────────────────────────────────────────────────────────────

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

// ── RSS item builder ──────────────────────────────────────────────────────────

interface FeedItem {
  guid: string
  title: string
  link: string
  description: string
  pubDate: string
  category: string | null
  author?: string | null
}

function buildItem(item: FeedItem): string {
  const categoryTag = item.category
    ? `    <category>${escapeXml(item.category)}</category>\n`
    : ''
  const authorTag = item.author
    ? `    <dc:creator>${escapeXml(item.author)}</dc:creator>\n`
    : ''

  return `  <item>
    <guid isPermaLink="true">${escapeXml(item.link)}</guid>
    <title>${escapeXml(item.title)}</title>
    <link>${escapeXml(item.link)}</link>
    <description>${escapeXml(item.description)}</description>
    <pubDate>${rfcDate(item.pubDate)}</pubDate>
${categoryTag}${authorTag}  </item>`
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest) {
  const supabase = await createClient()

  // Fetch recent laws (last 40)
  const { data: laws } = await supabase
    .from('laws')
    .select('id, statement, full_statement, category, total_votes, established_at')
    .order('established_at', { ascending: false })
    .limit(40)

  // Fetch active + voting topics (last 20)
  const { data: activeTopics } = await supabase
    .from('topics')
    .select('id, statement, category, total_votes, blue_pct, status, created_at')
    .in('status', ['active', 'voting'])
    .order('feed_score', { ascending: false })
    .limit(20)

  const items: FeedItem[] = []

  // Laws → marked as established
  for (const law of laws ?? []) {
    const desc = law.full_statement
      ? `${law.full_statement.slice(0, 300)}${law.full_statement.length > 300 ? '…' : ''}`
      : `Established Law · ${law.total_votes?.toLocaleString() ?? 0} votes cast.`

    items.push({
      guid: `${BASE_URL}/law/${law.id}`,
      title: `[LAW] ${law.statement}`,
      link: `${BASE_URL}/law/${law.id}`,
      description: desc,
      pubDate: law.established_at,
      category: law.category,
    })
  }

  // Active/voting topics
  for (const topic of activeTopics ?? []) {
    const forPct = Math.round(topic.blue_pct ?? 50)
    const againstPct = 100 - forPct
    const statusLabel = topic.status === 'voting' ? 'VOTING' : 'ACTIVE'
    const desc = `${statusLabel} · ${forPct}% For / ${againstPct}% Against · ${topic.total_votes?.toLocaleString() ?? 0} votes cast.`

    items.push({
      guid: `${BASE_URL}/topic/${topic.id}`,
      title: `[${statusLabel}] ${topic.statement}`,
      link: `${BASE_URL}/topic/${topic.id}`,
      description: desc,
      pubDate: topic.created_at,
      category: topic.category,
    })
  }

  // Sort all items by pubDate descending (most recent first)
  items.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())

  const lastBuildDate = items.length > 0 ? rfcDate(items[0].pubDate) : rfcDate(new Date().toISOString())

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:content="http://purl.org/rss/modules/content/">
<channel>
  <title>${escapeXml(FEED_TITLE)}</title>
  <link>${escapeXml(FEED_LINK)}</link>
  <description>${escapeXml(FEED_DESCRIPTION)}</description>
  <language>en-US</language>
  <lastBuildDate>${lastBuildDate}</lastBuildDate>
  <atom:link href="${BASE_URL}/api/rss" rel="self" type="application/rss+xml"/>
  <image>
    <url>${BASE_URL}/assets/logo-mark.png</url>
    <title>${escapeXml(FEED_TITLE)}</title>
    <link>${escapeXml(FEED_LINK)}</link>
  </image>
${items.map(buildItem).join('\n')}
</channel>
</rss>`

  return new Response(rss, {
    status: 200,
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  })
}
