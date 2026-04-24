import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TimelineArgument {
  id: string
  side: 'blue' | 'red'
  content: string
  upvotes: number
  created_at: string
  author: {
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

export interface ArgumentBucket {
  date: string     // YYYY-MM-DD
  for_count: number
  against_count: number
  total: number
}

export interface TimelineMilestone {
  type: 'proposed' | 'activated' | 'voting' | 'law' | 'failed' | 'voting_ends'
  label: string
  date: string
  description: string
}

export interface TopicTimelineData {
  topic: {
    id: string
    statement: string
    category: string | null
    scope: string
    status: string
    blue_pct: number
    total_votes: number
    support_count: number
    activation_threshold: number
    voting_ends_at: string | null
    created_at: string
    updated_at: string
  }
  milestones: TimelineMilestone[]
  argument_buckets: ArgumentBucket[]
  top_for: TimelineArgument[]
  top_against: TimelineArgument[]
  total_arguments: number
  debate_days: number
}

/**
 * GET /api/topics/[id]/timeline
 *
 * Returns the full history narrative for a topic:
 *   - Status milestones (created, activated, voting, resolved)
 *   - Argument activity bucketed by day
 *   - Top FOR and AGAINST arguments
 */
export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  // ── Fetch topic ────────────────────────────────────────────────────────────
  type TopicRow = {
    id: string
    statement: string
    category: string | null
    scope: string
    status: string
    blue_pct: number
    total_votes: number
    support_count: number
    activation_threshold: number
    voting_ends_at: string | null
    created_at: string
    updated_at: string
  }

  const { data: rawTopic, error: topicErr } = await supabase
    .from('topics')
    .select(
      'id, statement, category, scope, status, blue_pct, total_votes, ' +
      'support_count, activation_threshold, voting_ends_at, created_at, updated_at'
    )
    .eq('id', params.id)
    .single()

  if (topicErr || !rawTopic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }
  const topic = rawTopic as unknown as TopicRow

  // ── Fetch all arguments ────────────────────────────────────────────────────
  const { data: argRows } = await supabase
    .from('topic_arguments')
    .select(
      'id, side, content, upvotes, created_at, ' +
      'profiles!topic_arguments_user_id_fkey(username, display_name, avatar_url, role)'
    )
    .eq('topic_id', params.id)
    .order('created_at', { ascending: true })
    .limit(500)

  type ArgRow = {
    id: string
    side: 'blue' | 'red'
    content: string
    upvotes: number
    created_at: string
    profiles: { username: string; display_name: string | null; avatar_url: string | null; role: string } | null
  }
  const args = (argRows ?? []) as unknown as ArgRow[]

  // ── Build argument buckets by date ────────────────────────────────────────
  const bucketMap = new Map<string, ArgumentBucket>()
  for (const arg of args) {
    const date = arg.created_at.slice(0, 10) // YYYY-MM-DD
    const bucket = bucketMap.get(date) ?? { date, for_count: 0, against_count: 0, total: 0 }
    if (arg.side === 'blue') bucket.for_count++
    else bucket.against_count++
    bucket.total++
    bucketMap.set(date, bucket)
  }
  const argument_buckets = Array.from(bucketMap.values()).sort((a, b) =>
    a.date.localeCompare(b.date)
  )

  // ── Top FOR / AGAINST (by upvotes, then recency) ───────────────────────────
  const forArgs = [...args].filter((a) => a.side === 'blue').sort((a, b) => b.upvotes - a.upvotes)
  const againstArgs = [...args].filter((a) => a.side === 'red').sort((a, b) => b.upvotes - a.upvotes)

  function toTimelineArg(a: (typeof args)[number]): TimelineArgument {
    return {
      id: a.id,
      side: a.side,
      content: a.content,
      upvotes: a.upvotes,
      created_at: a.created_at,
      author: a.profiles
        ? {
            username: a.profiles.username,
            display_name: a.profiles.display_name,
            avatar_url: a.profiles.avatar_url,
            role: a.profiles.role,
          }
        : null,
    }
  }

  // ── Build status milestones ────────────────────────────────────────────────
  const milestones: TimelineMilestone[] = []

  milestones.push({
    type: 'proposed',
    label: 'Proposed',
    date: topic.created_at,
    description: 'Topic submitted to the Lobby for community review',
  })

  // Infer "activated" date from when first argument was posted (proxy for activation)
  // or from when the status changed. Since we don't store activation timestamp, we
  // estimate it as either the first argument date or the topic's updated_at if active.
  if (topic.status !== 'proposed') {
    const firstArgDate = args.length > 0 ? args[0].created_at : null
    const activationDate = firstArgDate ?? topic.updated_at

    if (activationDate && activationDate !== topic.created_at) {
      milestones.push({
        type: 'activated',
        label: 'Activated',
        date: activationDate,
        description: `Reached ${topic.activation_threshold} supports and entered active debate`,
      })
    }
  }

  if (topic.status === 'voting' || topic.status === 'law' || topic.status === 'failed') {
    // Voting started — estimate from voting_ends_at - voting_duration if available
    if (topic.voting_ends_at) {
      milestones.push({
        type: 'voting',
        label: 'Voting Phase',
        date: topic.voting_ends_at, // we'll show end date; start is unknown
        description: 'Community entered the final voting phase',
      })
    }
  }

  if (topic.status === 'law') {
    milestones.push({
      type: 'law',
      label: 'Established as Law',
      date: topic.updated_at,
      description: `Passed with ${Math.round(topic.blue_pct)}% majority and became community law`,
    })
  }

  if (topic.status === 'failed') {
    milestones.push({
      type: 'failed',
      label: 'Failed',
      date: topic.updated_at,
      description: `Did not reach the required supermajority — ${Math.round(topic.blue_pct)}% voted FOR`,
    })
  }

  if (topic.status === 'voting' && topic.voting_ends_at) {
    const endsAt = new Date(topic.voting_ends_at)
    if (endsAt > new Date()) {
      milestones.push({
        type: 'voting_ends',
        label: 'Voting Closes',
        date: topic.voting_ends_at,
        description: 'Final deadline for community votes',
      })
    }
  }

  // Sort milestones chronologically
  milestones.sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())

  // ── Compute debate duration ────────────────────────────────────────────────
  const startMs = new Date(topic.created_at).getTime()
  const endMs =
    topic.status === 'law' || topic.status === 'failed'
      ? new Date(topic.updated_at).getTime()
      : Date.now()
  const debate_days = Math.max(1, Math.ceil((endMs - startMs) / (1000 * 60 * 60 * 24)))

  return NextResponse.json({
    topic,
    milestones,
    argument_buckets,
    top_for: forArgs.slice(0, 5).map(toTimelineArg),
    top_against: againstArgs.slice(0, 5).map(toTimelineArg),
    total_arguments: args.length,
    debate_days,
  } satisfies TopicTimelineData)
}
