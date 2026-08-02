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

  // Fetch profile prefs and already-voted topic IDs in parallel
  const [profileRes, votedRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('category_preferences, total_votes')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('votes')
      .select('topic_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(500),
  ])

  const quizCategories: string[] =
    (profileRes.data?.category_preferences as string[] | null) ?? []
  const totalVotes = profileRes.data?.total_votes ?? 0

  // Collect IDs of topics already voted on — exclude these from results
  const votedTopicIds = (votedRes.data ?? []).map((r) => r.topic_id).filter(Boolean)

  let preferredCategories: string[] = quizCategories
  let preferenceSource: 'quiz' | 'history' | 'none' = 'quiz'

  // If no quiz preferences, infer top categories from vote history
  if (quizCategories.length === 0 && votedTopicIds.length > 0) {
    const { data: topicRows } = await supabase
      .from('topics')
      .select('id, category')
      .in('id', votedTopicIds.slice(0, 100))

    const counts: Record<string, number> = {}
    for (const t of topicRows ?? []) {
      if (t.category) counts[t.category] = (counts[t.category] ?? 0) + 1
    }

    preferredCategories = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([cat]) => cat)

    if (preferredCategories.length > 0) {
      preferenceSource = 'history'
    } else {
      preferenceSource = 'none'
    }
  } else if (quizCategories.length === 0) {
    preferenceSource = 'none'
  }

  // Build query: live topics, filtered by preferred categories, excluding voted ones
  let query = supabase
    .from('topics')
    .select('*, author:profiles!author_id(id, username, display_name, avatar_url, role)')
    .in('status', ['proposed', 'active', 'voting'])
    .range(offset, offset + limit - 1)

  if (preferredCategories.length > 0) {
    query = query.in('category', preferredCategories)
  }

  // Exclude already-voted topics — NOT IN up to 500 ids (UUIDs unquoted for PostgREST)
  if (votedTopicIds.length > 0) {
    query = query.not('id', 'in', `(${votedTopicIds.join(',')})`)
  }

  if (sort === 'new') {
    query = query.order('created_at', { ascending: false })
  } else if (sort === 'hot') {
    query = query
      .order('total_votes', { ascending: false })
      .order('created_at', { ascending: false })
  } else {
    query = query
      .order('feed_score', { ascending: false })
      .order('created_at', { ascending: false })
  }

  const { data, error } = await query

  if (error) {
    return NextResponse.json(
      { error: 'Failed to fetch unvoted feed' },
      { status: 500 }
    )
  }

  return NextResponse.json({
    topics: data ?? [],
    preferredCategories,
    preferenceSource,
    votedCount: totalVotes,
    remainingUnvoted: (data ?? []).length,
  })
}
