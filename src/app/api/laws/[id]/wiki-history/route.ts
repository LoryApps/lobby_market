import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LawWikiHistoryEntry {
  id: string
  law_id: string
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

export interface LawWikiHistoryResponse {
  entries: LawWikiHistoryEntry[]
  total: number
  law: {
    id: string
    statement: string
    category: string | null
    established_at: string
    wiki_content: string | null
    wiki_updated_at: string | null
  } | null
}

// ─── GET /api/laws/[id]/wiki-history ─────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const { data: law } = await supabase
    .from('laws')
    .select('id, statement, category, established_at, wiki_content, wiki_updated_at')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) {
    return NextResponse.json({ error: 'Law not found' }, { status: 404 })
  }

  // law_wiki_history is a new table not yet in the generated Supabase types
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const db = supabase as any
  const { data: rawEntries, count, error } = await (db
    .from('law_wiki_history')
    .select('id, law_id, editor_id, previous_content, new_content, char_delta, created_at', { count: 'exact' })
    .eq('law_id', params.id)
    .order('created_at', { ascending: false })
    .limit(50) as Promise<{ data: unknown[] | null; count: number | null; error: { message: string } | null }>)

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch history' }, { status: 500 })
  }

  if (!rawEntries || rawEntries.length === 0) {
    return NextResponse.json({ entries: [], total: count ?? 0, law } satisfies LawWikiHistoryResponse)
  }

  // Batch-load editor profiles
  const rows = rawEntries as Array<{
    id: string; law_id: string; editor_id: string | null
    previous_content: string | null; new_content: string | null
    char_delta: number; created_at: string
  }>

  const editorIds = [...new Set(rows.map((r) => r.editor_id).filter(Boolean))] as string[]
  const editorMap = new Map<string, LawWikiHistoryEntry['editor']>()

  if (editorIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .in('id', editorIds)
    for (const p of profiles ?? []) {
      editorMap.set(p.id, p)
    }
  }

  const entries: LawWikiHistoryEntry[] = rows.map((row) => ({
    id: row.id,
    law_id: row.law_id,
    editor_id: row.editor_id,
    previous_content: row.previous_content,
    new_content: row.new_content,
    char_delta: row.char_delta ?? 0,
    created_at: row.created_at,
    editor: row.editor_id ? (editorMap.get(row.editor_id) ?? null) : null,
  }))

  return NextResponse.json({ entries, total: count ?? entries.length, law } satisfies LawWikiHistoryResponse)
}
