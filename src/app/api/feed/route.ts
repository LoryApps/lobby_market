import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const cursor = searchParams.get('cursor')
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50)

  const supabase = await createClient()

  let query = supabase
    .from('topics')
    .select('*')
    .in('status', ['proposed', 'active', 'voting', 'law'])
    .order('feed_score', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(limit)

  if (cursor) {
    query = query.lt('feed_score', parseFloat(cursor))
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
