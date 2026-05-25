import { createClient } from '@/lib/supabase/server'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 300

const BASE_URL = 'https://lobby.market'

// Slug → display label (kebab-case tags from the vocab)
const TAG_LABELS: Record<string, string> = {
  tax: 'Tax Policy',
  economy: 'Economy',
  trade: 'Trade',
  budget: 'Budget & Fiscal',
  income: 'Income & Wages',
  inequality: 'Inequality',
  housing: 'Housing',
  banking: 'Banking & Finance',
  climate: 'Climate',
  environment: 'Environment',
  energy: 'Energy',
  water: 'Water',
  healthcare: 'Healthcare',
  'mental-health': 'Mental Health',
  drugs: 'Drugs & Addiction',
  pandemic: 'Public Health',
  education: 'Education',
  'student-debt': 'Student Debt',
  ai: 'Artificial Intelligence',
  'social-media': 'Social Media',
  privacy: 'Privacy & Data',
  cybersecurity: 'Cybersecurity',
  'tech-regulation': 'Tech Regulation',
  democracy: 'Democracy',
  'free-speech': 'Free Speech',
  immigration: 'Immigration',
  'foreign-policy': 'Foreign Policy',
  military: 'Military & Defense',
  policing: 'Policing',
  justice: 'Criminal Justice',
  corruption: 'Corruption & Ethics',
  gender: 'Gender & Identity',
  race: 'Race & Equity',
  religion: 'Religion & Secularism',
  abortion: 'Reproductive Rights',
  guns: 'Gun Policy',
  welfare: 'Welfare & Benefits',
  labor: 'Labor & Workers',
  media: 'Media & Press',
  urbanization: 'Urban & Rural',
  food: 'Food & Agriculture',
  // Category-derived tags
  economics: 'Economics',
  politics: 'Politics',
  technology: 'Technology',
  science: 'Science',
  ethics: 'Ethics',
  philosophy: 'Philosophy',
  culture: 'Culture',
  health: 'Health',
  environment2: 'Environment',
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
  status: string
}

function buildItem(item: FeedItem): string {
  const categoryTag = item.category
    ? `    <category>${escapeXml(item.category)}</category>\n`
    : ''

  return `  <item>
    <guid isPermaLink="true">${escapeXml(item.link)}</guid>
    <title>${escapeXml(item.title)}</title>
    <link>${escapeXml(item.link)}</link>
    <description>${escapeXml(item.description)}</description>
    <pubDate>${rfcDate(item.pubDate)}</pubDate>
${categoryTag}  </item>`
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { tag: string } }
) {
  const tag = params.tag.toLowerCase().trim()

  if (!tag || tag.length > 50 || !/^[a-z0-9-]+$/.test(tag)) {
    return new Response('Not Found', { status: 404 })
  }

  const tagLabel = TAG_LABELS[tag] ?? tag.replace(/-/g, ' ').replace(/\b\w/g, (c) => c.toUpperCase())
  const feedTitle = `Lobby Market — #${tag} Topics`
  const feedDescription = `Civic debates and established laws tagged #${tag} on Lobby Market — where ideas compete, votes decide, and the best arguments become law.`
  const feedLink = `${BASE_URL}/?tag=${encodeURIComponent(tag)}`

  const supabase = await createClient()

  const [lawsRes, topicsRes] = await Promise.all([
    supabase
      .from('laws')
      .select('id, statement, full_statement, category, total_votes, established_at, tags')
      .contains('tags', [tag])
      .eq('is_active', true)
      .order('established_at', { ascending: false })
      .limit(20),

    supabase
      .from('topics')
      .select('id, statement, category, total_votes, blue_pct, status, created_at, tags')
      .contains('tags', [tag])
      .in('status', ['active', 'voting', 'proposed'])
      .order('feed_score', { ascending: false })
      .limit(30),
  ])

  const items: FeedItem[] = []

  for (const law of lawsRes.data ?? []) {
    const desc = law.full_statement
      ? `${law.full_statement.slice(0, 300)}${law.full_statement.length > 300 ? '…' : ''}`
      : `Established Law · ${(law.total_votes ?? 0).toLocaleString()} votes cast.`

    items.push({
      guid: `${BASE_URL}/law/${law.id}`,
      title: `[LAW] ${law.statement}`,
      link: `${BASE_URL}/law/${law.id}`,
      description: desc,
      pubDate: law.established_at,
      category: law.category,
      status: 'law',
    })
  }

  for (const topic of topicsRes.data ?? []) {
    const forPct = Math.round(topic.blue_pct ?? 50)
    const againstPct = 100 - forPct
    const statusLabel =
      topic.status === 'voting' ? 'VOTING' :
      topic.status === 'active' ? 'ACTIVE' : 'PROPOSED'

    const desc = `${statusLabel} · ${forPct}% For / ${againstPct}% Against · ${(topic.total_votes ?? 0).toLocaleString()} votes cast.`

    items.push({
      guid: `${BASE_URL}/topic/${topic.id}`,
      title: `[${statusLabel}] ${topic.statement}`,
      link: `${BASE_URL}/topic/${topic.id}`,
      description: desc,
      pubDate: topic.created_at,
      category: topic.category,
      status: topic.status,
    })
  }

  if (items.length === 0) {
    return new Response('Not Found', { status: 404 })
  }

  items.sort((a, b) => new Date(b.pubDate).getTime() - new Date(a.pubDate).getTime())

  const lastBuildDate = rfcDate(items[0].pubDate)

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
  <title>${escapeXml(feedTitle)}</title>
  <link>${escapeXml(feedLink)}</link>
  <description>${escapeXml(feedDescription)}</description>
  <language>en-US</language>
  <lastBuildDate>${lastBuildDate}</lastBuildDate>
  <atom:link href="${BASE_URL}/api/rss/tag/${encodeURIComponent(tag)}" rel="self" type="application/rss+xml"/>
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
      'X-Tag': tag,
      'X-Tag-Label': tagLabel,
    },
  })
}
