import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// Minimum overlapping topics to return a meaningful score.
const MIN_COMMON = 3
// Cap votes fetched per user to keep query time bounded.
const MY_VOTE_LIMIT = 200
const THEIR_VOTE_LIMIT = 200

export interface AlignmentResponse {
  /** Agreement percentage (0–100), or null if insufficient overlap. */
  agreement_pct: number | null
  /** Number of topics both users have voted on. */
  common_topics: number
  /** Whether the viewer has cast enough votes to compute a score. */
  viewer_has_votes: boolean
}

/**
 * GET /api/analytics/alignment?target_id=<uuid>
 *
 * Returns how closely the logged-in viewer's votes agree with the target
 * user's votes.  Only topics where BOTH users have voted are compared.
 * Returns null for agreement_pct when overlap < MIN_COMMON so we don't
 * show misleading percentages based on 1–2 shared topics.
 */
export async function GET(request: NextRequest) {
  const targetId = request.nextUrl.searchParams.get('target_id')
  if (!targetId || !/^[0-9a-f-]{36}$/i.test(targetId)) {
    return NextResponse.json({ error: 'Invalid target_id' }, { status: 400 })
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  if (user.id === targetId) {
    // Comparing yourself to yourself — trivially 100 %.
    return NextResponse.json({
      agreement_pct: 100,
      common_topics: 0,
      viewer_has_votes: true,
    } satisfies AlignmentResponse)
  }

  // Fetch both users' votes in parallel.
  const [myRes, theirRes] = await Promise.all([
    supabase
      .from('votes')
      .select('topic_id, side')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false })
      .limit(MY_VOTE_LIMIT),
    supabase
      .from('votes')
      .select('topic_id, side')
      .eq('user_id', targetId)
      .order('created_at', { ascending: false })
      .limit(THEIR_VOTE_LIMIT),
  ])

  const myVotes = myRes.data ?? []
  const theirVotes = theirRes.data ?? []

  if (myVotes.length === 0) {
    return NextResponse.json({
      agreement_pct: null,
      common_topics: 0,
      viewer_has_votes: false,
    } satisfies AlignmentResponse)
  }

  // Build lookup maps.
  const myMap = new Map<string, string>(myVotes.map((v) => [v.topic_id, v.side]))
  const theirMap = new Map<string, string>(theirVotes.map((v) => [v.topic_id, v.side]))

  // Find shared topics and count agreements.
  let common = 0
  let agree = 0
  myMap.forEach((mySide, topicId) => {
    const theirSide = theirMap.get(topicId)
    if (theirSide === undefined) return
    common++
    if (theirSide === mySide) agree++
  })

  if (common < MIN_COMMON) {
    return NextResponse.json({
      agreement_pct: null,
      common_topics: common,
      viewer_has_votes: true,
    } satisfies AlignmentResponse)
  }

  const agreement_pct = Math.round((agree / common) * 100)

  return NextResponse.json({
    agreement_pct,
    common_topics: common,
    viewer_has_votes: true,
  } satisfies AlignmentResponse)
}
