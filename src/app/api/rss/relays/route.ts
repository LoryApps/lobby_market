import { createClient } from '@/lib/supabase/server'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 300

const BASE_URL = 'https://lobby.market'
const FEED_TITLE = 'Lobby Market — Civic Relays'
const FEED_DESCRIPTION =
  'Completed civic relay chains from Lobby Market — multi-author arguments built link by link, then voted compelling or not compelling by the community.'
const FEED_LINK = `${BASE_URL}/relays`

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

  const { data: relays } = await supabase
    .from('civic_relays')
    .select('id, topic_id, side, starter_id, max_legs, vote_compelling, vote_not_compelling, created_at, completed_at')
    .in('status', ['complete', 'voted'])
    .order('completed_at', { ascending: false })
    .limit(40)

  const emptyFeed = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
  <title>${escapeXml(FEED_TITLE)}</title>
  <link>${escapeXml(FEED_LINK)}</link>
  <description>${escapeXml(FEED_DESCRIPTION)}</description>
  <language>en-US</language>
  <lastBuildDate>${rfcDate(new Date().toISOString())}</lastBuildDate>
  <atom:link href="${BASE_URL}/api/rss/relays" rel="self" type="application/rss+xml"/>
</channel>
</rss>`

  if (!relays || relays.length === 0) {
    return new Response(emptyFeed, {
      status: 200,
      headers: {
        'Content-Type': 'application/rss+xml; charset=utf-8',
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    })
  }

  const relayIds = relays.map((r) => r.id)
  const topicIds = relays.map((r) => r.topic_id).filter(Boolean) as string[]
  const starterIds = [...new Set(relays.map((r) => r.starter_id))]

  const [topicsResult, startersResult, legsResult] = await Promise.all([
    topicIds.length > 0
      ? supabase.from('topics').select('id, statement, category').in('id', topicIds)
      : { data: [] as { id: string; statement: string; category: string | null }[] },
    supabase.from('profiles').select('id, username, display_name').in('id', starterIds),
    supabase
      .from('relay_legs')
      .select('relay_id, content')
      .in('relay_id', relayIds)
      .eq('leg_number', 1),
  ])

  const topicMap = new Map((topicsResult.data ?? []).map((t) => [t.id, t]))
  const starterMap = new Map((startersResult.data ?? []).map((s) => [s.id, s]))
  const firstLegMap = new Map((legsResult.data ?? []).map((l) => [l.relay_id, l.content as string]))

  const items: FeedItem[] = relays.map((relay) => {
    const topic = relay.topic_id ? topicMap.get(relay.topic_id) : null
    const starter = starterMap.get(relay.starter_id)
    const firstLeg = firstLegMap.get(relay.id) ?? ''

    const starterName = starter?.display_name ?? starter?.username ?? 'Unknown'
    const sideLabel = relay.side === 'for' ? 'FOR' : 'AGAINST'
    const totalVotes = (relay.vote_compelling ?? 0) + (relay.vote_not_compelling ?? 0)
    const compellingPct =
      totalVotes > 0 ? Math.round(((relay.vote_compelling ?? 0) / totalVotes) * 100) : null

    const topicSnippet = topic?.statement
      ? `re: "${topic.statement.slice(0, 80)}${topic.statement.length > 80 ? '…' : ''}"`
      : 'open debate'

    const title = `[RELAY ${sideLabel}] ${starterName} — ${topicSnippet}`

    const voteStr =
      compellingPct !== null
        ? ` · ${compellingPct}% found it compelling (${totalVotes} vote${totalVotes !== 1 ? 's' : ''})`
        : ''

    const desc = firstLeg
      ? `${firstLeg.slice(0, 250)}${firstLeg.length > 250 ? '…' : ''}${voteStr}`
      : `A ${relay.max_legs}-leg civic relay chain${voteStr}.`

    return {
      guid: `${BASE_URL}/relays/${relay.id}`,
      title,
      link: `${BASE_URL}/relays/${relay.id}`,
      description: desc,
      pubDate: relay.completed_at ?? relay.created_at,
      category: topic?.category ?? null,
      author: starterName,
    }
  })

  const lastBuildDate =
    items.length > 0 ? rfcDate(items[0].pubDate) : rfcDate(new Date().toISOString())

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
  <atom:link href="${BASE_URL}/api/rss/relays" rel="self" type="application/rss+xml"/>
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
