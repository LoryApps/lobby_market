import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10))
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50)
  const sort = searchParams.get('sort') || 'top'
  const status = searchParams.get('status') || null

  const supabase = await createClient()

  let query = supabase
    .from('topics')
    .select('*')
    .range(offset, offset + limit - 1)

  // Status filter — default shows all live statuses
  if (status) {
    query = query.eq('status', status as 'proposed' | 'active' | 'voting' | 'law' | 'failed' | 'archived' | 'continued')
  } else {
    query = query.in('status', ['proposed', 'active', 'voting', 'law'])
  }

  // Sort order
  if (sort === 'new') {
    query = query.order('created_at', { ascending: false })
  } else if (sort === 'hot') {
    query = query
      .order('total_votes', { ascending: false })
      .order('created_at', { ascending: false })
  } else {
    // top (default) — by feed_score
    query = query
      .order('feed_score', { ascending: false })
      .order('created_at', { ascending: false })
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json(
      { error: 'Failed to fetch feed' },
      { status: 500 }
    )
  }

  return NextResponse.json(data ?? [])
}
