import { createClient } from '@/lib/supabase/server'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 300 // 5-minute cache

const BASE_URL = 'https://lobby.market'

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

interface FeedItem {
  guid: string
  title: string
  link: string
  description: string
  pubDate: string
  author?: string | null
}

function buildItem(item: FeedItem): string {
  const authorTag = item.author
    ? `    <dc:creator>${escapeXml(item.author)}</dc:creator>\n`
    : ''

  return `  <item>
    <guid isPermaLink="true">${escapeXml(item.guid)}</guid>
    <title>${escapeXml(item.title)}</title>
    <link>${escapeXml(item.link)}</link>
    <description><![CDATA[${item.description}]]></description>
    <pubDate>${rfcDate(item.pubDate)}</pubDate>
${authorTag}  </item>`
}

function buildFeed(
  title: string,
  description: string,
  link: string,
  feedUrl: string,
  items: FeedItem[],
): string {
  const now = new Date().toUTCString()
  const itemsXml = items.map(buildItem).join('\n')

  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:dc="http://purl.org/dc/elements/1.1/"
  xmlns:content="http://purl.org/rss/1.0/modules/content/"
  xmlns:atom="http://www.w3.org/2005/Atom">
  <channel>
    <title>${escapeXml(title)}</title>
    <link>${escapeXml(link)}</link>
    <description>${escapeXml(description)}</description>
    <language>en-GB</language>
    <lastBuildDate>${now}</lastBuildDate>
    <generator>Lobby Market RSS</generator>
    <atom:link href="${escapeXml(feedUrl)}" rel="self" type="application/rss+xml" />
${itemsXml}
  </channel>
</rss>`
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { username: string } },
) {
  const supabase = await createClient()
  const username = params.username.toLowerCase()

  // Fetch profile by username
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, bio')
    .ilike('username', username)
    .single()

  if (!profile) {
    return new Response('User not found', { status: 404 })
  }

  const displayName = profile.display_name ?? profile.username
  const profileUrl = `${BASE_URL}/profile/${profile.username}`
  const feedUrl = `${BASE_URL}/api/rss/user/${profile.username}`
  const feedTitle = `${displayName} · Lobby Market`
  const feedDescription = profile.bio
    ? profile.bio.slice(0, 200)
    : `Topics and arguments from ${displayName} on Lobby Market — the civic debate platform.`

  const items: FeedItem[] = []

  // 1. User's recent topics
  const { data: topics } = await supabase
    .from('topics')
    .select('id, statement, description, category, status, blue_pct, total_votes, created_at, updated_at')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(20)

  for (const topic of topics ?? []) {
    const topicUrl = `${BASE_URL}/topic/${topic.id}`
    const forPct = Math.round(topic.blue_pct ?? 50)
    const statusLabels: Record<string, string> = {
      proposed: 'Proposed',
      active: 'Active',
      voting: 'In Voting',
      law: 'Established as Law',
      failed: 'Failed',
    }
    const statusLabel = statusLabels[topic.status] ?? topic.status

    items.push({
      guid: topicUrl,
      title: `[${statusLabel}] ${topic.statement.slice(0, 100)}${topic.statement.length > 100 ? '…' : ''}`,
      link: topicUrl,
      description: [
        `<p><strong>Topic by ${escapeXml(displayName)}</strong></p>`,
        topic.description ? `<p>${escapeXml(topic.description.slice(0, 400))}</p>` : '',
        `<p><strong>Vote split:</strong> ${forPct}% For / ${100 - forPct}% Against</p>`,
        `<p><strong>Total votes:</strong> ${(topic.total_votes ?? 0).toLocaleString()}</p>`,
        topic.category ? `<p><strong>Category:</strong> ${topic.category}</p>` : '',
        `<p><a href="${topicUrl}">View on Lobby Market →</a></p>`,
      ]
        .filter(Boolean)
        .join('\n'),
      pubDate: topic.created_at,
      author: displayName,
    })
  }

  // 2. User's recent arguments (with topic context)
  const { data: args } = await supabase
    .from('arguments')
    .select('id, content, side, upvotes, created_at, topic_id, topics(id, statement)')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(30)

  for (const arg of args ?? []) {
    const topic = arg.topics as { id: string; statement: string } | null
    const topicUrl = topic ? `${BASE_URL}/topic/${topic.id}` : profileUrl
    const sideLabel = arg.side === 'blue' ? 'FOR' : 'AGAINST'
    const topicTitle = topic
      ? `"${topic.statement.slice(0, 60)}${topic.statement.length > 60 ? '…' : ''}"`
      : 'a debate'
    const shortContent = arg.content.slice(0, 80)

    items.push({
      guid: `${BASE_URL}/topic/${arg.topic_id}/arguments#arg-${arg.id}`,
      title: `[${sideLabel}] "${shortContent}${arg.content.length > 80 ? '…' : ''}"`,
      link: topic ? `${topicUrl}/arguments` : profileUrl,
      description: [
        `<p><strong>${sideLabel}</strong> on ${topicTitle}</p>`,
        `<p>${escapeXml(arg.content)}</p>`,
        `<p><em>By ${escapeXml(displayName)} · ${arg.upvotes} upvote${arg.upvotes !== 1 ? 's' : ''}</em></p>`,
        topic ? `<p><a href="${topicUrl}/arguments">View all arguments →</a></p>` : '',
      ]
        .filter(Boolean)
        .join('\n'),
      pubDate: arg.created_at,
      author: displayName,
    })
  }

  // Sort newest first, cap at 50 items
  items.sort(
    (a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime(),
  )
  const capped = items.slice(0, 50)

  const xml = buildFeed(feedTitle, feedDescription, profileUrl, feedUrl, capped)

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  })
}
