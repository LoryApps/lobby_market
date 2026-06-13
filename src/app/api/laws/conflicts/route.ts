import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface ConflictLaw {
  id: string
  statement: string
  full_statement: string | null
  category: string | null
  blue_pct: number | null
  total_votes: number | null
  established_at: string
}

export type ConflictType = 'opposition' | 'overlap' | 'scope'

export interface ConflictPair {
  law_a: ConflictLaw
  law_b: ConflictLaw
  conflict_type: ConflictType
  similarity_score: number  // 0–1: word overlap
  shared_words: string[]
  conflict_signal: string   // human-readable reason
}

export interface ConflictsResponse {
  pairs: ConflictPair[]
  total_laws_analyzed: number
  category: string | null
}

// ─── Stop words ────────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'the', 'a', 'an', 'and', 'or', 'but', 'in', 'on', 'at', 'to', 'for',
  'of', 'with', 'by', 'from', 'is', 'are', 'was', 'were', 'be', 'been',
  'being', 'have', 'has', 'had', 'do', 'does', 'did', 'will', 'would',
  'could', 'should', 'may', 'might', 'must', 'shall', 'can', 'need',
  'that', 'this', 'these', 'those', 'it', 'its', 'which', 'who', 'whom',
  'what', 'when', 'where', 'why', 'how', 'all', 'each', 'every', 'both',
  'more', 'most', 'other', 'some', 'such', 'than', 'then', 'there', 'they',
  'their', 'them', 'we', 'our', 'you', 'your', 'he', 'she', 'his', 'her',
  'not', 'no', 'nor', 'also', 'just', 'only', 'very', 'too', 'so', 'as',
  'if', 'up', 'out', 'about', 'into', 'through', 'between', 'after', 'before',
  'over', 'under', 'again', 'further', 'because', 'while', 'although', 'unless',
  'until', 'within', 'without', 'across', 'among', 'against', 'during',
  'including', 'since', 'toward', 'upon',
])

// ─── Opposition pairs — keywords that signal contradiction ─────────────────────

const OPPOSITION_PAIRS: [string, string][] = [
  ['ban', 'allow'],
  ['ban', 'permit'],
  ['ban', 'legalise'],
  ['ban', 'legalize'],
  ['ban', 'decriminalise'],
  ['ban', 'decriminalize'],
  ['prohibit', 'allow'],
  ['prohibit', 'permit'],
  ['restrict', 'expand'],
  ['restrict', 'increase'],
  ['reduce', 'increase'],
  ['decrease', 'increase'],
  ['lower', 'raise'],
  ['lower', 'increase'],
  ['cut', 'expand'],
  ['cut', 'increase'],
  ['abolish', 'establish'],
  ['abolish', 'maintain'],
  ['abolish', 'preserve'],
  ['remove', 'add'],
  ['remove', 'maintain'],
  ['repeal', 'keep'],
  ['repeal', 'maintain'],
  ['privatise', 'nationalise'],
  ['privatize', 'nationalize'],
  ['mandatory', 'voluntary'],
  ['compulsory', 'optional'],
  ['required', 'optional'],
  ['should', "shouldn't"],
  ['must', 'must not'],
]

function tokenize(statement: string): string[] {
  return statement
    .toLowerCase()
    .replace(/[^a-z0-9\s'-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 3 && !STOP_WORDS.has(w))
}

function jaccardSimilarity(aSet: Set<string>, bSet: Set<string>): number {
  if (aSet.size === 0 && bSet.size === 0) return 0
  let intersection = 0
  aSet.forEach((w) => { if (bSet.has(w)) intersection++ })
  const union = aSet.size + bSet.size - intersection
  return union === 0 ? 0 : intersection / union
}

function detectOpposition(aTokens: Set<string>, bTokens: Set<string>): string | null {
  for (const [neg, pos] of OPPOSITION_PAIRS) {
    const aHasNeg = aTokens.has(neg) || [...aTokens].some((t) => t.startsWith(neg))
    const bHasPos = bTokens.has(pos) || [...bTokens].some((t) => t.startsWith(pos))
    const aHasPos = aTokens.has(pos) || [...aTokens].some((t) => t.startsWith(pos))
    const bHasNeg = bTokens.has(neg) || [...bTokens].some((t) => t.startsWith(neg))
    if ((aHasNeg && bHasPos) || (aHasPos && bHasNeg)) {
      return `One law uses "${neg}" while the other uses "${pos}"`
    }
  }
  return null
}

function sharedWords(aSet: Set<string>, bSet: Set<string>): string[] {
  const shared: string[] = []
  aSet.forEach((w) => { if (bSet.has(w)) shared.push(w) })
  return shared.slice(0, 8)
}

// ─── Route ─────────────────────────────────────────────────────────────────────

export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl
  const category = searchParams.get('category') || null
  const limit = Math.min(parseInt(searchParams.get('limit') ?? '30', 10), 60)
  const minSimilarity = parseFloat(searchParams.get('min_similarity') ?? '0.18')

  const supabase = await createClient()

  let query = supabase
    .from('laws')
    .select('id, statement, full_statement, category, blue_pct, total_votes, established_at')
    .eq('is_active', true)
    .order('total_votes', { ascending: false })
    .limit(120)

  if (category) {
    query = query.eq('category', category)
  }

  const { data: laws, error } = await query

  if (error || !laws) {
    return NextResponse.json({ pairs: [], total_laws_analyzed: 0, category }, { status: 200 })
  }

  // Pre-compute token sets for each law
  const tokenSets: Map<string, Set<string>> = new Map()
  for (const law of laws) {
    tokenSets.set(law.id, new Set(tokenize(law.statement)))
  }

  const pairs: ConflictPair[] = []

  for (let i = 0; i < laws.length; i++) {
    for (let j = i + 1; j < laws.length; j++) {
      const a = laws[i]
      const b = laws[j]
      const aSet = tokenSets.get(a.id)!
      const bSet = tokenSets.get(b.id)!

      const similarity = jaccardSimilarity(aSet, bSet)
      if (similarity < minSimilarity) continue

      const oppositionReason = detectOpposition(aSet, bSet)
      const shared = sharedWords(aSet, bSet)

      let conflictType: ConflictType
      let conflictSignal: string

      if (oppositionReason) {
        conflictType = 'opposition'
        conflictSignal = oppositionReason
      } else if (similarity >= 0.4) {
        conflictType = 'overlap'
        conflictSignal = `Both laws address the same subject: "${shared.slice(0, 3).join('", "')}"${shared.length > 3 ? ` and ${shared.length - 3} more` : ''}`
      } else {
        conflictType = 'scope'
        conflictSignal = `Both laws reference "${shared.slice(0, 2).join('" and "')}" — may define overlapping scope`
      }

      pairs.push({
        law_a: a as ConflictLaw,
        law_b: b as ConflictLaw,
        conflict_type: conflictType,
        similarity_score: similarity,
        shared_words: shared,
        conflict_signal: conflictSignal,
      })
    }
  }

  // Sort: opposition first, then by similarity score descending
  pairs.sort((a, b) => {
    if (a.conflict_type === 'opposition' && b.conflict_type !== 'opposition') return -1
    if (a.conflict_type !== 'opposition' && b.conflict_type === 'opposition') return 1
    return b.similarity_score - a.similarity_score
  })

  return NextResponse.json({
    pairs: pairs.slice(0, limit),
    total_laws_analyzed: laws.length,
    category,
  } satisfies ConflictsResponse)
}
