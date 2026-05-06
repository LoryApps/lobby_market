import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/laws/search?q=<query>&limit=<n>
 *
 * Full-text search on established laws. Falls back to ILIKE if FTS returns
 * no results. Returns id, statement, full_statement, category, blue_pct,
 * total_votes, established_at, is_active.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim() ?? ''
  const limit = Math.min(Number(searchParams.get('limit') ?? '8'), 20)

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] })
  }

  const supabase = await createClient()
  const fields = 'id, statement, full_statement, category, blue_pct, total_votes, established_at, is_active'

  // Try FTS first
  const { data: ftsData, error: ftsError } = await supabase
    .from('laws')
    .select(fields)
    .textSearch('statement', q, { type: 'websearch', config: 'english' })
    .order('total_votes', { ascending: false })
    .limit(limit)

  if (!ftsError && ftsData && ftsData.length > 0) {
    return NextResponse.json({ results: ftsData })
  }

  // Fallback to ILIKE
  const { data: likeData } = await supabase
    .from('laws')
    .select(fields)
    .ilike('statement', `%${q}%`)
    .order('total_votes', { ascending: false })
    .limit(limit)

  return NextResponse.json({ results: likeData ?? [] })
}
