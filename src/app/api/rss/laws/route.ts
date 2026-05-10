import { createClient } from '@/lib/supabase/server'
import type { NextRequest } from 'next/server'

export const dynamic = 'force-dynamic'
export const revalidate = 600

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

function buildItem(law: {
  id: string
  statement: string
  full_statement: string | null
  category: string | null
  total_votes: number | null
  established_at: string
}): string {
  const desc = law.full_statement
    ? `${law.full_statement.slice(0, 400)}${law.full_statement.length > 400 ? '…' : ''}`
    : `Established by community consensus · ${law.total_votes?.toLocaleString() ?? 0} votes cast.`

  const link = `${BASE_URL}/law/${law.id}`
  const categoryTag = law.category
    ? `    <category>${escapeXml(law.category)}</category>\n`
    : ''

  return `  <item>
    <guid isPermaLink="true">${escapeXml(link)}</guid>
    <title>${escapeXml(`[LAW] ${law.statement}`)}</title>
    <link>${escapeXml(link)}</link>
    <description>${escapeXml(desc)}</description>
    <pubDate>${rfcDate(law.established_at)}</pubDate>
${categoryTag}  </item>`
}

export async function GET(_req: NextRequest) {
  const supabase = await createClient()

  const { data: laws } = await supabase
    .from('laws')
    .select('id, statement, full_statement, category, total_votes, established_at')
    .order('established_at', { ascending: false })
    .limit(60)

  const items = (laws ?? []).map(buildItem)

  const lastBuildDate =
    laws && laws.length > 0
      ? rfcDate(laws[0].established_at)
      : rfcDate(new Date().toISOString())

  const rss = `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0"
  xmlns:atom="http://www.w3.org/2005/Atom"
  xmlns:dc="http://purl.org/dc/elements/1.1/">
<channel>
  <title>Lobby Market — Established Laws</title>
  <link>${BASE_URL}/law</link>
  <description>Every civic consensus that became law on Lobby Market — the community's collective decisions, made permanent.</description>
  <language>en-US</language>
  <lastBuildDate>${lastBuildDate}</lastBuildDate>
  <atom:link href="${BASE_URL}/api/rss/laws" rel="self" type="application/rss+xml"/>
  <image>
    <url>${BASE_URL}/assets/logo-mark.png</url>
    <title>Lobby Market — Established Laws</title>
    <link>${BASE_URL}/law</link>
  </image>
${items.join('\n')}
</channel>
</rss>`

  return new Response(rss, {
    status: 200,
    headers: {
      'Content-Type': 'application/rss+xml; charset=utf-8',
      'Cache-Control': 'public, s-maxage=600, stale-while-revalidate=1200',
    },
  })
}
