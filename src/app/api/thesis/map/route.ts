import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { THESIS_CATEGORIES } from '@/lib/types/thesis'
import type { ThesisCategory } from '@/lib/types/thesis'

export const dynamic = 'force-dynamic'

export interface ThesisMapPoint {
  id: string
  statement: string
  rationale: string | null
  category: ThesisCategory
  agree_count: number
  disagree_count: number
  resolution_date: string | null
  status: string
  agree_ratio: number
  total_votes: number
  days_until_resolution: number | null
  author_username: string
  author_display_name: string | null
  author_avatar: string | null
}

export interface ThesisMapResponse {
  points: ThesisMapPoint[]
  categories: ThesisCategory[]
  total: number
}

const DAY_MS = 86_400_000

export async function GET() {
  const supabase = await createClient()

  const { data: rows, error } = await supabase
    .from('civic_theses')
    .select(
      `id, statement, rationale, category, agree_count, disagree_count, resolution_date, status,
       profiles!civic_theses_user_id_fkey(username, display_name, avatar_url)`
    )
    .eq('is_public', true)
    .eq('status', 'active')
    .order('created_at', { ascending: false })
    .limit(300)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const now = Date.now()
  const points: ThesisMapPoint[] = (rows ?? []).map((row) => {
    const total = (row.agree_count ?? 0) + (row.disagree_count ?? 0)
    const agree_ratio = total > 0 ? (row.agree_count ?? 0) / total : 0.5

    let days_until: number | null = null
    if (row.resolution_date) {
      const ms = new Date(row.resolution_date).getTime() - now
      days_until = Math.max(0, Math.round(ms / DAY_MS))
    }

    const author = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
    return {
      id: row.id,
      statement: row.statement,
      rationale: row.rationale ?? null,
      category: row.category as ThesisCategory,
      agree_count: row.agree_count ?? 0,
      disagree_count: row.disagree_count ?? 0,
      resolution_date: row.resolution_date ?? null,
      status: row.status,
      agree_ratio,
      total_votes: total,
      days_until_resolution: days_until,
      author_username: (author as { username: string } | null)?.username ?? 'anon',
      author_display_name: (author as { display_name: string | null } | null)?.display_name ?? null,
      author_avatar: (author as { avatar_url: string | null } | null)?.avatar_url ?? null,
    }
  })

  return NextResponse.json({
    points,
    categories: THESIS_CATEGORIES,
    total: points.length,
  } satisfies ThesisMapResponse)
}
