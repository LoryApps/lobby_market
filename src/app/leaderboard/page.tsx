import type { Metadata } from 'next'
import Link from 'next/link'
import { Shield, Trophy } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { LeaderboardTabs } from '@/components/leaderboard/LeaderboardTabs'
import { CoalitionLeaderboard } from '@/components/leaderboard/CoalitionLeaderboard'
import type { Coalition, Profile, Topic, Vote } from '@/lib/supabase/types'
import type { LeaderboardCategory, PredictorStats } from '@/components/leaderboard/LeaderboardTabs'

export const metadata: Metadata = {
  title: 'Leaderboard · Lobby Market',
  description:
    'The top voices in the Lobby — ranked by reputation, votes cast, clout earned, and predictive accuracy.',
  openGraph: {
    title: 'Leaderboard · Lobby Market',
    description: 'Who\'s shaping the consensus? See the top voters, lawmakers, and predictors.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Leaderboard · Lobby Market',
    description: 'Top voices in the Lobby ranked by reputation and impact.',
  },
}

export const dynamic = 'force-dynamic'

const LIMIT = 100

export default async function LeaderboardPage() {
  const supabase = await createClient()

  // Overall: by reputation score descending
  const { data: overallRaw } = (await supabase
    .from('profiles')
    .select('*')
    .order('reputation_score', { ascending: false })
    .limit(LIMIT)) as { data: Profile[] | null }
  const overall = overallRaw ?? []

  // Most votes
  const { data: votesRaw } = (await supabase
    .from('profiles')
    .select('*')
    .order('total_votes', { ascending: false })
    .limit(LIMIT)) as { data: Profile[] | null }
  const votes = votesRaw ?? []

  // Rising stars: by most recent creation that still have activity
  const { data: risingRaw } = (await supabase
    .from('profiles')
    .select('*')
    .gt('total_votes', 0)
    .order('created_at', { ascending: false })
    .limit(LIMIT)) as { data: Profile[] | null }
  const rising = risingRaw ?? []

  // Troll catchers: by role
  const { data: trollRaw } = (await supabase
    .from('profiles')
    .select('*')
    .eq('role', 'troll_catcher')
    .order('reputation_score', { ascending: false })
    .limit(LIMIT)) as { data: Profile[] | null }
  const trollCatchers = trollRaw ?? []

  // Top authors: fetch all law-status topics, count per author
  const { data: lawTopicsRaw } = (await supabase
    .from('topics')
    .select('id, author_id, status')
    .eq('status', 'law')) as {
    data: Pick<Topic, 'id' | 'author_id' | 'status'>[] | null
  }
  const lawTopics = lawTopicsRaw ?? []
  const lawsAuthoredMap: Record<string, number> = {}
  for (const topic of lawTopics) {
    lawsAuthoredMap[topic.author_id] =
      (lawsAuthoredMap[topic.author_id] ?? 0) + 1
  }
  const authorsSorted: Profile[] = []
  const sortedAuthorIds = Object.entries(lawsAuthoredMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, LIMIT)
    .map(([id]) => id)
  if (sortedAuthorIds.length > 0) {
    const { data: authorProfiles } = (await supabase
      .from('profiles')
      .select('*')
      .in('id', sortedAuthorIds)) as { data: Profile[] | null }
    const profileMap = new Map((authorProfiles ?? []).map((p) => [p.id, p]))
    for (const id of sortedAuthorIds) {
      const profile = profileMap.get(id)
      if (profile) authorsSorted.push(profile)
    }
  }

  // Most active: most votes cast in the last 7 days
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
  const { data: recentVotesRaw } = (await supabase
    .from('votes')
    .select('user_id, created_at')
    .gte('created_at', sevenDaysAgo)
    .limit(5000)) as {
    data: Pick<Vote, 'user_id' | 'created_at'>[] | null
  }
  const recentVotesMap: Record<string, number> = {}
  for (const v of recentVotesRaw ?? []) {
    recentVotesMap[v.user_id] = (recentVotesMap[v.user_id] ?? 0) + 1
  }
  const mostActiveIds = Object.entries(recentVotesMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, LIMIT)
    .map(([id]) => id)
  const activeSorted: Profile[] = []
  if (mostActiveIds.length > 0) {
    const { data: activeProfiles } = (await supabase
      .from('profiles')
      .select('*')
      .in('id', mostActiveIds)) as { data: Profile[] | null }
    const profileMap = new Map((activeProfiles ?? []).map((p) => [p.id, p]))
    for (const id of mostActiveIds) {
      const profile = profileMap.get(id)
      if (profile) activeSorted.push(profile)
    }
  }

  // ── Predictors: aggregate prediction accuracy per user ────────────────────
  // Fetch all resolved predictions (resolved_at IS NOT NULL).
  // We group by user_id in JS because Supabase JS client doesn't support
  // GROUP BY directly. We cap at 5000 rows which covers any realistic scale.
  interface PredRow {
    user_id: string
    correct: boolean | null
    brier_score: number | null
    resolved_at: string | null
  }
  const { data: predRows } = (await supabase
    .from('topic_predictions')
    .select('user_id, correct, brier_score, resolved_at')
    .not('resolved_at', 'is', null)
    .limit(5000)) as { data: PredRow[] | null }

  // Aggregate per-user
  const predAgg: Record<
    string,
    { total: number; correct: number; brierSum: number; brierCount: number }
  > = {}
  for (const row of predRows ?? []) {
    if (!predAgg[row.user_id]) {
      predAgg[row.user_id] = { total: 0, correct: 0, brierSum: 0, brierCount: 0 }
    }
    predAgg[row.user_id].total += 1
    if (row.correct === true) predAgg[row.user_id].correct += 1
    if (row.brier_score !== null) {
      predAgg[row.user_id].brierSum += row.brier_score
      predAgg[row.user_id].brierCount += 1
    }
  }

  // Qualify: min 3 resolved predictions. Sort by accuracy DESC, then total DESC.
  const MIN_PREDICTIONS = 3
  const qualifiedPredictorIds = Object.entries(predAgg)
    .filter(([, agg]) => agg.total >= MIN_PREDICTIONS)
    .sort(([, a], [, b]) => {
      const accA = a.total > 0 ? a.correct / a.total : 0
      const accB = b.total > 0 ? b.correct / b.total : 0
      if (accB !== accA) return accB - accA          // higher accuracy first
      return b.total - a.total                        // more predictions as tiebreak
    })
    .slice(0, LIMIT)
    .map(([id]) => id)

  // Build predictorsStatsMap for the component
  const predictorsStatsMap: Record<string, PredictorStats> = {}
  for (const [userId, agg] of Object.entries(predAgg)) {
    if (agg.total < MIN_PREDICTIONS) continue
    predictorsStatsMap[userId] = {
      accuracy: agg.total > 0 ? Math.round((agg.correct / agg.total) * 100) : 0,
      total: agg.total,
      avgBrier: agg.brierCount > 0 ? agg.brierSum / agg.brierCount : null,
    }
  }

  // Fetch profiles for qualified predictors in ranked order
  const predictorsSorted: Profile[] = []
  if (qualifiedPredictorIds.length > 0) {
    const { data: predProfiles } = (await supabase
      .from('profiles')
      .select('*')
      .in('id', qualifiedPredictorIds)) as { data: Profile[] | null }
    const profileMap = new Map((predProfiles ?? []).map((p) => [p.id, p]))
    for (const id of qualifiedPredictorIds) {
      const profile = profileMap.get(id)
      if (profile) predictorsSorted.push(profile)
    }
  }

  // ── Streaks: by current vote_streak descending ───────────────────────────
  const { data: streaksRaw } = (await supabase
    .from('profiles')
    .select('*')
    .gt('vote_streak', 0)
    .order('vote_streak', { ascending: false })
    .limit(LIMIT)) as { data: Profile[] | null }
  const streaks = streaksRaw ?? []

  // ── Coalitions ────────────────────────────────────────────────────────────
  const { data: coalitionsRaw } = (await supabase
    .from('coalitions')
    .select('*')
    .eq('is_public', true)
    .order('coalition_influence', { ascending: false })
    .limit(50)) as { data: Coalition[] | null }
  const coalitions = coalitionsRaw ?? []

  const initial: Record<LeaderboardCategory, Profile[]> = {
    overall,
    votes,
    authors: authorsSorted,
    active: activeSorted,
    rising,
    troll_catchers: trollCatchers,
    predictors: predictorsSorted,
    streaks,
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-6xl mx-auto px-4 py-8 pb-24 md:pb-12">
        {/* Hero */}
        <div className="mb-8 flex items-center gap-3">
          <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-gold/10 border border-gold/30">
            <Trophy className="h-6 w-6 text-gold" />
          </div>
          <div>
            <h1 className="font-mono text-3xl font-bold text-white">
              Leaderboard
            </h1>
            <p className="text-sm font-mono text-surface-500 mt-0.5">
              The Lobby&rsquo;s most influential citizens.
            </p>
          </div>
        </div>

        {/* Individual rankings */}
        <LeaderboardTabs
          initial={initial}
          lawsAuthoredMap={lawsAuthoredMap}
          recentVotesMap={recentVotesMap}
          predictorsStatsMap={predictorsStatsMap}
        />

        {/* Coalition rankings */}
        <section className="mt-16">
          <div className="mb-6 flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-purple/10 border border-purple/30">
              <Shield className="h-5 w-5 text-purple" />
            </div>
            <div>
              <h2 className="font-mono text-2xl font-bold text-white">
                Coalition Rankings
              </h2>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                The most powerful alliances in the Lobby.
              </p>
            </div>
          </div>
          <CoalitionLeaderboard coalitions={coalitions} />
        </section>

        {/* Achievements link */}
        <section className="mt-12">
          <Link
            href="/achievements"
            className="flex items-center justify-between rounded-2xl border border-gold/30 bg-gold/5 px-6 py-5 hover:bg-gold/10 transition-colors group"
          >
            <div className="flex items-center gap-4">
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/30 flex-shrink-0">
                <Trophy className="h-5 w-5 text-gold" />
              </div>
              <div>
                <p className="font-mono text-base font-semibold text-white">
                  Achievements Gallery
                </p>
                <p className="text-sm font-mono text-surface-500 mt-0.5">
                  Browse every badge — see rarity stats and what you&rsquo;ve earned.
                </p>
              </div>
            </div>
            <svg
              className="h-5 w-5 text-surface-500 group-hover:text-surface-300 transition-colors flex-shrink-0"
              viewBox="0 0 20 20"
              fill="none"
              stroke="currentColor"
              strokeWidth={1.5}
              aria-hidden
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M7.5 4l5 6-5 6" />
            </svg>
          </Link>
        </section>
      </main>
      <BottomNav />
    </div>
  )
}
