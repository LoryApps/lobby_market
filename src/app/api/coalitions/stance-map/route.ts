import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'

export interface CoalitionStanceCell {
  coalition_id: string
  coalition_name: string
  coalition_influence: number
  member_count: number
  category: string
  for_count: number
  against_count: number
  neutral_count: number
  total_stances: number
  dominant_stance: 'for' | 'against' | 'neutral' | 'split'
  strength: number // 0–100, how decisive the dominant stance is
}

export interface StanceMapResponse {
  cells: CoalitionStanceCell[]
  coalitions: { id: string; name: string; influence: number; member_count: number }[]
  categories: string[]
  total_stances: number
}

const CATEGORIES = [
  'Politics',
  'Economics',
  'Technology',
  'Science',
  'Ethics',
  'Culture',
  'Philosophy',
  'Health',
  'Environment',
  'Education',
]

export async function GET() {
  try {
    const supabase = await createClient()

    // Fetch top coalitions by influence
    const { data: coalitions, error: cErr } = await supabase
      .from('coalitions')
      .select('id, name, coalition_influence, member_count')
      .eq('is_public', true)
      .order('coalition_influence', { ascending: false })
      .limit(20)

    if (cErr || !coalitions?.length) {
      return NextResponse.json({
        cells: [],
        coalitions: [],
        categories: CATEGORIES,
        total_stances: 0,
      })
    }

    const coalitionIds = coalitions.map((c) => c.id)

    // Fetch all stances for those coalitions, with topic category
    const { data: stances } = await supabase
      .from('coalition_stances')
      .select(`
        coalition_id,
        stance,
        topic:topics ( category )
      `)
      .in('coalition_id', coalitionIds)

    const rows = (stances ?? []) as {
      coalition_id: string
      stance: string
      topic: { category: string | null } | null
    }[]

    // Aggregate into cells: coalition × category
    const cellMap = new Map<string, { for: number; against: number; neutral: number }>()

    for (const row of rows) {
      const category = row.topic?.category
      if (!category || !CATEGORIES.includes(category)) continue

      const key = `${row.coalition_id}::${category}`
      const existing = cellMap.get(key) ?? { for: 0, against: 0, neutral: 0 }

      if (row.stance === 'for') existing.for++
      else if (row.stance === 'against') existing.against++
      else existing.neutral++

      cellMap.set(key, existing)
    }

    const coalitionMeta = new Map(coalitions.map((c) => [c.id, c]))

    const cells: CoalitionStanceCell[] = []

    for (const [key, counts] of cellMap.entries()) {
      const [coalition_id, category] = key.split('::')
      const meta = coalitionMeta.get(coalition_id)
      if (!meta) continue

      const total = counts.for + counts.against + counts.neutral
      if (total === 0) continue

      let dominant_stance: CoalitionStanceCell['dominant_stance'] = 'neutral'
      let strength = 0

      const forPct = counts.for / total
      const againstPct = counts.against / total

      if (Math.abs(forPct - againstPct) < 0.15 && total > 1) {
        dominant_stance = 'split'
        strength = Math.round(Math.abs(forPct - againstPct) * 100)
      } else if (counts.for >= counts.against && counts.for >= counts.neutral) {
        dominant_stance = 'for'
        strength = Math.round(forPct * 100)
      } else if (counts.against >= counts.for && counts.against >= counts.neutral) {
        dominant_stance = 'against'
        strength = Math.round(againstPct * 100)
      } else {
        dominant_stance = 'neutral'
        strength = Math.round((counts.neutral / total) * 100)
      }

      cells.push({
        coalition_id,
        coalition_name: meta.name,
        coalition_influence: meta.coalition_influence,
        member_count: meta.member_count,
        category,
        for_count: counts.for,
        against_count: counts.against,
        neutral_count: counts.neutral,
        total_stances: total,
        dominant_stance,
        strength,
      })
    }

    return NextResponse.json({
      cells,
      coalitions: coalitions.map((c) => ({
        id: c.id,
        name: c.name,
        influence: c.coalition_influence,
        member_count: c.member_count,
      })),
      categories: CATEGORIES,
      total_stances: rows.length,
    } satisfies StanceMapResponse)
  } catch {
    return NextResponse.json({
      cells: [],
      coalitions: [],
      categories: CATEGORIES,
      total_stances: 0,
    })
  }
}
