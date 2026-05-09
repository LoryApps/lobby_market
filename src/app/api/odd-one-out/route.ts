import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface OddItem {
  id: string
  statement: string
  category: string
  status: string
  blue_pct: number
  total_votes: number
}

export interface OddOneOutRound {
  /** All 4 items shuffled — player must find the odd one */
  items: OddItem[]
  /** Index (0-3) into `items` that is the odd one out */
  oddIndex: number
  /** The shared category of the three majority items */
  majorityCategory: string
  /** The category of the odd item */
  oddCategory: string
}

export interface OddOneOutPayload {
  rounds: OddOneOutRound[]
  date: string
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function todayUTC(): string {
  return new Date().toISOString().slice(0, 10)
}

/** Deterministic seeded shuffle using today's date string as entropy. */
function seededShuffle<T>(arr: T[], seed: string): T[] {
  const copy = [...arr]
  let h = seed.split('').reduce((a, c) => (a * 31 + c.charCodeAt(0)) >>> 0, 7)
  for (let i = copy.length - 1; i > 0; i--) {
    h = ((h * 1664525) + 1013904223) >>> 0
    const j = h % (i + 1)
    ;[copy[i], copy[j]] = [copy[j], copy[i]]
  }
  return copy
}

/** Pick `n` items starting from `offset` wrapping around the pool. */
function pickFrom<T>(pool: T[], offset: number, n: number): T[] {
  const out: T[] = []
  for (let i = 0; i < n; i++) {
    out.push(pool[(offset + i) % pool.length])
  }
  return out
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET(_req: NextRequest) {
  const supabase = await createClient()

  // Fetch a reasonable pool of topics with known categories and enough votes
  const { data, error } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .in('status', ['active', 'voting', 'law', 'failed'])
    .gte('total_votes', 10)
    .not('category', 'is', null)
    .not('blue_pct', 'is', null)
    .order('total_votes', { ascending: false })
    .limit(400)

  if (error || !data) {
    return NextResponse.json({ error: 'Failed to load topics' }, { status: 500 })
  }

  // Group topics by category
  const byCategory = new Map<string, OddItem[]>()
  for (const t of data) {
    const cat = (t.category as string) ?? ''
    if (!cat) continue
    const item: OddItem = {
      id: t.id as string,
      statement: t.statement as string,
      category: cat,
      status: t.status as string,
      blue_pct: (t.blue_pct as number) ?? 50,
      total_votes: (t.total_votes as number) ?? 0,
    }
    const list = byCategory.get(cat) ?? []
    list.push(item)
    byCategory.set(cat, list)
  }

  // Only keep categories with enough items to form majority groups
  const eligibleCategories = Array.from(byCategory.entries())
    .filter(([, items]) => items.length >= 3)
    .map(([cat]) => cat)
    .sort()

  if (eligibleCategories.length < 2) {
    return NextResponse.json(
      { error: 'Not enough categorised topics yet' },
      { status: 503 }
    )
  }

  const date = todayUTC()

  // Build rounds deterministically from today's seed
  const ROUNDS_COUNT = 5
  const rounds: OddOneOutRound[] = []

  // Shuffle category list with today's seed for variety
  const shuffledCats = seededShuffle(eligibleCategories, date)

  let catOffset = 0
  const itemOffsetsByCategory: Record<string, number> = {}

  for (let r = 0; r < ROUNDS_COUNT; r++) {
    // Pick majority category (cycling through shuffled categories)
    const majorityCategory = shuffledCats[catOffset % shuffledCats.length]
    catOffset++

    // Pick a different category for the odd one out
    const oddCategory =
      shuffledCats[(catOffset + r + 1) % shuffledCats.length] === majorityCategory
        ? shuffledCats[(catOffset + r + 2) % shuffledCats.length]
        : shuffledCats[(catOffset + r + 1) % shuffledCats.length]

    const majorityPool = byCategory.get(majorityCategory)!
    const oddPool = byCategory.get(oddCategory)!

    // Pick 3 majority items and 1 odd item, rotating through pools each round
    const majOffset = itemOffsetsByCategory[majorityCategory] ?? r * 3
    const oddOffset = itemOffsetsByCategory[oddCategory] ?? r
    itemOffsetsByCategory[majorityCategory] = majOffset + 3
    itemOffsetsByCategory[oddCategory] = oddOffset + 1

    const majorityItems = pickFrom(majorityPool, majOffset, 3)
    const [oddItem] = pickFrom(oddPool, oddOffset, 1)

    if (!majorityItems[0] || !majorityItems[1] || !majorityItems[2] || !oddItem) {
      continue
    }

    // Shuffle the 4 items and track where the odd one ended up
    const allFour: OddItem[] = [...majorityItems, oddItem]
    const shuffled = seededShuffle(allFour, `${date}-round-${r}`)
    const oddIndex = shuffled.findIndex((item) => item.id === oddItem.id)

    rounds.push({
      items: shuffled,
      oddIndex,
      majorityCategory,
      oddCategory,
    })
  }

  if (rounds.length < 3) {
    return NextResponse.json(
      { error: 'Could not generate enough rounds' },
      { status: 503 }
    )
  }

  const payload: OddOneOutPayload = { rounds, date }
  return NextResponse.json(payload)
}
