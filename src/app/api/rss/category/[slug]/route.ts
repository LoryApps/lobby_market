import { createClient } from '@/lib/supabase/server'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 300

const BASE_URL = 'https://lobby.market'

const VALID_CATEGORIES: Record<string, string> = {
  economics:   'Economics',
  politics:    'Politics',
  technology:  'Technology',
  science:     'Science',
  ethics:      'Ethics',
  philosophy:  'Philosophy',
  culture:     'Culture',
  health:      'Health',
  environment: 'Environment',
  education:   'Education',
}

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

export async function GET(
  _req: NextRequest,
  { params }: { params: { slug: string } }
) {
  const slug = params.slug.toLowerCase()
  const category = VALID_CATEGORIES[slug]

  if (!category) {
    return new Response('Not Found', { status: 404 })
  }

  const supabase = await createClient()

  const [lawsRes, topicsRes] = await Promise.all([
    supabase
      .from('laws')
      .select('id, statement, full_statement, category, total_votes, established_at')
      .eq('category', category)
      .order('established_at', { ascending: false })
      .limit(30),
    supabase
      .from('topics')
      .select('id, statement, category, total_votes, blue_pct, status, created_at')
      .eq('category', category)
      .in('status', ['active', 'voting'])
      .order('feed_score', { ascending: false })
      .limit(20),
  ])

  const items: FeedItem[] = []

  for (const law of lawsRes.data ?? []) {
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

  for (const topic of topicsRes.data ?? []) {
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

  items.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())

  const feedTitle = `Lobby Market — ${category}`
  const feedDesc = `Laws established and active debates in the ${category} category on Lobby Market.`
  const feedLink = `${BASE_URL}/categories/${category}`
  const selfUrl = `${BASE_URL}/api/rss/category/${slug}`
  const lastBuildDate = items.length > 0 ? rfcDate(items[0].pubDate) : rfcDate(new Date().toISOString())

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
  <title>${escapeXml(feedTitle)}</title>
  <link>${escapeXml(feedLink)}</link>
  <description>${escapeXml(feedDesc)}</description>
  <language>en-US</language>
  <lastBuildDate>${lastBuildDate}</lastBuildDate>
  <atom:link href="${escapeXml(selfUrl)}" rel="self" type="application/rss+xml"/>
  <image>
    <url>${BASE_URL}/assets/logo-mark.png</url>
    <title>${escapeXml(feedTitle)}</title>
    <link>${escapeXml(feedLink)}</link>
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
