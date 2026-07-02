import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CrossExamineReply {
  id: string
  content: string
  created_at: string
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

export interface CrossExamineArgument {
  id: string
  side: 'blue' | 'red'
  content: string
  upvotes: number
  ai_score: number | null
  ai_grade: string | null
  created_at: string
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    clout: number
  } | null
  replies: CrossExamineReply[]
  reply_count: number
}

export interface CrossExamineTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
}

export interface CrossExamineResponse {
  topic: CrossExamineTopic
  for_arguments: CrossExamineArgument[]
  against_arguments: CrossExamineArgument[]
  total_for: number
  total_against: number
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const topicId = params.id
  if (!topicId) return NextResponse.json({ error: 'Missing id' }, { status: 400 })

  const supabase = await createClient()

  // Fetch topic metadata
  const { data: topicRow, error: topicError } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .eq('id', topicId)
    .maybeSingle()

  if (topicError || !topicRow) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  const topic: CrossExamineTopic = {
    id: topicRow.id,
    statement: topicRow.statement,
    category: topicRow.category,
    status: topicRow.status,
    blue_pct: topicRow.blue_pct ?? 50,
    total_votes: topicRow.total_votes ?? 0,
  }

  // Fetch top arguments per side (up to 5 each, sorted by upvotes then date)
  const { data: argRows } = await supabase
    .from('topic_arguments')
    .select('id, side, content, upvotes, ai_score, ai_grade, created_at, user_id')
    .eq('topic_id', topicId)
    .order('upvotes', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(40)

  const args = argRows ?? []

  // Split by side, take top 5 each
  const forArgs = args.filter((a) => a.side === 'blue').slice(0, 5)
  const againstArgs = args.filter((a) => a.side === 'red').slice(0, 5)
  const totalFor = args.filter((a) => a.side === 'blue').length
  const totalAgainst = args.filter((a) => a.side === 'red').length

  const topArgs = [...forArgs, ...againstArgs]

  // Fetch author profiles
  const authorIds = Array.from(new Set(topArgs.map((a) => a.user_id).filter(Boolean)))
  const { data: profiles } = authorIds.length
    ? await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, role, clout')
        .in('id', authorIds)
    : { data: [] as { id: string; username: string; display_name: string | null; avatar_url: string | null; role: string; clout: number }[] }

  const profileMap = new Map((profiles ?? []).map((p) => [p.id, p]))

  // Fetch replies for each argument (top 3 per argument)
  const argIds = topArgs.map((a) => a.id)
  const { data: replyRows } = argIds.length
    ? await supabase
        .from('argument_replies')
        .select('id, argument_id, content, created_at, user_id')
        .in('argument_id', argIds)
        .order('created_at', { ascending: true })
    : { data: [] as { id: string; argument_id: string; content: string; created_at: string; user_id: string }[] }

  const replies = replyRows ?? []

  // Fetch reply author profiles
  const replyAuthorIds = Array.from(new Set(replies.map((r) => r.user_id).filter(Boolean)))
  const { data: replyProfiles } = replyAuthorIds.length
    ? await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, role')
        .in('id', replyAuthorIds)
    : { data: [] as { id: string; username: string; display_name: string | null; avatar_url: string | null; role: string }[] }

  const replyProfileMap = new Map((replyProfiles ?? []).map((p) => [p.id, p]))

  // Group replies by argument_id, take first 3
  const replyByArg = new Map<string, CrossExamineReply[]>()
  for (const r of replies) {
    const existing = replyByArg.get(r.argument_id) ?? []
    if (existing.length < 3) {
      const rp = replyProfileMap.get(r.user_id)
      existing.push({
        id: r.id,
        content: r.content,
        created_at: r.created_at,
        author: rp
          ? {
              id: rp.id,
              username: rp.username,
              display_name: rp.display_name,
              avatar_url: rp.avatar_url,
              role: rp.role,
            }
          : null,
      })
      replyByArg.set(r.argument_id, existing)
    }
  }

  // Count replies per argument
  const replyCountByArg = new Map<string, number>()
  for (const r of replies) {
    replyCountByArg.set(r.argument_id, (replyCountByArg.get(r.argument_id) ?? 0) + 1)
  }

  function toArgument(a: typeof topArgs[0]): CrossExamineArgument {
    const author = profileMap.get(a.user_id)
    return {
      id: a.id,
      side: a.side as 'blue' | 'red',
      content: a.content,
      upvotes: a.upvotes,
      ai_score: a.ai_score ?? null,
      ai_grade: a.ai_grade ?? null,
      created_at: a.created_at,
      author: author
        ? {
            id: author.id,
            username: author.username,
            display_name: author.display_name,
            avatar_url: author.avatar_url,
            role: author.role,
            clout: author.clout,
          }
        : null,
      replies: replyByArg.get(a.id) ?? [],
      reply_count: replyCountByArg.get(a.id) ?? 0,
    }
  }

  return NextResponse.json({
    topic,
    for_arguments: forArgs.map(toArgument),
    against_arguments: againstArgs.map(toArgument),
    total_for: totalFor,
    total_against: totalAgainst,
  } satisfies CrossExamineResponse)
}
