import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface ArgumentDetail {
  id: string
  content: string
  side: 'blue' | 'red'
  upvotes: number
  created_at: string
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  }
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
  reply_count: number
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const { id } = params

  if (!id || !/^[0-9a-f-]{36}$/i.test(id)) {
    return NextResponse.json({ error: 'Invalid argument ID' }, { status: 400 })
  }

  const supabase = await createClient()

  const { data: arg, error } = await supabase
    .from('topic_arguments')
    .select('id, content, side, upvotes, created_at, topic_id, user_id')
    .eq('id', id)
    .single()

  if (error || !arg) {
    return NextResponse.json({ error: 'Argument not found' }, { status: 404 })
  }

  const [topicRes, profileRes, replyRes] = await Promise.all([
    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .eq('id', arg.topic_id)
      .single(),
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .eq('id', arg.user_id)
      .maybeSingle(),
    supabase
      .from('argument_replies')
      .select('id', { count: 'exact', head: true })
      .eq('argument_id', id),
  ])

  const topic = topicRes.data
  if (!topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  const result: ArgumentDetail = {
    id: arg.id,
    content: arg.content,
    side: arg.side as 'blue' | 'red',
    upvotes: arg.upvotes,
    created_at: arg.created_at,
    topic: {
      id: topic.id,
      statement: topic.statement,
      category: topic.category,
      status: topic.status,
      blue_pct: topic.blue_pct,
      total_votes: topic.total_votes,
    },
    author: profileRes.data
      ? {
          id: profileRes.data.id,
          username: profileRes.data.username,
          display_name: profileRes.data.display_name,
          avatar_url: profileRes.data.avatar_url,
          role: profileRes.data.role,
        }
      : null,
    reply_count: replyRes.count ?? 0,
  }

  return NextResponse.json(result)
}
