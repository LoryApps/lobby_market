import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WikiRecentEdit {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  description: string | null
  description_updated_at: string
  editor: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

export interface WikiRecentResponse {
  edits: WikiRecentEdit[]
  total: number
}

// ─── GET /api/topics/wiki/recent ──────────────────────────────────────────────

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '30', 10), 100)
  const offset = parseInt(searchParams.get('offset') ?? '0', 10)
  const category = searchParams.get('category') // optional filter

  try {
    const supabase = await createClient()

    // Build the query — only return topics that have been wiki-edited at least once
    let query = supabase
      .from('topics')
      .select(
        'id, statement, category, status, blue_pct, total_votes, description, description_updated_at, description_updated_by',
        { count: 'exact' }
      )
      .not('description_updated_at', 'is', null)
      .not('description', 'is', null)

    if (category && category !== 'All') {
      query = query.eq('category', category)
    }

    const { data: topics, error, count } = await query
      .order('description_updated_at', { ascending: false })
      .range(offset, offset + limit - 1)

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    const rawTopics = topics ?? []

    // Batch-fetch editor profiles
    const editorIds = Array.from(
      new Set(
        rawTopics
          .map((t) => t.description_updated_by as string | null)
          .filter(Boolean) as string[]
      )
    )

    const editorMap = new Map<string, WikiRecentEdit['editor']>()
    if (editorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, role')
        .in('id', editorIds)

      for (const p of profiles ?? []) {
        editorMap.set(p.id, p as WikiRecentEdit['editor'])
      }
    }

    const edits: WikiRecentEdit[] = rawTopics.map((t) => ({
      id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
      blue_pct: t.blue_pct ?? 50,
      total_votes: t.total_votes ?? 0,
      description: t.description,
      description_updated_at: t.description_updated_at as string,
      editor: t.description_updated_by
        ? (editorMap.get(t.description_updated_by as string) ?? null)
        : null,
    }))

    return NextResponse.json({ edits, total: count ?? 0 } satisfies WikiRecentResponse)
  } catch (err) {
    console.error('[wiki/recent]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
