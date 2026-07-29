import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface LawWikiRecentEdit {
  id: string
  statement: string
  category: string | null
  established_at: string
  blue_pct: number | null
  total_votes: number | null
  wiki_content: string | null
  wiki_updated_at: string
  char_delta: number | null
  editor: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

export interface LawWikiRecentResponse {
  edits: LawWikiRecentEdit[]
  total: number
}

// ─── GET /api/law/wiki/recent ─────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '30', 10), 100)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10)
  const category = searchParams.get('category')

  try {
    const supabase = await createClient()

    let query = supabase
      .from('laws')
      .select(
        'id, statement, category, established_at, blue_pct, total_votes, wiki_content, wiki_updated_at, wiki_updated_by',
        { count: 'exact' }
      )
      .not('wiki_updated_at', 'is', null)
      .not('wiki_content', 'is', null)

    if (category && category !== 'All') {
      query = query.eq('category', category)
    }

    const { data: laws, error, count } = await query
      .order('wiki_updated_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const rawLaws = laws ?? []

    // Batch-fetch editor profiles
    const editorIds = Array.from(
      new Set(
        rawLaws
          .map((l) => l.wiki_updated_by as string | null)
          .filter(Boolean) as string[]
      )
    )

    const editorMap = new Map<string, LawWikiRecentEdit['editor']>()
    if (editorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, role')
        .in('id', editorIds)

      for (const p of profiles ?? []) {
        editorMap.set(p.id, {
          id: p.id,
          username: p.username as string,
          display_name: p.display_name as string | null,
          avatar_url: p.avatar_url as string | null,
          role: (p.role as string) ?? 'person',
        })
      }
    }

    // Pull char_delta from law_wiki_history for most recent edit per law
    const lawIds = rawLaws.map((l) => l.id)
    const charDeltaMap = new Map<string, number | null>()
    if (lawIds.length > 0) {
      const { data: historyRows } = await supabase
        .from('law_wiki_history')
        .select('law_id, char_delta, created_at')
        .in('law_id', lawIds)
        .order('created_at', { ascending: false })

      const seen = new Set<string>()
      for (const row of historyRows ?? []) {
        if (!seen.has(row.law_id)) {
          seen.add(row.law_id)
          charDeltaMap.set(row.law_id, row.char_delta ?? null)
        }
      }
    }

    const edits: LawWikiRecentEdit[] = rawLaws.map((l) => ({
      id: l.id,
      statement: l.statement as string,
      category: l.category as string | null,
      established_at: l.established_at as string,
      blue_pct: l.blue_pct as number | null,
      total_votes: l.total_votes as number | null,
      wiki_content: l.wiki_content as string | null,
      wiki_updated_at: l.wiki_updated_at as string,
      char_delta: charDeltaMap.get(l.id) ?? null,
      editor: editorMap.get(l.wiki_updated_by as string) ?? null,
    }))

    return NextResponse.json({ edits, total: count ?? 0 } satisfies LawWikiRecentResponse)
  } catch (err) {
    console.error('[GET /api/law/wiki/recent]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
