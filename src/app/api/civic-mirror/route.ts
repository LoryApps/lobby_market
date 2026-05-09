import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface MirrorTopic {
  id: string
  statement: string
  category: string | null
  blue_pct: number
  total_votes: number
}

export interface MirrorPayload {
  topics: MirrorTopic[]
  seed: string
}

function dailySeed(): string {
  return new Date().toISOString().slice(0, 10)
}

function seededShuffle<T>(arr: T[], seed: string): T[] {
  let s = 0
  for (let i = 0; i < seed.length; i++) s = (s * 31 + seed.charCodeAt(i)) >>> 0
  const a = [...arr]
  for (let i = a.length - 1; i > 0; i--) {
    s = (s * 1664525 + 1013904223) >>> 0
    const j = s % (i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export async function GET() {
  try {
    const supabase = await createClient()

    const { data, error } = await supabase
      .from('topics')
      .select('id, statement, category, blue_pct, total_votes')
      .gte('total_votes', 20)
      .in('status', ['active', 'voting', 'law', 'failed'])
      .order('total_votes', { ascending: false })
      .limit(200)

    if (error || !data || data.length < 5) {
      return NextResponse.json({ error: 'Not enough data' }, { status: 503 })
    }

    const seed = dailySeed()

    const forMajority    = data.filter((t) => (t.blue_pct ?? 50) >= 60)
    const contested      = data.filter((t) => (t.blue_pct ?? 50) >= 40 && (t.blue_pct ?? 50) < 60)
    const againstMajority = data.filter((t) => (t.blue_pct ?? 50) < 40)

    const pool: typeof data = []
    pool.push(...seededShuffle(forMajority, seed + 'f').slice(0, 2))
    pool.push(...seededShuffle(contested, seed + 'c').slice(0, 1))
    pool.push(...seededShuffle(againstMajority, seed + 'a').slice(0, 2))

    if (pool.length < 5) {
      const seen = new Set(pool.map((t) => t.id))
      for (const t of seededShuffle(data, seed)) {
        if (!seen.has(t.id)) {
          pool.push(t)
          seen.add(t.id)
        }
        if (pool.length >= 5) break
      }
    }

    const topics: MirrorTopic[] = seededShuffle(pool, seed).slice(0, 5).map((t) => ({
      id: t.id,
      statement: t.statement,
      category: t.category ?? null,
      blue_pct: Math.round(t.blue_pct ?? 50),
      total_votes: t.total_votes ?? 0,
    }))

    return NextResponse.json({ topics, seed } satisfies MirrorPayload)
  } catch {
    return NextResponse.json({ error: 'Server error' }, { status: 500 })
  }
}
