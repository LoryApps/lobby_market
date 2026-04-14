import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/search?q=<query>&tab=topics|laws|people
 *
 * Uses PostgreSQL full-text search (websearch_to_tsquery) via the `fts`
 * generated tsvector columns added in migration 00014_fts_indexes.sql.
 *
 * Falls back to ILIKE if full-text search returns zero results or the fts
 * column is not yet available (migration hasn't run).
 */

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim() ?? ''
  const tab = searchParams.get('tab') ?? 'topics'

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] })
  }

  const supabase = await createClient()
  const pattern = `%${q}%`

  // ── Topics ──────────────────────────────────────────────────────────────────

  if (tab === 'topics') {
    // Try FTS first; fall back to ILIKE if `fts` column missing or no results.
    const { data: ftsData, error: ftsError } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, view_count, created_at')
      .textSearch('fts', q, { type: 'websearch', config: 'english' })
      .in('status', ['proposed', 'active', 'voting', 'law', 'failed'])
      .order('feed_score', { ascending: false })
      .limit(20)

    if (!ftsError && ftsData && ftsData.length > 0) {
      return NextResponse.json({ results: ftsData, engine: 'fts' })
    }

    // Fallback — covers stop-word-only queries and pre-migration environments.
    const { data, error } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, view_count, created_at')
      .ilike('statement', pattern)
      .in('status', ['proposed', 'active', 'voting', 'law', 'failed'])
      .order('feed_score', { ascending: false })
      .limit(20)

    if (error) {
      return NextResponse.json({ error: 'Search failed' }, { status: 500 })
    }
    return NextResponse.json({ results: data ?? [], engine: 'ilike' })
  }

  // ── Laws ────────────────────────────────────────────────────────────────────

  if (tab === 'laws') {
    const { data: ftsData, error: ftsError } = await supabase
      .from('laws')
      .select('id, statement, full_statement, category, blue_pct, total_votes, established_at')
      .textSearch('fts', q, { type: 'websearch', config: 'english' })
      .order('established_at', { ascending: false })
      .limit(20)

    if (!ftsError && ftsData && ftsData.length > 0) {
      return NextResponse.json({ results: ftsData, engine: 'fts' })
    }

    const { data, error } = await supabase
      .from('laws')
      .select('id, statement, full_statement, category, blue_pct, total_votes, established_at')
      .or(`statement.ilike.${pattern},full_statement.ilike.${pattern}`)
      .order('established_at', { ascending: false })
      .limit(20)

    if (error) {
      return NextResponse.json({ error: 'Search failed' }, { status: 500 })
    }
    return NextResponse.json({ results: data ?? [], engine: 'ilike' })
  }

  // ── People ──────────────────────────────────────────────────────────────────

  if (tab === 'people') {
    // 'simple' config for names: no stemming, just lowercasing.
    const { data: ftsData, error: ftsError } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout, reputation_score')
      .textSearch('fts', q, { type: 'websearch', config: 'simple' })
      .order('reputation_score', { ascending: false })
      .limit(20)

    if (!ftsError && ftsData && ftsData.length > 0) {
      return NextResponse.json({ results: ftsData, engine: 'fts' })
    }

    const { data, error } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role, clout, reputation_score')
      .or(`username.ilike.${pattern},display_name.ilike.${pattern}`)
      .order('reputation_score', { ascending: false })
      .limit(20)

    if (error) {
      return NextResponse.json({ error: 'Search failed' }, { status: 500 })
    }
    return NextResponse.json({ results: data ?? [], engine: 'ilike' })
  }

  return NextResponse.json({ results: [] })
}
