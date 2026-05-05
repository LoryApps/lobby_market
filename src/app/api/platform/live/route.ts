import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

// Revalidate every 60 seconds — live stats change frequently but don't need
// per-request freshness.
export const revalidate = 60

export interface PlatformLiveStats {
  /** Topics currently in active or voting status */
  activeTopics: number
  /** Debates currently live (status = 'live') */
  liveDebates: number
  /** Votes cast in the last 60 minutes */
  votesLastHour: number
  /** Arguments posted in the last 60 minutes */
  argumentsLastHour: number
  /** Laws established in the current UTC month */
  lawsThisMonth: number
  /** Total votes cast on the platform all time */
  totalVotesAllTime: number
  /** ISO timestamp of the most recently established law */
  latestLawAt: string | null
  /** Statement of the most recently established law */
  latestLawStatement: string | null
}

export async function GET() {
  try {
    const supabase = await createClient()

    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000).toISOString()
    const monthStart = new Date(
      Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)
    ).toISOString()

    const [
      activeTopicsRes,
      liveDebatesRes,
      votesLastHourRes,
      argumentsLastHourRes,
      lawsThisMonthRes,
      totalVotesRes,
      latestLawRes,
    ] = await Promise.all([
      // Active / voting topics count
      supabase
        .from('topics')
        .select('id', { count: 'exact', head: true })
        .in('status', ['active', 'voting']),

      // Currently live debates
      supabase
        .from('debates')
        .select('id', { count: 'exact', head: true })
        .eq('status', 'live'),

      // Votes in last hour — use topic vote counts delta approximation via
      // the votes table if it exists, else fall back to 0
      supabase
        .from('votes')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', oneHourAgo),

      // Arguments in last hour
      supabase
        .from('arguments')
        .select('id', { count: 'exact', head: true })
        .gte('created_at', oneHourAgo),

      // Laws established this calendar month
      supabase
        .from('laws')
        .select('id', { count: 'exact', head: true })
        .eq('is_active', true)
        .gte('established_at', monthStart),

      // Platform-wide total votes (sum from profiles to avoid scanning all votes)
      supabase
        .from('profiles')
        .select('total_votes.sum()')
        .single(),

      // Most recent law
      supabase
        .from('laws')
        .select('topic_id, established_at')
        .eq('is_active', true)
        .order('established_at', { ascending: false })
        .limit(1)
        .maybeSingle(),
    ])

    // Resolve latest law statement
    let latestLawStatement: string | null = null
    let latestLawAt: string | null = null
    if (latestLawRes.data) {
      latestLawAt = latestLawRes.data.established_at
      const { data: topicRow } = await supabase
        .from('topics')
        .select('statement')
        .eq('id', latestLawRes.data.topic_id)
        .maybeSingle()
      latestLawStatement = topicRow?.statement ?? null
    }

    const totalVotesRaw = (totalVotesRes.data as unknown as { sum: number | null } | null)
    const totalVotesAllTime = totalVotesRaw?.sum ?? 0

    const stats: PlatformLiveStats = {
      activeTopics: activeTopicsRes.count ?? 0,
      liveDebates: liveDebatesRes.count ?? 0,
      votesLastHour: votesLastHourRes.count ?? 0,
      argumentsLastHour: argumentsLastHourRes.count ?? 0,
      lawsThisMonth: lawsThisMonthRes.count ?? 0,
      totalVotesAllTime,
      latestLawAt,
      latestLawStatement,
    }

    return NextResponse.json(stats, {
      headers: { 'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120' },
    })
  } catch {
    return NextResponse.json(
      {
        activeTopics: 0,
        liveDebates: 0,
        votesLastHour: 0,
        argumentsLastHour: 0,
        lawsThisMonth: 0,
        totalVotesAllTime: 0,
        latestLawAt: null,
        latestLawStatement: null,
      } satisfies PlatformLiveStats,
      { status: 200 }
    )
  }
}
