import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ThesisCategory, ThesisStatus } from '@/lib/types/thesis'
import { THESIS_CATEGORIES } from '@/lib/types/thesis'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ThesisCategoryStats {
  category: ThesisCategory
  total: number
  active: number
  vindicated: number
  refuted: number
  expired: number
  accuracy: number       // vindicated / (vindicated + refuted) * 100, or null if no resolved
  agree_total: number    // sum of agree_count across user's theses in this category
}

export interface ThesisSummary {
  id: string
  statement: string
  category: string
  status: ThesisStatus
  agree_count: number
  disagree_count: number
  resolution_date: string | null
  resolved_at: string | null
  created_at: string
}

export interface ThesisAnalyticsData {
  total: number
  active: number
  vindicated: number
  refuted: number
  expired: number
  accuracy: number                   // overall vindicated / (vindicated + refuted) * 100
  totalAgreements: number            // total agrees received across all theses
  totalDisagreements: number
  byCategory: ThesisCategoryStats[]
  bestCategory: ThesisCategory | null
  worstCategory: ThesisCategory | null
  mostAgreed: ThesisSummary | null   // thesis with most agrees
  mostContested: ThesisSummary | null // thesis with most disagrees
  recentResolved: ThesisSummary[]    // last 3 resolved theses
  platformStats: {
    total_active: number
    total_vindicated: number
    total_refuted: number
    platform_accuracy: number
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch user's theses
  const { data: rows, error } = await supabase
    .from('civic_theses')
    .select(
      'id, statement, category, status, agree_count, disagree_count, resolution_date, resolved_at, created_at'
    )
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const theses = rows ?? []

  // Overall counts
  let active = 0, vindicated = 0, refuted = 0, expired = 0
  let totalAgreements = 0, totalDisagreements = 0

  for (const t of theses) {
    if (t.status === 'active') active++
    else if (t.status === 'vindicated') vindicated++
    else if (t.status === 'refuted') refuted++
    else if (t.status === 'expired') expired++
    totalAgreements += t.agree_count ?? 0
    totalDisagreements += t.disagree_count ?? 0
  }

  const resolvedCount = vindicated + refuted
  const accuracy = resolvedCount > 0 ? Math.round((vindicated / resolvedCount) * 100) : 0

  // By category
  const catMap = new Map<ThesisCategory, ThesisCategoryStats>()
  for (const cat of THESIS_CATEGORIES) {
    catMap.set(cat, {
      category: cat,
      total: 0, active: 0, vindicated: 0, refuted: 0, expired: 0,
      accuracy: 0, agree_total: 0,
    })
  }

  for (const t of theses) {
    const cat = t.category as ThesisCategory
    const s = catMap.get(cat)
    if (!s) continue
    s.total++
    if (t.status === 'active') s.active++
    else if (t.status === 'vindicated') s.vindicated++
    else if (t.status === 'refuted') s.refuted++
    else if (t.status === 'expired') s.expired++
    s.agree_total += t.agree_count ?? 0
  }

  // Compute accuracy per category
  for (const s of catMap.values()) {
    const r = s.vindicated + s.refuted
    s.accuracy = r > 0 ? Math.round((s.vindicated / r) * 100) : 0
  }

  const byCategory = Array.from(catMap.values()).filter(s => s.total > 0)

  // Best / worst category (only among those with at least 1 resolved thesis)
  const resolved = byCategory.filter(s => s.vindicated + s.refuted > 0)
  resolved.sort((a, b) => b.accuracy - a.accuracy)
  const bestCategory = resolved.length > 0 ? resolved[0].category : null
  const worstCategory = resolved.length > 1 ? resolved[resolved.length - 1].category : null

  // Most agreed
  const sorted = [...theses].sort((a, b) => (b.agree_count ?? 0) - (a.agree_count ?? 0))
  const mostAgreed = sorted[0]
    ? {
        id: sorted[0].id, statement: sorted[0].statement, category: sorted[0].category,
        status: sorted[0].status as ThesisStatus, agree_count: sorted[0].agree_count,
        disagree_count: sorted[0].disagree_count,
        resolution_date: sorted[0].resolution_date, resolved_at: sorted[0].resolved_at,
        created_at: sorted[0].created_at,
      }
    : null

  // Most contested (most disagrees)
  const sortedDisagree = [...theses].sort((a, b) => (b.disagree_count ?? 0) - (a.disagree_count ?? 0))
  const mostContested = sortedDisagree[0]
    ? {
        id: sortedDisagree[0].id, statement: sortedDisagree[0].statement,
        category: sortedDisagree[0].category, status: sortedDisagree[0].status as ThesisStatus,
        agree_count: sortedDisagree[0].agree_count, disagree_count: sortedDisagree[0].disagree_count,
        resolution_date: sortedDisagree[0].resolution_date, resolved_at: sortedDisagree[0].resolved_at,
        created_at: sortedDisagree[0].created_at,
      }
    : null

  // Recent resolved
  const recentResolved = theses
    .filter(t => t.status === 'vindicated' || t.status === 'refuted')
    .sort((a, b) => (b.resolved_at ?? '').localeCompare(a.resolved_at ?? ''))
    .slice(0, 3)
    .map(t => ({
      id: t.id, statement: t.statement, category: t.category,
      status: t.status as ThesisStatus, agree_count: t.agree_count,
      disagree_count: t.disagree_count, resolution_date: t.resolution_date,
      resolved_at: t.resolved_at, created_at: t.created_at,
    }))

  // Platform stats (all public theses)
  const { data: platformRows } = await supabase
    .from('civic_theses')
    .select('status')
    .eq('is_public', true)

  const platformStats = (platformRows ?? []).reduce(
    (acc, r) => {
      if (r.status === 'active') acc.total_active++
      else if (r.status === 'vindicated') acc.total_vindicated++
      else if (r.status === 'refuted') acc.total_refuted++
      return acc
    },
    { total_active: 0, total_vindicated: 0, total_refuted: 0, platform_accuracy: 0 }
  )
  const platformResolved = platformStats.total_vindicated + platformStats.total_refuted
  platformStats.platform_accuracy = platformResolved > 0
    ? Math.round((platformStats.total_vindicated / platformResolved) * 100)
    : 0

  const result: ThesisAnalyticsData = {
    total: theses.length,
    active, vindicated, refuted, expired,
    accuracy, totalAgreements, totalDisagreements,
    byCategory, bestCategory, worstCategory,
    mostAgreed, mostContested, recentResolved,
    platformStats,
  }

  return NextResponse.json(result)
}
