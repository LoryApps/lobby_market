import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface SenateArgument {
  id: string
  side: 'blue' | 'red'
  content: string
  upvotes: number
  author: {
    username: string
    display_name: string | null
    avatar_url: string | null
  } | null
}

export interface SenateTopic {
  id: string
  statement: string
  category: string | null
  blue_pct: number
  total_votes: number
  voting_ends_at: string | null
  feed_score: number
  top_for: SenateArgument | null
  top_against: SenateArgument | null
  user_vote: 'blue' | 'red' | null
}

export interface SenateResponse {
  topics: SenateTopic[]
  total: number
}

// ─── Module-level helpers ─────────────────────────────────────────────────────

type ArgRow = {
  id: string
  topic_id: string
  side: string
  content: string
  upvotes: number
  user_id: string
}

type ProfileRow = {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
}

/** Pick the first row per topic_id (rows must already be ordered by upvotes desc). */
function topPerTopic(rows: ArgRow[] | null): Map<string, ArgRow> {
  const map = new Map<string, ArgRow>()
  for (const row of rows ?? []) {
    if (!map.has(row.topic_id)) map.set(row.topic_id, row)
  }
  return map
}

function buildArg(
  raw: ArgRow | undefined,
  side: 'blue' | 'red',
  profileMap: Map<string, ProfileRow>
): SenateArgument | null {
  if (!raw) return null
  const author = profileMap.get(raw.user_id)
  return {
    id: raw.id,
    side,
    content: raw.content,
    upvotes: raw.upvotes,
    author: author
      ? { username: author.username, display_name: author.display_name, avatar_url: author.avatar_url }
      : null,
  }
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()

    const {
      data: { user },
    } = await supabase.auth.getUser()

    // All topics in voting phase, soonest deadline first
    const { data: topicRows, error: topicsErr } = await supabase
      .from('topics')
      .select('id, statement, category, blue_pct, total_votes, voting_ends_at, feed_score')
      .eq('status', 'voting')
      .order('voting_ends_at', { ascending: true, nullsFirst: false })
      .order('feed_score', { ascending: false })
      .limit(50)

    if (topicsErr) {
      return NextResponse.json({ error: 'Failed to load senate' }, { status: 500 })
    }

    const topics = topicRows ?? []
    if (topics.length === 0) {
      return NextResponse.json({ topics: [], total: 0 })
    }

    const topicIds = topics.map((t) => t.id)

    // Fetch top FOR and top AGAINST arguments (ordered by upvotes desc)
    const [{ data: forArgs }, { data: againstArgs }] = await Promise.all([
      supabase
        .from('topic_arguments')
        .select('id, topic_id, side, content, upvotes, user_id')
        .in('topic_id', topicIds)
        .eq('side', 'blue')
        .order('upvotes', { ascending: false }),
      supabase
        .from('topic_arguments')
        .select('id, topic_id, side, content, upvotes, user_id')
        .in('topic_id', topicIds)
        .eq('side', 'red')
        .order('upvotes', { ascending: false }),
    ])

    const topForMap = topPerTopic(forArgs as ArgRow[] | null)
    const topAgainstMap = topPerTopic(againstArgs as ArgRow[] | null)

    // Collect unique author IDs and fetch profiles
    const authorIds = new Set<string>()
    topForMap.forEach((arg) => authorIds.add(arg.user_id))
    topAgainstMap.forEach((arg) => authorIds.add(arg.user_id))

    const { data: profileRows } = authorIds.size > 0
      ? await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url')
          .in('id', Array.from(authorIds))
      : { data: [] as ProfileRow[] }

    const profileMap = new Map<string, ProfileRow>()
    for (const p of (profileRows ?? []) as ProfileRow[]) {
      profileMap.set(p.id, p)
    }

    // Fetch the authenticated user's existing votes on these topics
    const voteMap = new Map<string, 'blue' | 'red'>()
    if (user) {
      const { data: votes } = await supabase
        .from('votes')
        .select('topic_id, side')
        .eq('user_id', user.id)
        .in('topic_id', topicIds)

      for (const v of votes ?? []) {
        voteMap.set(v.topic_id, v.side as 'blue' | 'red')
      }
    }

    const result: SenateTopic[] = topics.map((t) => ({
      id: t.id,
      statement: t.statement,
      category: t.category,
      blue_pct: t.blue_pct,
      total_votes: t.total_votes,
      voting_ends_at: t.voting_ends_at,
      feed_score: t.feed_score,
      top_for: buildArg(topForMap.get(t.id), 'blue', profileMap),
      top_against: buildArg(topAgainstMap.get(t.id), 'red', profileMap),
      user_vote: voteMap.get(t.id) ?? null,
    }))

    return NextResponse.json({ topics: result, total: result.length })
  } catch (err) {
    console.error('[senate]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
