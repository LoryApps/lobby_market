import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface ThinMarket {
  id: string
  statement: string
  category: string | null
  status: string
  price: number
  vote_count: number
  days_since_activity: number
  participants_needed: number
}

export interface StaleMarket {
  id: string
  statement: string
  category: string | null
  status: string
  price: number
  vote_count: number
  days_stale: number
  created_at: string
}

export interface CategoryHealth {
  category: string
  market_count: number
  active_count: number
  avg_votes_per_market: number
  resolution_rate: number   // % of non-active markets that became law
  avg_price: number
  health_score: number      // 0–100 composite
  trend: 'growing' | 'stable' | 'declining'
}

export interface HealthVitals {
  total_markets: number
  active_markets: number
  thin_markets: number       // <10 votes
  stale_markets: number      // no activity in 7+ days
  avg_votes_per_market: number
  overall_resolution_rate: number  // % that became law
  market_quality_score: number     // 0–100
  coverage_score: number           // how well all categories are represented
}

export interface HealthResponse {
  vitals: HealthVitals
  category_health: CategoryHealth[]
  thin_markets: ThinMarket[]
  stale_markets: StaleMarket[]
  as_of: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const THIN_THRESHOLD = 10     // markets with fewer votes than this are "thin"
const STALE_DAYS = 7           // days without activity = "stale"

// ─── Helpers ─────────────────────────────────────────────────────────────────

function healthScore(cat: {
  market_count: number
  avg_votes_per_market: number
  resolution_rate: number
  active_count: number
}): number {
  // Coverage: having at least 5 markets in a category = 30 pts
  const coverageScore = Math.min(30, (cat.market_count / 5) * 30)
  // Participation: avg 50+ votes = 40 pts
  const participationScore = Math.min(40, (cat.avg_votes_per_market / 50) * 40)
  // Resolution: 30% resolution rate = 30 pts (civic markets are naturally slow)
  const resolutionScore = Math.min(30, (cat.resolution_rate / 30) * 30)
  return Math.round(coverageScore + participationScore + resolutionScore)
}

function marketQualityScore(vitals: {
  thin_markets: number
  total_markets: number
  avg_votes_per_market: number
  overall_resolution_rate: number
}): number {
  if (vitals.total_markets === 0) return 0
  const thinRatio = 1 - vitals.thin_markets / vitals.total_markets
  const participationScore = Math.min(1, vitals.avg_votes_per_market / 100)
  const resolutionScore = Math.min(1, vitals.overall_resolution_rate / 30)
  return Math.round((thinRatio * 40 + participationScore * 40 + resolutionScore * 20))
}

function fallback(): HealthResponse {
  return {
    vitals: {
      total_markets: 0,
      active_markets: 0,
      thin_markets: 0,
      stale_markets: 0,
      avg_votes_per_market: 0,
      overall_resolution_rate: 0,
      market_quality_score: 0,
      coverage_score: 0,
    },
    category_health: [],
    thin_markets: [],
    stale_markets: [],
    as_of: new Date().toISOString(),
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()
    const staleThreshold = new Date(Date.now() - STALE_DAYS * 86_400_000).toISOString()

    // Fetch all non-proposed topics
    const { data: topics, error } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes, feed_score, created_at, updated_at')
      .neq('status', 'proposed')
      .limit(1000)

    if (error || !topics) return NextResponse.json(fallback())

    const now = Date.now()

    // ── Thin markets ─────────────────────────────────────────────────────────

    const thin_markets: ThinMarket[] = topics
      .filter(t => (t.total_votes ?? 0) < THIN_THRESHOLD && (t.status === 'active' || t.status === 'voting'))
      .sort((a, b) => (a.total_votes ?? 0) - (b.total_votes ?? 0))
      .slice(0, 12)
      .map(t => {
        const daysSince = Math.floor((now - new Date(t.updated_at).getTime()) / 86_400_000)
        return {
          id: t.id,
          statement: t.statement,
          category: t.category as string | null,
          status: t.status,
          price: Math.round(t.blue_pct ?? 50),
          vote_count: t.total_votes ?? 0,
          days_since_activity: daysSince,
          participants_needed: THIN_THRESHOLD - (t.total_votes ?? 0),
        }
      })

    // ── Stale markets ────────────────────────────────────────────────────────

    const stale_markets: StaleMarket[] = topics
      .filter(t =>
        (t.status === 'active' || t.status === 'voting') &&
        t.updated_at < staleThreshold
      )
      .sort((a, b) => new Date(a.updated_at).getTime() - new Date(b.updated_at).getTime())
      .slice(0, 12)
      .map(t => {
        const daysStale = Math.floor((now - new Date(t.updated_at).getTime()) / 86_400_000)
        return {
          id: t.id,
          statement: t.statement,
          category: t.category as string | null,
          status: t.status,
          price: Math.round(t.blue_pct ?? 50),
          vote_count: t.total_votes ?? 0,
          days_stale: daysStale,
          created_at: t.created_at,
        }
      })

    // ── Category health ───────────────────────────────────────────────────────

    const byCategory = new Map<string, typeof topics>()
    for (const cat of CATEGORIES) byCategory.set(cat, [])

    for (const t of topics) {
      const cat = (t.category as string | null) ?? 'Other'
      if (byCategory.has(cat)) byCategory.get(cat)!.push(t)
    }

    const category_health: CategoryHealth[] = CATEGORIES.map(cat => {
      const ts = byCategory.get(cat) ?? []
      if (ts.length === 0) {
        return {
          category: cat,
          market_count: 0,
          active_count: 0,
          avg_votes_per_market: 0,
          resolution_rate: 0,
          avg_price: 50,
          health_score: 0,
          trend: 'stable' as const,
        }
      }

      const active = ts.filter(t => t.status === 'active' || t.status === 'voting')
      const settled = ts.filter(t => t.status === 'law' || t.status === 'failed')
      const laws = ts.filter(t => t.status === 'law')
      const totalVotes = ts.reduce((s, t) => s + (t.total_votes ?? 0), 0)
      const avgVotes = ts.length > 0 ? Math.round(totalVotes / ts.length) : 0
      const avgPrice = active.length > 0
        ? Math.round(active.reduce((s, t) => s + (t.blue_pct ?? 50), 0) / active.length)
        : 50
      const resolutionRate = settled.length > 0
        ? Math.round((laws.length / settled.length) * 100)
        : 0

      const score = healthScore({
        market_count: ts.length,
        avg_votes_per_market: avgVotes,
        resolution_rate: resolutionRate,
        active_count: active.length,
      })

      // Simple trend: more than 25% of category markets updated recently
      const recentlyActive = ts.filter(t => t.updated_at >= staleThreshold).length
      const trendRatio = ts.length > 0 ? recentlyActive / ts.length : 0
      const trend: CategoryHealth['trend'] = trendRatio > 0.4 ? 'growing' : trendRatio > 0.15 ? 'stable' : 'declining'

      return {
        category: cat,
        market_count: ts.length,
        active_count: active.length,
        avg_votes_per_market: avgVotes,
        resolution_rate: resolutionRate,
        avg_price: avgPrice,
        health_score: score,
        trend,
      }
    }).sort((a, b) => b.health_score - a.health_score)

    // ── Overall vitals ────────────────────────────────────────────────────────

    const active = topics.filter(t => t.status === 'active' || t.status === 'voting')
    const settled = topics.filter(t => t.status === 'law' || t.status === 'failed')
    const laws = topics.filter(t => t.status === 'law')
    const totalVotes = topics.reduce((s, t) => s + (t.total_votes ?? 0), 0)
    const avgVotes = topics.length > 0 ? Math.round(totalVotes / topics.length) : 0
    const resolutionRate = settled.length > 0
      ? Math.round((laws.length / settled.length) * 100)
      : 0

    // Coverage: how many of the 10 categories have at least 1 active market
    const coveredCategories = CATEGORIES.filter(cat => {
      const ts = byCategory.get(cat) ?? []
      return ts.some(t => t.status === 'active' || t.status === 'voting')
    }).length
    const coverageScore = Math.round((coveredCategories / CATEGORIES.length) * 100)

    const vitals: HealthVitals = {
      total_markets: topics.length,
      active_markets: active.length,
      thin_markets: thin_markets.length,
      stale_markets: stale_markets.length,
      avg_votes_per_market: avgVotes,
      overall_resolution_rate: resolutionRate,
      market_quality_score: marketQualityScore({
        thin_markets: topics.filter(t => (t.total_votes ?? 0) < THIN_THRESHOLD && t.status === 'active').length,
        total_markets: topics.length,
        avg_votes_per_market: avgVotes,
        overall_resolution_rate: resolutionRate,
      }),
      coverage_score: coverageScore,
    }

    return NextResponse.json({
      vitals,
      category_health,
      thin_markets,
      stale_markets,
      as_of: new Date().toISOString(),
    } satisfies HealthResponse)
  } catch (err) {
    console.error('[exchange/health]', err)
    return NextResponse.json(fallback())
  }
}
