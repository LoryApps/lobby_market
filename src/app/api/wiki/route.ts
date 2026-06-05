import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface WikiFeaturedArticle {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  view_count: number
  description: string
  description_updated_at: string
  editor: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

export interface WikiRecentEdit {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  description_preview: string
  description_updated_at: string
  editor: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
  } | null
}

export interface WikiContributor {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  edit_count: number
}

export interface WikiCategoryStats {
  category: string
  article_count: number
  avg_description_length: number
  pct_covered: number
}

export interface WikiPortalResponse {
  featured: WikiFeaturedArticle | null
  recent_edits: WikiRecentEdit[]
  top_contributors: WikiContributor[]
  category_stats: WikiCategoryStats[]
  total_articles: number
  total_topics: number
  coverage_pct: number
  generated_at: string
}

// ─── GET /api/wiki ─────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()

    // 1. Featured article: longest wiki description, weighted by view_count + votes
    const { data: featuredRows } = await supabase
      .from('topics')
      .select(
        'id, statement, category, status, blue_pct, total_votes, view_count, description, description_updated_at, description_updated_by'
      )
      .not('description', 'is', null)
      .not('description_updated_at', 'is', null)
      .gte('total_votes', 3)
      .order('view_count', { ascending: false })
      .limit(20)

    // Pick the one with the longest/richest wiki description among top-viewed
    const rawFeatured = (featuredRows ?? []).sort((a, b) => {
      const scoreA = (a.description?.length ?? 0) * 0.6 + (a.view_count ?? 0) * 0.4
      const scoreB = (b.description?.length ?? 0) * 0.6 + (b.view_count ?? 0) * 0.4
      return scoreB - scoreA
    })[0] ?? null

    // 2. Recent edits (top 8)
    const { data: recentRows } = await supabase
      .from('topics')
      .select(
        'id, statement, category, status, blue_pct, total_votes, description, description_updated_at, description_updated_by'
      )
      .not('description_updated_at', 'is', null)
      .not('description', 'is', null)
      .order('description_updated_at', { ascending: false })
      .limit(8)

    // 3. Top contributors: count edits per editor from wiki history
    const { data: historyRows } = await supabase
      .from('topic_wiki_history')
      .select('editor_id')
      .not('editor_id', 'is', null)
      .limit(500)

    const editCounts = new Map<string, number>()
    for (const row of historyRows ?? []) {
      if (row.editor_id) {
        editCounts.set(row.editor_id, (editCounts.get(row.editor_id) ?? 0) + 1)
      }
    }
    const topEditorIds = [...editCounts.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 6)
      .map(([id]) => id)

    // 4. Category coverage stats
    const { data: allTopics, count: totalTopics } = await supabase
      .from('topics')
      .select('category, description', { count: 'exact' })
      .limit(2000)

    const { count: articleCount } = await supabase
      .from('topics')
      .select('id', { count: 'exact', head: true })
      .not('description', 'is', null)
      .not('description_updated_at', 'is', null)

    // Batch-fetch editor profiles
    const allEditorIds = Array.from(
      new Set([
        ...(recentRows ?? []).map((r) => r.description_updated_by as string | null).filter(Boolean),
        rawFeatured?.description_updated_by as string | null,
        ...topEditorIds,
      ].filter(Boolean) as string[])
    )

    const editorMap = new Map<string, WikiRecentEdit['editor']>()
    if (allEditorIds.length > 0) {
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, role')
        .in('id', allEditorIds)
      for (const p of profiles ?? []) {
        editorMap.set(p.id, p as WikiRecentEdit['editor'])
      }
    }

    // Build category stats
    const catMap = new Map<string, { total: number; withWiki: number; totalLen: number }>()
    for (const t of allTopics ?? []) {
      const cat = t.category ?? 'Other'
      const existing = catMap.get(cat) ?? { total: 0, withWiki: 0, totalLen: 0 }
      existing.total++
      if (t.description) {
        existing.withWiki++
        existing.totalLen += t.description.length
      }
      catMap.set(cat, existing)
    }

    const category_stats: WikiCategoryStats[] = [...catMap.entries()]
      .filter(([, v]) => v.withWiki > 0)
      .map(([category, v]) => ({
        category,
        article_count: v.withWiki,
        avg_description_length: v.withWiki > 0 ? Math.round(v.totalLen / v.withWiki) : 0,
        pct_covered: v.total > 0 ? Math.round((v.withWiki / v.total) * 100) : 0,
      }))
      .sort((a, b) => b.article_count - a.article_count)
      .slice(0, 10)

    // Assemble top contributors
    const top_contributors: WikiContributor[] = topEditorIds
      .map((id) => {
        const profile = editorMap.get(id)
        if (!profile) return null
        return {
          ...profile,
          edit_count: editCounts.get(id) ?? 0,
        } as WikiContributor
      })
      .filter(Boolean) as WikiContributor[]

    // Build recent edits
    const recent_edits: WikiRecentEdit[] = (recentRows ?? []).map((t) => ({
      id: t.id,
      statement: t.statement,
      category: t.category,
      status: t.status,
      blue_pct: t.blue_pct ?? 50,
      total_votes: t.total_votes ?? 0,
      description_preview: (t.description ?? '').slice(0, 160),
      description_updated_at: t.description_updated_at as string,
      editor: t.description_updated_by
        ? (editorMap.get(t.description_updated_by as string) ?? null)
        : null,
    }))

    // Build featured article
    const featured: WikiFeaturedArticle | null = rawFeatured
      ? {
          id: rawFeatured.id,
          statement: rawFeatured.statement,
          category: rawFeatured.category,
          status: rawFeatured.status,
          blue_pct: rawFeatured.blue_pct ?? 50,
          total_votes: rawFeatured.total_votes ?? 0,
          view_count: rawFeatured.view_count ?? 0,
          description: rawFeatured.description ?? '',
          description_updated_at: rawFeatured.description_updated_at as string,
          editor: rawFeatured.description_updated_by
            ? (editorMap.get(rawFeatured.description_updated_by as string) ?? null)
            : null,
        }
      : null

    const total_articles = articleCount ?? 0
    const total = totalTopics ?? 0
    const coverage_pct = total > 0 ? Math.round((total_articles / total) * 100) : 0

    return NextResponse.json({
      featured,
      recent_edits,
      top_contributors,
      category_stats,
      total_articles,
      total_topics: total,
      coverage_pct,
      generated_at: new Date().toISOString(),
    } satisfies WikiPortalResponse)
  } catch (err) {
    console.error('[api/wiki]', err)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
