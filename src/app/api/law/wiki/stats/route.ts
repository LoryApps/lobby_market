import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WikiCategoryBreakdown {
  category: string
  total: number
  with_wiki: number
  coverage_pct: number
}

export interface TopContributor {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  edit_count: number
  chars_contributed: number
}

export interface LawWikiStats {
  total_laws: number
  laws_with_wiki: number
  coverage_pct: number
  total_wiki_chars: number
  total_edits: number
  editors_count: number
  avg_wiki_length: number
  categories: WikiCategoryBreakdown[]
  top_contributors: TopContributor[]
}

// ─── GET /api/law/wiki/stats ──────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()

    // Total active laws
    const { count: totalLaws } = await supabase
      .from('laws')
      .select('*', { count: 'exact', head: true })
      .eq('is_active', true)

    // Laws with wiki content
    const { data: wikiLaws, count: lawsWithWiki } = await supabase
      .from('laws')
      .select('id, category, wiki_content', { count: 'exact' })
      .eq('is_active', true)
      .not('wiki_content', 'is', null)
      .not('wiki_content', 'eq', '')

    const total = totalLaws ?? 0
    const withWiki = lawsWithWiki ?? 0

    // Compute total chars and avg length
    const wikiRows = wikiLaws ?? []
    const totalChars = wikiRows.reduce(
      (sum, l) => sum + (l.wiki_content?.length ?? 0),
      0
    )
    const avgWikiLength = withWiki > 0 ? Math.round(totalChars / withWiki) : 0

    // Category breakdown — fetch all laws for grouping
    const { data: allLaws } = await supabase
      .from('laws')
      .select('id, category, wiki_content')
      .eq('is_active', true)

    const catMap = new Map<
      string,
      { total: number; with_wiki: number }
    >()
    for (const law of allLaws ?? []) {
      const cat = law.category ?? 'Uncategorised'
      const existing = catMap.get(cat) ?? { total: 0, with_wiki: 0 }
      existing.total++
      const hasWiki =
        law.wiki_content != null && law.wiki_content.trim().length > 0
      if (hasWiki) existing.with_wiki++
      catMap.set(cat, existing)
    }
    const categories: WikiCategoryBreakdown[] = Array.from(catMap.entries())
      .map(([category, { total, with_wiki }]) => ({
        category,
        total,
        with_wiki,
        coverage_pct:
          total > 0 ? Math.round((with_wiki / total) * 100) : 0,
      }))
      .sort((a, b) => b.total - a.total)

    // Edit history stats
    const { data: historyRows } = await supabase
      .from('law_wiki_history')
      .select('editor_id, char_delta')

    const rows = historyRows ?? []
    const totalEdits = rows.length

    const editorEditMap = new Map<string, { edits: number; chars: number }>()
    for (const row of rows) {
      if (!row.editor_id) continue
      const e = editorEditMap.get(row.editor_id) ?? { edits: 0, chars: 0 }
      e.edits++
      e.chars += row.char_delta && row.char_delta > 0 ? row.char_delta : 0
      editorEditMap.set(row.editor_id, e)
    }

    const editorsCount = editorEditMap.size

    // Top contributors
    const topEditorIds = Array.from(editorEditMap.entries())
      .sort((a, b) => b[1].edits - a[1].edits)
      .slice(0, 10)
      .map(([id]) => id)

    let profiles: Array<{
      id: string
      username: string | null
      display_name: string | null
      avatar_url: string | null
      role: string | null
    }> = []
    if (topEditorIds.length > 0) {
      const { data: p } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, role')
        .in('id', topEditorIds)
      profiles = p ?? []
    }

    const profileMap = new Map(profiles.map((p) => [p.id, p]))
    const top_contributors: TopContributor[] = topEditorIds
      .map((id) => {
        const p = profileMap.get(id)
        if (!p) return null
        const stats = editorEditMap.get(id)!
        return {
          id: p.id,
          username: p.username as string,
          display_name: p.display_name as string | null,
          avatar_url: p.avatar_url as string | null,
          role: (p.role as string) ?? 'person',
          edit_count: stats.edits,
          chars_contributed: stats.chars,
        } satisfies TopContributor
      })
      .filter(Boolean) as TopContributor[]

    return NextResponse.json({
      total_laws: total,
      laws_with_wiki: withWiki,
      coverage_pct: total > 0 ? Math.round((withWiki / total) * 100) : 0,
      total_wiki_chars: totalChars,
      total_edits: totalEdits,
      editors_count: editorsCount,
      avg_wiki_length: avgWikiLength,
      categories,
      top_contributors,
    } satisfies LawWikiStats)
  } catch (err) {
    console.error('[GET /api/law/wiki/stats]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
