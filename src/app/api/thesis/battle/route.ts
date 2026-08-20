import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Thesis, ThesisAuthor } from '@/lib/types/thesis'

export const dynamic = 'force-dynamic'

export interface BattleThesis {
  id: string
  statement: string
  rationale: string | null
  category: string
  resolution_date: string | null
  status: string
  agree_count: number
  disagree_count: number
  author: ThesisAuthor | null
  viewer_vote: boolean | null
  related_topic_id: string | null
  related_topic_statement: string | null
}

export interface ThesisBattleResponse {
  theses: BattleThesis[]
  total_available: number
}

function toEntry(
  row: Thesis,
  votes: Record<string, boolean>
): BattleThesis {
  const rawAuthor = row.author as unknown
  let author: ThesisAuthor | null = null
  if (rawAuthor && typeof rawAuthor === 'object') {
    const a = rawAuthor as Record<string, unknown>
    author = {
      id: String(a.id ?? ''),
      username: String(a.username ?? ''),
      display_name: a.display_name ? String(a.display_name) : null,
      avatar_url: a.avatar_url ? String(a.avatar_url) : null,
      role: String(a.role ?? 'citizen'),
    }
  }

  return {
    id: row.id,
    statement: row.statement,
    rationale: row.rationale ?? null,
    category: row.category,
    resolution_date: row.resolution_date ?? null,
    status: row.status,
    agree_count: row.agree_count ?? 0,
    disagree_count: row.disagree_count ?? 0,
    author,
    viewer_vote: votes[row.id] !== undefined ? votes[row.id] : null,
    related_topic_id: row.related_topic_id ?? null,
    related_topic_statement: row.related_topic_statement ?? null,
  }
}

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = req.nextUrl

  // How many theses to return for the battle queue
  const count = Math.min(parseInt(searchParams.get('count') || '20', 10), 40)
  const category = searchParams.get('category') || null

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Build base query — active, public theses with a minimum of 3 votes for quality
  let query = supabase
    .from('civic_theses')
    .select(
      `
      id, user_id, statement, rationale, category,
      resolution_date, status, related_topic_id,
      agree_count, disagree_count, is_public, resolved_at,
      created_at, updated_at,
      profiles!civic_theses_user_id_fkey(
        id, username, display_name, avatar_url, role
      )
    `,
      { count: 'exact' }
    )
    .eq('is_public', true)
    .eq('status', 'active')
    .gte('agree_count', 1)
    .order('agree_count', { ascending: false })
    .limit(count * 3) // fetch 3× so we have diversity before client-side shuffling

  if (category) {
    query = query.eq('category', category)
  }

  // Exclude the current user's own theses
  if (user) {
    query = query.neq('user_id', user.id)
  }

  const { data: rows, count: total, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (!rows || rows.length === 0) {
    return NextResponse.json({ theses: [], total_available: 0 })
  }

  // Fetch viewer votes for all returned rows
  const viewerVotes: Record<string, boolean> = {}
  if (user) {
    const ids = rows.map((r) => r.id)
    const { data: voteRows } = await supabase
      .from('thesis_votes')
      .select('thesis_id, agree')
      .eq('user_id', user.id)
      .in('thesis_id', ids)

    if (voteRows) {
      for (const v of voteRows) {
        viewerVotes[v.thesis_id] = v.agree
      }
    }
  }

  // Map rows, normalizing nested author
  const theses = rows.map((row) => {
    const rawAuthor = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
    const normalized = { ...row, author: rawAuthor ?? null } as Thesis
    return toEntry(normalized, viewerVotes)
  })

  return NextResponse.json({
    theses,
    total_available: total ?? theses.length,
  } satisfies ThesisBattleResponse)
}
