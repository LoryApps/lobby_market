import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface ThesisPredictorRow {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  total_theses: number
  vindicated: number
  refuted: number
  active: number
  expired: number
  accuracy_pct: number | null      // null when < 3 resolved
  total_agrees: number
  total_disagrees: number
  net_agreement: number
}

export interface ThesisMostAgreedRow {
  id: string
  statement: string
  category: string
  status: string
  agree_count: number
  disagree_count: number
  resolved_at: string | null
  created_at: string
  author_username: string
  author_display_name: string | null
  author_avatar_url: string | null
  author_role: string
}

export interface ThesisLeaderboardResponse {
  predictors: ThesisPredictorRow[]
  most_agreed: ThesisMostAgreedRow[]
}

export async function GET() {
  const supabase = await createClient()

  // ── Pull all public theses with author info ──────────────────────────────
  const { data: rawTheses } = await supabase
    .from('civic_theses')
    .select(
      `
      id, user_id, status, agree_count, disagree_count,
      statement, category, resolved_at, created_at,
      profiles!civic_theses_user_id_fkey(
        username, display_name, avatar_url, role
      )
      `
    )
    .eq('is_public', true)
    .order('agree_count', { ascending: false })

  const theses = (rawTheses ?? []) as Array<{
    id: string
    user_id: string
    status: string
    agree_count: number
    disagree_count: number
    statement: string
    category: string
    resolved_at: string | null
    created_at: string
    profiles: {
      username: string
      display_name: string | null
      avatar_url: string | null
      role: string
    } | null
  }>

  // ── Aggregate per-user stats ─────────────────────────────────────────────
  const userMap = new Map<string, ThesisPredictorRow>()

  for (const t of theses) {
    const prof = t.profiles
    if (!prof) continue

    let row = userMap.get(t.user_id)
    if (!row) {
      row = {
        user_id: t.user_id,
        username: prof.username,
        display_name: prof.display_name,
        avatar_url: prof.avatar_url,
        role: prof.role,
        total_theses: 0,
        vindicated: 0,
        refuted: 0,
        active: 0,
        expired: 0,
        accuracy_pct: null,
        total_agrees: 0,
        total_disagrees: 0,
        net_agreement: 0,
      }
      userMap.set(t.user_id, row)
    }

    row.total_theses++
    row.total_agrees += t.agree_count
    row.total_disagrees += t.disagree_count
    row.net_agreement = row.total_agrees - row.total_disagrees

    if (t.status === 'vindicated') row.vindicated++
    else if (t.status === 'refuted') row.refuted++
    else if (t.status === 'active') row.active++
    else if (t.status === 'expired') row.expired++
  }

  // Compute accuracy for users with ≥ 3 resolved theses
  for (const row of userMap.values()) {
    const resolved = row.vindicated + row.refuted
    if (resolved >= 3) {
      row.accuracy_pct = Math.round((row.vindicated / resolved) * 100)
    }
  }

  // ── Top predictors: users with accuracy, then by total ──────────────────
  const predictors = Array.from(userMap.values())
    .filter((r) => r.total_theses >= 1)
    .sort((a, b) => {
      // Primary: accuracy (nulls last)
      if (a.accuracy_pct !== null && b.accuracy_pct !== null) {
        if (b.accuracy_pct !== a.accuracy_pct) return b.accuracy_pct - a.accuracy_pct
      } else if (a.accuracy_pct !== null) return -1
      else if (b.accuracy_pct !== null) return 1
      // Secondary: net agreement
      if (b.net_agreement !== a.net_agreement) return b.net_agreement - a.net_agreement
      // Tertiary: total theses
      return b.total_theses - a.total_theses
    })
    .slice(0, 50)

  // ── Most agreed theses (top 20 by agree_count) ──────────────────────────
  const most_agreed: ThesisMostAgreedRow[] = theses
    .filter((t) => t.agree_count > 0)
    .slice(0, 20)
    .map((t) => ({
      id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
      agree_count: t.agree_count,
      disagree_count: t.disagree_count,
      resolved_at: t.resolved_at,
      created_at: t.created_at,
      author_username: t.profiles?.username ?? '',
      author_display_name: t.profiles?.display_name ?? null,
      author_avatar_url: t.profiles?.avatar_url ?? null,
      author_role: t.profiles?.role ?? 'person',
    }))

  return NextResponse.json({ predictors, most_agreed } satisfies ThesisLeaderboardResponse)
}
