import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 1800 // 30 minutes

// ─── Types ────────────────────────────────────────────────────────────────────

export interface RippleTarget {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  link_type: 'category' | 'wiki'
  /** aligned = trending same direction as source verdict; opposed = opposite; neutral = near 50/50 */
  alignment: 'aligned' | 'opposed' | 'neutral'
  /** 0–100: how strongly aligned/opposed */
  alignment_score: number
}

export interface RippleAnchor {
  id: string
  statement: string
  category: string | null
  verdict: 'law' | 'failed'
  blue_pct: number
  total_votes: number
  resolved_at: string
  ripple_targets: RippleTarget[]
  /** Proportion (0–100) of related topics aligned with this verdict's direction */
  ripple_score: number
  aligned_count: number
  opposed_count: number
  total_connected: number
}

export interface RippleResponse {
  anchors: RippleAnchor[]
  global_ripple_index: number  // 0–100: platform-wide ripple strength
  total_resolved_90d: number
  generated_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Alignment between a resolved topic's verdict and an active related topic:
 *
 * - If source became LAW (FOR won, blue_pct >= 60):
 *     related topic is "aligned" if it also leans FOR (blue_pct >= 55)
 *     related topic is "opposed" if it leans AGAINST (blue_pct <= 45)
 *
 * - If source FAILED (AGAINST won, blue_pct <= 40):
 *     related topic is "aligned" if it also leans AGAINST (blue_pct <= 45)
 *     related topic is "opposed" if it leans FOR (blue_pct >= 55)
 */
function computeAlignment(
  verdict: 'law' | 'failed',
  targetBluePct: number
): { alignment: 'aligned' | 'opposed' | 'neutral'; score: number } {
  if (verdict === 'law') {
    // Source passed FOR — is the related topic also leaning FOR?
    if (targetBluePct >= 55) {
      return { alignment: 'aligned', score: Math.round((targetBluePct - 50) * 2) }
    } else if (targetBluePct <= 45) {
      return { alignment: 'opposed', score: Math.round((50 - targetBluePct) * 2) }
    }
    return { alignment: 'neutral', score: 0 }
  } else {
    // Source failed (AGAINST won) — is the related topic also leaning AGAINST?
    if (targetBluePct <= 45) {
      return { alignment: 'aligned', score: Math.round((50 - targetBluePct) * 2) }
    } else if (targetBluePct >= 55) {
      return { alignment: 'opposed', score: Math.round((targetBluePct - 50) * 2) }
    }
    return { alignment: 'neutral', score: 0 }
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const category = searchParams.get('category') || null
  const windowDays = Math.max(7, Math.min(180, parseInt(searchParams.get('window') || '90', 10)))

  const supabase = await createClient()

  const windowStart = new Date()
  windowStart.setDate(windowStart.getDate() - windowDays)
  const windowISO = windowStart.toISOString()

  // ── 1. Fetch recently resolved anchor topics ───────────────────────────────

  // For laws: use the laws table (has precise established_at)
  const lawsQuery = supabase
    .from('laws')
    .select('topic_id, statement, category, blue_pct, total_votes, established_at')
    .gte('established_at', windowISO)
    .gte('total_votes', 10)
    .order('established_at', { ascending: false })
    .limit(30)

  // For failed topics: use the topics table (updated_at approximates resolution)
  const failedQuery = supabase
    .from('topics')
    .select('id, statement, category, blue_pct, total_votes, updated_at')
    .eq('status', 'failed')
    .gte('updated_at', windowISO)
    .gte('total_votes', 10)
    .order('updated_at', { ascending: false })
    .limit(20)

  const [{ data: lawsData }, { data: failedData }] = await Promise.all([
    lawsQuery,
    failedQuery,
  ])

  // Merge into unified anchor list
  type RawAnchor = {
    id: string
    statement: string
    category: string | null
    blue_pct: number
    total_votes: number
    resolved_at: string
    verdict: 'law' | 'failed'
  }

  const rawAnchors: RawAnchor[] = [
    ...(lawsData ?? []).map((l) => ({
      id: l.topic_id,
      statement: l.statement,
      category: l.category ?? null,
      blue_pct: l.blue_pct,
      total_votes: l.total_votes,
      resolved_at: l.established_at,
      verdict: 'law' as const,
    })),
    ...(failedData ?? []).map((t) => ({
      id: t.id,
      statement: t.statement,
      category: t.category ?? null,
      blue_pct: t.blue_pct ?? 50,
      total_votes: t.total_votes,
      resolved_at: t.updated_at,
      verdict: 'failed' as const,
    })),
  ]
    .filter((a) => !category || a.category === category)
    .sort((a, b) => new Date(b.resolved_at).getTime() - new Date(a.resolved_at).getTime())
    .slice(0, 20)

  if (rawAnchors.length === 0) {
    return NextResponse.json({
      anchors: [],
      global_ripple_index: 0,
      total_resolved_90d: 0,
      generated_at: new Date().toISOString(),
    } satisfies RippleResponse)
  }

  // ── 2. Get wiki links for all anchor topics ────────────────────────────────
  const anchorIds = rawAnchors.map((a) => a.id)

  const { data: wikiLinks } = await supabase
    .from('topic_links')
    .select('source_topic_id, target_topic_id')
    .or(`source_topic_id.in.(${anchorIds.join(',')}),target_topic_id.in.(${anchorIds.join(',')})`)

  // Build a map: anchorId → Set of linked topic IDs
  const wikiLinksMap = new Map<string, Set<string>>()
  for (const link of wikiLinks ?? []) {
    if (anchorIds.includes(link.source_topic_id)) {
      if (!wikiLinksMap.has(link.source_topic_id)) {
        wikiLinksMap.set(link.source_topic_id, new Set())
      }
      wikiLinksMap.get(link.source_topic_id)!.add(link.target_topic_id)
    }
    if (anchorIds.includes(link.target_topic_id)) {
      if (!wikiLinksMap.has(link.target_topic_id)) {
        wikiLinksMap.set(link.target_topic_id, new Set())
      }
      wikiLinksMap.get(link.target_topic_id)!.add(link.source_topic_id)
    }
  }

  // ── 3. Get active topics for each anchor category ─────────────────────────
  const anchorCategories = Array.from(
    new Set(rawAnchors.map((a) => a.category).filter((c): c is string => c !== null))
  )

  let activeTopics: Array<{ id: string; statement: string; category: string | null; status: string; blue_pct: number; total_votes: number }> = []
  if (anchorCategories.length > 0) {
    const { data } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .in('status', ['proposed', 'active', 'voting'])
      .in('category', anchorCategories)
      .gte('total_votes', 5)
      .order('total_votes', { ascending: false })
      .limit(200)
    activeTopics = data ?? []
  }

  const activeById = new Map(
    (activeTopics ?? []).map((t) => [t.id, t])
  )

  // ── 4. Collect all wiki-linked target IDs we still need ───────────────────
  const allLinkedIds = new Set<string>()
  for (const [, linkedSet] of wikiLinksMap) {
    for (const id of linkedSet) {
      if (!activeById.has(id)) allLinkedIds.add(id)
    }
  }

  let extraTopics: typeof activeTopics = []
  if (allLinkedIds.size > 0) {
    const idList = Array.from(allLinkedIds)
    const { data: extras } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .in('id', idList)
      .in('status', ['proposed', 'active', 'voting'])
    extraTopics = extras ?? []
    for (const t of extraTopics) {
      activeById.set(t.id, t)
    }
  }

  // ── 5. Build RippleAnchor objects ─────────────────────────────────────────
  const anchors: RippleAnchor[] = rawAnchors.map((anchor) => {
    const targets: RippleTarget[] = []
    const seenIds = new Set<string>([anchor.id])

    // Category-linked targets
    for (const topic of activeTopics ?? []) {
      if (seenIds.has(topic.id)) continue
      if (topic.category !== anchor.category) continue
      seenIds.add(topic.id)

      const { alignment, score } = computeAlignment(anchor.verdict, topic.blue_pct ?? 50)
      targets.push({
        id: topic.id,
        statement: topic.statement,
        category: topic.category ?? null,
        status: topic.status,
        blue_pct: topic.blue_pct ?? 50,
        total_votes: topic.total_votes,
        link_type: 'category',
        alignment,
        alignment_score: score,
      })
    }

    // Wiki-linked targets (may cross categories)
    const wikiIds = wikiLinksMap.get(anchor.id) ?? new Set()
    for (const targetId of wikiIds) {
      if (seenIds.has(targetId)) continue
      const topic = activeById.get(targetId)
      if (!topic) continue
      seenIds.add(targetId)

      const { alignment, score } = computeAlignment(anchor.verdict, topic.blue_pct ?? 50)
      targets.push({
        id: topic.id,
        statement: topic.statement,
        category: topic.category ?? null,
        status: topic.status,
        blue_pct: topic.blue_pct ?? 50,
        total_votes: topic.total_votes,
        link_type: 'wiki',
        alignment,
        alignment_score: score,
      })
    }

    // Sort: wiki links first, then by vote count
    targets.sort((a, b) => {
      if (a.link_type !== b.link_type) return a.link_type === 'wiki' ? -1 : 1
      return b.total_votes - a.total_votes
    })

    const topTargets = targets.slice(0, 12)
    const alignedCount = topTargets.filter((t) => t.alignment === 'aligned').length
    const opposedCount = topTargets.filter((t) => t.alignment === 'opposed').length
    const rippleScore =
      topTargets.length > 0
        ? Math.round((alignedCount / topTargets.length) * 100)
        : 0

    return {
      id: anchor.id,
      statement: anchor.statement,
      category: anchor.category,
      verdict: anchor.verdict,
      blue_pct: anchor.blue_pct,
      total_votes: anchor.total_votes,
      resolved_at: anchor.resolved_at,
      ripple_targets: topTargets,
      ripple_score: rippleScore,
      aligned_count: alignedCount,
      opposed_count: opposedCount,
      total_connected: topTargets.length,
    }
  })

  // ── 6. Compute global ripple index ────────────────────────────────────────
  const anchorsWithTargets = anchors.filter((a) => a.total_connected > 0)
  const globalRippleIndex =
    anchorsWithTargets.length > 0
      ? Math.round(
          anchorsWithTargets.reduce((sum, a) => sum + a.ripple_score, 0) /
            anchorsWithTargets.length
        )
      : 0

  return NextResponse.json({
    anchors,
    global_ripple_index: globalRippleIndex,
    total_resolved_90d: rawAnchors.length,
    generated_at: new Date().toISOString(),
  } satisfies RippleResponse)
}
