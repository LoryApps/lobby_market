import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

/**
 * GET /api/topics/similar?q=<statement>
 *
 * Returns up to 5 topics whose statement contains all the significant
 * words in `q`.  Used by the create-topic form to warn about potential
 * duplicates before submission.
 *
 * Does NOT require authentication — public info only.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const q = searchParams.get('q')?.trim() ?? ''

  // Need at least 10 chars before we bother searching
  if (q.length < 10) {
    return NextResponse.json({ topics: [] })
  }

  const supabase = await createClient()

  // Extract meaningful words (≥4 chars, strip common stop-words)
  const STOP_WORDS = new Set([
    'that', 'this', 'with', 'from', 'have', 'will', 'should', 'would',
    'could', 'been', 'were', 'they', 'them', 'their', 'than', 'then',
    'when', 'what', 'which', 'where', 'into', 'your', 'more', 'very',
    'also', 'just', 'only', 'some', 'most', 'over', 'such', 'each',
    'about', 'after', 'before', 'being', 'between', 'other', 'there',
  ])

  const words = q
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length >= 4 && !STOP_WORDS.has(w))
    .slice(0, 6) // Cap at 6 keywords to avoid overly narrow queries

  if (words.length === 0) {
    return NextResponse.json({ topics: [] })
  }

  // Build an OR of ILIKE patterns — at least 2 of the key words must match.
  // We fetch candidates with an OR on individual words then score client-side.
  const orFilter = words.map((w) => `statement.ilike.%${w}%`).join(',')

  const { data, error } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .or(orFilter)
    .in('status', ['proposed', 'active', 'voting', 'law'])
    .order('feed_score', { ascending: false })
    .limit(40)

  if (error) {
    return NextResponse.json({ topics: [] })
  }

  // Score each candidate: count how many query words appear in its statement
  const lower = q.toLowerCase()
  const scored = (data ?? [])
    .map((topic) => {
      const stmt = topic.statement.toLowerCase()
      const hits = words.filter((w) => stmt.includes(w)).length
      // Bonus: if the entire phrase is a substring, boost heavily
      const phraseBonus = stmt.includes(lower.slice(0, 30)) ? 3 : 0
      return { ...topic, _score: hits + phraseBonus }
    })
    .filter((t) => t._score >= 2) // Must share at least 2 key words
    .sort((a, b) => b._score - a._score)
    .slice(0, 5)
    .map(({ _score: _s, ...rest }) => rest)

  return NextResponse.json({ topics: scored })
}
