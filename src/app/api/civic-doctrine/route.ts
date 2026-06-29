import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
export const revalidate = 0

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DoctrineStats {
  totalVotes: number
  totalLaws: number
  totalUsers: number
  totalArguments: number
  totalTopics: number
  totalDebates: number
  lawSuccessRate: number
  avgLawConsensus: number
  argumentsPerVoter: number
  activeDebaters: number
  voterParticipationRate: number
  roleBreakdown: {
    person: number
    debator: number
    troll_catcher: number
    elder: number
  }
  generatedAt: string
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET() {
  try {
    const supabase = await createClient()

    const [
      topicsRes,
      lawsRes,
      usersRes,
      argsRes,
      debatesRes,
    ] = await Promise.all([
      supabase
        .from('topics')
        .select('status, blue_pct, total_votes')
        .order('created_at', { ascending: false }),
      supabase
        .from('laws')
        .select('blue_pct')
        .eq('is_active', true),
      supabase
        .from('profiles')
        .select('role, total_votes, total_arguments'),
      supabase
        .from('arguments')
        .select('id', { count: 'exact', head: true }),
      supabase
        .from('debates')
        .select('id', { count: 'exact', head: true }),
    ])

    const topics = topicsRes.data ?? []
    const laws = lawsRes.data ?? []
    const users = usersRes.data ?? []
    const totalArguments = argsRes.count ?? 0
    const totalDebates = debatesRes.count ?? 0

    // ── Compute stats ─────────────────────────────────────────────────────────

    const totalVotes = topics.reduce((s, t) => s + (t.total_votes ?? 0), 0)
    const totalLaws = laws.length
    const totalUsers = users.length

    const closedTopics = topics.filter((t) => t.status === 'law' || t.status === 'failed')
    const lawSuccessRate =
      closedTopics.length > 0
        ? Math.round((topics.filter((t) => t.status === 'law').length / closedTopics.length) * 100)
        : 0

    const avgLawConsensus =
      laws.length > 0
        ? Math.round(laws.reduce((s, l) => s + (l.blue_pct ?? 75), 0) / laws.length)
        : 75

    const activeDebaters = users.filter((u) => (u.total_arguments ?? 0) > 0).length
    const votersWithVotes = users.filter((u) => (u.total_votes ?? 0) > 0).length
    const voterParticipationRate =
      totalUsers > 0 ? Math.round((votersWithVotes / totalUsers) * 100) : 0

    const argumentsPerVoter =
      votersWithVotes > 0
        ? Math.round((totalArguments / votersWithVotes) * 10) / 10
        : 0

    const roleBreakdown = {
      person: users.filter((u) => u.role === 'person').length,
      debator: users.filter((u) => u.role === 'debator').length,
      troll_catcher: users.filter((u) => u.role === 'troll_catcher').length,
      elder: users.filter((u) => u.role === 'elder').length,
    }

    const stats: DoctrineStats = {
      totalVotes,
      totalLaws,
      totalUsers,
      totalArguments,
      totalTopics: topics.length,
      totalDebates,
      lawSuccessRate,
      avgLawConsensus,
      argumentsPerVoter,
      activeDebaters,
      voterParticipationRate,
      roleBreakdown,
      generatedAt: new Date().toISOString(),
    }

    return NextResponse.json(stats)
  } catch (err) {
    console.error('[civic-doctrine]', err)
    return NextResponse.json(
      {
        totalVotes: 0,
        totalLaws: 0,
        totalUsers: 0,
        totalArguments: 0,
        totalTopics: 0,
        totalDebates: 0,
        lawSuccessRate: 0,
        avgLawConsensus: 75,
        argumentsPerVoter: 0,
        activeDebaters: 0,
        voterParticipationRate: 0,
        roleBreakdown: { person: 0, debator: 0, troll_catcher: 0, elder: 0 },
        generatedAt: new Date().toISOString(),
      } satisfies DoctrineStats,
      { status: 200 },
    )
  }
}
