import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/topics/random
 *
 * Returns a single random topic the current user hasn't voted on yet.
 * Guest users get any random active/proposed topic.
 *
 * Query params:
 *   exclude  – comma-separated topic IDs to skip (session-side dedup)
 *   category – filter by a single category name (optional)
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const excludeParam = searchParams.get('exclude') ?? ''
  const category = searchParams.get('category') ?? ''

  const excludeIds = excludeParam
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)

  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Fetch a pool of candidates — ORDER BY RANDOM() isn't natively supported
  // in PostgREST, so we pull a wider set and pick one client-side.
  let query = supabase
    .from('topics')
    .select('id, statement, description, category, status, blue_pct, total_votes, blue_votes, red_votes, scope, created_at')
    .in('status', ['proposed', 'active', 'voting'])
    .order('feed_score', { ascending: false })
    .limit(200)

  if (category) {
    query = query.ilike('category', category)
  }

  const { data: candidates, error } = await query

  if (error || !candidates || candidates.length === 0) {
    return NextResponse.json({ topic: null })
  }

  // Filter out already-excluded (session-seen) topics
  let pool = candidates.filter((t) => !excludeIds.includes(t.id))

  // For authenticated users: also filter out already-voted topics
  if (user && pool.length > 0) {
    const topicIds = pool.map((t) => t.id)
    const { data: existingVotes } = await supabase
      .from('votes')
      .select('topic_id')
      .eq('user_id', user.id)
      .in('topic_id', topicIds)

    if (existingVotes && existingVotes.length > 0) {
      const votedSet = new Set(existingVotes.map((v) => v.topic_id))
      pool = pool.filter((t) => !votedSet.has(t.id))
    }
  }

  if (pool.length === 0) {
    return NextResponse.json({ topic: null, exhausted: true })
  }

  // Pick a random topic from the filtered pool
  const topic = pool[Math.floor(Math.random() * pool.length)]

  return NextResponse.json({ topic })
}
