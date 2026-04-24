import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CitationDomain {
  domain: string
  for_count: number
  against_count: number
  total_count: number
  example_url: string
}

export interface ArgumentCitationsResponse {
  citations: CitationDomain[]
  total_cited_args: number
  for_cited: number
  against_cited: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractDomain(url: string): string | null {
  try {
    const u = new URL(url)
    return u.hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const topicId = params.id
  if (!topicId) {
    return NextResponse.json({ error: 'Missing topic id' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: args, error } = await supabase
    .from('topic_arguments')
    .select('side, source_url')
    .eq('topic_id', topicId)
    .not('source_url', 'is', null)
    .limit(200)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!args || args.length === 0) {
    return NextResponse.json({
      citations: [],
      total_cited_args: 0,
      for_cited: 0,
      against_cited: 0,
    } satisfies ArgumentCitationsResponse)
  }

  // Aggregate by domain
  const domainMap = new Map<string, { for_count: number; against_count: number; example_url: string }>()

  let forCited = 0
  let againstCited = 0

  for (const arg of args) {
    if (!arg.source_url) continue
    const domain = extractDomain(arg.source_url)
    if (!domain) continue

    const isFor = arg.side === 'blue'
    if (isFor) forCited++
    else againstCited++

    const existing = domainMap.get(domain) ?? { for_count: 0, against_count: 0, example_url: arg.source_url }
    if (isFor) existing.for_count++
    else existing.against_count++
    domainMap.set(domain, existing)
  }

  const citations: CitationDomain[] = Array.from(domainMap.entries())
    .map(([domain, stats]) => ({
      domain,
      for_count: stats.for_count,
      against_count: stats.against_count,
      total_count: stats.for_count + stats.against_count,
      example_url: stats.example_url,
    }))
    .sort((a, b) => b.total_count - a.total_count)
    .slice(0, 20)

  return NextResponse.json({
    citations,
    total_cited_args: forCited + againstCited,
    for_cited: forCited,
    against_cited: againstCited,
  } satisfies ArgumentCitationsResponse, {
    headers: {
      'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300',
    },
  })
}
