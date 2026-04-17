import type { Metadata } from 'next'
import Link from 'next/link'
import { Trophy } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AchievementsGallery } from '@/components/profile/AchievementsGallery'
import type { Achievement, AchievementTier } from '@/lib/supabase/types'
import { cn } from '@/lib/utils/cn'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Achievements · Lobby Market',
  description:
    'Browse all achievements on Lobby Market — from Common milestones to Legendary feats. See rarity stats and track your progress.',
  openGraph: {
    title: 'Achievements · Lobby Market',
    description:
      'Every badge, every tier — see the full hall of fame for Lobby Market achievements.',
    type: 'website',
    siteName: 'Lobby Market',
  },
}

const TIER_ORDER: AchievementTier[] = ['legendary', 'epic', 'rare', 'common']

const TIER_META: Record<
  AchievementTier,
  { label: string; border: string; bg: string; text: string; barColor: string }
> = {
  legendary: {
    label: 'Legendary',
    border: 'border-gold/50',
    bg: 'bg-gold/10',
    text: 'text-gold',
    barColor: '#f59e0b',
  },
  epic: {
    label: 'Epic',
    border: 'border-purple/50',
    bg: 'bg-purple/10',
    text: 'text-purple',
    barColor: '#8b5cf6',
  },
  rare: {
    label: 'Rare',
    border: 'border-for-500/50',
    bg: 'bg-for-500/10',
    text: 'text-for-400',
    barColor: '#3b82f6',
  },
  common: {
    label: 'Common',
    border: 'border-surface-400/30',
    bg: 'bg-surface-200/40',
    text: 'text-surface-400',
    barColor: '#71717a',
  },
}

export default async function AchievementsPage() {
  const supabase = await createClient()

  // Fetch all achievements
  const { data: achievementsRaw } = await supabase
    .from('achievements')
    .select('*')
    .order('tier')

  const allAchievements = (achievementsRaw ?? []) as Achievement[]

  // Fetch earn counts per achievement (single query, aggregate)
  const { data: earnCounts } = await supabase
    .from('user_achievements')
    .select('achievement_id')

  const earnMap: Record<string, number> = {}
  for (const row of earnCounts ?? []) {
    earnMap[row.achievement_id] = (earnMap[row.achievement_id] ?? 0) + 1
  }

  // Total unique earners (for rarity %)
  const { count: totalUsers } = await supabase
    .from('profiles')
    .select('*', { count: 'exact', head: true })

  const totalProfiles = totalUsers ?? 0

  // Current user's earned achievement IDs (null if not logged in)
  let myEarnedIds: string[] = []
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    const { data: myRows } = await supabase
      .from('user_achievements')
      .select('achievement_id')
      .eq('user_id', user.id)
    myEarnedIds = (myRows ?? []).map((r) => r.achievement_id)
  }

  // Group by tier
  const byTier: Record<AchievementTier, Achievement[]> = {
    legendary: [],
    epic: [],
    rare: [],
    common: [],
  }
  for (const a of allAchievements) {
    const t = a.tier as AchievementTier
    if (byTier[t]) byTier[t].push(a)
  }

  const myEarnedSet = new Set(myEarnedIds)
  const totalEarned = myEarnedIds.length

  const tierStats = TIER_ORDER.map((tier) => ({
    tier,
    total: byTier[tier].length,
    earned: byTier[tier].filter((a) => myEarnedSet.has(a.id)).length,
  }))

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-4xl mx-auto px-4 py-8 pb-28 md:pb-12" id="main-content">
        {/* Header */}
        <div className="mb-8 flex items-start gap-4">
          <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-gold/10 border border-gold/30 flex-shrink-0">
            <Trophy className="h-6 w-6 text-gold" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-mono text-2xl font-bold text-white">Achievements</h1>
            <p className="text-sm font-mono text-surface-500 mt-0.5">
              {allAchievements.length} badge{allAchievements.length !== 1 ? 's' : ''} across four tiers
              {user
                ? ` · you've earned ${totalEarned} of ${allAchievements.length}`
                : ''}
            </p>
          </div>
        </div>

        {/* Tier progress bars (logged-in users) */}
        {user && allAchievements.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            {tierStats.map(({ tier, total, earned }) => {
              const m = TIER_META[tier]
              const pct = total > 0 ? Math.round((earned / total) * 100) : 0
              return (
                <div
                  key={tier}
                  className={cn(
                    'rounded-2xl border p-4',
                    m.border,
                    m.bg,
                  )}
                >
                  <p className={cn('text-[10px] font-mono uppercase tracking-widest mb-1', m.text)}>
                    {m.label}
                  </p>
                  <p className="text-xl font-mono font-bold text-white">
                    {earned}
                    <span className="text-sm text-surface-500 font-normal">/{total}</span>
                  </p>
                  <div className="mt-2 h-1 rounded-full bg-surface-300 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{ width: `${pct}%`, backgroundColor: m.barColor }}
                    />
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {/* Gallery — client component handles tier filtering */}
        <AchievementsGallery
          allAchievements={allAchievements}
          earnMap={earnMap}
          totalProfiles={totalProfiles}
          myEarnedIds={myEarnedIds}
        />

        {/* CTA for logged-out users */}
        {!user && (
          <div className="mt-10 rounded-2xl border border-for-500/30 bg-for-500/5 p-6 text-center">
            <p className="text-sm font-mono text-surface-400 mb-3">
              Sign in to track your achievements and see your progress.
            </p>
            <Link
              href="/login"
              className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-medium transition-colors"
            >
              Sign in
            </Link>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
