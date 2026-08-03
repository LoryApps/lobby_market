import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MonthlyLaw {
  id: string
  statement: string
  category: string | null
  established_at: string
  blue_pct: number | null
  total_votes: number | null
  // Community scrutiny metrics
  verdict_count: number
  success_pct: number | null  // 0–100, null = no verdicts yet
  open_challenges: number
  total_challenges: number
  wiki_edits: number
  has_wiki: boolean
  chat_count: number
  // Composite engagement score
  engagement_score: number
}

export interface MonthlyStats {
  new_laws: number
  total_votes: number
  avg_blue_pct: number
  new_verdicts: number
  new_challenges: number
  new_wiki_edits: number
  categories: Array<{ category: string; count: number }>
}

export interface MonthlyLawResponse {
  stats: MonthlyStats
  laws: MonthlyLaw[]
  window_days: number
  generated_at: string
}

// ─── Verdict helpers ──────────────────────────────────────────────────────────

const VERDICT_WEIGHTS: Record<string, number> = {
  succeeded: 100,
  mostly_succeeded: 75,
  mixed: 50,
  mostly_failed: 25,
  failed: 0,
}

function computeSuccessPct(verdicts: string[]): number | null {
  if (verdicts.length === 0) return null
  const avg = verdicts.reduce((s, v) => s + (VERDICT_WEIGHTS[v] ?? 50), 0) / verdicts.length
  return Math.round(avg)
}

// ─── GET /api/laws/monthly ────────────────────────────────────────────────────

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url)
  const days = Math.min(Math.max(parseInt(searchParams.get('days') ?? '30', 10), 7), 90)

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const supabase = (await createClient()) as any

  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000).toISOString()

  // 1. Laws established in the window
  const { data: laws, error: lawsError } = await supabase
    .from('laws')
    .select('id, statement, category, established_at, blue_pct, total_votes, wiki_content')
    .eq('is_active', true)
    .gte('established_at', since)
    .order('established_at', { ascending: false })

  if (lawsError || !laws) {
    return NextResponse.json({ error: 'Failed to fetch laws' }, { status: 500 })
  }

  if (laws.length === 0) {
    const empty: MonthlyLawResponse = {
      stats: { new_laws: 0, total_votes: 0, avg_blue_pct: 0, new_verdicts: 0, new_challenges: 0, new_wiki_edits: 0, categories: [] },
      laws: [],
      window_days: days,
      generated_at: new Date().toISOString(),
    }
    return NextResponse.json(empty)
  }

  const lawIds: string[] = laws.map((l: { id: string }) => l.id)

  // 2. Community verdicts for these laws
  const { data: verdictRows } = await supabase
    .from('law_verdict_votes')
    .select('law_id, verdict')
    .in('law_id', lawIds)

  const verdictMap = new Map<string, string[]>()
  for (const r of verdictRows ?? []) {
    const existing = verdictMap.get(r.law_id) ?? []
    existing.push(r.verdict)
    verdictMap.set(r.law_id, existing)
  }

  // 3. Challenges for these laws
  const { data: challengeRows } = await supabase
    .from('law_challenges')
    .select('law_id, status')
    .in('law_id', lawIds)

  const challengeMap = new Map<string, { total: number; open: number }>()
  for (const r of challengeRows ?? []) {
    const entry = challengeMap.get(r.law_id) ?? { total: 0, open: 0 }
    entry.total++
    if (r.status === 'open') entry.open++
    challengeMap.set(r.law_id, entry)
  }

  // 4. Wiki edit counts
  const { data: wikiRows } = await supabase
    .from('law_wiki_history')
    .select('law_id')
    .in('law_id', lawIds)

  const wikiEditMap = new Map<string, number>()
  for (const r of wikiRows ?? []) {
    wikiEditMap.set(r.law_id, (wikiEditMap.get(r.law_id) ?? 0) + 1)
  }

  // 5. Chat message counts
  const { data: chatRows } = await supabase
    .from('law_chat_messages')
    .select('law_id')
    .in('law_id', lawIds)

  const chatCountMap = new Map<string, number>()
  for (const r of chatRows ?? []) {
    chatCountMap.set(r.law_id, (chatCountMap.get(r.law_id) ?? 0) + 1)
  }

  // 6. Assemble law records
  const assembled: MonthlyLaw[] = laws.map((l: {
    id: string; statement: string; category: string | null
    established_at: string; blue_pct: number | null; total_votes: number | null
    wiki_content: string | null
  }) => {
    const verdicts = verdictMap.get(l.id) ?? []
    const challenges = challengeMap.get(l.id) ?? { total: 0, open: 0 }
    const wiki_edits = wikiEditMap.get(l.id) ?? 0
    const chat_count = chatCountMap.get(l.id) ?? 0
    const success_pct = computeSuccessPct(verdicts)

    // Engagement score: weighted sum of community actions
    const engagement_score =
      verdicts.length * 3 +
      challenges.total * 5 +
      wiki_edits * 4 +
      chat_count * 1

    return {
      id: l.id,
      statement: l.statement,
      category: l.category,
      established_at: l.established_at,
      blue_pct: l.blue_pct,
      total_votes: l.total_votes,
      verdict_count: verdicts.length,
      success_pct,
      open_challenges: challenges.open,
      total_challenges: challenges.total,
      wiki_edits,
      has_wiki: !!l.wiki_content,
      chat_count,
      engagement_score,
    }
  })

  // 7. Stats
  const total_votes = assembled.reduce((s, l) => s + (l.total_votes ?? 0), 0)
  const avg_blue_pct = assembled.length > 0
    ? Math.round(assembled.reduce((s, l) => s + (l.blue_pct ?? 50), 0) / assembled.length)
    : 0
  const new_verdicts = assembled.reduce((s, l) => s + l.verdict_count, 0)
  const new_challenges = assembled.reduce((s, l) => s + l.total_challenges, 0)
  const new_wiki_edits = assembled.reduce((s, l) => s + l.wiki_edits, 0)

  const categoryCount = new Map<string, number>()
  for (const l of assembled) {
    if (l.category) categoryCount.set(l.category, (categoryCount.get(l.category) ?? 0) + 1)
  }
  const categories = Array.from(categoryCount.entries())
    .map(([category, count]) => ({ category, count }))
    .sort((a, b) => b.count - a.count)

  const stats: MonthlyStats = {
    new_laws: assembled.length,
    total_votes,
    avg_blue_pct,
    new_verdicts,
    new_challenges,
    new_wiki_edits,
    categories,
  }

  // Sort by most recent by default
  assembled.sort((a, b) => new Date(b.established_at).getTime() - new Date(a.established_at).getTime())

  const response: MonthlyLawResponse = {
    stats,
    laws: assembled,
    window_days: days,
    generated_at: new Date().toISOString(),
  }

  return NextResponse.json(response)
}
