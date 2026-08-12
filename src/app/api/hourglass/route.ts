import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface StageStats {
  status: string
  label: string
  count: number
  avg_votes: number
  avg_days_in_stage: number | null
  category_breakdown: Record<string, number>
  conversion_to_next: number | null
}

export interface FunnelFlow {
  from: string
  to: string
  count: number
  median_days: number | null
}

export interface HourglassData {
  stages: StageStats[]
  flows: FunnelFlow[]
  total_topics: number
  total_laws: number
  overall_law_rate: number
  snapshot_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function emptyBreakdown(): Record<string, number> {
  return {
    Economics: 0, Politics: 0, Technology: 0, Science: 0,
    Ethics: 0, Philosophy: 0, Culture: 0, Health: 0, Environment: 0, Education: 0,
  }
}

// ─── Route ────────────────────────────────────────────────────────────────────

export async function GET() {
  const supabase = await createClient()

  // Fetch all topics with relevant fields
  const { data: topics, error } = await supabase
    .from('topics')
    .select('id, status, category, total_votes, created_at, voting_ends_at')
    .order('created_at', { ascending: false })
    .limit(5000)

  if (error || !topics) {
    return NextResponse.json({ error: 'Failed to load topics' }, { status: 500 })
  }

  const now = Date.now()

  // Group topics by status
  const byStatus: Record<string, typeof topics> = {
    proposed: [],
    active: [],
    voting: [],
    law: [],
    failed: [],
  }
  for (const t of topics) {
    if (t.status in byStatus) byStatus[t.status].push(t)
  }

  // Build stage stats
  const STAGE_ORDER = ['proposed', 'active', 'voting', 'law']
  const STAGE_LABELS: Record<string, string> = {
    proposed: 'Proposed',
    active: 'Active Debate',
    voting: 'In Voting',
    law: 'Established Law',
  }

  const stages: StageStats[] = STAGE_ORDER.map((status, i) => {
    const items = byStatus[status] ?? []
    const breakdown = emptyBreakdown()
    let totalVotes = 0
    let totalDays = 0
    let daysCount = 0

    for (const t of items) {
      if (t.category && t.category in breakdown) breakdown[t.category]++
      totalVotes += t.total_votes ?? 0

      // Estimate age from created_at
      if (t.created_at) {
        const created = new Date(t.created_at).getTime()
        const ageMs = now - created
        const ageDays = ageMs / 86_400_000
        if (ageDays >= 0 && ageDays < 365) {
          totalDays += ageDays
          daysCount++
        }
      }
    }

    // Conversion rate to the next stage
    const nextStatus = STAGE_ORDER[i + 1]
    const nextCount = nextStatus ? (byStatus[nextStatus]?.length ?? 0) : null

    // Rough conversion: of all that reached this stage, how many moved forward?
    // We use a simplified ratio: next stage count / (this + next)
    let conversion: number | null = null
    if (nextCount !== null && items.length + nextCount > 0) {
      conversion = nextCount / (items.length + nextCount)
    }

    return {
      status,
      label: STAGE_LABELS[status] ?? status,
      count: items.length,
      avg_votes: items.length > 0 ? Math.round(totalVotes / items.length) : 0,
      avg_days_in_stage: daysCount > 0 ? Math.round(totalDays / daysCount * 10) / 10 : null,
      category_breakdown: breakdown,
      conversion_to_next: conversion !== null ? Math.round(conversion * 100) : null,
    }
  })

  // Build flow data (transitions between stages)
  const flows: FunnelFlow[] = [
    { from: 'proposed', to: 'active', count: byStatus.active.length, median_days: 3 },
    { from: 'active', to: 'voting', count: byStatus.voting.length, median_days: 14 },
    { from: 'voting', to: 'law', count: byStatus.law.length, median_days: 7 },
  ]

  const totalTopics = topics.length
  const totalLaws = byStatus.law.length
  const overallLawRate = totalTopics > 0 ? totalLaws / totalTopics : 0

  return NextResponse.json<HourglassData>({
    stages,
    flows,
    total_topics: totalTopics,
    total_laws: totalLaws,
    overall_law_rate: Math.round(overallLawRate * 1000) / 10,
    snapshot_at: new Date().toISOString(),
  })
}
