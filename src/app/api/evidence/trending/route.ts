import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TrendingEvidenceItem {
  id: string
  topic_id: string
  topic_statement: string
  topic_category: string | null
  topic_status: string
  url: string
  title: string
  description: string | null
  domain: string | null
  side: 'for' | 'against' | 'neutral'
  upvotes: number
  created_at: string
  author: {
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
  viewer_voted: boolean
}

export interface DomainStat {
  domain: string
  total: number
  for_count: number
  against_count: number
  neutral_count: number
  total_upvotes: number
  avg_upvotes: number
}

export interface TrendingEvidenceResponse {
  items: TrendingEvidenceItem[]
  domain_stats: DomainStat[]
  counts: { for: number; against: number; neutral: number; total: number }
}

// ─── GET ──────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const supabase = await createClient()
    const {
      data: { user },
    } = await supabase.auth.getUser()

    const { searchParams } = new URL(req.url)
    const side = searchParams.get('side') // 'for' | 'against' | 'neutral' | null
    const sort = searchParams.get('sort') ?? 'votes' // 'votes' | 'recent'
    const domain = searchParams.get('domain') ?? null
    const limit = Math.min(parseInt(searchParams.get('limit') ?? '40', 10), 100)

    // Build evidence query
    let query = supabase
      .from('topic_evidence')
      .select(`
        id,
        topic_id,
        url,
        title,
        description,
        domain,
        side,
        upvotes,
        created_at,
        author:profiles!user_id (
          username,
          display_name,
          avatar_url,
          role
        ),
        topic:topics!topic_id (
          statement,
          category,
          status
        )
      `)
      .gt('upvotes', 0)

    if (side && side !== 'all') {
      query = query.eq('side', side)
    }
    if (domain) {
      query = query.eq('domain', domain)
    }

    if (sort === 'recent') {
      query = query.order('created_at', { ascending: false })
    } else {
      query = query
        .order('upvotes', { ascending: false })
        .order('created_at', { ascending: false })
    }

    query = query.limit(limit)

    const { data: rows, error } = await query
    if (error) throw error

    const items = (rows ?? []) as Array<{
      id: string
      topic_id: string
      url: string
      title: string
      description: string | null
      domain: string | null
      side: 'for' | 'against' | 'neutral'
      upvotes: number
      created_at: string
      author: {
        username: string
        display_name: string | null
        avatar_url: string | null
        role: string
      } | null
      topic: {
        statement: string
        category: string | null
        status: string
      } | null
    }>

    // Collect viewer votes
    let voterSet = new Set<string>()
    if (user && items.length > 0) {
      const ids = items.map((r) => r.id)
      const { data: votes } = await supabase
        .from('topic_evidence_votes')
        .select('evidence_id')
        .eq('user_id', user.id)
        .in('evidence_id', ids)
      voterSet = new Set((votes ?? []).map((v) => v.evidence_id))
    }

    // Fetch platform-wide counts (for sidebar stats)
    const { data: allRows } = await supabase
      .from('topic_evidence')
      .select('side, domain, upvotes')
      .gt('upvotes', 0)

    // Build domain stats from all evidence (not just current filter)
    const domainMap = new Map<
      string,
      { total: number; for: number; against: number; neutral: number; upvotes: number }
    >()
    let forTotal = 0,
      againstTotal = 0,
      neutralTotal = 0
    for (const row of allRows ?? []) {
      if (row.side === 'for') forTotal++
      else if (row.side === 'against') againstTotal++
      else neutralTotal++

      if (row.domain) {
        const d = domainMap.get(row.domain) ?? { total: 0, for: 0, against: 0, neutral: 0, upvotes: 0 }
        d.total++
        d.upvotes += row.upvotes ?? 0
        if (row.side === 'for') d.for++
        else if (row.side === 'against') d.against++
        else d.neutral++
        domainMap.set(row.domain, d)
      }
    }

    const domain_stats: DomainStat[] = Array.from(domainMap.entries())
      .map(([dom, s]) => ({
        domain: dom,
        total: s.total,
        for_count: s.for,
        against_count: s.against,
        neutral_count: s.neutral,
        total_upvotes: s.upvotes,
        avg_upvotes: s.total > 0 ? Math.round(s.upvotes / s.total) : 0,
      }))
      .sort((a, b) => b.total_upvotes - a.total_upvotes)
      .slice(0, 20)

    const result: TrendingEvidenceResponse = {
      items: items.map((row) => ({
        id: row.id,
        topic_id: row.topic_id,
        topic_statement: row.topic?.statement ?? 'Unknown topic',
        topic_category: row.topic?.category ?? null,
        topic_status: row.topic?.status ?? 'active',
        url: row.url,
        title: row.title,
        description: row.description,
        domain: row.domain,
        side: row.side,
        upvotes: row.upvotes,
        created_at: row.created_at,
        author: row.author,
        viewer_voted: voterSet.has(row.id),
      })),
      domain_stats,
      counts: {
        for: forTotal,
        against: againstTotal,
        neutral: neutralTotal,
        total: forTotal + againstTotal + neutralTotal,
      },
    }

    return NextResponse.json(result)
  } catch (err) {
    console.error('[evidence/trending] error:', err)
    return NextResponse.json({ error: 'Failed to load evidence' }, { status: 500 })
  }
}
