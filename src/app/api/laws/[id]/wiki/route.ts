import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WikiLaw {
  id: string
  statement: string
  category: string | null
  established_at: string
  blue_pct: number | null
  total_votes: number | null
  wiki_content: string | null
  wiki_updated_at: string | null
  wiki_updated_by: string | null
}

export interface WikiHistoryEntry {
  id: string
  editor_id: string | null
  char_delta: number | null
  created_at: string
  editor: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

export interface LawWikiResponse {
  law: WikiLaw
  history: WikiHistoryEntry[]
  total_edits: number
}

// ─── GET /api/laws/[id]/wiki ──────────────────────────────────────────────────

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const { data: law, error: lawErr } = await supabase
    .from('laws')
    .select('id, statement, category, established_at, blue_pct, total_votes, wiki_content, wiki_updated_at, wiki_updated_by')
    .eq('id', params.id)
    .maybeSingle()

  if (lawErr || !law) {
    return NextResponse.json({ error: 'Law not found' }, { status: 404 })
  }

  // Fetch wiki edit history (most recent 50)
  const { data: rawHistory, count } = await supabase
    .from('law_wiki_history')
    .select('id, editor_id, char_delta, created_at', { count: 'exact' })
    .eq('law_id', params.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const history: WikiHistoryEntry[] = []

  if (rawHistory && rawHistory.length > 0) {
    const editorIds = [...new Set(rawHistory.map((r) => r.editor_id).filter(Boolean))] as string[]

    const editorMap: Map<string, WikiHistoryEntry['editor']> = new Map()
    if (editorIds.length > 0) {
      const { data: editors } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, role')
        .in('id', editorIds)
      for (const e of editors ?? []) {
        editorMap.set(e.id, e)
      }
    }

    for (const row of rawHistory) {
      history.push({
        id: row.id,
        editor_id: row.editor_id,
        char_delta: row.char_delta,
        created_at: row.created_at,
        editor: row.editor_id ? (editorMap.get(row.editor_id) ?? null) : null,
      })
    }
  }

  return NextResponse.json({
    law: law as WikiLaw,
    history,
    total_edits: count ?? 0,
  })
}

// ─── PATCH /api/laws/[id]/wiki ────────────────────────────────────────────────

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { data: law, error: lawErr } = await supabase
    .from('laws')
    .select('id, is_active')
    .eq('id', params.id)
    .maybeSingle()

  if (lawErr || !law) {
    return NextResponse.json({ error: 'Law not found' }, { status: 404 })
  }

  let body: { wiki_content?: string }
  try {
    body = await request.json()
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 })
  }

  const trimmed = body.wiki_content?.trim() ?? null

  if (trimmed !== null && trimmed.length > 5000) {
    return NextResponse.json({ error: 'Wiki content exceeds 5000 characters' }, { status: 422 })
  }

  const { data: updated, error: updateErr } = await supabase
    .from('laws')
    .update({
      wiki_content: trimmed,
      wiki_updated_at: new Date().toISOString(),
      wiki_updated_by: user.id,
    })
    .eq('id', params.id)
    .select('id, statement, category, established_at, blue_pct, total_votes, wiki_content, wiki_updated_at, wiki_updated_by')
    .single()

  if (updateErr || !updated) {
    return NextResponse.json({ error: 'Failed to save wiki content' }, { status: 500 })
  }

  return NextResponse.json({ law: updated as WikiLaw })
}
