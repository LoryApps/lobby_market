import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 300

// ─── Types ────────────────────────────────────────────────────────────────────

export interface GradientBucket {
  pctMin: number
  pctMax: number
  label: string
  count: number
  laws: number
  topics: GradientTopic[]
}

export interface GradientTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
}

export interface CategoryStats {
  category: string
  count: number
  avgBluePct: number
  lawCount: number
  mostContested: GradientTopic | null
  strongestFor: GradientTopic | null
}

export interface GradientResponse {
  buckets: GradientBucket[]
  categories: CategoryStats[]
  totalTopics: number
  totalLaws: number
  medianBluePct: number
  meanBluePct: number
  polarizationScore: number  // 0–100: higher = more polarized (bimodal)
  consensusScore: number     // 0–100: higher = more consensus (unimodal near 50%)
  generatedAt: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const BUCKET_SIZE = 5 // 5% buckets → 20 buckets from 0–100%

// ─── Helpers ──────────────────────────────────────────────────────────────────

function bucketLabel(min: number): string {
  if (min < 10) return `<10% FOR`
  if (min >= 90) return `>90% FOR`
  if (min >= 62) return `${min}–${min + BUCKET_SIZE}% (law zone)`
  if (min >= 45 && min < 55) return `${min}–${min + BUCKET_SIZE}% (contested)`
  return `${min}–${min + BUCKET_SIZE}% FOR`
}

function median(sorted: number[]): number {
  if (sorted.length === 0) return 50
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid]
}

// Bimodality coefficient: 0=unimodal, 1=perfectly bimodal
// Uses the excess kurtosis and skewness formula.
function bimodalityCoefficient(values: number[]): number {
  const n = values.length
  if (n < 4) return 0
  const mean = values.reduce((s, v) => s + v, 0) / n
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / n
  const std = Math.sqrt(variance)
  if (std === 0) return 0
  const skew = values.reduce((s, v) => s + ((v - mean) / std) ** 3, 0) / n
  const kurt = values.reduce((s, v) => s + ((v - mean) / std) ** 4, 0) / n - 3
  return (skew ** 2 + 1) / (kurt + (3 * (n - 1) ** 2) / ((n - 2) * (n - 3)))
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()

    const { data: rows, error } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .not('blue_pct', 'is', null)
      .gt('total_votes', 0)
      .order('blue_pct', { ascending: true })

    if (error) throw error

    const topics = (rows ?? []) as GradientTopic[]

    // Build 5%-wide buckets (0–5, 5–10, ..., 95–100)
    const buckets: GradientBucket[] = Array.from({ length: 20 }, (_, i) => ({
      pctMin: i * BUCKET_SIZE,
      pctMax: (i + 1) * BUCKET_SIZE,
      label: bucketLabel(i * BUCKET_SIZE),
      count: 0,
      laws: 0,
      topics: [],
    }))

    const bluePcts: number[] = []

    for (const t of topics) {
      const pct = Math.min(100, Math.max(0, t.blue_pct ?? 50))
      bluePcts.push(pct)
      const bucketIdx = Math.min(19, Math.floor(pct / BUCKET_SIZE))
      buckets[bucketIdx].count++
      if (t.status === 'law') buckets[bucketIdx].laws++
      if (buckets[bucketIdx].topics.length < 5) {
        buckets[bucketIdx].topics.push(t)
      }
    }

    // Category stats
    const categoryMap: Record<string, GradientTopic[]> = {}
    for (const t of topics) {
      const cat = t.category ?? 'Other'
      if (!categoryMap[cat]) categoryMap[cat] = []
      categoryMap[cat].push(t)
    }

    const categories: CategoryStats[] = CATEGORIES
      .filter((c) => categoryMap[c]?.length > 0)
      .map((cat) => {
        const list = categoryMap[cat]
        const avg = list.reduce((s, t) => s + (t.blue_pct ?? 50), 0) / list.length
        const laws = list.filter((t) => t.status === 'law').length
        const sorted = [...list].sort((a, b) => {
          const da = Math.abs((a.blue_pct ?? 50) - 50)
          const db = Math.abs((b.blue_pct ?? 50) - 50)
          return da - db  // most contested first
        })
        const sortedFor = [...list].sort((a, b) => (b.blue_pct ?? 50) - (a.blue_pct ?? 50))
        return {
          category: cat,
          count: list.length,
          avgBluePct: Math.round(avg),
          lawCount: laws,
          mostContested: sorted[0] ?? null,
          strongestFor: sortedFor[0] ?? null,
        }
      })

    // Global stats
    const mean = bluePcts.length
      ? bluePcts.reduce((s, v) => s + v, 0) / bluePcts.length
      : 50
    const med = median(bluePcts)
    const bmc = bimodalityCoefficient(bluePcts)
    // Polarization: high BC → high polarization
    const polarizationScore = Math.min(100, Math.round(bmc * 100))
    // Consensus: inversely correlated; topics clustered near 50 = high consensus
    const contestedShare = topics.filter(
      (t) => (t.blue_pct ?? 50) >= 40 && (t.blue_pct ?? 50) < 60
    ).length / Math.max(1, topics.length)
    const consensusScore = Math.round(contestedShare * 100)

    return NextResponse.json({
      buckets,
      categories,
      totalTopics: topics.length,
      totalLaws: topics.filter((t) => t.status === 'law').length,
      medianBluePct: Math.round(med),
      meanBluePct: Math.round(mean),
      polarizationScore,
      consensusScore,
      generatedAt: new Date().toISOString(),
    } satisfies GradientResponse)
  } catch {
    return NextResponse.json({ error: 'Failed to load gradient data' }, { status: 500 })
  }
}
