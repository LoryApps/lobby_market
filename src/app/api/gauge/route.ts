import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface GaugeQuestion {
  id: string
  statement: string
  category: string | null
  status: 'law' | 'failed'
  total_votes: number
  true_pct: number // percentage that voted FOR (0–100)
}

export interface GaugePayload {
  questions: GaugeQuestion[]
  date: string
}

function seededShuffle<T>(arr: T[], seed: string): T[] {
  const result = [...arr]
  let s = seed.split('').reduce((acc, c) => acc * 31 + c.charCodeAt(0), 7)
  for (let i = result.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) & 0xffffffff
    const j = Math.abs(s) % (i + 1)
    ;[result[i], result[j]] = [result[j], result[i]]
  }
  return result
}

export async function GET(_req: NextRequest) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .in('status', ['law', 'failed'])
    .gte('total_votes', 10)
    .not('blue_pct', 'is', null)
    .order('total_votes', { ascending: false })
    .limit(300)

  if (error) {
    return NextResponse.json({ error: 'Failed to load questions' }, { status: 500 })
  }

  // Exclude trivial cases (0% or 100% FOR) and map to typed questions
  const pool: GaugeQuestion[] = (data ?? [])
    .filter((t) => t.blue_pct > 0 && t.blue_pct < 100)
    .map((t) => ({
      id: t.id,
      statement: t.statement,
      category: t.category ?? null,
      status: t.status as 'law' | 'failed',
      total_votes: t.total_votes,
      true_pct: Math.round(t.blue_pct),
    }))

  const date = new Date().toISOString().slice(0, 10)
  const shuffled = seededShuffle(pool, date)
  const questions = shuffled.slice(0, 5)

  return NextResponse.json({ questions, date } satisfies GaugePayload)
}
