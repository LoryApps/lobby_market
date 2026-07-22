import { createClient } from '@/lib/supabase/server'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 120 // 2-minute cache — topic feeds change frequently

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
    <atom:link href="${escapeXml(link)}" rel="self" type="application/rss+xml" />
${itemsXml}
  </channel>
</rss>`
}

// ── Status labels ──────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'In Voting',
  law: 'Established as Law',
  failed: 'Failed',
}

// ── Route handler ─────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()

  // Fetch topic
  const { data: topic } = await supabase
    .from('topics')
    .select(
      'id, statement, description, category, status, blue_pct, total_votes, created_at, updated_at',
    )
    .eq('id', params.id)
    .single()

  if (!topic) {
    return new Response('Topic not found', { status: 404 })
  }

  const topicUrl = `${BASE_URL}/topic/${topic.id}`
  const feedTitle = `"${topic.statement.slice(0, 70)}${topic.statement.length > 70 ? '…' : ''}" · Lobby Market`
  const forPct = Math.round(topic.blue_pct ?? 50)
  const statusLabel = STATUS_LABEL[topic.status] ?? topic.status
  const feedDescription =
    topic.description
      ? `${topic.description.slice(0, 200)}${topic.description.length > 200 ? '…' : ''}`
      : `Follow this civic debate on Lobby Market. Current status: ${statusLabel}. ${forPct}% For / ${100 - forPct}% Against across ${(topic.total_votes ?? 0).toLocaleString()} votes.`

  const items: FeedItem[] = []

  // 1. Topic itself as first item (status update)
  items.push({
    guid: `${topicUrl}#status-${topic.status}-${topic.updated_at ?? topic.created_at}`,
    title: `${statusLabel}: ${topic.statement.slice(0, 100)}${topic.statement.length > 100 ? '…' : ''}`,
    link: topicUrl,
    description: [
      `<p><strong>Status:</strong> ${statusLabel}</p>`,
      `<p><strong>Vote split:</strong> ${forPct}% For / ${100 - forPct}% Against</p>`,
      `<p><strong>Total votes:</strong> ${(topic.total_votes ?? 0).toLocaleString()}</p>`,
      topic.category ? `<p><strong>Category:</strong> ${topic.category}</p>` : '',
      topic.description ? `<p>${escapeXml(topic.description.slice(0, 500))}</p>` : '',
      `<p><a href="${topicUrl}">View on Lobby Market →</a></p>`,
    ]
      .filter(Boolean)
      .join('\n'),
    pubDate: topic.updated_at ?? topic.created_at,
  })

  // 2. Recent arguments on this topic
  const { data: args } = await supabase
    .from('arguments')
    .select('id, content, side, upvotes, created_at, user_id')
    .eq('topic_id', params.id)
    .order('created_at', { ascending: false })
    .limit(25)

  const authorIds = Array.from(new Set((args ?? []).map((a) => a.user_id)))

  const { data: profiles } = authorIds.length
    ? await supabase
        .from('profiles')
        .select('id, username, display_name')
        .in('id', authorIds)
    : { data: [] }

  const profileMap = new Map(
    (profiles ?? []).map((p: { id: string; username: string; display_name: string | null }) => [p.id, p]),
  )

  for (const arg of args ?? []) {
    const author = profileMap.get(arg.user_id)
    const sideLabel = arg.side === 'blue' ? 'FOR' : 'AGAINST'
    const authorName =
      author?.display_name ?? author?.username ?? 'Anonymous'
    const shortContent = arg.content.slice(0, 80)

    items.push({
      guid: `${BASE_URL}/topic/${params.id}/arguments#arg-${arg.id}`,
      title: `[${sideLabel}] "${shortContent}${arg.content.length > 80 ? '…' : ''}"`,
      link: `${topicUrl}/arguments`,
      description: [
        `<p><strong>${sideLabel}</strong></p>`,
        `<p>${escapeXml(arg.content)}</p>`,
        `<p><em>By ${escapeXml(authorName)} · ${arg.upvotes} upvote${arg.upvotes !== 1 ? 's' : ''}</em></p>`,
        `<p><a href="${topicUrl}/arguments">View all arguments →</a></p>`,
      ].join('\n'),
      pubDate: arg.created_at,
      author: authorName,
    })
  }

  // 3. Upcoming debates on this topic
  const { data: debates } = await supabase
    .from('debates')
    .select('id, type, status, scheduled_at, creator_id')
    .eq('topic_id', params.id)
    .in('status', ['scheduled', 'live'])
    .order('scheduled_at', { ascending: true })
    .limit(5)

  for (const debate of debates ?? []) {
    const typeLabel =
      debate.type === 'quick'
        ? '15-min Quick Debate'
        : debate.type === 'grand'
          ? '45-min Grand Debate'
          : '60-min Tribunal'
    const statusStr = debate.status === 'live' ? 'LIVE NOW' : 'Scheduled'
    const scheduledAt = debate.scheduled_at
      ? new Date(debate.scheduled_at).toLocaleString('en-GB', {
          dateStyle: 'long',
          timeStyle: 'short',
        })
      : 'TBD'

    items.push({
      guid: `${BASE_URL}/debate/${debate.id}`,
      title: `[${statusStr}] ${typeLabel} on "${topic.statement.slice(0, 60)}…"`,
      link: `${BASE_URL}/debate/${debate.id}`,
      description: [
        `<p><strong>${typeLabel}</strong> — ${statusStr}</p>`,
        debate.scheduled_at
          ? `<p><strong>When:</strong> ${scheduledAt}</p>`
          : '',
        `<p><a href="${BASE_URL}/debate/${debate.id}">View debate →</a></p>`,
      ]
        .filter(Boolean)
        .join('\n'),
      pubDate: debate.scheduled_at ?? new Date().toISOString(),
    })
  }

  // Sort all items chronologically (newest first)
  items.sort(
    (a, b) =>
      new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime(),
  )

  const xml = buildFeed(feedTitle, feedDescription, topicUrl, items)

  return new Response(xml, {
    status: 200,
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=240',
    },
  })
}
