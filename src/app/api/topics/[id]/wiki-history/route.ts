import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface WikiHistoryEntry {
  id: string
  topic_id: string
  editor_id: string | null
  previous_content: string | null
  new_content: string | null
  char_delta: number
  created_at: string
  editor: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

export interface WikiHistoryResponse {
  entries: WikiHistoryEntry[]
  total: number
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
  } | null
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const topicId = params.id

  // Fetch topic metadata
  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status')
    .eq('id', topicId)
    .single()

  if (!topic) {
    return NextResponse.json({ error: 'Topic not found' }, { status: 404 })
  }

  // Fetch edit history with editor profile join.
  // Cast to `any` because the Supabase type gen doesn't include the new table yet.
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data: rawEntries, error } = await (db
    .from('topic_wiki_history')
    .select(
      `id, topic_id, editor_id, previous_content, new_content, char_delta, created_at,
       editor:profiles!editor_id(id, username, display_name, avatar_url, role)`
    )
    .eq('topic_id', topicId)
    .order('created_at', { ascending: false })
    .limit(50) as Promise<{ data: unknown[] | null; error: { message: string } | null }>)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 })
  }

  const entries = (rawEntries ?? []).map((e) => {
    const row = e as WikiHistoryEntry & { editor: WikiHistoryEntry['editor'] | WikiHistoryEntry['editor'][] }
    return {
      ...row,
      editor: Array.isArray(row.editor) ? (row.editor[0] ?? null) : row.editor,
    } as WikiHistoryEntry
  })

  return NextResponse.json({
    entries,
    total: entries.length,
    topic,
  } satisfies WikiHistoryResponse)
}
