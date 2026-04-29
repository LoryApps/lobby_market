import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface TriviaQuestion {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number       // the actual answer (0–100)
  total_votes: number
  scope: string | null
}

export interface TriviaPayload {
  questions: TriviaQuestion[]
  date: string  // YYYY-MM-DD seed so same seed → same questions per day
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/**
 * Deterministic daily seed: pick 5 questions from the pool based on today's
 * date. Pool is sorted by id so ordering is stable. We use the date to offset
 * the starting index so the set rotates daily.
 */
function pickDaily(pool: TriviaQuestion[], seed: string, count: number): TriviaQuestion[] {
  if (pool.length <= count) return pool
  const hash = seed.split('').reduce((acc, c) => acc * 31 + c.charCodeAt(0), 0)
  const start = Math.abs(hash) % pool.length
  const result: TriviaQuestion[] = []
  for (let i = 0; i < count; i++) {
    result.push(pool[(start + i) % pool.length])
  }
  return result
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest) {
  const supabase = await createClient()

  // Pull topics that have enough votes to be interesting trivia
  const { data, error } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, scope')
    .in('status', ['active', 'voting', 'law', 'failed'])
    .gte('total_votes', 20)
    .not('blue_pct', 'is', null)
    .lte('statement', 'z')   // ensure statements exist
    .order('total_votes', { ascending: false })
    .limit(200)

  if (error) {
    return NextResponse.json({ error: 'Failed to load questions' }, { status: 500 })
  }

  const pool: TriviaQuestion[] = (data ?? []).map((t) => ({
    id: t.id,
    statement: t.statement,
    category: t.category ?? null,
    status: t.status,
    blue_pct: Math.round(t.blue_pct ?? 50),
    total_votes: t.total_votes ?? 0,
    scope: t.scope ?? null,
  }))

  if (pool.length === 0) {
    return NextResponse.json({ error: 'Not enough data yet' }, { status: 404 })
  }

  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const questions = pickDaily(pool, today, Math.min(5, pool.length))

  return NextResponse.json({ questions, date: today } satisfies TriviaPayload)
}
