import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 300

export interface ArchetypeStatEntry {
  archetype: string
  count: number
  pct: number
}

export interface ArchetypeStatsResponse {
  total: number
  distribution: ArchetypeStatEntry[]
}

export async function GET() {
  const supabase = await createClient()

  const { data, error } = await supabase
    .from('profiles')
    .select('civic_archetype')
    .not('civic_archetype', 'is', null)

  if (error) {
    return NextResponse.json({ total: 0, distribution: [] } satisfies ArchetypeStatsResponse)
  }

  const counts: Record<string, number> = {}
  for (const row of data ?? []) {
    if (row.civic_archetype) {
      counts[row.civic_archetype] = (counts[row.civic_archetype] ?? 0) + 1
    }
  }

  const total = Object.values(counts).reduce((s, n) => s + n, 0)

  const distribution: ArchetypeStatEntry[] = Object.entries(counts)
    .sort(([, a], [, b]) => b - a)
    .map(([archetype, count]) => ({
      archetype,
      count,
      pct: total > 0 ? Math.round((count / total) * 100) : 0,
    }))

  return NextResponse.json({ total, distribution } satisfies ArchetypeStatsResponse)
}
