import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface BookmarkedArgument {
  id: string
  topic_id: string
  user_id: string
  side: 'blue' | 'red'
  content: string
  upvotes: number
  created_at: string
  bookmarked_at: string
  author: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
  } | null
}

export interface BookmarkedArgumentsResponse {
  arguments: BookmarkedArgument[]
  total: number
}

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch bookmarks ordered by save time
  const { data: bookmarkRows, error: bookmarkError } = await supabase
    .from('argument_bookmarks')
    .select('argument_id, created_at')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(100)

  if (bookmarkError) {
    return NextResponse.json({ error: bookmarkError.message }, { status: 500 })
  }

  const rows = bookmarkRows ?? []
  if (rows.length === 0) {
    return NextResponse.json({ arguments: [], total: 0 } satisfies BookmarkedArgumentsResponse)
  }

  const argumentIds = rows.map((r) => r.argument_id)

  // Fetch arguments with author join
  const { data: argRows } = await supabase
    .from('topic_arguments')
    .select('id, topic_id, user_id, side, content, upvotes, created_at')
    .in('id', argumentIds)

  const argMap = new Map<string, typeof argRows extends (infer T)[] | null ? T : never>()
  for (const a of argRows ?? []) {
    argMap.set(a.id, a)
  }

  // Fetch author profiles
  const authorIds = Array.from(new Set((argRows ?? []).map((a) => a.user_id)))
  const profileMap = new Map<string, {
    id: string; username: string; display_name: string | null
    avatar_url: string | null; role: string
  }>()
  if (authorIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .in('id', authorIds)
    for (const p of profiles ?? []) {
      profileMap.set(p.id, p)
    }
  }

  // Fetch topics
  const topicIds = Array.from(new Set((argRows ?? []).map((a) => a.topic_id)))
  const topicMap = new Map<string, {
    id: string; statement: string; category: string | null; status: string
  }>()
  if (topicIds.length > 0) {
    const { data: topics } = await supabase
      .from('topics')
      .select('id, statement, category, status')
      .in('id', topicIds)
    for (const t of topics ?? []) {
      topicMap.set(t.id, t)
    }
  }

  // Assemble results in bookmark order
  const arguments_: BookmarkedArgument[] = rows
    .map((bm) => {
      const arg = argMap.get(bm.argument_id)
      if (!arg) return null
      return {
        id: arg.id,
        topic_id: arg.topic_id,
        user_id: arg.user_id,
        side: arg.side as 'blue' | 'red',
        content: arg.content,
        upvotes: arg.upvotes,
        created_at: arg.created_at,
        bookmarked_at: bm.created_at,
        author: profileMap.get(arg.user_id) ?? null,
        topic: topicMap.get(arg.topic_id) ?? null,
      }
    })
    .filter((x): x is BookmarkedArgument => x !== null)

  return NextResponse.json({
    arguments: arguments_,
    total: arguments_.length,
  } satisfies BookmarkedArgumentsResponse)
}
