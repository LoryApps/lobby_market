import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ─────────────────────────────────────────────────────────────────────

export interface CategoryConviction {
  category: string
  totalVotes: number
  blueVotes: number
  redVotes: number
  bluePct: number            // 0-100
  convictionScore: number    // 0-100: 0 = perfectly split, 100 = always one side
  dominantSide: 'blue' | 'red' | 'balanced'
  swing: boolean             // true if convictionScore < 35
  stronghold: boolean        // true if convictionScore >= 75
}

export interface ConvictionMonthBucket {
  month: string              // "YYYY-MM"
  conviction: number         // 0-100 avg conviction that month
  votes: number
}

export interface ConvictionResponse {
  overall: {
    convictionScore: number     // 0-100 weighted avg across categories
    label: string               // "Steadfast", "Principled", "Independent", "Fluid"
    description: string
    totalVotedCategories: number
    strongholds: number
    swings: number
    platformAvg: number
  }
  categories: CategoryConviction[]
  monthlyTrend: ConvictionMonthBucket[]
  topStronghold: CategoryConviction | null
  topSwing: CategoryConviction | null
  generated_at: string
}

// ─── Conviction helpers ────────────────────────────────────────────────────────

function convictionScore(blue: number, total: number): number {
  if (total === 0) return 0
  const pct = blue / total
  return Math.round(Math.abs(pct - 0.5) * 200) // 0–100
}

function dominantSide(blue: number, total: number): 'blue' | 'red' | 'balanced' {
  if (total === 0) return 'balanced'
  const pct = blue / total
  if (pct >= 0.55) return 'blue'
  if (pct <= 0.45) return 'red'
  return 'balanced'
}

function convictionLabel(score: number): { label: string; description: string } {
  if (score >= 80) return {
    label: 'Steadfast',
    description: 'You vote with iron consistency. Once you\'ve formed a view, you hold it across every debate in the category.',
  }
  if (score >= 60) return {
    label: 'Principled',
    description: 'Strong convictions with room for nuance. You reliably lean one way but aren\'t rigid about it.',
  }
  if (score >= 40) return {
    label: 'Independent',
    description: 'You judge each debate on its merits. You have leanings but you\'re genuinely open to both sides.',
  }
  return {
    label: 'Fluid',
    description: 'You\'re a true swing voter. You weigh every topic individually — no category owns your vote.',
  }
}

// ─── Route handler ────────────────────────────────────────────────────────────

export async function GET(): Promise<NextResponse> {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // ── Fetch user's votes (last 2 years) ────────────────────────────────────
  const twoYearsAgo = new Date()
  twoYearsAgo.setFullYear(twoYearsAgo.getFullYear() - 2)

  const { data: votesRaw } = await supabase
    .from('votes')
    .select('id, side, created_at, topic_id')
    .eq('user_id', user.id)
    .gte('created_at', twoYearsAgo.toISOString())
    .order('created_at', { ascending: true })
    .limit(5000)

  const votes = votesRaw ?? []

  if (votes.length === 0) {
    const empty: ConvictionResponse = {
      overall: {
        convictionScore: 0,
        label: 'No data',
        description: 'Vote on at least 5 topics to see your conviction profile.',
        totalVotedCategories: 0,
        strongholds: 0,
        swings: 0,
        platformAvg: 52,
      },
      categories: [],
      monthlyTrend: [],
      topStronghold: null,
      topSwing: null,
      generated_at: new Date().toISOString(),
    }
    return NextResponse.json(empty)
  }

  // ── Fetch topic categories ────────────────────────────────────────────────
  const topicIds = Array.from(new Set(votes.map((v) => v.topic_id)))

  const { data: topicsRaw } = await supabase
    .from('topics')
    .select('id, category')
    .in('id', topicIds)

  const topicCategoryMap = new Map<string, string>(
    (topicsRaw ?? [])
      .filter((t): t is { id: string; category: string } => !!t.category)
      .map((t) => [t.id, t.category])
  )

  // ── Build per-category counts ─────────────────────────────────────────────
  const catMap = new Map<string, { blue: number; red: number }>()

  for (const vote of votes) {
    const cat = topicCategoryMap.get(vote.topic_id)
    if (!cat) continue
    const cur = catMap.get(cat) ?? { blue: 0, red: 0 }
    if (vote.side === 'blue') cur.blue++
    else cur.red++
    catMap.set(cat, cur)
  }

  // ── Build CategoryConviction array ────────────────────────────────────────
  const categories: CategoryConviction[] = Array.from(catMap.entries())
    .map(([category, { blue, red }]) => {
      const total = blue + red
      const score = convictionScore(blue, total)
      return {
        category,
        totalVotes: total,
        blueVotes: blue,
        redVotes: red,
        bluePct: total > 0 ? Math.round((blue / total) * 100) : 50,
        convictionScore: score,
        dominantSide: dominantSide(blue, total),
        swing: score < 35,
        stronghold: score >= 75,
      }
    })
    .filter((c) => c.totalVotes >= 3)  // filter noise
    .sort((a, b) => b.totalVotes - a.totalVotes)

  // ── Overall conviction score (weighted by vote count) ────────────────────
  const totalVotesInCats = categories.reduce((s, c) => s + c.totalVotes, 0)
  const weightedConviction = totalVotesInCats > 0
    ? categories.reduce((s, c) => s + c.convictionScore * c.totalVotes, 0) / totalVotesInCats
    : 0
  const overallScore = Math.round(weightedConviction)

  const strongholds = categories.filter((c) => c.stronghold).length
  const swings = categories.filter((c) => c.swing).length

  const { label, description } = convictionLabel(overallScore)

  // ── Monthly trend ─────────────────────────────────────────────────────────
  const monthMap = new Map<string, { blue: number; red: number }>()

  for (const vote of votes) {
    const cat = topicCategoryMap.get(vote.topic_id)
    if (!cat) continue
    const month = vote.created_at.slice(0, 7) // "YYYY-MM"
    const cur = monthMap.get(month) ?? { blue: 0, red: 0 }
    if (vote.side === 'blue') cur.blue++
    else cur.red++
    monthMap.set(month, cur)
  }

  // Last 12 months
  const monthlyTrend: ConvictionMonthBucket[] = Array.from(monthMap.entries())
    .map(([month, { blue, red }]) => ({
      month,
      conviction: convictionScore(blue, blue + red),
      votes: blue + red,
    }))
    .sort((a, b) => a.month.localeCompare(b.month))
    .slice(-12)

  // ── Platform average conviction (approximate from top profiles) ──────────
  // Simple heuristic: platform avg is around 52 (slightly leaning)
  const platformAvg = 52

  const topStronghold = categories.filter((c) => c.stronghold).sort((a, b) => b.convictionScore - a.convictionScore)[0] ?? null
  const topSwing = categories.filter((c) => c.swing).sort((a, b) => a.convictionScore - b.convictionScore)[0] ?? null

  const response: ConvictionResponse = {
    overall: {
      convictionScore: overallScore,
      label,
      description,
      totalVotedCategories: categories.length,
      strongholds,
      swings,
      platformAvg,
    },
    categories,
    monthlyTrend,
    topStronghold,
    topSwing,
    generated_at: new Date().toISOString(),
  }

  return NextResponse.json(response)
}
