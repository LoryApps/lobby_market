import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Response Types ───────────────────────────────────────────────────────────

export interface TopPredictor {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  total_resolved: number
  vindicated: number
  refuted: number
  accuracy_pct: number
  contrarian_count: number // vindicated where < 40% agreed at time of post
  avg_agree_at_post: number
}

export interface CategoryStat {
  category: string
  total: number
  active: number
  vindicated: number
  refuted: number
  expired: number
  accuracy_pct: number
  avg_agree_count: number
  avg_disagree_count: number
}

export interface PlatformThesisStat {
  total_theses: number
  active: number
  vindicated: number
  refuted: number
  expired: number
  accuracy_pct: number
  avg_resolution_days: number | null
  total_predictors: number
  most_agreed_thesis_id: string | null
  most_agreed_thesis_statement: string | null
  most_agreed_count: number
}

export interface ThesisAnalyticsResponse {
  platform: PlatformThesisStat
  categories: CategoryStat[]
  top_predictors: TopPredictor[]
}

export async function GET() {
  const supabase = await createClient()

  // ── Platform-wide stats ───────────────────────────────────────────────────
  const { data: allTheses } = await supabase
    .from('civic_theses')
    .select('id, status, category, agree_count, disagree_count, resolved_at, created_at')
    .eq('is_public', true)

  const theses = allTheses ?? []
  const total = theses.length
  const vindicated = theses.filter((t) => t.status === 'vindicated').length
  const refuted = theses.filter((t) => t.status === 'refuted').length
  const expired = theses.filter((t) => t.status === 'expired').length
  const active = theses.filter((t) => t.status === 'active').length
  const resolved = vindicated + refuted

  const accuracy_pct = resolved > 0 ? Math.round((vindicated / resolved) * 100) : 0

  // Average days to resolution
  const resolvedWithDates = theses.filter(
    (t) => t.resolved_at && t.created_at && (t.status === 'vindicated' || t.status === 'refuted')
  )
  const avgResolutionDays =
    resolvedWithDates.length > 0
      ? resolvedWithDates.reduce((sum, t) => {
          const created = new Date(t.created_at).getTime()
          const resolved_at = new Date(t.resolved_at!).getTime()
          return sum + (resolved_at - created) / (1000 * 60 * 60 * 24)
        }, 0) / resolvedWithDates.length
      : null

  // Most agreed thesis
  const mostAgreed = [...theses].sort((a, b) => b.agree_count - a.agree_count)[0]
  let mostAgreedStatement: string | null = null
  if (mostAgreed) {
    const { data: mostAgreedData } = await supabase
      .from('civic_theses')
      .select('statement')
      .eq('id', mostAgreed.id)
      .single()
    mostAgreedStatement = mostAgreedData?.statement ?? null
  }

  // Distinct predictors
  const { count: totalPredictors } = await supabase
    .from('civic_theses')
    .select('user_id', { count: 'exact', head: true })
    .eq('is_public', true)

  const platform: PlatformThesisStat = {
    total_theses: total,
    active,
    vindicated,
    refuted,
    expired,
    accuracy_pct,
    avg_resolution_days: avgResolutionDays !== null ? Math.round(avgResolutionDays) : null,
    total_predictors: totalPredictors ?? 0,
    most_agreed_thesis_id: mostAgreed?.id ?? null,
    most_agreed_thesis_statement: mostAgreedStatement,
    most_agreed_count: mostAgreed?.agree_count ?? 0,
  }

  // ── Category breakdown ─────────────────────────────────────────────────────
  const categoryMap = new Map<string, CategoryStat>()
  for (const t of theses) {
    const cat = t.category || 'unknown'
    const existing = categoryMap.get(cat) ?? {
      category: cat,
      total: 0,
      active: 0,
      vindicated: 0,
      refuted: 0,
      expired: 0,
      accuracy_pct: 0,
      avg_agree_count: 0,
      avg_disagree_count: 0,
    }
    existing.total += 1
    if (t.status === 'active') existing.active += 1
    if (t.status === 'vindicated') existing.vindicated += 1
    if (t.status === 'refuted') existing.refuted += 1
    if (t.status === 'expired') existing.expired += 1
    existing.avg_agree_count = (existing.avg_agree_count * (existing.total - 1) + t.agree_count) / existing.total
    existing.avg_disagree_count = (existing.avg_disagree_count * (existing.total - 1) + t.disagree_count) / existing.total
    categoryMap.set(cat, existing)
  }
  const categories: CategoryStat[] = Array.from(categoryMap.values()).map((c) => {
    const catResolved = c.vindicated + c.refuted
    return {
      ...c,
      accuracy_pct: catResolved > 0 ? Math.round((c.vindicated / catResolved) * 100) : 0,
      avg_agree_count: Math.round(c.avg_agree_count),
      avg_disagree_count: Math.round(c.avg_disagree_count),
    }
  }).sort((a, b) => b.total - a.total)

  // ── Top predictors ─────────────────────────────────────────────────────────
  // Fetch user thesis stats — group by user
  const { data: userThesesRaw } = await supabase
    .from('civic_theses')
    .select(`
      user_id, status, agree_count, disagree_count,
      profiles!civic_theses_user_id_fkey(username, display_name, avatar_url, role)
    `)
    .eq('is_public', true)
    .in('status', ['vindicated', 'refuted'])

  const userMap = new Map<
    string,
    {
      user_id: string
      username: string
      display_name: string | null
      avatar_url: string | null
      role: string
      vindicated: number
      refuted: number
      total_resolved: number
      contrarian_count: number
      total_agree_at_post: number
    }
  >()

  for (const t of userThesesRaw ?? []) {
    const profile = (t as { profiles: { username: string; display_name: string | null; avatar_url: string | null; role: string } | null }).profiles
    if (!profile) continue
    const existing = userMap.get(t.user_id) ?? {
      user_id: t.user_id,
      username: profile.username,
      display_name: profile.display_name,
      avatar_url: profile.avatar_url,
      role: profile.role,
      vindicated: 0,
      refuted: 0,
      total_resolved: 0,
      contrarian_count: 0,
      total_agree_at_post: 0,
    }
    existing.total_resolved += 1
    existing.total_agree_at_post += t.agree_count ?? 0
    if (t.status === 'vindicated') {
      existing.vindicated += 1
      // Contrarian: vindicated AND had < 40% agreement at resolution
      const total = (t.agree_count ?? 0) + (t.disagree_count ?? 0)
      const agreedPct = total > 0 ? (t.agree_count ?? 0) / total : 0.5
      if (agreedPct < 0.4) existing.contrarian_count += 1
    } else {
      existing.refuted += 1
    }
    userMap.set(t.user_id, existing)
  }

  const top_predictors: TopPredictor[] = Array.from(userMap.values())
    .filter((u) => u.total_resolved >= 2)
    .map((u) => ({
      user_id: u.user_id,
      username: u.username,
      display_name: u.display_name,
      avatar_url: u.avatar_url,
      role: u.role,
      total_resolved: u.total_resolved,
      vindicated: u.vindicated,
      refuted: u.refuted,
      accuracy_pct: Math.round((u.vindicated / u.total_resolved) * 100),
      contrarian_count: u.contrarian_count,
      avg_agree_at_post: u.total_resolved > 0 ? Math.round(u.total_agree_at_post / u.total_resolved) : 0,
    }))
    .sort((a, b) => b.accuracy_pct - a.accuracy_pct || b.total_resolved - a.total_resolved)
    .slice(0, 20)

  return NextResponse.json({ platform, categories, top_predictors } satisfies ThesisAnalyticsResponse)
}
