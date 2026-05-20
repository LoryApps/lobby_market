import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface BatchTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  view_count: number
  created_at: string
  ends_at: string | null
  scope: string | null
}

export interface BatchTopicsResponse {
  topics: BatchTopic[]
}

// POST /api/topics/batch
// Body: { ids: string[] }   (max 30 IDs)
export async function POST(request: NextRequest) {
  let body: { ids?: unknown }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 })
  }

  const ids = body.ids
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ topics: [] })
  }

  // Clamp to 30 to avoid abuse
  const safeIds = (ids as unknown[])
    .filter((id): id is string => typeof id === 'string' && id.length > 0)
    .slice(0, 30)

  if (safeIds.length === 0) {
    return NextResponse.json({ topics: [] })
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, view_count, created_at, ends_at, scope')
    .in('id', safeIds)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Preserve the caller's ordering (most recently viewed first)
  const topicMap = new Map((data ?? []).map((t) => [t.id, t]))
  const ordered: BatchTopic[] = safeIds
    .map((id) => topicMap.get(id))
    .filter((t): t is BatchTopic => t !== undefined)

  return NextResponse.json({ topics: ordered })
}
