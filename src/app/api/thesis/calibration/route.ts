import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Response Types ───────────────────────────────────────────────────────────

export interface CalibrationBucket {
  label: string          // e.g. "0–20% agree"
  min_pct: number        // 0
  max_pct: number        // 20
  total_resolved: number
  vindicated: number
  vindication_rate: number  // 0–100
  active_count: number      // how many active theses sit in this bucket
}

export interface ActiveThesisRow {
  id: string
  statement: string
  category: string
  agree_count: number
  disagree_count: number
  resolution_date: string | null
  created_at: string
  confidence_pct: number   // agree / (agree + disagree) * 100, or 50 if no votes
  total_votes: number
  author_username: string | null
  author_display_name: string | null
  author_avatar_url: string | null
  days_until_resolution: number | null
}

export interface CalibrationCategoryRow {
  category: string
  total_resolved: number
  vindicated: number
  vindication_rate: number
  active_count: number
  avg_confidence_pct: number  // avg community confidence on active theses in this category
}

export interface CalibrationResponse {
  buckets: CalibrationBucket[]
  categories: CalibrationCategoryRow[]
  high_confidence: ActiveThesisRow[]   // agree_pct >= 70
  contested: ActiveThesisRow[]         // agree_pct 35–65
  expiring_soon: ActiveThesisRow[]     // resolution_date within 30 days
  platform: {
    total_active: number
    total_resolved: number
    overall_vindication_rate: number
    avg_confidence_on_active: number
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function confidencePct(agree: number, disagree: number): number {
  const total = agree + disagree
  if (total === 0) return 50
  return Math.round((agree / total) * 100)
}

function daysUntil(dateStr: string | null): number | null {
  if (!dateStr) return null
  const diff = new Date(dateStr).getTime() - Date.now()
  return Math.ceil(diff / (1000 * 60 * 60 * 24))
}

const BUCKETS: Array<{ label: string; min: number; max: number }> = [
  { label: '0–20%', min: 0,  max: 20  },
  { label: '20–40%', min: 20, max: 40  },
  { label: '40–60%', min: 40, max: 60  },
  { label: '60–80%', min: 60, max: 80  },
  { label: '80–100%', min: 80, max: 101 },
]

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  const { data: allTheses } = await supabase
    .from('civic_theses')
    .select(
      `
      id, status, category, agree_count, disagree_count,
      resolution_date, created_at, statement,
      profiles!civic_theses_user_id_fkey(username, display_name, avatar_url)
      `
    )
    .eq('is_public', true)

  const raw = (allTheses ?? []) as Array<{
    id: string
    status: string
    category: string
    agree_count: number
    disagree_count: number
    resolution_date: string | null
    created_at: string
    statement: string
    profiles: { username: string; display_name: string | null; avatar_url: string | null } | null
  }>

  const resolved = raw.filter((t) => t.status === 'vindicated' || t.status === 'refuted')
  const active   = raw.filter((t) => t.status === 'active')

  // ── Calibration buckets ───────────────────────────────────────────────────

  const buckets: CalibrationBucket[] = BUCKETS.map(({ label, min, max }) => {
    const bucketResolved = resolved.filter((t) => {
      const pct = confidencePct(t.agree_count, t.disagree_count)
      return pct >= min && pct < max
    })
    const vindicated = bucketResolved.filter((t) => t.status === 'vindicated').length
    const bucketActive = active.filter((t) => {
      const pct = confidencePct(t.agree_count, t.disagree_count)
      return pct >= min && pct < max
    }).length

    return {
      label,
      min_pct: min,
      max_pct: max,
      total_resolved: bucketResolved.length,
      vindicated,
      vindication_rate:
        bucketResolved.length > 0
          ? Math.round((vindicated / bucketResolved.length) * 100)
          : 0,
      active_count: bucketActive,
    }
  })

  // ── Category stats ────────────────────────────────────────────────────────

  const catSet = new Set(raw.map((t) => t.category))
  const categories: CalibrationCategoryRow[] = Array.from(catSet).map((cat) => {
    const catResolved = resolved.filter((t) => t.category === cat)
    const catVindicated = catResolved.filter((t) => t.status === 'vindicated').length
    const catActive = active.filter((t) => t.category === cat)
    const avgConfidence =
      catActive.length > 0
        ? Math.round(
            catActive.reduce(
              (sum, t) => sum + confidencePct(t.agree_count, t.disagree_count),
              0
            ) / catActive.length
          )
        : 50

    return {
      category: cat,
      total_resolved: catResolved.length,
      vindicated: catVindicated,
      vindication_rate:
        catResolved.length > 0
          ? Math.round((catVindicated / catResolved.length) * 100)
          : 0,
      active_count: catActive.length,
      avg_confidence_pct: avgConfidence,
    }
  })
  categories.sort((a, b) => b.total_resolved - a.total_resolved)

  // ── Active thesis rows ────────────────────────────────────────────────────

  function toRow(t: (typeof raw)[number]): ActiveThesisRow {
    return {
      id: t.id,
      statement: t.statement,
      category: t.category,
      agree_count: t.agree_count,
      disagree_count: t.disagree_count,
      resolution_date: t.resolution_date,
      created_at: t.created_at,
      confidence_pct: confidencePct(t.agree_count, t.disagree_count),
      total_votes: t.agree_count + t.disagree_count,
      author_username: t.profiles?.username ?? null,
      author_display_name: t.profiles?.display_name ?? null,
      author_avatar_url: t.profiles?.avatar_url ?? null,
      days_until_resolution: daysUntil(t.resolution_date),
    }
  }

  const activeRows = active.map(toRow)

  // High confidence: >= 70% agree, at least 3 votes, sorted by confidence desc
  const high_confidence = activeRows
    .filter((t) => t.confidence_pct >= 70 && t.total_votes >= 3)
    .sort((a, b) => b.confidence_pct - a.confidence_pct || b.total_votes - a.total_votes)
    .slice(0, 10)

  // Contested: 35–65% agree, at least 3 votes, sorted by total_votes desc
  const contested = activeRows
    .filter((t) => t.confidence_pct >= 35 && t.confidence_pct <= 65 && t.total_votes >= 3)
    .sort((a, b) => b.total_votes - a.total_votes)
    .slice(0, 10)

  // Expiring soon: resolution_date within 30 days, sorted by days_until_resolution asc
  const now = Date.now()
  const expiring_soon = activeRows
    .filter((t) => {
      if (!t.resolution_date) return false
      const diff = new Date(t.resolution_date).getTime() - now
      return diff > 0 && diff <= 30 * 24 * 60 * 60 * 1000
    })
    .sort(
      (a, b) =>
        (a.days_until_resolution ?? 999) - (b.days_until_resolution ?? 999)
    )
    .slice(0, 10)

  // ── Platform stats ────────────────────────────────────────────────────────

  const vindicated_total = resolved.filter((t) => t.status === 'vindicated').length
  const avgConfidenceActive =
    active.length > 0
      ? Math.round(
          active.reduce(
            (sum, t) => sum + confidencePct(t.agree_count, t.disagree_count),
            0
          ) / active.length
        )
      : 50

  const response: CalibrationResponse = {
    buckets,
    categories,
    high_confidence,
    contested,
    expiring_soon,
    platform: {
      total_active: active.length,
      total_resolved: resolved.length,
      overall_vindication_rate:
        resolved.length > 0
          ? Math.round((vindicated_total / resolved.length) * 100)
          : 0,
      avg_confidence_on_active: avgConfidenceActive,
    },
  }

  return NextResponse.json(response)
}
