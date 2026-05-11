import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export type AuthorPeriod = 'week' | 'month' | 'all'

export interface AuthorBestArgument {
  id: string
  topic_id: string
  side: 'blue' | 'red'
  content: string
  upvotes: number
  ai_score: number
  ai_grade: string
  topic_statement: string
  topic_category: string | null
  topic_status: string
}

export interface ArgumentAuthor {
  user_id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  argument_count: number
  scored_count: number
  avg_score: number
  best_grade: string
  total_upvotes: number
  author_score: number
  best_argument: AuthorBestArgument | null
}

export interface ArgumentAuthorsResponse {
  authors: ArgumentAuthor[]
  period: AuthorPeriod
  category: string | null
  generatedAt: string
}

const PERIOD_CUTOFFS: Record<AuthorPeriod, string | null> = {
  week:  new Date(Date.now() -  7 * 24 * 60 * 60 * 1000).toISOString(),
  month: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString(),
  all:   null,
}

const VALID_CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science', 'Ethics',
  'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const GRADE_RANK: Record<string, number> = {
  'A+': 13, 'A': 12, 'A-': 11,
  'B+': 10, 'B': 9,  'B-': 8,
  'C+': 7,  'C': 6,  'C-': 5,
  'D+': 4,  'D': 3,  'D-': 2,
  'F': 1,
}

function bestGrade(grades: string[]): string {
  if (grades.length === 0) return 'N/A'
  return grades.reduce((best, g) => {
    const brank = GRADE_RANK[best] ?? 0
    const grank = GRADE_RANK[g]   ?? 0
    return grank > brank ? g : best
  })
}

// Composite author score: rewards both quality AND volume
function authorScore(avgScore: number, scoredCount: number, totalUpvotes: number): number {
  return avgScore * Math.log(scoredCount + 1) + totalUpvotes * 0.05
}

/**
 * GET /api/arguments/authors
 *
 * Returns top argument writers ranked by a composite quality score.
 * Score = avg_ai_score × ln(scored_count + 1) + total_upvotes × 0.05
 *
 * Query params:
 *   period   — week | month | all (default: month)
 *   category — filter to a specific topic category (optional)
 *   limit    — number of authors to return, max 50 (default: 30)
 */
export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)

  const rawPeriod   = searchParams.get('period')   ?? 'month'
  const rawCategory = searchParams.get('category') ?? ''
  const rawLimit    = parseInt(searchParams.get('limit') ?? '30', 10)

  const period   = (['week', 'month', 'all'] as AuthorPeriod[]).includes(rawPeriod as AuthorPeriod)
    ? (rawPeriod as AuthorPeriod)
    : 'month'
  const category = VALID_CATEGORIES.includes(rawCategory) ? rawCategory : null
  const limit    = Math.min(50, Math.max(1, isNaN(rawLimit) ? 30 : rawLimit))

  const supabase = await createClient()

  // Fetch scored arguments with author + topic info (up to 1000 for grouping)
  let query = supabase
    .from('topic_arguments')
    .select(`
      id, user_id, side, content, upvotes, ai_score, ai_grade, created_at,
      author:profiles!user_id ( id, username, display_name, avatar_url, role ),
      topic:topics!topic_id   ( id, statement, category, status )
    `)
    .not('ai_score', 'is', null)
    .not('ai_grade', 'is', null)
    .order('ai_score', { ascending: false })
    .limit(1000)

  const cutoff = PERIOD_CUTOFFS[period]
  if (cutoff) query = query.gte('created_at', cutoff)

  const { data: rawArgs, error } = await query

  if (error) {
    console.error('[authors] DB error:', error.message)
    return NextResponse.json({ error: 'Failed to load arguments' }, { status: 500 })
  }

  const args = rawArgs ?? []

  // Normalize Supabase's array-or-object joins
  type RawArg = (typeof args)[number]
  function normAuthor(a: RawArg) {
    return Array.isArray(a.author) ? a.author[0] ?? null : (a.author as {
      id: string; username: string; display_name: string | null; avatar_url: string | null; role: string
    } | null)
  }
  function normTopic(a: RawArg) {
    return Array.isArray(a.topic) ? a.topic[0] ?? null : (a.topic as {
      id: string; statement: string; category: string | null; status: string
    } | null)
  }

  // Group by user
  const authorMap = new Map<string, {
    author: NonNullable<ReturnType<typeof normAuthor>>
    scores: number[]
    grades: string[]
    total_upvotes: number
    best_arg: (typeof args)[number] | null
  }>()

  for (const arg of args) {
    const author = normAuthor(arg)
    const topic  = normTopic(arg)
    if (!author) continue

    // Category filter — apply after fetch
    if (category && topic?.category !== category) continue

    const entry = authorMap.get(author.id)
    if (!entry) {
      authorMap.set(author.id, {
        author,
        scores: [arg.ai_score as number],
        grades: arg.ai_grade ? [arg.ai_grade as string] : [],
        total_upvotes: arg.upvotes ?? 0,
        best_arg: arg,
      })
    } else {
      entry.scores.push(arg.ai_score as number)
      if (arg.ai_grade) entry.grades.push(arg.ai_grade as string)
      entry.total_upvotes += arg.upvotes ?? 0
      // best_arg is already the highest-scored (since we sorted by ai_score desc)
    }
  }

  // Build sorted author list
  const authors: ArgumentAuthor[] = Array.from(authorMap.values())
    .filter((e) => e.scores.length >= 1)
    .map((e) => {
      const avg  = e.scores.reduce((a, b) => a + b, 0) / e.scores.length
      const score = authorScore(avg, e.scores.length, e.total_upvotes)
      const bestArgRaw = e.best_arg
      const bestTopic  = bestArgRaw ? normTopic(bestArgRaw) : null

      const best_argument: AuthorBestArgument | null = bestArgRaw && bestTopic
        ? {
            id:               bestArgRaw.id,
            topic_id:         bestArgRaw.topic_id,
            side:             bestArgRaw.side as 'blue' | 'red',
            content:          bestArgRaw.content ?? '',
            upvotes:          bestArgRaw.upvotes ?? 0,
            ai_score:         bestArgRaw.ai_score as number,
            ai_grade:         bestArgRaw.ai_grade as string,
            topic_statement:  bestTopic.statement,
            topic_category:   bestTopic.category,
            topic_status:     bestTopic.status,
          }
        : null

      return {
        user_id:        e.author.id,
        username:       e.author.username,
        display_name:   e.author.display_name,
        avatar_url:     e.author.avatar_url,
        role:           e.author.role,
        argument_count: e.scores.length,
        scored_count:   e.scores.length,
        avg_score:      Math.round(avg * 10) / 10,
        best_grade:     bestGrade(e.grades),
        total_upvotes:  e.total_upvotes,
        author_score:   Math.round(score * 100) / 100,
        best_argument,
      }
    })
    .sort((a, b) => b.author_score - a.author_score)
    .slice(0, limit)

  return NextResponse.json({
    authors,
    period,
    category,
    generatedAt: new Date().toISOString(),
  } satisfies ArgumentAuthorsResponse)
}
