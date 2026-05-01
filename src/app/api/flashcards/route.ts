import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface Flashcard {
  id: string
  topic_id: string
  statement: string
  full_statement: string
  body_markdown: string | null
  category: string | null
  established_at: string
  blue_pct: number
  total_votes: number
  /** Count of law links (related laws) */
  link_count: number
}

export interface FlashcardsResponse {
  cards: Flashcard[]
  total: number
  categories: string[]
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url)
  const category = searchParams.get('category') ?? null
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '60', 10), 120)

  try {
    const supabase = await createClient()

    // Base query for established, active laws
    let query = supabase
      .from('laws')
      .select('id, topic_id, statement, full_statement, body_markdown, category, established_at, blue_pct, total_votes')
      .eq('is_active', true)
      .order('established_at', { ascending: false })
      .limit(limit)

    if (category) {
      query = query.eq('category', category)
    }

    const { data: laws, error } = await query

    if (error) {
      return NextResponse.json({ cards: [], total: 0, categories: [] }, { status: 200 })
    }

    // Fetch related-law link counts for all returned law IDs
    const ids = (laws ?? []).map((l) => l.id)
    const linkCountMap: Record<string, number> = {}

    if (ids.length > 0) {
      const { data: links } = await supabase
        .from('law_links')
        .select('source_law_id')
        .in('source_law_id', ids)

      for (const link of links ?? []) {
        linkCountMap[link.source_law_id] = (linkCountMap[link.source_law_id] ?? 0) + 1
      }
    }

    const cards: Flashcard[] = (laws ?? []).map((law) => ({
      ...law,
      link_count: linkCountMap[law.id] ?? 0,
    }))

    // Fetch distinct categories for the filter bar
    const { data: catRows } = await supabase
      .from('laws')
      .select('category')
      .eq('is_active', true)
      .not('category', 'is', null)
      .order('category')

    const categories = Array.from(
      new Set((catRows ?? []).map((r) => r.category).filter(Boolean) as string[])
    ).sort()

    // Total count for all laws (no category filter)
    const { count } = await supabase
      .from('laws')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true)

    return NextResponse.json({
      cards,
      total: count ?? cards.length,
      categories,
    } satisfies FlashcardsResponse)
  } catch {
    return NextResponse.json({ cards: [], total: 0, categories: [] }, { status: 200 })
  }
}
