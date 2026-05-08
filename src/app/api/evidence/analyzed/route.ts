import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export interface AnalyzedTopicItem {
  topic_id: string
  topic_statement: string
  topic_category: string | null
  quality_score: number
  bias_score: number
  evidence_count: number
  for_count: number
  against_count: number
  neutral_count: number
  key_claim: string
  missing_perspective: string
  generated_at: string
}

export interface AnalyzedResponse {
  topics: AnalyzedTopicItem[]
  total: number
}

export async function GET() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('topic_evidence_analysis')
    .select(`
      topic_id,
      quality_score,
      bias_score,
      evidence_count,
      for_count,
      against_count,
      neutral_count,
      key_claim,
      missing_perspective,
      generated_at,
      topics!inner ( statement, category )
    `)
    .order('quality_score', { ascending: false })
    .limit(20)

  if (error || !data) {
    return NextResponse.json({ topics: [], total: 0 } satisfies AnalyzedResponse)
  }

  const topics: AnalyzedTopicItem[] = (data as unknown as Array<{
    topic_id: string
    quality_score: number
    bias_score: number
    evidence_count: number
    for_count: number
    against_count: number
    neutral_count: number
    key_claim: string
    missing_perspective: string
    generated_at: string
    topics: { statement: string; category: string | null }
  }>).map((row) => ({
    topic_id: row.topic_id,
    topic_statement: row.topics.statement,
    topic_category: row.topics.category,
    quality_score: row.quality_score,
    bias_score: row.bias_score,
    evidence_count: row.evidence_count,
    for_count: row.for_count,
    against_count: row.against_count,
    neutral_count: row.neutral_count,
    key_claim: row.key_claim,
    missing_perspective: row.missing_perspective,
    generated_at: row.generated_at,
  }))

  return NextResponse.json({ topics, total: topics.length } satisfies AnalyzedResponse)
}
