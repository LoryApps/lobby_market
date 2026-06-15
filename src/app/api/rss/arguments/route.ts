import { createClient } from '@/lib/supabase/server'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 300 // 5-minute cache

const BASE_URL = 'https://lobby.market'
const FEED_TITLE = 'Lobby Market — Top Arguments'
const FEED_DESCRIPTION =
  'The most upvoted civic arguments on Lobby Market — sharp, reasoned cases for and against the most important debates. Updated every 5 minutes.'
const FEED_LINK = `${BASE_URL}/arguments`

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

// ── Row types ──────────────────────────────────────────────────────────────────

interface ArgumentRow {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  created_at: string
  topic_id: string
  user_id: string
}

interface TopicRow {
  id: string
  statement: string
  category: string | null
  status: string
}

interface ProfileRow {
  id: string
  username: string
  display_name: string | null
}

// ── RSS item builder ───────────────────────────────────────────────────────────

function buildItem(
  arg: ArgumentRow,
  topic: TopicRow | undefined,
  author: ProfileRow | undefined,
): string {
  const sideLabel = arg.side === 'blue' ? 'FOR' : 'AGAINST'
  const topicStatement = topic?.statement ?? 'Unknown topic'
  const authorName = author?.display_name ?? author?.username ?? 'Anonymous'
  const categoryLabel = topic?.category ? ` [${topic.category}]` : ''

  const title = `${sideLabel}: "${topicStatement.slice(0, 80)}${topicStatement.length > 80 ? '…' : ''}"${categoryLabel}`

  const description = [
    `<p><strong>${sideLabel}</strong> — ${escapeXml(arg.content)}</p>`,
    `<p><em>By ${escapeXml(authorName)} · ${arg.upvotes} upvote${arg.upvotes !== 1 ? 's' : ''}</em></p>`,
    topic
      ? `<p><a href="${BASE_URL}/topic/${topic.id}">View debate →</a></p>`
      : '',
  ]
    .filter(Boolean)
    .join('\n')

  const link = `${BASE_URL}/topic/${arg.topic_id}/arguments`
  const authorTag = author
    ? `    <dc:creator>${escapeXml(authorName)}</dc:creator>\n`
    : ''
  const categoryTag = topic?.category
    ? `    <category>${escapeXml(topic.category)}</category>\n`
    : ''

  return `  <item>
    <guid isPermaLink="false">arg-${arg.id}</guid>
    <title>${escapeXml(title)}</title>
    <link>${escapeXml(link)}</link>
    <description><![CDATA[${description}]]></description>
    <pubDate>${rfcDate(arg.created_at)}</pubDate>
${authorTag}${categoryTag}  </item>`
}

// ── Route handler ──────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest) {
  const supabase = await createClient()

  // Fetch top arguments from the last 7 days, ordered by upvotes
  const since = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()

  const { data: argRows } = await supabase
    .from('topic_arguments')
    .select('id, content, side, upvotes, created_at, topic_id, user_id')
    .gte('created_at', since)
    .order('upvotes', { ascending: false })
    .limit(50)

  const args = (argRows as ArgumentRow[] | null) ?? []

  if (args.length === 0) {
    // Fall back to all-time top if no recent arguments
    const { data: fallback } = await supabase
      .from('topic_arguments')
      .select('id, content, side, upvotes, created_at, topic_id, user_id')
      .order('upvotes', { ascending: false })
      .limit(50)
    args.push(...((fallback as ArgumentRow[] | null) ?? []))
  }

  // Batch-fetch referenced topics and authors
  const topicIds = [...new Set(args.map((a) => a.topic_id))]
  const userIds = [...new Set(args.map((a) => a.user_id))]

  const [topicsRes, profilesRes] = await Promise.all([
    topicIds.length > 0
      ? supabase
          .from('topics')
          .select('id, statement, category, status')
          .in('id', topicIds)
      : Promise.resolve({ data: [] }),
    userIds.length > 0
      ? supabase
          .from('profiles')
          .select('id, username, display_name')
          .in('id', userIds)
      : Promise.resolve({ data: [] }),
  ])

  const topicMap = new Map<string, TopicRow>(
    ((topicsRes.data as TopicRow[] | null) ?? []).map((t) => [t.id, t]),
  )
  const profileMap = new Map<string, ProfileRow>(
    ((profilesRes.data as ProfileRow[] | null) ?? []).map((p) => [p.id, p]),
  )

  const items = args.map((a) =>
    buildItem(a, topicMap.get(a.topic_id), profileMap.get(a.user_id)),
  )

  const lastBuildDate =
    args.length > 0
      ? rfcDate(args[0].created_at)
      : rfcDate(new Date().toISOString())

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
  <title>${FEED_TITLE}</title>
  <link>${FEED_LINK}</link>
  <description>${FEED_DESCRIPTION}</description>
  <language>en-US</language>
  <lastBuildDate>${lastBuildDate}</lastBuildDate>
  <atom:link href="${BASE_URL}/api/rss/arguments" rel="self" type="application/rss+xml"/>
  <image>
    <url>${BASE_URL}/assets/logo-mark.png</url>
    <title>${FEED_TITLE}</title>
    <link>${FEED_LINK}</link>
  </image>
${items.join('\n')}
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
