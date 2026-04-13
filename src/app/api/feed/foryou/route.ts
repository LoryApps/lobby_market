import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const offset = Math.max(0, parseInt(searchParams.get('offset') || '0', 10))
  const limit = Math.min(parseInt(searchParams.get('limit') || '20', 10), 50)
  const sort = searchParams.get('sort') || 'top'

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch user's category preferences from their profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('category_preferences')
    .eq('id', user.id)
    .maybeSingle()

  const preferredCategories: string[] =
    (profile?.category_preferences as string[] | null) ?? []

  // If user hasn't completed onboarding quiz, signal that to the client
  if (preferredCategories.length === 0) {
    return NextResponse.json({
      topics: [],
      preferredCategories: [],
      hasPreferences: false,
    })
  }

  // Build query filtered to the user's preferred categories
  let query = supabase
    .from('topics')
    .select('*')
    .in('status', ['proposed', 'active', 'voting', 'law'])
    .in('category', preferredCategories)
    .range(offset, offset + limit - 1)

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
      { error: 'Failed to fetch personalized feed' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    topics: data ?? [],
    preferredCategories,
    hasPreferences: true,
  })
}
