import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ProfileSnippet {
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
}

export interface HighlightArgument {
  id: string
  content: string
  upvotes: number
  ai_grade: string | null
  reply_count: number
  created_at: string
  author: ProfileSnippet | null
}

export interface HighlightVote {
  side: 'blue' | 'red'
  reason: string
  created_at: string
  author: ProfileSnippet | null
}

export interface HighlightFirstVoter {
  side: 'blue' | 'red'
  created_at: string
  author: ProfileSnippet | null
}

export interface LawHighlightsResponse {
  law: {
    id: string
    statement: string
    category: string | null
    established_at: string
    blue_pct: number
    total_votes: number
    topic_id: string
    topic_created_at: string
    days_to_pass: number
  }
  founding_argument: HighlightArgument | null
  strongest_opposition: HighlightArgument | null
  first_vote: HighlightFirstVoter | null
  notable_for_take: HighlightVote | null
  notable_against_take: HighlightVote | null
  stats: {
    for_arguments: number
    against_arguments: number
    total_arguments: number
    for_votes: number
    against_votes: number
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } },
) {
  const supabase = await createClient()
  const lawId = params.id

  const { data: law } = await supabase
    .from('laws')
    .select('id, statement, category, established_at, blue_pct, total_votes, topic_id')
    .eq('id', lawId)
    .maybeSingle()

  if (!law) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  const topicId = law.topic_id

  // Fetch topic created_at for days_to_pass calculation
  const { data: topicMeta } = await supabase
    .from('topics')
    .select('created_at, blue_votes, red_votes')
    .eq('id', topicId)
    .maybeSingle()

  // Run independent queries in parallel
  const [
    topForResult,
    topAgainstResult,
    firstVoteResult,
    recentForTakesResult,
    recentAgainstTakesResult,
    forArgCountResult,
    againstArgCountResult,
  ] = await Promise.all([
    supabase
      .from('topic_arguments')
      .select('id, content, upvotes, ai_grade, created_at, user_id')
      .eq('topic_id', topicId)
      .eq('side', 'blue')
      .order('upvotes', { ascending: false })
      .limit(1),

    supabase
      .from('topic_arguments')
      .select('id, content, upvotes, ai_grade, created_at, user_id')
      .eq('topic_id', topicId)
      .eq('side', 'red')
      .order('upvotes', { ascending: false })
      .limit(1),

    supabase
      .from('votes')
      .select('side, created_at, user_id')
      .eq('topic_id', topicId)
      .order('created_at', { ascending: true })
      .limit(1),

    supabase
      .from('votes')
      .select('reason, created_at, user_id')
      .eq('topic_id', topicId)
      .eq('side', 'blue')
      .not('reason', 'is', null)
      .order('created_at', { ascending: false })
      .limit(30),

    supabase
      .from('votes')
      .select('reason, created_at, user_id')
      .eq('topic_id', topicId)
      .eq('side', 'red')
      .not('reason', 'is', null)
      .order('created_at', { ascending: false })
      .limit(30),

    supabase
      .from('topic_arguments')
      .select('*', { count: 'exact', head: true })
      .eq('topic_id', topicId)
      .eq('side', 'blue'),

    supabase
      .from('topic_arguments')
      .select('*', { count: 'exact', head: true })
      .eq('topic_id', topicId)
      .eq('side', 'red'),
  ])

  const topFor = topForResult.data?.[0] ?? null
  const topAgainst = topAgainstResult.data?.[0] ?? null
  const firstVote = firstVoteResult.data?.[0] ?? null

  const pickBestTake = (takes: Array<{ reason: string | null; created_at: string; user_id: string }> | null) =>
    (takes ?? [])
      .filter((v) => v.reason && v.reason.trim().length >= 30)
      .sort((a, b) => (b.reason?.length ?? 0) - (a.reason?.length ?? 0))[0] ?? null

  const notableFor = pickBestTake(recentForTakesResult.data as Array<{ reason: string | null; created_at: string; user_id: string }> | null)
  const notableAgainst = pickBestTake(recentAgainstTakesResult.data as Array<{ reason: string | null; created_at: string; user_id: string }> | null)

  // Collect all user IDs for batch profile fetch
  const userIds = new Set<string>()
  if (topFor?.user_id) userIds.add(topFor.user_id)
  if (topAgainst?.user_id) userIds.add(topAgainst.user_id)
  if (firstVote?.user_id) userIds.add(firstVote.user_id)
  if (notableFor?.user_id) userIds.add(notableFor.user_id)
  if (notableAgainst?.user_id) userIds.add(notableAgainst.user_id)

  const profileMap: Record<string, ProfileSnippet> = {}
  if (userIds.size > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .in('id', Array.from(userIds))
    for (const p of profiles ?? []) {
      profileMap[p.id] = {
        username: p.username,
        display_name: p.display_name,
        avatar_url: p.avatar_url,
        role: p.role,
      }
    }
  }

  // Reply counts for top arguments
  const argIds = [topFor?.id, topAgainst?.id].filter(Boolean) as string[]
  const replyCountMap: Record<string, number> = {}
  if (argIds.length > 0) {
    const { data: replies } = await supabase
      .from('argument_replies')
      .select('argument_id')
      .in('argument_id', argIds)
    for (const r of replies ?? []) {
      replyCountMap[r.argument_id] = (replyCountMap[r.argument_id] ?? 0) + 1
    }
  }

  const topicCreatedAt = topicMeta?.created_at ?? law.established_at
  const daysToPass = Math.max(
    1,
    Math.round(
      (new Date(law.established_at).getTime() - new Date(topicCreatedAt).getTime()) /
      (1000 * 60 * 60 * 24),
    ),
  )

  const forVotes = topicMeta?.blue_votes ?? Math.round((law.total_votes ?? 0) * ((law.blue_pct ?? 50) / 100))
  const againstVotes = topicMeta?.red_votes ?? (law.total_votes ?? 0) - forVotes

  const response: LawHighlightsResponse = {
    law: {
      id: law.id,
      statement: law.statement,
      category: law.category,
      established_at: law.established_at,
      blue_pct: law.blue_pct ?? 50,
      total_votes: law.total_votes ?? 0,
      topic_id: topicId,
      topic_created_at: topicCreatedAt,
      days_to_pass: daysToPass,
    },
    founding_argument: topFor
      ? {
          id: topFor.id,
          content: topFor.content,
          upvotes: topFor.upvotes,
          ai_grade: topFor.ai_grade,
          reply_count: replyCountMap[topFor.id] ?? 0,
          created_at: topFor.created_at,
          author: profileMap[topFor.user_id] ?? null,
        }
      : null,
    strongest_opposition: topAgainst
      ? {
          id: topAgainst.id,
          content: topAgainst.content,
          upvotes: topAgainst.upvotes,
          ai_grade: topAgainst.ai_grade,
          reply_count: replyCountMap[topAgainst.id] ?? 0,
          created_at: topAgainst.created_at,
          author: profileMap[topAgainst.user_id] ?? null,
        }
      : null,
    first_vote: firstVote
      ? {
          side: firstVote.side as 'blue' | 'red',
          created_at: firstVote.created_at,
          author: profileMap[firstVote.user_id] ?? null,
        }
      : null,
    notable_for_take: notableFor
      ? {
          side: 'blue',
          reason: notableFor.reason!,
          created_at: notableFor.created_at,
          author: profileMap[notableFor.user_id] ?? null,
        }
      : null,
    notable_against_take: notableAgainst
      ? {
          side: 'red',
          reason: notableAgainst.reason!,
          created_at: notableAgainst.created_at,
          author: profileMap[notableAgainst.user_id] ?? null,
        }
      : null,
    stats: {
      for_arguments: forArgCountResult.count ?? 0,
      against_arguments: againstArgCountResult.count ?? 0,
      total_arguments: (forArgCountResult.count ?? 0) + (againstArgCountResult.count ?? 0),
      for_votes: forVotes,
      against_votes: againstVotes,
    },
  }

  return NextResponse.json(response)
}
