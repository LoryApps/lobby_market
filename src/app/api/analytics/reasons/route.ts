import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface CategoryReasonStat {
  category: string
  count: number
  for_count: number
  against_count: number
}

export interface SideReasonStat {
  side: 'for' | 'against'
  count: number
  pct: number
}

export interface MonthlyReasonTrend {
  month: string   // YYYY-MM
  label: string   // "Jan 2025"
  count: number
}

export interface WordFrequency {
  word: string
  count: number
}

export interface RecentReason {
  id: string
  reason: string
  side: 'blue' | 'red'
  topic_id: string
  topic_statement: string
  topic_category: string | null
  created_at: string
}

export interface ReasonsData {
  total_reasons: number
  total_votes: number
  reason_rate: number
  for_reasons: number
  against_reasons: number
  category_breakdown: CategoryReasonStat[]
  monthly_trend: MonthlyReasonTrend[]
  word_frequency: WordFrequency[]
  recent_reasons: RecentReason[]
  longest_reason: string | null
  avg_reason_length: number
  most_active_category: string | null
}

// ─── Stopwords ────────────────────────────────────────────────────────────────

const STOPWORDS = new Set([
  'a','an','the','and','or','but','in','on','at','to','for','of','with',
  'by','from','is','it','its','be','as','are','was','were','been','has',
  'have','had','do','does','did','will','would','could','should','may',
  'might','this','that','these','those','i','my','me','we','our','you',
  'your','he','his','she','her','they','their','not','no','so','if',
  'then','than','when','which','who','what','how','all','any','more',
  'can','just','also','about','up','out','there','very','much','need',
  'people','make','think','because','like','one','get','see','even',
  'still','way','time','good','need','well','going','every','other',
])

function extractWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^a-z0-9'\s-]/g, ' ')
    .split(/\s+/)
    .map((w) => w.replace(/^['-]+|['-]+$/g, ''))
    .filter((w) => w.length >= 3 && !STOPWORDS.has(w))
}

// ─── GET handler ──────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Fetch all votes for this user, with topic info
  const { data: votes, error } = await supabase
    .from('votes')
    .select(`
      id,
      side,
      reason,
      created_at,
      topic:topics!votes_topic_id_fkey(id, statement, category)
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(2000)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const allVotes = (votes ?? []) as Array<{
    id: string
    side: string
    reason: string | null
    created_at: string
    topic: { id: string; statement: string; category: string | null } | null
  }>

  const total_votes = allVotes.length
  const withReason = allVotes.filter((v) => v.reason && v.reason.trim().length > 0)
  const total_reasons = withReason.length
  const reason_rate = total_votes > 0 ? Math.round((total_reasons / total_votes) * 100) : 0

  const for_reasons = withReason.filter((v) => v.side === 'blue').length
  const against_reasons = withReason.filter((v) => v.side === 'red').length

  // ── Category breakdown ────────────────────────────────────────────────────
  const catMap = new Map<string, { count: number; for_count: number; against_count: number }>()
  for (const v of withReason) {
    const cat = v.topic?.category ?? 'Other'
    const prev = catMap.get(cat) ?? { count: 0, for_count: 0, against_count: 0 }
    catMap.set(cat, {
      count: prev.count + 1,
      for_count: prev.for_count + (v.side === 'blue' ? 1 : 0),
      against_count: prev.against_count + (v.side === 'red' ? 1 : 0),
    })
  }
  const category_breakdown: CategoryReasonStat[] = Array.from(catMap.entries())
    .map(([category, s]) => ({ category, ...s }))
    .sort((a, b) => b.count - a.count)
    .slice(0, 8)

  const most_active_category = category_breakdown[0]?.category ?? null

  // ── Monthly trend ─────────────────────────────────────────────────────────
  const monthMap = new Map<string, number>()
  for (const v of withReason) {
    const d = new Date(v.created_at)
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
    monthMap.set(key, (monthMap.get(key) ?? 0) + 1)
  }
  const monthly_trend: MonthlyReasonTrend[] = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .slice(-12)
    .map(([month, count]) => {
      const [yr, mo] = month.split('-')
      const label = new Date(Number(yr), Number(mo) - 1, 1).toLocaleDateString('en-US', {
        month: 'short',
        year: 'numeric',
      })
      return { month, label, count }
    })

  // ── Word frequency ────────────────────────────────────────────────────────
  const wordMap = new Map<string, number>()
  for (const v of withReason) {
    if (!v.reason) continue
    for (const word of extractWords(v.reason)) {
      wordMap.set(word, (wordMap.get(word) ?? 0) + 1)
    }
  }
  const word_frequency: WordFrequency[] = Array.from(wordMap.entries())
    .sort(([, a], [, b]) => b - a)
    .slice(0, 30)
    .map(([word, count]) => ({ word, count }))

  // ── Recent reasons ────────────────────────────────────────────────────────
  const recent_reasons: RecentReason[] = withReason.slice(0, 20).map((v) => ({
    id: v.id,
    reason: v.reason!,
    side: v.side === 'blue' ? 'blue' : 'red',
    topic_id: v.topic?.id ?? '',
    topic_statement: v.topic?.statement ?? 'Unknown topic',
    topic_category: v.topic?.category ?? null,
    created_at: v.created_at,
  }))

  // ── Longest reason & avg length ───────────────────────────────────────────
  const reasons = withReason.map((v) => v.reason!).filter(Boolean)
  const longest_reason = reasons.reduce<string | null>(
    (acc, r) => (acc === null || r.length > acc.length ? r : acc),
    null
  )
  const avg_reason_length =
    reasons.length > 0
      ? Math.round(reasons.reduce((sum, r) => sum + r.length, 0) / reasons.length)
      : 0

  const result: ReasonsData = {
    total_reasons,
    total_votes,
    reason_rate,
    for_reasons,
    against_reasons,
    category_breakdown,
    monthly_trend,
    word_frequency,
    recent_reasons,
    longest_reason,
    avg_reason_length,
    most_active_category,
  }

  return NextResponse.json(result)
}
