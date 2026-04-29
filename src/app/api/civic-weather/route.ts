import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 300 // 5-minute cache

// ─── Types ────────────────────────────────────────────────────────────────────

export type WeatherCondition =
  | 'scorching'
  | 'sunny'
  | 'partly_cloudy'
  | 'overcast'
  | 'stormy'
  | 'thunderstorm'

export type WeatherTrend = 'warming' | 'cooling' | 'stable'

export interface CategoryWeather {
  category: string
  condition: WeatherCondition
  conditionLabel: string
  conditionDesc: string
  temperature: number      // avg blue_pct 0–100 (50 = perfect deadlock)
  wind: number             // debate activity score 0–100
  precipitation: number    // polarization score (% of topics within ±10 of 50/50), 0–100
  topicCount: number
  lawCount: number
  hotTopicId: string | null
  hotTopicStatement: string | null
  trend: WeatherTrend
}

export interface GlobalForecast {
  overallPolarization: number
  hottestCategory: string | null
  mostActiveCategory: string | null
  totalActiveTopics: number
  recentLaws: number
  condition: WeatherCondition
  conditionLabel: string
  generatedAt: string
}

export interface CivicWeatherResponse {
  categories: CategoryWeather[]
  global: GlobalForecast
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Politics', 'Economics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function computeCondition(
  avgBluePct: number,
  polarizationPct: number,
  windScore: number,
): WeatherCondition {
  const deviation = Math.abs(avgBluePct - 50)

  if (deviation >= 25) return 'scorching'
  if (deviation >= 17) return 'sunny'

  // Below 17° deviation — contested territory
  if (polarizationPct >= 55 && windScore >= 55) return 'thunderstorm'
  if (polarizationPct >= 40) return 'stormy'
  if (windScore >= 55) return 'partly_cloudy'
  return 'overcast'
}

function conditionMeta(
  c: WeatherCondition,
  avgBluePct: number,
): { label: string; desc: string } {
  const side = avgBluePct >= 50 ? 'FOR' : 'AGAINST'
  switch (c) {
    case 'scorching':
      return {
        label: 'Clear Skies',
        desc: `Strong consensus: ${side} is dominating every debate.`,
      }
    case 'sunny':
      return {
        label: 'Mostly Sunny',
        desc: `${side} has a clear edge. Dissent is minimal.`,
      }
    case 'partly_cloudy':
      return {
        label: 'Partly Cloudy',
        desc: 'Debates are lively but no definitive majority yet.',
      }
    case 'overcast':
      return {
        label: 'Overcast',
        desc: 'Opinion is split. No clear direction emerging.',
      }
    case 'stormy':
      return {
        label: 'Storm Warning',
        desc: 'Deeply polarised debates. No consensus in sight.',
      }
    case 'thunderstorm':
      return {
        label: 'Thunderstorm',
        desc: 'Maximum polarisation — arguments flying everywhere.',
      }
  }
}

// ─── GET handler ──────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()

    // 1. All active/voting/law topics with category
    const { data: topicRows } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, feed_score, created_at')
      .in('status', ['active', 'voting', 'law'])
      .not('category', 'is', null)

    const topics = topicRows ?? []

    // 2. Recent (7-day) argument counts per topic_id — proxy for wind/activity
    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: recentArgRows } = await supabase
      .from('arguments')
      .select('topic_id')
      .gte('created_at', sevenDaysAgo)

    const argsByTopic = new Map<string, number>()
    for (const row of recentArgRows ?? []) {
      argsByTopic.set(row.topic_id, (argsByTopic.get(row.topic_id) ?? 0) + 1)
    }

    // 3. Laws in last 30 days per category
    const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000).toISOString()
    const { data: recentLawRows } = await supabase
      .from('laws')
      .select('category')
      .gte('established_at', thirtyDaysAgo)

    const recentLawsByCategory = new Map<string, number>()
    for (const row of recentLawRows ?? []) {
      if (row.category) {
        recentLawsByCategory.set(
          row.category,
          (recentLawsByCategory.get(row.category) ?? 0) + 1,
        )
      }
    }

    // 4. "Historical" topics older than 14 days (for trend comparison)
    const fourteenDaysAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString()

    // ─── Build per-category stats ─────────────────────────────────────────────

    // Find max argument count for normalisation
    let maxArgCount = 0
    for (const t of topics) {
      const cnt = argsByTopic.get(t.id) ?? 0
      if (cnt > maxArgCount) maxArgCount = cnt
    }
    if (maxArgCount === 0) maxArgCount = 1

    const categoryResults: CategoryWeather[] = []
    for (const cat of CATEGORIES) {
      const catTopics = topics.filter(
        (t) => t.category === cat && t.status !== 'law',
      )
      const catLawTopics = topics.filter(
        (t) => t.category === cat && t.status === 'law',
      )

      if (catTopics.length === 0) {
        // Still show the category with minimal data
        categoryResults.push({
          category: cat,
          condition: 'overcast',
          conditionLabel: 'No Data',
          conditionDesc: 'No active debates in this category yet.',
          temperature: 50,
          wind: 0,
          precipitation: 0,
          topicCount: 0,
          lawCount: recentLawsByCategory.get(cat) ?? 0,
          hotTopicId: null,
          hotTopicStatement: null,
          trend: 'stable',
        })
        continue
      }

      // Average blue_pct (temperature)
      const avgBluePct =
        catTopics.reduce((s, t) => s + (typeof t.blue_pct === 'number' ? t.blue_pct : 50), 0) /
        catTopics.length

      // Polarization: % of topics within ±10 of 50
      const contestedCount = catTopics.filter((t) => {
        const pct = typeof t.blue_pct === 'number' ? t.blue_pct : 50
        return pct >= 40 && pct <= 60
      }).length
      const polarizationPct = (contestedCount / catTopics.length) * 100

      // Wind: normalised argument activity across category topics
      const totalArgs = catTopics.reduce((s, t) => s + (argsByTopic.get(t.id) ?? 0), 0)
      const avgArgsPerTopic = totalArgs / catTopics.length
      // Normalise to 0-100 using a soft cap: 20+ args/topic/week = 100
      const windScore = Math.min(100, (avgArgsPerTopic / 20) * 100)

      // Trend: compare avg_blue_pct of new topics (<14 days) vs older
      const recentCatTopics = catTopics.filter((t) => t.created_at >= fourteenDaysAgo)
      const olderCatTopics = catTopics.filter((t) => t.created_at < fourteenDaysAgo)
      let trend: WeatherTrend = 'stable'
      if (recentCatTopics.length >= 2 && olderCatTopics.length >= 2) {
        const recentAvg =
          recentCatTopics.reduce((s, t) => s + (t.blue_pct ?? 50), 0) /
          recentCatTopics.length
        const olderAvg =
          olderCatTopics.reduce((s, t) => s + (t.blue_pct ?? 50), 0) /
          olderCatTopics.length
        const delta = recentAvg - olderAvg
        if (delta > 3) trend = 'warming'
        else if (delta < -3) trend = 'cooling'
      }

      // Hot topic: highest feed_score
      const sorted = [...catTopics].sort(
        (a, b) => (b.feed_score ?? 0) - (a.feed_score ?? 0),
      )
      const hot = sorted[0] ?? null

      const condition = computeCondition(avgBluePct, polarizationPct, windScore)
      const meta = conditionMeta(condition, avgBluePct)

      categoryResults.push({
        category: cat,
        condition,
        conditionLabel: meta.label,
        conditionDesc: meta.desc,
        temperature: Math.round(avgBluePct),
        wind: Math.round(windScore),
        precipitation: Math.round(polarizationPct),
        topicCount: catTopics.length,
        lawCount: (recentLawsByCategory.get(cat) ?? 0) + catLawTopics.length,
        hotTopicId: hot?.id ?? null,
        hotTopicStatement: hot?.statement ?? null,
        trend,
      })
    }

    // ─── Global forecast ──────────────────────────────────────────────────────

    const overallPolarization =
      categoryResults.length > 0
        ? Math.round(
            categoryResults.reduce((s, c) => s + c.precipitation, 0) /
              categoryResults.length,
          )
        : 0

    const hottestCategory =
      categoryResults.reduce(
        (best, c) =>
          Math.abs(c.temperature - 50) > Math.abs((best?.temperature ?? 50) - 50)
            ? c
            : best,
        null as CategoryWeather | null,
      )?.category ?? null

    const mostActiveCategory =
      categoryResults.reduce(
        (best, c) => (c.wind > (best?.wind ?? -1) ? c : best),
        null as CategoryWeather | null,
      )?.category ?? null

    const totalActiveTopics = topics.filter(
      (t) => t.status === 'active' || t.status === 'voting',
    ).length

    const recentLaws = Array.from(recentLawsByCategory.values()).reduce(
      (s, n) => s + n,
      0,
    )

    const globalAvgBluePct =
      topics.length > 0
        ? topics.reduce((s, t) => s + (t.blue_pct ?? 50), 0) / topics.length
        : 50
    const globalAvgWind =
      categoryResults.length > 0
        ? categoryResults.reduce((s, c) => s + c.wind, 0) / categoryResults.length
        : 0
    const globalCondition = computeCondition(
      globalAvgBluePct,
      overallPolarization,
      globalAvgWind,
    )
    const globalMeta = conditionMeta(globalCondition, globalAvgBluePct)

    const global: GlobalForecast = {
      overallPolarization,
      hottestCategory,
      mostActiveCategory,
      totalActiveTopics,
      recentLaws,
      condition: globalCondition,
      conditionLabel: globalMeta.label,
      generatedAt: new Date().toISOString(),
    }

    return NextResponse.json({ categories: categoryResults, global } satisfies CivicWeatherResponse)
  } catch (err) {
    console.error('[civic-weather]', err)
    return NextResponse.json(
      { categories: [], global: null },
      { status: 500 },
    )
  }
}
