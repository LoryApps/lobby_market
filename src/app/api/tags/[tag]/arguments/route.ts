import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export async function GET(
  req: NextRequest,
  { params }: { params: { tag: string } },
) {
  const tag  = decodeURIComponent(params.tag).toLowerCase()
  const url  = new URL(req.url)
  const sort = url.searchParams.get('sort') ?? 'top'
  const side = url.searchParams.get('side') ?? 'all'
  const page = Math.max(0, parseInt(url.searchParams.get('page') ?? '0', 10))
  const limit = 30

  const supabase = await createClient()

  // Fetch topic IDs for this tag
  const { data: tagged, error: tagErr } = await supabase
    .from('topics')
    .select('id')
    .contains('tags', [tag])
    .limit(500)

  if (tagErr) return NextResponse.json({ error: tagErr.message }, { status: 500 })
  if (!tagged || tagged.length === 0) {
    return NextResponse.json({ arguments: [], total: 0, page, hasMore: false })
  }

  const topicIds = tagged.map((t) => t.id)

  let query = supabase
    .from('topic_arguments')
    .select('id, topic_id, user_id, side, content, upvotes, ai_score, ai_grade, created_at', { count: 'exact' })
    .in('topic_id', topicIds)

  if (side === 'blue' || side === 'red') {
    query = query.eq('side', side)
  }

  if (sort === 'new') {
    query = query.order('created_at', { ascending: false })
  } else {
    query = query.order('upvotes', { ascending: false }).order('created_at', { ascending: false })
  }

  query = query.range(page * limit, page * limit + limit - 1)

  const { data: args, count, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const rows = args ?? []
  const authorIds = [...new Set(rows.map((a) => a.user_id))]
  const topicIdSet = [...new Set(rows.map((a) => a.topic_id))]

  const [profilesRes, topicsRes] = await Promise.all([
    authorIds.length
      ? supabase.from('profiles').select('id, username, display_name, avatar_url, role, clout').in('id', authorIds)
      : Promise.resolve({ data: [] }),
    topicIdSet.length
      ? supabase.from('topics').select('id, statement, status, category').in('id', topicIdSet)
      : Promise.resolve({ data: [] }),
  ])

  const profileMap = new Map((profilesRes.data ?? []).map((p) => [p.id, p]))
  const topicMap   = new Map((topicsRes.data   ?? []).map((t) => [t.id, t]))

  const enriched = rows.map((a) => ({
    ...a,
    author: profileMap.get(a.user_id) ?? null,
    topic:  topicMap.get(a.topic_id)  ?? null,
  }))

  return NextResponse.json({
    arguments: enriched,
    total:   count ?? 0,
    page,
    hasMore: (count ?? 0) > (page + 1) * limit,
  })
}
