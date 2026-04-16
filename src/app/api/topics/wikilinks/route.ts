import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/topics/wikilinks?q=<query>&exclude=<topicId>
 *
 * Returns up to 8 topics matching the query — used for [[wikilink]] autocomplete
 * in the topic wiki editor.  Searches statement via full-text first, falls back
 * to ILIKE.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim() ?? ''
  const exclude = searchParams.get('exclude') ?? ''

  if (q.length < 1) {
    return NextResponse.json({ results: [] })
  }

  const supabase = await createClient()
  const pattern = `%${q}%`

  // Try full-text search first
  const { data: ftsData, error: ftsError } = await supabase
    .from('topics')
    .select('id, statement, status, category')
    .textSearch('fts', q, { type: 'websearch', config: 'english' })
    .in('status', ['active', 'voting', 'law', 'proposed'])
    .neq('id', exclude || '00000000-0000-0000-0000-000000000000')
    .order('feed_score', { ascending: false })
    .limit(8)

  if (!ftsError && ftsData && ftsData.length > 0) {
    return NextResponse.json({ results: ftsData })
  }

  // Fall back to ILIKE
  const { data, error } = await supabase
    .from('topics')
    .select('id, statement, status, category')
    .ilike('statement', pattern)
    .in('status', ['active', 'voting', 'law', 'proposed'])
    .neq('id', exclude || '00000000-0000-0000-0000-000000000000')
    .order('feed_score', { ascending: false })
    .limit(8)

  if (error) {
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }

  return NextResponse.json({ results: data ?? [] })
}
