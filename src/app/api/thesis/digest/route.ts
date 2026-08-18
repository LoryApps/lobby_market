import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Thesis, ThesisAuthor } from '@/lib/types/thesis'

export const dynamic = 'force-dynamic'

export interface DigestThesis extends Thesis {
  controversy_score?: number
  velocity?: number
}

export interface TopForecaster {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  vindicated_count: number
  total_resolved: number
  accuracy_pct: number
}

export interface DigestResponse {
  week_label: string
  vindicated: DigestThesis[]
  most_agreed: DigestThesis[]
  controversial: DigestThesis[]
  rising: DigestThesis[]
  top_forecasters: TopForecaster[]
  stats: {
    total_published_week: number
    total_vindicated_week: number
    total_active: number
  }
}

function shapeThesis(
  row: Record<string, unknown>,
  viewerId: string | null
): DigestThesis {
  const profileRaw = row['profiles!civic_theses_user_id_fkey'] as Record<string, unknown> | null
  const author: ThesisAuthor | null = profileRaw
    ? {
        id: profileRaw.id as string,
        username: profileRaw.username as string,
        display_name: profileRaw.display_name as string | null,
        avatar_url: profileRaw.avatar_url as string | null,
        role: profileRaw.role as string,
      }
    : null

  return {
    id: row.id as string,
    user_id: row.user_id as string,
    statement: row.statement as string,
    rationale: row.rationale as string | null,
    category: row.category as string,
    resolution_date: row.resolution_date as string | null,
    status: row.status as Thesis['status'],
    related_topic_id: row.related_topic_id as string | null,
    agree_count: row.agree_count as number,
    disagree_count: row.disagree_count as number,
    is_public: row.is_public as boolean,
    resolved_at: row.resolved_at as string | null,
    created_at: row.created_at as string,
    updated_at: row.updated_at as string,
    author,
    viewer_vote: null,
    related_topic_statement: null,
  }
}

const THESIS_SELECT = `
  id, user_id, statement, rationale, category,
  resolution_date, status, related_topic_id,
  agree_count, disagree_count, is_public, resolved_at,
  created_at, updated_at,
  profiles!civic_theses_user_id_fkey(
    id, username, display_name, avatar_url, role
  )
`

export async function GET() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const now = new Date()
  const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000).toISOString()

  // Week label e.g. "Week of Aug 12"
  const weekStart = new Date(now)
  weekStart.setDate(weekStart.getDate() - weekStart.getDay())
  const week_label = `Week of ${weekStart.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}`

  const [
    vindicatedRes,
    mostAgreedRes,
    risingRes,
    controversialRes,
    statsActiveRes,
    statsVindicatedRes,
    statsWeekRes,
    forecastersRes,
  ] = await Promise.all([
    // Vindicated this week
    supabase
      .from('civic_theses')
      .select(THESIS_SELECT)
      .eq('is_public', true)
      .eq('status', 'vindicated')
      .gte('resolved_at', weekAgo)
      .order('agree_count', { ascending: false })
      .limit(5),

    // Most agreed (all-time agree_count, published this week)
    supabase
      .from('civic_theses')
      .select(THESIS_SELECT)
      .eq('is_public', true)
      .eq('status', 'active')
      .gte('created_at', weekAgo)
      .order('agree_count', { ascending: false })
      .limit(5),

    // Rising: newest theses with highest velocity (agree_count per hour)
    supabase
      .from('civic_theses')
      .select(THESIS_SELECT)
      .eq('is_public', true)
      .eq('status', 'active')
      .gte('created_at', weekAgo)
      .order('agree_count', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(5),

    // Controversial: closest agree/disagree split, minimum engagement
    supabase
      .from('civic_theses')
      .select(THESIS_SELECT)
      .eq('is_public', true)
      .eq('status', 'active')
      .gte('created_at', weekAgo)
      .gte('agree_count', 2)
      .gte('disagree_count', 2)
      .order('disagree_count', { ascending: false })
      .limit(20),

    // Stats: total active
    supabase
      .from('civic_theses')
      .select('id', { count: 'exact', head: true })
      .eq('is_public', true)
      .eq('status', 'active'),

    // Stats: total vindicated this week
    supabase
      .from('civic_theses')
      .select('id', { count: 'exact', head: true })
      .eq('is_public', true)
      .eq('status', 'vindicated')
      .gte('resolved_at', weekAgo),

    // Stats: total published this week
    supabase
      .from('civic_theses')
      .select('id', { count: 'exact', head: true })
      .eq('is_public', true)
      .gte('created_at', weekAgo),

    // Top forecasters: users with most vindicated theses all-time
    supabase
      .from('civic_theses')
      .select(
        `user_id, status,
         profiles!civic_theses_user_id_fkey(id, username, display_name, avatar_url, role)`
      )
      .eq('is_public', true)
      .in('status', ['vindicated', 'refuted'])
      .limit(200),
  ])

  // Compute controversy score and sort
  const controversial = (controversialRes.data ?? [])
    .map((r) => {
      const a = (r.agree_count as number) || 0
      const d = (r.disagree_count as number) || 0
      const total = a + d
      const ratio = total > 0 ? Math.abs(a - d) / total : 1
      return { ...r, _controversy: ratio }
    })
    .sort((a, b) => a._controversy - b._controversy)
    .slice(0, 5)

  // Compute top forecasters from raw rows
  const forecasterMap = new Map<
    string,
    { profile: Record<string, unknown>; vindicated: number; refuted: number }
  >()

  for (const row of forecastersRes.data ?? []) {
    const profile = row['profiles!civic_theses_user_id_fkey'] as Record<string, unknown> | null
    if (!profile) continue
    const uid = row.user_id as string
    if (!forecasterMap.has(uid)) {
      forecasterMap.set(uid, { profile, vindicated: 0, refuted: 0 })
    }
    const entry = forecasterMap.get(uid)!
    if (row.status === 'vindicated') entry.vindicated++
    else entry.refuted++
  }

  const top_forecasters: TopForecaster[] = Array.from(forecasterMap.values())
    .filter((e) => e.vindicated >= 1)
    .sort((a, b) => b.vindicated - a.vindicated)
    .slice(0, 5)
    .map((e) => {
      const total = e.vindicated + e.refuted
      return {
        id: e.profile.id as string,
        username: e.profile.username as string,
        display_name: e.profile.display_name as string | null,
        avatar_url: e.profile.avatar_url as string | null,
        role: e.profile.role as string,
        vindicated_count: e.vindicated,
        total_resolved: total,
        accuracy_pct: total > 0 ? Math.round((e.vindicated / total) * 100) : 0,
      }
    })

  const viewerId = user?.id ?? null

  const digest: DigestResponse = {
    week_label,
    vindicated: (vindicatedRes.data ?? []).map((r) =>
      shapeThesis(r as unknown as Record<string, unknown>, viewerId)
    ),
    most_agreed: (mostAgreedRes.data ?? []).map((r) =>
      shapeThesis(r as unknown as Record<string, unknown>, viewerId)
    ),
    controversial: controversial.map((r) =>
      shapeThesis(r as unknown as Record<string, unknown>, viewerId)
    ),
    rising: (risingRes.data ?? []).map((r) =>
      shapeThesis(r as unknown as Record<string, unknown>, viewerId)
    ),
    top_forecasters,
    stats: {
      total_active: statsActiveRes.count ?? 0,
      total_vindicated_week: statsVindicatedRes.count ?? 0,
      total_published_week: statsWeekRes.count ?? 0,
    },
  }

  return NextResponse.json(digest)
}
