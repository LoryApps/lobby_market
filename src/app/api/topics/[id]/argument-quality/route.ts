import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export type Grade = 'A' | 'B' | 'C' | 'D' | 'F'
export type QualityTier = 'excellent' | 'good' | 'mixed' | 'poor' | 'ungraded'

export interface GradeCount {
  grade: Grade
  count: number
}

export interface SideQuality {
  avg_score: number | null
  graded_count: number
  grade_distribution: GradeCount[]
}

export interface ArgumentQualityResponse {
  topic_id: string
  total_arguments: number
  graded_arguments: number
  overall_avg_score: number | null
  quality_tier: QualityTier
  quality_label: string
  for_quality: SideQuality
  against_quality: SideQuality
  top_for_argument: {
    id: string
    content: string
    ai_grade: Grade | null
    ai_score: number | null
    upvotes: number
  } | null
  top_against_argument: {
    id: string
    content: string
    ai_grade: Grade | null
    ai_score: number | null
    upvotes: number
  } | null
}

const GRADES: Grade[] = ['A', 'B', 'C', 'D', 'F']

function computeQualityTier(avgScore: number | null, gradedCount: number): QualityTier {
  if (gradedCount === 0) return 'ungraded'
  if (avgScore === null) return 'ungraded'
  if (avgScore >= 8) return 'excellent'
  if (avgScore >= 6) return 'good'
  if (avgScore >= 4) return 'mixed'
  return 'poor'
}

function qualityLabel(tier: QualityTier): string {
  switch (tier) {
    case 'excellent': return 'Excellent Debate'
    case 'good':      return 'Good Debate'
    case 'mixed':     return 'Mixed Quality'
    case 'poor':      return 'Low Quality'
    case 'ungraded':  return 'Ungraded'
  }
}

function buildSideQuality(
  rows: { ai_grade: string | null; ai_score: number | null }[]
): SideQuality {
  const graded = rows.filter((r) => r.ai_grade && r.ai_score)
  const avg =
    graded.length > 0
      ? graded.reduce((sum, r) => sum + (r.ai_score ?? 0), 0) / graded.length
      : null

  const dist: GradeCount[] = GRADES.map((g) => ({
    grade: g,
    count: graded.filter((r) => r.ai_grade === g).length,
  }))

  return {
    avg_score: avg !== null ? Math.round(avg * 10) / 10 : null,
    graded_count: graded.length,
    grade_distribution: dist,
  }
}

export async function GET(
  _req: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('topic_arguments')
    .select('id, side, content, upvotes, ai_grade, ai_score')
    .eq('topic_id', params.id)
    .order('upvotes', { ascending: false })

  if (error) {
    return NextResponse.json({ error: 'Failed to fetch arguments' }, { status: 500 })
  }

  const rows = data ?? []
  const total = rows.length
  const graded = rows.filter((r) => r.ai_grade && r.ai_score)

  const overallAvg =
    graded.length > 0
      ? graded.reduce((sum, r) => sum + (r.ai_score ?? 0), 0) / graded.length
      : null

  const forRows = rows.filter((r) => r.side === 'blue')
  const againstRows = rows.filter((r) => r.side === 'red')

  const tier = computeQualityTier(overallAvg, graded.length)

  const topFor = forRows[0] ?? null
  const topAgainst = againstRows[0] ?? null

  const response: ArgumentQualityResponse = {
    topic_id: params.id,
    total_arguments: total,
    graded_arguments: graded.length,
    overall_avg_score: overallAvg !== null ? Math.round(overallAvg * 10) / 10 : null,
    quality_tier: tier,
    quality_label: qualityLabel(tier),
    for_quality: buildSideQuality(forRows),
    against_quality: buildSideQuality(againstRows),
    top_for_argument: topFor
      ? {
          id: topFor.id,
          content: topFor.content,
          ai_grade: (topFor.ai_grade as Grade | null) ?? null,
          ai_score: topFor.ai_score ?? null,
          upvotes: topFor.upvotes,
        }
      : null,
    top_against_argument: topAgainst
      ? {
          id: topAgainst.id,
          content: topAgainst.content,
          ai_grade: (topAgainst.ai_grade as Grade | null) ?? null,
          ai_score: topAgainst.ai_score ?? null,
          upvotes: topAgainst.upvotes,
        }
      : null,
  }

  return NextResponse.json(response, {
    headers: { 'Cache-Control': 'public, s-maxage=120, stale-while-revalidate=300' },
  })
}
