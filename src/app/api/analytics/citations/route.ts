import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CitationSourceStat {
  domain: string
  count: number
  avg_upvotes: number
  avg_ai_score: number | null
}

export interface CitationImpactByCategory {
  category: string
  cited_count: number
  uncited_count: number
  cited_avg_upvotes: number
  uncited_avg_upvotes: number
  cited_avg_score: number | null
  uncited_avg_score: number | null
  citation_rate: number
}

export interface CitationTrendPoint {
  month: string
  cited: number
  uncited: number
  citation_rate: number
}

export interface TopCitedArgument {
  id: string
  content: string
  source_url: string
  domain: string
  upvotes: number
  ai_score: number | null
  ai_grade: string | null
  side: 'blue' | 'red'
  created_at: string
  topic: {
    id: string
    statement: string
    category: string | null
  } | null
}

export interface CitationAnalyticsResponse {
  // Overview
  total_arguments: number
  cited_count: number
  citation_rate: number            // 0.0–1.0

  // Impact comparison
  cited_avg_upvotes: number
  uncited_avg_upvotes: number
  cited_avg_score: number | null
  uncited_avg_score: number | null
  upvote_lift: number              // cited vs uncited uplift %
  score_lift: number | null        // AI score uplift %

  // Platform comparison
  platform_citation_rate: number

  // By category
  by_category: CitationImpactByCategory[]

  // Top sources used
  top_sources: CitationSourceStat[]

  // Monthly trend
  monthly_trend: CitationTrendPoint[]

  // Best cited arguments
  top_cited_arguments: TopCitedArgument[]
}

// ─── Helper ───────────────────────────────────────────────────────────────────

function extractDomain(url: string | null): string {
  if (!url) return 'unknown'
  try {
    const u = new URL(url)
    return u.hostname.replace(/^www\./, '')
  } catch {
    return 'other'
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Fetch all user arguments with topic join ─────────────────────────────
  const { data: args } = await supabase
    .from('topic_arguments')
    .select(`
      id, side, content, upvotes, source_url, ai_score, ai_grade, created_at,
      topic:topics!topic_id(id, statement, category)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  const allArgs = (args ?? []) as Array<{
    id: string
    side: string
    content: string
    upvotes: number
    source_url: string | null
    ai_score: number | null
    ai_grade: string | null
    created_at: string
    topic: { id: string; statement: string; category: string | null } | null
  }>

  const total_arguments = allArgs.length
  const citedArgs = allArgs.filter((a) => a.source_url && a.source_url.length > 0)
  const uncitedArgs = allArgs.filter((a) => !a.source_url)
  const cited_count = citedArgs.length
  const citation_rate = total_arguments > 0 ? cited_count / total_arguments : 0

  // ── Impact stats ────────────────────────────────────────────────────────
  const avg = (arr: typeof allArgs, key: 'upvotes' | 'ai_score') => {
    const filtered = arr.filter((a) => a[key] !== null)
    if (filtered.length === 0) return null
    return filtered.reduce((sum, a) => sum + (a[key] as number), 0) / filtered.length
  }

  const cited_avg_upvotes = avg(citedArgs, 'upvotes') ?? 0
  const uncited_avg_upvotes = avg(uncitedArgs, 'upvotes') ?? 0
  const cited_avg_score = avg(citedArgs, 'ai_score')
  const uncited_avg_score = avg(uncitedArgs, 'ai_score')

  const upvote_lift =
    uncited_avg_upvotes > 0
      ? ((cited_avg_upvotes - uncited_avg_upvotes) / uncited_avg_upvotes) * 100
      : 0

  const score_lift =
    cited_avg_score !== null && uncited_avg_score !== null && uncited_avg_score > 0
      ? ((cited_avg_score - uncited_avg_score) / uncited_avg_score) * 100
      : null

  // ── Platform citation rate (sampled from recent arguments) ───────────────
  const { data: platformSample } = await supabase
    .from('topic_arguments')
    .select('source_url')
    .order('created_at', { ascending: false })
    .limit(500)

  const platformCitedCount = (platformSample ?? []).filter(
    (a) => a.source_url && a.source_url.length > 0
  ).length
  const platform_citation_rate =
    (platformSample ?? []).length > 0
      ? platformCitedCount / (platformSample ?? []).length
      : 0

  // ── By category breakdown ────────────────────────────────────────────────
  const categoryMap = new Map<string, {
    cited: typeof allArgs
    uncited: typeof allArgs
  }>()

  for (const a of allArgs) {
    const cat = a.topic?.category ?? 'Other'
    if (!categoryMap.has(cat)) categoryMap.set(cat, { cited: [], uncited: [] })
    const bucket = categoryMap.get(cat)!
    if (a.source_url) bucket.cited.push(a)
    else bucket.uncited.push(a)
  }

  const by_category: CitationImpactByCategory[] = Array.from(categoryMap.entries())
    .map(([category, { cited, uncited }]) => ({
      category,
      cited_count: cited.length,
      uncited_count: uncited.length,
      cited_avg_upvotes: avg(cited, 'upvotes') ?? 0,
      uncited_avg_upvotes: avg(uncited, 'upvotes') ?? 0,
      cited_avg_score: avg(cited, 'ai_score'),
      uncited_avg_score: avg(uncited, 'ai_score'),
      citation_rate: cited.length / Math.max(cited.length + uncited.length, 1),
    }))
    .filter((c) => c.cited_count + c.uncited_count >= 2)
    .sort((a, b) => b.cited_count + b.uncited_count - (a.cited_count + a.uncited_count))

  // ── Top sources ──────────────────────────────────────────────────────────
  const domainMap = new Map<string, { upvotes: number[]; scores: number[] }>()
  for (const a of citedArgs) {
    const domain = extractDomain(a.source_url)
    if (!domainMap.has(domain)) domainMap.set(domain, { upvotes: [], scores: [] })
    const d = domainMap.get(domain)!
    d.upvotes.push(a.upvotes)
    if (a.ai_score !== null) d.scores.push(a.ai_score)
  }

  const top_sources: CitationSourceStat[] = Array.from(domainMap.entries())
    .map(([domain, { upvotes, scores }]) => ({
      domain,
      count: upvotes.length,
      avg_upvotes: upvotes.reduce((s, v) => s + v, 0) / upvotes.length,
      avg_ai_score: scores.length > 0 ? scores.reduce((s, v) => s + v, 0) / scores.length : null,
    }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 10)

  // ── Monthly trend (last 12 months) ───────────────────────────────────────
  const trendMap = new Map<string, { cited: number; uncited: number }>()
  const now = new Date()
  for (let i = 0; i < 12; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    trendMap.set(key, { cited: 0, uncited: 0 })
  }

  for (const a of allArgs) {
    const d = new Date(a.created_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    if (trendMap.has(key)) {
      const b = trendMap.get(key)!
      if (a.source_url) b.cited++
      else b.uncited++
    }
  }

  const monthly_trend: CitationTrendPoint[] = Array.from(trendMap.entries())
    .map(([month, { cited, uncited }]) => ({
      month,
      cited,
      uncited,
      citation_rate: cited + uncited > 0 ? cited / (cited + uncited) : 0,
    }))
    .sort((a, b) => a.month.localeCompare(b.month))

  // ── Top cited arguments ──────────────────────────────────────────────────
  const top_cited_arguments: TopCitedArgument[] = citedArgs
    .sort((a, b) => b.upvotes - a.upvotes)
    .slice(0, 6)
    .map((a) => ({
      id: a.id,
      content: a.content,
      source_url: a.source_url!,
      domain: extractDomain(a.source_url),
      upvotes: a.upvotes,
      ai_score: a.ai_score,
      ai_grade: a.ai_grade,
      side: a.side as 'blue' | 'red',
      created_at: a.created_at,
      topic: a.topic,
    }))

  const response: CitationAnalyticsResponse = {
    total_arguments,
    cited_count,
    citation_rate,
    cited_avg_upvotes,
    uncited_avg_upvotes,
    cited_avg_score,
    uncited_avg_score,
    upvote_lift,
    score_lift,
    platform_citation_rate,
    by_category,
    top_sources,
    monthly_trend,
    top_cited_arguments,
  }

  return NextResponse.json(response)
}
