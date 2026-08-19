import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { ThesisAuthor } from '@/lib/types/thesis'

export const dynamic = 'force-dynamic'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ThesisCompareEntry {
  id: string
  statement: string
  rationale: string | null
  category: string
  status: string
  resolution_date: string | null
  resolved_at: string | null
  agree_count: number
  disagree_count: number
  is_public: boolean
  created_at: string
  author: ThesisAuthor | null
  viewer_vote: boolean | null
  related_topic_id: string | null
  related_topic_statement: string | null
  total_engagement: number
  agree_pct: number
  disagree_pct: number
  days_to_resolve: number | null
  days_since_created: number
}

export interface ThesisCompareResponse {
  a: ThesisCompareEntry | null
  b: ThesisCompareEntry | null
  insights: {
    same_category: boolean
    same_status: boolean
    closer_resolution: 'a' | 'b' | 'equal' | null
    more_popular: 'a' | 'b' | 'equal'
    more_contested: 'a' | 'b' | 'equal'
    category_a: string
    category_b: string
    overlap_tags: string[]
  } | null
}

// ─── Helper ────────────────────────────────────────────────────────────────────

function toEntry(
  row: Record<string, unknown>,
  viewerVote: boolean | null
): ThesisCompareEntry {
  const agreePct =
    (row.agree_count as number) + (row.disagree_count as number) > 0
      ? Math.round(
          ((row.agree_count as number) /
            ((row.agree_count as number) + (row.disagree_count as number))) *
            100
        )
      : 50

  const authorRaw = row.profiles as Record<string, unknown> | null
  const relatedTopicRaw = row.related_topic as Record<string, unknown> | null

  let daysToResolve: number | null = null
  if (row.resolution_date) {
    daysToResolve = Math.ceil(
      (new Date(row.resolution_date as string).getTime() - Date.now()) /
        (1000 * 60 * 60 * 24)
    )
  }

  return {
    id: row.id as string,
    statement: row.statement as string,
    rationale: (row.rationale as string | null) ?? null,
    category: row.category as string,
    status: row.status as string,
    resolution_date: (row.resolution_date as string | null) ?? null,
    resolved_at: (row.resolved_at as string | null) ?? null,
    agree_count: (row.agree_count as number) ?? 0,
    disagree_count: (row.disagree_count as number) ?? 0,
    is_public: (row.is_public as boolean) ?? true,
    created_at: row.created_at as string,
    author: authorRaw
      ? {
          id: authorRaw.id as string,
          username: authorRaw.username as string,
          display_name: (authorRaw.display_name as string | null) ?? null,
          avatar_url: (authorRaw.avatar_url as string | null) ?? null,
          role: (authorRaw.role as string) ?? 'citizen',
        }
      : null,
    viewer_vote: viewerVote,
    related_topic_id: (row.related_topic_id as string | null) ?? null,
    related_topic_statement:
      (relatedTopicRaw?.statement as string | null) ?? null,
    total_engagement:
      (row.agree_count as number) + (row.disagree_count as number),
    agree_pct: agreePct,
    disagree_pct: 100 - agreePct,
    days_to_resolve: daysToResolve,
    days_since_created: Math.floor(
      (Date.now() - new Date(row.created_at as string).getTime()) /
        (1000 * 60 * 60 * 24)
    ),
  }
}

// ─── Compute shared insights ───────────────────────────────────────────────────

function computeInsights(
  a: ThesisCompareEntry,
  b: ThesisCompareEntry
): ThesisCompareResponse['insights'] {
  const morePopular: 'a' | 'b' | 'equal' =
    a.total_engagement > b.total_engagement
      ? 'a'
      : b.total_engagement > a.total_engagement
        ? 'b'
        : 'equal'

  const contestA = Math.abs(a.agree_pct - 50)
  const contestB = Math.abs(b.agree_pct - 50)
  const moreContested: 'a' | 'b' | 'equal' =
    contestA < contestB ? 'a' : contestB < contestA ? 'b' : 'equal'

  let closerResolution: 'a' | 'b' | 'equal' | null = null
  if (a.days_to_resolve !== null && b.days_to_resolve !== null) {
    closerResolution =
      a.days_to_resolve < b.days_to_resolve
        ? 'a'
        : b.days_to_resolve < a.days_to_resolve
          ? 'b'
          : 'equal'
  } else if (a.days_to_resolve !== null) {
    closerResolution = 'a'
  } else if (b.days_to_resolve !== null) {
    closerResolution = 'b'
  }

  const wordsA = new Set(
    a.statement.toLowerCase().match(/\b[a-z]{4,}\b/g) ?? []
  )
  const wordsB = new Set(
    b.statement.toLowerCase().match(/\b[a-z]{4,}\b/g) ?? []
  )
  const stopWords = new Set([
    'will', 'that', 'this', 'with', 'have', 'from', 'they', 'been',
    'more', 'than', 'when', 'make', 'most', 'over', 'such', 'into',
    'also', 'government', 'should', 'would', 'could',
  ])
  const overlap: string[] = []
  for (const w of wordsA) {
    if (wordsB.has(w) && !stopWords.has(w)) overlap.push(w)
  }

  return {
    same_category: a.category === b.category,
    same_status: a.status === b.status,
    closer_resolution: closerResolution,
    more_popular: morePopular,
    more_contested: moreContested,
    category_a: a.category,
    category_b: b.category,
    overlap_tags: overlap.slice(0, 5),
  }
}

// ─── Handler ───────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const supabase = await createClient()
  const { searchParams } = req.nextUrl

  const idA = searchParams.get('a')
  const idB = searchParams.get('b')

  if (!idA || !idB) {
    return NextResponse.json(
      { error: 'Both ?a and ?b thesis IDs are required' },
      { status: 400 }
    )
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  const SELECT = `
    id, user_id, statement, rationale, category,
    resolution_date, status, related_topic_id,
    agree_count, disagree_count, is_public, resolved_at,
    created_at, updated_at,
    profiles!civic_theses_user_id_fkey(
      id, username, display_name, avatar_url, role
    ),
    related_topic:topics!civic_theses_related_topic_id_fkey(
      statement
    )
  `

  const [rowA, rowB] = await Promise.all([
    supabase.from('civic_theses').select(SELECT).eq('id', idA).maybeSingle(),
    supabase.from('civic_theses').select(SELECT).eq('id', idB).maybeSingle(),
  ])

  let viewerVoteA: boolean | null = null
  let viewerVoteB: boolean | null = null

  if (user) {
    const [vA, vB] = await Promise.all([
      supabase
        .from('thesis_votes')
        .select('agree')
        .eq('thesis_id', idA)
        .eq('user_id', user.id)
        .maybeSingle(),
      supabase
        .from('thesis_votes')
        .select('agree')
        .eq('thesis_id', idB)
        .eq('user_id', user.id)
        .maybeSingle(),
    ])
    viewerVoteA = vA.data?.agree ?? null
    viewerVoteB = vB.data?.agree ?? null
  }

  const entryA = rowA.data ? toEntry(rowA.data as Record<string, unknown>, viewerVoteA) : null
  const entryB = rowB.data ? toEntry(rowB.data as Record<string, unknown>, viewerVoteB) : null

  const insights =
    entryA && entryB ? computeInsights(entryA, entryB) : null

  return NextResponse.json({ a: entryA, b: entryB, insights } satisfies ThesisCompareResponse)
}
