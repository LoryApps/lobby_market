import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface CompareTopic {
  id: string
  statement: string
  description: string | null
  category: string | null
  scope: string
  status: string
  blue_votes: number
  red_votes: number
  total_votes: number
  blue_pct: number
  support_count: number
  feed_score: number
  view_count: number
  created_at: string
  tags: string[]
  argument_count: number
  debate_count: number
}

export interface TopicCompareResponse {
  primary: CompareTopic
  secondary: CompareTopic
  same_category: boolean
  vote_delta: number
  shared_tags: string[]
  user_voted_both: boolean
}

interface Props {
  params: { id: string }
}

const TOPIC_FIELDS =
  'id, statement, description, category, scope, status, blue_votes, red_votes, total_votes, blue_pct, support_count, feed_score, view_count, created_at, tags'

export async function GET(req: Request, { params }: Props) {
  const supabase = await createClient()

  const url = new URL(req.url)
  const secondaryId = url.searchParams.get('with')

  if (!secondaryId) {
    return NextResponse.json({ error: 'Missing ?with= parameter' }, { status: 400 })
  }

  if (secondaryId === params.id) {
    return NextResponse.json({ error: 'Cannot compare a topic with itself' }, { status: 400 })
  }

  const [primaryRes, secondaryRes, { data: { user } }] = await Promise.all([
    supabase.from('topics').select(TOPIC_FIELDS).eq('id', params.id).maybeSingle(),
    supabase.from('topics').select(TOPIC_FIELDS).eq('id', secondaryId).maybeSingle(),
    supabase.auth.getUser(),
  ])

  if (!primaryRes.data) {
    return NextResponse.json({ error: 'Primary topic not found' }, { status: 404 })
  }
  if (!secondaryRes.data) {
    return NextResponse.json({ error: 'Secondary topic not found' }, { status: 404 })
  }

  const ids = [params.id, secondaryId]

  const [argCountsRes, debateCountsRes, userVotesRes] = await Promise.all([
    supabase
      .from('arguments')
      .select('topic_id')
      .in('topic_id', ids),
    supabase
      .from('debates')
      .select('topic_id')
      .in('topic_id', ids),
    user
      ? supabase
          .from('votes')
          .select('topic_id')
          .eq('user_id', user.id)
          .in('topic_id', ids)
      : Promise.resolve({ data: [] }),
  ])

  const argCounts: Record<string, number> = {}
  const debateCounts: Record<string, number> = {}

  for (const id of ids) {
    argCounts[id] = (argCountsRes.data ?? []).filter((r) => r.topic_id === id).length
    debateCounts[id] = (debateCountsRes.data ?? []).filter((r) => r.topic_id === id).length
  }

  const userVotedIds = new Set((userVotesRes.data ?? []).map((r) => r.topic_id))

  const primaryTags: string[] = primaryRes.data.tags ?? []
  const secondaryTags: string[] = secondaryRes.data.tags ?? []
  const sharedTags = primaryTags.filter((t) => secondaryTags.includes(t))

  const primary: CompareTopic = {
    ...primaryRes.data,
    argument_count: argCounts[params.id] ?? 0,
    debate_count: debateCounts[params.id] ?? 0,
  }

  const secondary: CompareTopic = {
    ...secondaryRes.data,
    argument_count: argCounts[secondaryId] ?? 0,
    debate_count: debateCounts[secondaryId] ?? 0,
  }

  const response: TopicCompareResponse = {
    primary,
    secondary,
    same_category: !!primary.category && primary.category === secondary.category,
    vote_delta: Math.abs(primary.blue_pct - secondary.blue_pct),
    shared_tags: sharedTags,
    user_voted_both: userVotedIds.has(params.id) && userVotedIds.has(secondaryId),
  }

  return NextResponse.json(response)
}
