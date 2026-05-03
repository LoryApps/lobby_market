import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { DILEMMAS, getCurrentDilemma, type CrossroadsDilemma } from '@/app/api/crossroads/route'

export const dynamic = 'force-dynamic'

export interface DilemmaArchiveEntry {
  dilemma: CrossroadsDilemma
  stats: {
    totalVotes: number
    countA: number
    countB: number
    pctA: number
    pctB: number
  }
  userVote: 'A' | 'B' | null
  isCurrent: boolean
}

export interface ArchiveResponse {
  entries: DilemmaArchiveEntry[]
  currentDilemmaId: string
}

export async function GET() {
  const supabase = await createClient()
  const { data: { user } } = await supabase.auth.getUser()

  const currentDilemma = getCurrentDilemma()

  // Fetch all votes for all dilemmas in one query
  const { data: allVotes } = await supabase
    .from('crossroads_votes')
    .select('dilemma_id, choice, user_id')

  const votes = allVotes ?? []

  // Build per-dilemma stat maps
  const countMap: Record<string, { A: number; B: number }> = {}
  const userVoteMap: Record<string, 'A' | 'B'> = {}

  for (const v of votes) {
    if (!countMap[v.dilemma_id]) countMap[v.dilemma_id] = { A: 0, B: 0 }
    if (v.choice === 'A') countMap[v.dilemma_id].A += 1
    else if (v.choice === 'B') countMap[v.dilemma_id].B += 1

    if (user && v.user_id === user.id) {
      userVoteMap[v.dilemma_id] = v.choice as 'A' | 'B'
    }
  }

  const entries: DilemmaArchiveEntry[] = DILEMMAS.map((d) => {
    const counts = countMap[d.id] ?? { A: 0, B: 0 }
    const total = counts.A + counts.B
    return {
      dilemma: d,
      stats: {
        totalVotes: total,
        countA: counts.A,
        countB: counts.B,
        pctA: total > 0 ? Math.round((counts.A / total) * 100) : 50,
        pctB: total > 0 ? Math.round((counts.B / total) * 100) : 50,
      },
      userVote: userVoteMap[d.id] ?? null,
      isCurrent: d.id === currentDilemma.id,
    }
  })

  // Sort: current first, then rest in week order
  entries.sort((a, b) => {
    if (a.isCurrent && !b.isCurrent) return -1
    if (!a.isCurrent && b.isCurrent) return 1
    return a.dilemma.week - b.dilemma.week
  })

  return NextResponse.json({ entries, currentDilemmaId: currentDilemma.id } satisfies ArchiveResponse)
}
