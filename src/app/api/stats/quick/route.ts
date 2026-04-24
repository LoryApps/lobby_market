import { NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const dynamic = 'force-dynamic'
// Cache for 2 minutes at the CDN — these numbers don't need to be real-time
export const revalidate = 120

export interface QuickStats {
  activeTopics: number
  votingTopics: number
  totalVotes: number
  lawsEstablished: number
  totalUsers: number
}

/**
 * GET /api/stats/quick
 *
 * Lightweight endpoint returning just the four headline numbers for the
 * Sidebar stats widget.  Uses a single aggregated query per table to
 * keep latency low.
 */
export async function GET(): Promise<NextResponse> {
  const supabase = await createClient()

  const [topicsRes, lawsRes, profilesRes] = await Promise.all([
    // Active + voting topics count + sum of all votes
    supabase
      .from('topics')
      .select('status, total_votes')
      .not('status', 'in', '("archived","failed")'),

    // Laws count
    supabase
      .from('laws')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true),

    // User count
    supabase
      .from('profiles')
      .select('id', { count: 'exact', head: true }),
  ])

  const topics = topicsRes.data ?? []

  const activeTopics = topics.filter(
    (t) => t.status === 'active' || t.status === 'voting'
  ).length

  const votingTopics = topics.filter((t) => t.status === 'voting').length

  const totalVotes = topics.reduce(
    (sum, t) => sum + (t.total_votes ?? 0),
    0
  )

  const lawsEstablished = lawsRes.count ?? 0
  const totalUsers = profilesRes.count ?? 0

  const stats: QuickStats = {
    activeTopics,
    votingTopics,
    totalVotes,
    lawsEstablished,
    totalUsers,
  }

  return NextResponse.json(stats)
}
