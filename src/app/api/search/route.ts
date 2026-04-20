import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/search?q=<query>&tab=topics|laws|people|arguments&category=<cat>&status=<status>&side=for|against
 *
 * Uses PostgreSQL full-text search (websearch_to_tsquery) via the `fts`
 * generated tsvector columns added in migrations 00014 and 00035.
 *
 * Falls back to ILIKE if full-text search returns zero results or the fts
 * column is not yet available (migration hasn't run).
 *
 * Optional filters:
 *   category — topics & laws: exact match on category
 *   status   — topics tab only: exact match on status
 *   side     — arguments tab: 'for' (blue) or 'against' (red)
 */

const VALID_STATUSES = ['proposed', 'active', 'voting', 'law', 'failed'] as const
const VALID_CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science', 'Ethics',
  'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
] as const
const VALID_SIDES = ['for', 'against'] as const

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim() ?? ''
  const tab = searchParams.get('tab') ?? 'topics'
  const rawCategory = searchParams.get('category')?.trim() ?? ''
  const rawStatus   = searchParams.get('status')?.trim() ?? ''
  const rawSide     = searchParams.get('side')?.trim() ?? ''

  type TopicStatus = 'proposed' | 'active' | 'voting' | 'continued' | 'law' | 'failed' | 'archived'

  // Validate filter values to prevent unexpected queries
  const category = (VALID_CATEGORIES as readonly string[]).includes(rawCategory) ? rawCategory : null
  const status: TopicStatus | null = (VALID_STATUSES as readonly string[]).includes(rawStatus)
    ? (rawStatus as TopicStatus)
    : null
  const side = (VALID_SIDES as readonly string[]).includes(rawSide) ? rawSide : null

  if (!q || q.length < 2) {
    return NextResponse.json({ results: [] })
  }

  const supabase = await createClient()
  const pattern = `%${q}%`

  // ── Topics ──────────────────────────────────────────────────────────────────

  if (tab === 'topics') {
    // Build base FTS query — apply single-status filter via .eq() to avoid
    // needing a string[] cast against the generated Supabase union type.
    let ftsQ = supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, view_count, created_at')
      .textSearch('fts', q, { type: 'websearch', config: 'english' })
      .order('feed_score', { ascending: false })
      .limit(20)
    if (status) {
      ftsQ = ftsQ.eq('status', status)
    } else {
      ftsQ = ftsQ.in('status', ['proposed', 'active', 'voting', 'law', 'failed'])
    }
    if (category) ftsQ = ftsQ.eq('category', category)
    const { data: ftsData, error: ftsError } = await ftsQ

    if (!ftsError && ftsData && ftsData.length > 0) {
      return NextResponse.json({ results: ftsData, engine: 'fts' })
    }

    // Fallback — covers stop-word-only queries and pre-migration environments.
    let ilikeQ = supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, view_count, created_at')
      .ilike('statement', pattern)
      .order('feed_score', { ascending: false })
      .limit(20)
    if (status) {
      ilikeQ = ilikeQ.eq('status', status)
    } else {
      ilikeQ = ilikeQ.in('status', ['proposed', 'active', 'voting', 'law', 'failed'])
    }
    if (category) ilikeQ = ilikeQ.eq('category', category)
    const { data, error } = await ilikeQ

    if (error) {
      return NextResponse.json({ error: 'Search failed' }, { status: 500 })
    }
    return NextResponse.json({ results: data ?? [], engine: 'ilike' })
  }

  // ── Laws ────────────────────────────────────────────────────────────────────

  if (tab === 'laws') {
    let ftsQ = supabase
      .from('laws')
      .select('id, statement, full_statement, category, blue_pct, total_votes, established_at')
      .textSearch('fts', q, { type: 'websearch', config: 'english' })
      .order('established_at', { ascending: false })
      .limit(20)
    if (category) ftsQ = ftsQ.eq('category', category)
    const { data: ftsData, error: ftsError } = await ftsQ

    if (!ftsError && ftsData && ftsData.length > 0) {
      return NextResponse.json({ results: ftsData, engine: 'fts' })
    }

    let ilikeQ = supabase
      .from('laws')
      .select('id, statement, full_statement, category, blue_pct, total_votes, established_at')
      .or(`statement.ilike.${pattern},full_statement.ilike.${pattern}`)
      .order('established_at', { ascending: false })
      .limit(20)
    if (category) ilikeQ = ilikeQ.eq('category', category)
    const { data, error } = await ilikeQ

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

  // ── Arguments ────────────────────────────────────────────────────────────────
  // Searches topic_arguments.content joined with topics (for context) and
  // profiles (for author info).  Supports optional side filter (blue/red).

  if (tab === 'arguments') {
    const dbSide = side === 'for' ? 'blue' : side === 'against' ? 'red' : null

    // Try FTS first (requires migration 00035 to have run).
    try {
      let ftsQ = supabase
        .from('topic_arguments')
        .select(`
          id,
          content,
          side,
          upvotes,
          created_at,
          topic:topics!topic_id(id, statement, category, status),
          author:profiles!user_id(id, username, display_name, avatar_url, role)
        `)
        .textSearch('fts', q, { type: 'websearch', config: 'english' })
        .order('upvotes', { ascending: false })
        .limit(20)

      if (dbSide) ftsQ = ftsQ.eq('side', dbSide)

      const { data: ftsData, error: ftsError } = await ftsQ

      if (!ftsError && ftsData && ftsData.length > 0) {
        return NextResponse.json({ results: ftsData, engine: 'fts' })
      }
    } catch {
      // FTS column not yet available — fall through to ILIKE
    }

    // ILIKE fallback
    let ilikeQ = supabase
      .from('topic_arguments')
      .select(`
        id,
        content,
        side,
        upvotes,
        created_at,
        topic:topics!topic_id(id, statement, category, status),
        author:profiles!user_id(id, username, display_name, avatar_url, role)
      `)
      .ilike('content', pattern)
      .order('upvotes', { ascending: false })
      .limit(20)

    if (dbSide) ilikeQ = ilikeQ.eq('side', dbSide)

    const { data, error } = await ilikeQ

    if (error) {
      return NextResponse.json({ error: 'Search failed' }, { status: 500 })
    }
    return NextResponse.json({ results: data ?? [], engine: 'ilike' })
  }

  return NextResponse.json({ results: [] })
}
