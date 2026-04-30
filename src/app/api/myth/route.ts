import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface MythQuestion {
  id: string
  statement: string
  category: string | null
  answer: 'law' | 'myth'
  blue_pct: number
}

export interface MythPayload {
  questions: MythQuestion[]
  date: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pickDaily<T>(pool: T[], salt: string, count: number): T[] {
  if (pool.length === 0) return []
  if (pool.length <= count) return pool
  const hash = salt.split('').reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) | 0, 0)
  const start = Math.abs(hash) % pool.length
  const result: T[] = []
  for (let i = 0; i < count; i++) {
    result.push(pool[(start + i) % pool.length])
  }
  return result
}

function seededShuffle<T>(arr: T[], seed: number): T[] {
  const a = [...arr]
  let s = Math.abs(seed) >>> 0
  for (let i = a.length - 1; i > 0; i--) {
    s = ((s * 1664525 + 1013904223) >>> 0)
    const j = s % (i + 1)
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()
  const today = new Date().toISOString().slice(0, 10) // YYYY-MM-DD
  const dateSeed = today.split('').reduce((acc, c) => (acc * 31 + c.charCodeAt(0)) | 0, 0)

  // Fetch established laws (topics that passed voting)
  const { data: lawData } = await supabase
    .from('topics')
    .select('id, statement, category, blue_pct, total_votes')
    .eq('status', 'law')
    .gte('total_votes', 5)
    .order('total_votes', { ascending: false })
    .limit(120)

  // Fetch topics the community rejected
  const { data: failedData } = await supabase
    .from('topics')
    .select('id, statement, category, blue_pct, total_votes')
    .eq('status', 'failed')
    .gte('total_votes', 5)
    .order('total_votes', { ascending: false })
    .limit(120)

  const lawPool: MythQuestion[] = (lawData ?? []).map((t) => ({
    id: t.id,
    statement: t.statement,
    category: t.category ?? null,
    answer: 'law' as const,
    blue_pct: Math.round(t.blue_pct ?? 0),
  }))

  const mythPool: MythQuestion[] = (failedData ?? []).map((t) => ({
    id: t.id,
    statement: t.statement,
    category: t.category ?? null,
    answer: 'myth' as const,
    blue_pct: Math.round(t.blue_pct ?? 0),
  }))

  // If not enough failed topics, supplement with low-traction proposed topics
  if (mythPool.length < 2) {
    const { data: propData } = await supabase
      .from('topics')
      .select('id, statement, category, blue_pct')
      .eq('status', 'proposed')
      .lt('support_count', 5)
      .order('created_at', { ascending: false })
      .limit(50)

    const extra: MythQuestion[] = (propData ?? []).map((t) => ({
      id: t.id,
      statement: t.statement,
      category: t.category ?? null,
      answer: 'myth' as const,
      blue_pct: Math.round(t.blue_pct ?? 50),
    }))
    mythPool.push(...extra)
  }

  const totalAvailable = lawPool.length + mythPool.length
  if (totalAvailable < 3) {
    return NextResponse.json({ error: 'Not enough data yet' }, { status: 404 })
  }

  const TOTAL = 5
  const lawCount = Math.min(3, lawPool.length)
  const mythCount = Math.min(TOTAL - lawCount, mythPool.length)

  const selectedLaws = pickDaily(lawPool, today + '_law', lawCount)
  const selectedMyths = pickDaily(mythPool, today + '_myth', mythCount)

  const questions = seededShuffle(
    [...selectedLaws, ...selectedMyths],
    Math.abs(dateSeed),
  ).slice(0, TOTAL)

  return NextResponse.json({ questions, date: today } satisfies MythPayload)
}
