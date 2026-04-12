import { Trophy } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { LeaderboardTabs } from '@/components/leaderboard/LeaderboardTabs'
import type { Profile, Topic, Vote } from '@/lib/supabase/types'
import type { LeaderboardCategory } from '@/components/leaderboard/LeaderboardTabs'

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

  const initial: Record<LeaderboardCategory, Profile[]> = {
    overall,
    votes,
    authors: authorsSorted,
    active: activeSorted,
    rising,
    troll_catchers: trollCatchers,
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

        <LeaderboardTabs
          initial={initial}
          lawsAuthoredMap={lawsAuthoredMap}
          recentVotesMap={recentVotesMap}
        />
      </main>
      <BottomNav />
    </div>
  )
}
