import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface SourceDomain {
  domain: string
  example_url: string
  for_count: number
  against_count: number
  total_count: number
  /** 0–100: percentage of citations that are FOR */
  for_pct: number
  /** Top categories that cite this domain */
  top_categories: string[]
  /** Sample topic statements that cite this domain (up to 3) */
  sample_topics: { id: string; statement: string; status: string }[]
}

export interface SourcesResponse {
  sources: SourceDomain[]
  total_cited_args: number
  total_unique_domains: number
  for_cited: number
  against_cited: number
  /** Category breakdown — how many unique cited domains per category */
  category_breakdown: { category: string; count: number }[]
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function extractDomain(url: string): string | null {
  try {
    return new URL(url).hostname.replace(/^www\./, '')
  } catch {
    return null
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category') ?? null
  const sort = searchParams.get('sort') ?? 'total'  // total | for | against | bias

  const supabase = await createClient()

  // Step 1: fetch all cited arguments (side, source_url, topic_id)
  const { data: args, error: argsError } = await supabase
    .from('topic_arguments')
    .select('side, source_url, topic_id')
    .not('source_url', 'is', null)
    .limit(2000)

  if (argsError) {
    return NextResponse.json({ error: argsError.message }, { status: 500 })
  }

  if (!args || args.length === 0) {
    return NextResponse.json({
      sources: [],
      total_cited_args: 0,
      total_unique_domains: 0,
      for_cited: 0,
      against_cited: 0,
      category_breakdown: [],
    } satisfies SourcesResponse)
  }

  // Step 2: fetch topic details for the unique topic IDs that appear in args
  const topicIdSet = new Set<string>()
  for (const a of args) { if (a.topic_id) topicIdSet.add(a.topic_id) }
  const uniqueTopicIds = Array.from(topicIdSet)

  const { data: topics } = await supabase
    .from('topics')
    .select('id, statement, category, status')
    .in('id', uniqueTopicIds.slice(0, 500))

  // Build a lookup map
  const topicMap = new Map<string, { id: string; statement: string; category: string | null; status: string }>()
  for (const t of topics ?? []) {
    topicMap.set(t.id, t)
  }

  // ── Aggregate by domain ───────────────────────────────────────────────────

  interface DomainAccum {
    for_count: number
    against_count: number
    example_url: string
    // category → count
    categories: Map<string, number>
    // topic id → { statement, status }
    topicSamples: Map<string, { statement: string; status: string }>
  }

  const domainMap = new Map<string, DomainAccum>()
  const categoryDomainSets = new Map<string, Set<string>>()

  let totalFor = 0
  let totalAgainst = 0

  for (const arg of args) {
    if (!arg.source_url) continue
    const domain = extractDomain(arg.source_url)
    if (!domain) continue

    const topic = arg.topic_id ? topicMap.get(arg.topic_id) : null
    const topicCategory = topic?.category ?? 'Other'

    // Apply category filter
    if (category && topicCategory !== category) continue

    const isFor = arg.side === 'blue'
    if (isFor) totalFor++
    else totalAgainst++

    // Domain accumulator
    if (!domainMap.has(domain)) {
      domainMap.set(domain, {
        for_count: 0,
        against_count: 0,
        example_url: arg.source_url,
        categories: new Map(),
        topicSamples: new Map(),
      })
    }
    const acc = domainMap.get(domain)!
    if (isFor) acc.for_count++
    else acc.against_count++

    // Category accumulator
    acc.categories.set(topicCategory, (acc.categories.get(topicCategory) ?? 0) + 1)

    // Topic accumulator (max 10 per domain for sampling)
    if (topic && acc.topicSamples.size < 10) {
      acc.topicSamples.set(topic.id, { statement: topic.statement, status: topic.status })
    }

    // Category → domain set (for breakdown)
    if (!categoryDomainSets.has(topicCategory)) {
      categoryDomainSets.set(topicCategory, new Set())
    }
    categoryDomainSets.get(topicCategory)!.add(domain)
  }

  // ── Build result array ────────────────────────────────────────────────────

  const sources: SourceDomain[] = Array.from(domainMap.entries()).map(([domain, acc]) => {
    const total = acc.for_count + acc.against_count
    const forPct = total > 0 ? Math.round((acc.for_count / total) * 100) : 50

    const topCategories = Array.from(acc.categories.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([cat]) => cat)

    const sampleTopics = Array.from(acc.topicSamples.entries())
      .slice(0, 3)
      .map(([id, t]) => ({ id, statement: t.statement, status: t.status }))

    return {
      domain,
      example_url: acc.example_url,
      for_count: acc.for_count,
      against_count: acc.against_count,
      total_count: total,
      for_pct: forPct,
      top_categories: topCategories,
      sample_topics: sampleTopics,
    }
  })

  // ── Sort ──────────────────────────────────────────────────────────────────

  sources.sort((a, b) => {
    if (sort === 'for') return b.for_count - a.for_count
    if (sort === 'against') return b.against_count - a.against_count
    if (sort === 'bias') {
      const biasA = Math.abs(a.for_pct - 50)
      const biasB = Math.abs(b.for_pct - 50)
      return biasB - biasA
    }
    return b.total_count - a.total_count
  })

  // ── Category breakdown ────────────────────────────────────────────────────

  const categoryBreakdown = Array.from(categoryDomainSets.entries())
    .map(([cat, domainSet]) => ({ category: cat, count: domainSet.size }))
    .sort((a, b) => b.count - a.count)

  return NextResponse.json({
    sources: sources.slice(0, 60),
    total_cited_args: totalFor + totalAgainst,
    total_unique_domains: domainMap.size,
    for_cited: totalFor,
    against_cited: totalAgainst,
    category_breakdown: categoryBreakdown,
  } satisfies SourcesResponse, {
    headers: {
      'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
    },
  })
}
