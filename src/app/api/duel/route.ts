import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DuelArgument {
  id: string
  topic_id: string
  side: 'blue' | 'red'
  content: string
  upvotes: number
  created_at: string
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

export interface DuelTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
}

export interface DuelResponse {
  topic: DuelTopic
  forArgument: DuelArgument
  againstArgument: DuelArgument
  duelIndex: number
  totalDuels: number
}

export const dynamic = 'force-dynamic'

// GET /api/duel?index=0
// Returns a matched FOR/AGAINST argument pair from hot topics.
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const indexParam = searchParams.get('index')
  const requestedIndex = indexParam !== null ? parseInt(indexParam, 10) : null

  try {
    const supabase = await createClient()

    // Step 1: Find topics with both a FOR and AGAINST argument
    // Get topics that are active or voting with decent vote counts
    const { data: topics } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .in('status', ['active', 'voting', 'proposed', 'law'])
      .order('total_votes', { ascending: false })
      .limit(200)

    if (!topics || topics.length === 0) {
      return NextResponse.json({ error: 'No topics available' }, { status: 404 })
    }

    const topicIds = topics.map((t) => t.id)

    // Step 2: Fetch all arguments for these topics
    const { data: allArgs } = await supabase
      .from('topic_arguments')
      .select('id, topic_id, user_id, side, content, upvotes, created_at')
      .in('topic_id', topicIds)
      .gte('upvotes', 0)
      .order('upvotes', { ascending: false })

    if (!allArgs || allArgs.length === 0) {
      return NextResponse.json({ error: 'No arguments available' }, { status: 404 })
    }

    // Step 3: Group by topic, find topics with both sides
    const byTopic: Record<string, { blue: typeof allArgs; red: typeof allArgs }> = {}
    for (const arg of allArgs) {
      if (!byTopic[arg.topic_id]) byTopic[arg.topic_id] = { blue: [], red: [] }
      if (arg.side === 'blue') byTopic[arg.topic_id].blue.push(arg)
      else byTopic[arg.topic_id].red.push(arg)
    }

    // Eligible: topic has at least 1 FOR and 1 AGAINST argument
    const eligibleTopicIds = Object.entries(byTopic)
      .filter(([, { blue, red }]) => blue.length > 0 && red.length > 0)
      .map(([id]) => id)

    if (eligibleTopicIds.length === 0) {
      return NextResponse.json({ error: 'No matched duels available' }, { status: 404 })
    }

    // Step 4: Select topic by index, wrapping around
    const totalDuels = eligibleTopicIds.length
    const duelIndex =
      requestedIndex !== null && !Number.isNaN(requestedIndex)
        ? ((requestedIndex % totalDuels) + totalDuels) % totalDuels
        : Math.floor(Math.random() * totalDuels)

    const chosenTopicId = eligibleTopicIds[duelIndex]
    const chosenTopic = topics.find((t) => t.id === chosenTopicId)!

    // Step 5: Pick top argument from each side (highest upvotes)
    const topFor = byTopic[chosenTopicId].blue.reduce((a, b) =>
      b.upvotes > a.upvotes ? b : a
    )
    const topAgainst = byTopic[chosenTopicId].red.reduce((a, b) =>
      b.upvotes > a.upvotes ? b : a
    )

    // Step 6: Fetch author profiles in parallel
    const authorIds = Array.from(new Set([topFor.user_id, topAgainst.user_id]))
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .in('id', authorIds)

    const profileMap = new Map(profiles?.map((p) => [p.id, p]) ?? [])

    const toArg = (raw: (typeof allArgs)[number]): DuelArgument => ({
      id: raw.id,
      topic_id: raw.topic_id,
      side: raw.side as 'blue' | 'red',
      content: raw.content,
      upvotes: raw.upvotes,
      created_at: raw.created_at,
      author: profileMap.get(raw.user_id) ?? null,
    })

    const response: DuelResponse = {
      topic: {
        id: chosenTopic.id,
        statement: chosenTopic.statement,
        category: chosenTopic.category,
        status: chosenTopic.status,
        blue_pct: chosenTopic.blue_pct,
        total_votes: chosenTopic.total_votes,
      },
      forArgument: toArg(topFor),
      againstArgument: toArg(topAgainst),
      duelIndex,
      totalDuels,
    }

    return NextResponse.json(response, {
      headers: { 'Cache-Control': 'no-store' },
    })
  } catch (err) {
    console.error('[/api/duel]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
