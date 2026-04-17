import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

/**
 * GET /api/users/suggest?q=<username_prefix>&limit=<n>
 *
 * Returns profiles whose usernames start with the given prefix (case-insensitive).
 * Used by the @mention autocomplete in the argument and reply composers.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim().toLowerCase() ?? ''
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '8', 10), 20)

  if (!q || q.length < 1) {
    return NextResponse.json({ results: [] })
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role')
    .ilike('username', `${q}%`)
    .order('clout', { ascending: false })
    .limit(limit)

  if (error) {
    return NextResponse.json({ error: 'Search failed' }, { status: 500 })
  }

  return NextResponse.json({ results: data ?? [] })
}
