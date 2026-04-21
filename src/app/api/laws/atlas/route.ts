import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 300 // 5-minute edge cache

export type Scope = 'Global' | 'National' | 'Regional' | 'Local'
export type Category = 'Economics' | 'Politics' | 'Technology' | 'Science' | 'Ethics' | 'Philosophy' | 'Culture' | 'Health' | 'Environment' | 'Education' | 'Other'

export interface AtlasLaw {
  id: string
  statement: string
  category: string | null
  scope: string
  blue_pct: number | null
  total_votes: number | null
  established_at: string
  topic_id: string
}

export interface AtlasMatrix {
  /** matrix[scope][category] = count */
  matrix: Record<string, Record<string, number>>
  /** Total laws per scope */
  byScope: Record<string, number>
  /** Total laws per category */
  byCategory: Record<string, number>
  /** All laws enriched with scope */
  laws: AtlasLaw[]
  totals: {
    laws: number
    votes: number
  }
}

export async function GET() {
  const supabase = await createClient()

  // Join laws with topics to get the scope field
  const { data, error } = await supabase
    .from('laws')
    .select(
      `
      id,
      statement,
      category,
      blue_pct,
      total_votes,
      established_at,
      topic_id,
      topics!inner ( scope )
    `
    )
    .eq('is_active', true)
    .order('established_at', { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = data ?? []

  // Flatten topics.scope into each law row
  const laws: AtlasLaw[] = rows.map((r) => ({
    id: r.id as string,
    statement: r.statement as string,
    category: r.category as string | null,
    scope: normaliseScope((r.topics as unknown as { scope?: string })?.scope),
    blue_pct: r.blue_pct as number | null,
    total_votes: r.total_votes as number | null,
    established_at: r.established_at as string,
    topic_id: r.topic_id as string,
  }))

  // Build aggregation matrix
  const matrix: Record<string, Record<string, number>> = {}
  const byScope: Record<string, number> = {}
  const byCategory: Record<string, number> = {}
  let totalVotes = 0

  for (const law of laws) {
    const scope = law.scope
    const cat = normaliseCategory(law.category)

    // Matrix cell
    if (!matrix[scope]) matrix[scope] = {}
    matrix[scope][cat] = (matrix[scope][cat] ?? 0) + 1

    // Row/col totals
    byScope[scope] = (byScope[scope] ?? 0) + 1
    byCategory[cat] = (byCategory[cat] ?? 0) + 1

    totalVotes += law.total_votes ?? 0
  }

  return NextResponse.json({
    matrix,
    byScope,
    byCategory,
    laws,
    totals: { laws: laws.length, votes: totalVotes },
  } satisfies AtlasMatrix)
}

function normaliseScope(raw: string | undefined | null): string {
  if (!raw) return 'Global'
  // DB stores lowercase by convention ('global', 'national', 'regional', 'local')
  const map: Record<string, string> = {
    global: 'Global',
    national: 'National',
    regional: 'Regional',
    local: 'Local',
  }
  return map[raw.toLowerCase()] ?? 'Global'
}

function normaliseCategory(raw: string | null | undefined): string {
  if (!raw) return 'Other'
  // Match against known categories (case-insensitive)
  const known = [
    'Economics', 'Politics', 'Technology', 'Science',
    'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
  ]
  const found = known.find((c) => c.toLowerCase() === raw.toLowerCase())
  return found ?? 'Other'
}
