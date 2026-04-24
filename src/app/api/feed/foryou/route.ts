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

  // Fetch profile prefs and vote count in parallel
  const [profileRes, voteCountRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('category_preferences, total_votes')
      .eq('id', user.id)
      .maybeSingle(),
    supabase
      .from('votes')
      .select('id', { count: 'exact', head: true })
      .eq('user_id', user.id),
  ])

  const quizCategories: string[] =
    (profileRes.data?.category_preferences as string[] | null) ?? []
  const totalVotes = voteCountRes.count ?? 0

  let preferredCategories: string[] = quizCategories
  let preferenceSource: 'quiz' | 'history' | 'none' = 'quiz'
  let inferredFromVotes = 0

  // If the user hasn't taken the quiz, infer categories from their vote history
  if (quizCategories.length === 0) {
    if (totalVotes === 0) {
      return NextResponse.json({
        topics: [],
        preferredCategories: [],
        hasPreferences: false,
        preferenceSource: 'none' as const,
        inferredFromVotes: 0,
      })
    }

    // Fetch recent vote topic IDs, then look up their categories
    const { data: voteRows } = await supabase
      .from('votes')
      .select('topic_id')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(100)

    const topicIds = (voteRows ?? []).map((r) => r.topic_id).filter(Boolean)

    const counts: Record<string, number> = {}

    if (topicIds.length > 0) {
      const { data: topicRows } = await supabase
        .from('topics')
        .select('id, category')
        .in('id', topicIds)

      // Build a lookup map for O(1) access
      const catById: Record<string, string | null> = {}
      for (const t of topicRows ?? []) {
        catById[t.id] = t.category
      }

      for (const { topic_id } of voteRows ?? []) {
        const cat = catById[topic_id]
        if (cat) counts[cat] = (counts[cat] ?? 0) + 1
      }
    }

    const inferred = Object.entries(counts)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([cat]) => cat)

    if (inferred.length === 0) {
      return NextResponse.json({
        topics: [],
        preferredCategories: [],
        hasPreferences: false,
        preferenceSource: 'none' as const,
        inferredFromVotes: totalVotes,
      })
    }

    preferredCategories = inferred
    preferenceSource = 'history'
    inferredFromVotes = Math.min(totalVotes, 100)
  }

  // Build query filtered to the user's preferred categories
  let query = supabase
    .from('topics')
    .select('*, author:profiles!author_id(id, username, display_name, avatar_url, role)')
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
    preferenceSource,
    inferredFromVotes,
  })
}
