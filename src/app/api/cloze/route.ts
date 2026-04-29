import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ClozeQuestion {
  id: string
  /** Statement with the target word replaced by _____ */
  clue: string
  /** The correct answer */
  answer: string
  /** All 4 options in shuffled order */
  options: string[]
  /** Correct option index (0–3) */
  correctIndex: number
  category: string | null
  source: 'law' | 'topic'
  originalStatement: string
}

export interface ClozePayload {
  questions: ClozeQuestion[]
  date: string
}

// ─── Stop words ───────────────────────────────────────────────────────────────

const STOP_WORDS = new Set([
  'a', 'an', 'the', 'and', 'or', 'but', 'not', 'nor', 'so', 'yet', 'for',
  'in', 'on', 'at', 'to', 'of', 'by', 'up', 'as', 'is', 'it', 'be', 'do',
  'if', 'we', 'he', 'she', 'they', 'that', 'this', 'with', 'from', 'have',
  'will', 'should', 'would', 'could', 'been', 'were', 'are', 'was', 'has',
  'had', 'may', 'all', 'any', 'can', 'its', 'our', 'their', 'more', 'less',
  'than', 'when', 'then', 'into', 'over', 'also', 'just', 'only', 'such',
  'each', 'both', 'very', 'most', 'which', 'what', 'who', 'how', 'why',
  'where', 'there', 'these', 'those', 'must', 'need', 'used', 'being', 'about',
  'between', 'while', 'since', 'after', 'before', 'through', 'across', 'under',
  'above', 'every', 'some', 'other', 'new', 'old', 'same', 'even', 'first',
  'second', 'third', 'one', 'two', 'three', 'four', 'five', 'make', 'take',
  'give', 'come', 'know', 'well', 'right', 'good', 'high', 'large', 'small',
])

// ─── Helpers ──────────────────────────────────────────────────────────────────

function deterministicShuffle<T>(arr: T[], seed: number): T[] {
  const out = [...arr]
  let rng = seed
  for (let i = out.length - 1; i > 0; i--) {
    rng = (rng * 1664525 + 1013904223) >>> 0
    const j = rng % (i + 1)
    ;[out[i], out[j]] = [out[j], out[i]]
  }
  return out
}

function hashStr(s: string): number {
  let h = 0
  for (let i = 0; i < s.length; i++) {
    h = (Math.imul(31, h) + s.charCodeAt(i)) | 0
  }
  return Math.abs(h)
}

/**
 * Extract candidate blank words from a statement.
 * Prefers words 5-12 chars long that are not stop words.
 * Returns them ordered by "importance" (longer words first).
 */
function extractCandidates(statement: string): string[] {
  const words = statement.match(/\b[a-zA-Z]{5,12}\b/g) ?? []
  const unique = [...new Set(words.map((w) => w.toLowerCase()))]
  return unique
    .filter((w) => !STOP_WORDS.has(w))
    .sort((a, b) => b.length - a.length)
    .slice(0, 8)
}

/**
 * Given a statement and a target word, return the clue string with
 * the first occurrence of that word (case-insensitive) replaced by _____.
 */
function buildClue(statement: string, target: string): string {
  const re = new RegExp(`\\b${target}\\b`, 'i')
  return statement.replace(re, '_____')
}

/**
 * Pick `count` daily questions from a pool, seeded by date string.
 */
function pickDaily<T>(pool: T[], seed: string, count: number): T[] {
  if (pool.length <= count) return pool
  const h = hashStr(seed)
  const start = h % pool.length
  const result: T[] = []
  for (let i = 0; i < count; i++) {
    result.push(pool[(start + i) % pool.length])
  }
  return result
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest) {
  const supabase = await createClient()

  // Fetch law statements (preferred — more authoritative)
  const { data: lawRows } = await supabase
    .from('laws')
    .select('id, statement, full_statement, category')
    .eq('is_active', true)
    .not('statement', 'is', null)
    .order('established_at', { ascending: false })
    .limit(200)

  // Also fetch highly-voted topic statements as fallback pool
  const { data: topicRows } = await supabase
    .from('topics')
    .select('id, statement, category, status')
    .in('status', ['law', 'active', 'voting'])
    .gte('total_votes', 10)
    .not('statement', 'is', null)
    .order('feed_score', { ascending: false })
    .limit(200)

  interface RawEntry {
    id: string
    statement: string
    category: string | null
    source: 'law' | 'topic'
  }

  const pool: RawEntry[] = [
    ...(lawRows ?? []).map((l) => ({
      id: l.id as string,
      statement: (l.full_statement ?? l.statement) as string,
      category: l.category as string | null,
      source: 'law' as const,
    })),
    ...(topicRows ?? []).map((t) => ({
      id: t.id as string,
      statement: t.statement as string,
      category: t.category as string | null,
      source: 'topic' as const,
    })),
  ].filter((e) => e.statement && e.statement.length > 20)

  // Collect all potential answers from the whole pool for distractor generation
  const allWords: string[] = []
  for (const entry of pool) {
    allWords.push(...extractCandidates(entry.statement))
  }
  const globalWordSet = [...new Set(allWords)]

  const date = new Date().toISOString().slice(0, 10)

  // Build a candidate set — entries that have at least one blankable word
  const candidateEntries = pool.filter((e) => extractCandidates(e.statement).length > 0)

  if (candidateEntries.length === 0) {
    return NextResponse.json({ questions: [], date } satisfies ClozePayload)
  }

  const selected = pickDaily(candidateEntries, date, 5)

  const questions: ClozeQuestion[] = []

  for (let qi = 0; qi < selected.length; qi++) {
    const entry = selected[qi]
    const candidates = extractCandidates(entry.statement)
    if (candidates.length === 0) continue

    // Pick the target word: use date+index as seed so it's stable
    const wordSeed = hashStr(`${date}-${qi}-${entry.id}`)
    const targetWord = candidates[wordSeed % candidates.length]
    const clue = buildClue(entry.statement, targetWord)
    if (clue === entry.statement) continue // word didn't substitute

    // Build 3 distractors: words of similar length from the global pool,
    // excluding the correct answer
    const targetLen = targetWord.length
    const similar = globalWordSet
      .filter((w) => w !== targetWord && Math.abs(w.length - targetLen) <= 3)
    const shuffledSimilar = deterministicShuffle(similar, wordSeed)
    const distractors = shuffledSimilar.slice(0, 3)

    // If we don't have enough distractors, pad with generic civic terms
    const FALLBACKS = ['government', 'citizens', 'national', 'authority', 'standard',
      'system', 'policy', 'public', 'rights', 'services', 'reform', 'support',
      'federal', 'local', 'sector', 'budget', 'program', 'action', 'freedom']
    const fb = FALLBACKS.filter((w) => w !== targetWord && !distractors.includes(w))
    while (distractors.length < 3) {
      const pick = fb[distractors.length % fb.length] ?? 'civic'
      if (!distractors.includes(pick)) distractors.push(pick)
      else distractors.push(`${pick}s`)
    }

    const options = deterministicShuffle([targetWord, ...distractors.slice(0, 3)], wordSeed + qi)
    const correctIndex = options.indexOf(targetWord)

    questions.push({
      id: entry.id,
      clue,
      answer: targetWord,
      options,
      correctIndex,
      category: entry.category,
      source: entry.source,
      originalStatement: entry.statement,
    })
  }

  return NextResponse.json({ questions, date } satisfies ClozePayload)
}
