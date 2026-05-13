import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface MatchupArgument {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  source_url: string | null
  ai_score: number | null
  ai_grade: string | null
  created_at: string
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

export interface MatchupResponse {
  argA: MatchupArgument
  argB: MatchupArgument
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number | null
  }
  remaining: number
}

// GET /api/faceoffs/matchup?topicId=xxx
// Returns a pair of arguments from a topic that the user hasn't seen in a faceoff.
// Returns 404 when no unseen pairs remain.
export async function GET(req: NextRequest) {
  const supabase = await createClient()

  const topicId = req.nextUrl.searchParams.get('topicId')
  if (!topicId) return NextResponse.json({ error: 'topicId required' }, { status: 400 })

  const { data: { user } } = await supabase.auth.getUser()

  // Fetch topic
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct')
    .eq('id', topicId)
    .maybeSingle()

  if (!topic) return NextResponse.json({ error: 'Topic not found' }, { status: 404 })

  // Fetch all arguments for this topic
  const { data: allArgs } = await supabase
    .from('topic_arguments')
    .select('id, content, side, upvotes, source_url, ai_score, ai_grade, created_at, user_id')
    .eq('topic_id', topicId)
    .order('upvotes', { ascending: false })

  const args = allArgs ?? []
  if (args.length < 2) {
    return NextResponse.json({ error: 'Not enough arguments for a faceoff' }, { status: 404 })
  }

  // Find pairs this user has already voted on
  const seenPairs = new Set<string>()
  if (user) {
    const { data: votes } = await supabase
      .from('argument_faceoff_votes')
      .select('argument_a_id, argument_b_id')
      .eq('user_id', user.id)

    for (const v of votes ?? []) {
      // Canonical key: sorted UUIDs joined
      const key = [v.argument_a_id, v.argument_b_id].sort().join('|')
      seenPairs.add(key)
    }
  }

  // Build list of unseen pairs. We try combinations of for vs against first
  // (cross-side matchups are most interesting), then same-side pairs.
  const blueArgs = args.filter((a) => a.side === 'blue')
  const redArgs = args.filter((a) => a.side === 'red')

  // Generate candidate pairs: cross-side first, then same-side
  const candidates: [typeof args[0], typeof args[0]][] = []

  for (const b of blueArgs) {
    for (const r of redArgs) {
      const key = [b.id, r.id].sort().join('|')
      if (!seenPairs.has(key)) {
        candidates.push([b, r])
      }
    }
  }

  // If cross-side exhausted, try same-side pairings
  if (candidates.length === 0) {
    for (let i = 0; i < args.length; i++) {
      for (let j = i + 1; j < args.length; j++) {
        const key = [args[i].id, args[j].id].sort().join('|')
        if (!seenPairs.has(key)) {
          candidates.push([args[i], args[j]])
        }
      }
    }
  }

  if (candidates.length === 0) {
    return NextResponse.json({ error: 'No more unseen matchups for this topic' }, { status: 404 })
  }

  // Pick a random candidate from the first few to avoid always serving the same one
  const pool = candidates.slice(0, Math.min(candidates.length, 10))
  const [rawA, rawB] = pool[Math.floor(Math.random() * pool.length)]

  // Batch-fetch authors
  const userIds = [...new Set([rawA.user_id, rawB.user_id])]
  const { data: profiles } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role')
    .in('id', userIds)

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))

  function enrich(a: typeof args[0]): MatchupArgument {
    return {
      id: a.id,
      content: a.content,
      side: a.side,
      upvotes: a.upvotes,
      source_url: a.source_url,
      ai_score: a.ai_score,
      ai_grade: a.ai_grade,
      created_at: a.created_at,
      author: profileMap.get(a.user_id) ?? null,
    }
  }

  return NextResponse.json({
    argA: enrich(rawA),
    argB: enrich(rawB),
    topic,
    remaining: candidates.length - 1,
  } satisfies MatchupResponse)
}
