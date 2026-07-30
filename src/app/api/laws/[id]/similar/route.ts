import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/laws/[id]/similar
 *
 * Returns laws from the Codex that are related to the given law.
 *
 * Relevance strategy (two lenses):
 *   1. Category peers — laws in the same category, sorted by vote count
 *   2. Keyword overlap — laws whose statements share significant words
 *      with the source law's statement (case-insensitive ILIKE on each token)
 *
 * Each lens returns up to 8 results. Results are de-duplicated across lenses.
 * The source law is always excluded.
 * Does NOT require authentication.
 */
export const dynamic = 'force-dynamic'
export const revalidate = 3600

const MAX_PER_LENS = 8

// Words shorter than this are skipped as noise
const MIN_WORD_LEN = 5

// Common English stopwords to ignore when building keyword set
const STOPWORDS = new Set([
  'should', 'could', 'would', 'their', 'there', 'these', 'those', 'about',
  'above', 'after', 'again', 'being', 'below', 'between', 'both', 'cannot',
  'does', 'during', 'every', 'from', 'further', 'have', 'here', 'itself',
  'just', 'more', 'most', 'must', 'need', 'never', 'only', 'other', 'over',
  'same', 'since', 'some', 'still', 'such', 'than', 'that', 'them', 'then',
  'through', 'under', 'until', 'were', 'what', 'when', 'where', 'which',
  'while', 'with', 'within', 'without', 'your',
])

export interface SimilarLaw {
  id: string
  statement: string
  category: string | null
  blue_pct: number
  total_votes: number
  established_at: string
  is_active: boolean
  match_reason: 'category' | 'keyword'
  shared_keywords: string[]
}

export interface SimilarLawsResponse {
  source: {
    id: string
    statement: string
    category: string | null
    total_votes: number
    established_at: string
  }
  categoryPeers: SimilarLaw[]
  keywordMatches: SimilarLaw[]
  totalDistinct: number
}

function extractKeywords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= MIN_WORD_LEN && !STOPWORDS.has(w))
}

export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()
  const lawId = params.id

  // ── Fetch source law ────────────────────────────────────────────────────────
  const { data: source } = await supabase
    .from('laws')
    .select('id, statement, category, total_votes, established_at')
    .eq('id', lawId)
    .maybeSingle()

  if (!source) {
    return NextResponse.json({ error: 'Law not found' }, { status: 404 })
  }

  type LawRow = {
    id: string
    statement: string
    category: string | null
    blue_pct: number
    total_votes: number
    established_at: string
    is_active: boolean
  }

  const seen = new Set<string>([lawId])

  // ── Lens 1: same-category peers ─────────────────────────────────────────────
  const categoryPeers: SimilarLaw[] = []

  if (source.category) {
    const { data: catRows } = await supabase
      .from('laws')
      .select('id, statement, category, blue_pct, total_votes, established_at, is_active')
      .eq('category', source.category)
      .neq('id', lawId)
      .order('total_votes', { ascending: false })
      .limit(MAX_PER_LENS)

    for (const row of (catRows ?? []) as LawRow[]) {
      seen.add(row.id)
      categoryPeers.push({
        ...row,
        match_reason: 'category',
        shared_keywords: [],
      })
    }
  }

  // ── Lens 2: keyword overlap ─────────────────────────────────────────────────
  const keywords = extractKeywords(source.statement)
  const keywordMatches: SimilarLaw[] = []

  if (keywords.length > 0) {
    // Fetch candidates from the same category or close by, then filter in JS
    // to avoid expensive cross-product queries. Limit the pool to 100 laws
    // sorted by vote count.
    const { data: pool } = await supabase
      .from('laws')
      .select('id, statement, category, blue_pct, total_votes, established_at, is_active')
      .neq('id', lawId)
      .order('total_votes', { ascending: false })
      .limit(100)

    const scored: Array<{ row: LawRow; shared: string[]; score: number }> = []

    for (const row of (pool ?? []) as LawRow[]) {
      if (seen.has(row.id)) continue

      const rowWords = new Set(extractKeywords(row.statement))
      const shared = keywords.filter((kw) => rowWords.has(kw))
      if (shared.length >= 2) {
        scored.push({ row, shared, score: shared.length })
      }
    }

    // Sort by number of shared keywords, take top MAX_PER_LENS
    scored.sort((a, b) => b.score - a.score)

    for (const { row, shared } of scored.slice(0, MAX_PER_LENS)) {
      seen.add(row.id)
      keywordMatches.push({
        ...row,
        match_reason: 'keyword',
        shared_keywords: shared.slice(0, 5),
      })
    }
  }

  const totalDistinct = categoryPeers.length + keywordMatches.length

  return NextResponse.json({
    source: {
      id: source.id,
      statement: source.statement,
      category: source.category,
      total_votes: source.total_votes,
      established_at: source.established_at,
    },
    categoryPeers,
    keywordMatches,
    totalDistinct,
  } satisfies SimilarLawsResponse)
}
