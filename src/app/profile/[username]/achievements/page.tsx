import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { ArrowLeft, Trophy } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { AchievementGrid } from '@/components/profile/AchievementGrid'
import { NextAchievementsPanel } from '@/components/profile/NextAchievementsPanel'
import type { Achievement, UserAchievement } from '@/lib/supabase/types'
import { cn } from '@/lib/utils/cn'

export const dynamic = 'force-dynamic'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lobby.market'

interface PageProps {
  params: { username: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, avatar_url, role')
    .eq('username', params.username)
    .maybeSingle()

  if (!profile) return { title: 'Achievements · Lobby Market' }

  const displayName = profile.display_name ?? profile.username
  const title = `${displayName}'s Achievements · Lobby Market`
  const description = `Browse every civic achievement earned by ${displayName} on Lobby Market — from Voter milestones to Legendary Orator badges.`
  const ogImage = `${BASE_URL}/api/og/profile/${profile.username}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
      siteName: 'Lobby Market',
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  }
}

export default async function ProfileAchievementsPage({ params }: PageProps) {
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, reputation_score, clout')
    .eq('username', params.username)
    .maybeSingle()

  if (!profile) notFound()

  const [achievementsRes, earnedRes, currentUserRes] = await Promise.all([
    supabase
      .from('achievements')
      .select('*')
      .order('tier', { ascending: true }) as Promise<{ data: Achievement[] | null }>,
    supabase
      .from('user_achievements')
      .select('achievement_id')
      .eq('user_id', profile.id) as Promise<{ data: Pick<UserAchievement, 'achievement_id'>[] | null }>,
    supabase.auth.getUser(),
  ])

  const allAchievements = achievementsRes.data ?? []
  const earnedAchievementIds = (earnedRes.data ?? []).map((r) => r.achievement_id)
  const isOwner = currentUserRes.data.user?.id === profile.id

  const earnedCount = earnedAchievementIds.length
  const totalCount = allAchievements.length
  const displayName = profile.display_name ?? profile.username

  const legendaryCount = allAchievements.filter(
    (a) => a.tier === 'legendary' && earnedAchievementIds.includes(a.id),
  ).length
  const epicCount = allAchievements.filter(
    (a) => a.tier === 'epic' && earnedAchievementIds.includes(a.id),
  ).length
  const rareCount = allAchievements.filter(
    (a) => a.tier === 'rare' && earnedAchievementIds.includes(a.id),
  ).length

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">

        {/* Back link */}
        <Link
          href={`/profile/${profile.username}`}
          className="inline-flex items-center gap-2 text-surface-500 hover:text-white transition-colors text-sm font-mono mb-6"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to profile
        </Link>

        {/* Header */}
        <div className="flex items-center gap-4 mb-8">
          <Avatar
            src={profile.avatar_url}
            fallback={displayName}
            size="lg"
          />
          <div className="min-w-0">
            <h1 className="font-mono text-2xl font-bold text-white truncate">
              {displayName}
            </h1>
            <p className="text-sm font-mono text-surface-500 mt-0.5">
              @{profile.username} · Civic Achievements
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-4 gap-3 mb-8">
          <div className={cn(
            'rounded-xl border p-3 text-center',
            'bg-surface-100 border-surface-300',
          )}>
            <Trophy className="h-4 w-4 text-gold mx-auto mb-1" />
            <div className="font-mono text-xl font-bold text-white">{earnedCount}</div>
            <div className="text-[10px] font-mono text-surface-500 mt-0.5">earned</div>
          </div>
          <div className={cn(
            'rounded-xl border p-3 text-center',
            legendaryCount > 0
              ? 'bg-gold/10 border-gold/40'
              : 'bg-surface-100 border-surface-300',
          )}>
            <div className={cn(
              'font-mono text-xl font-bold',
              legendaryCount > 0 ? 'text-gold' : 'text-surface-500',
            )}>{legendaryCount}</div>
            <div className="text-[10px] font-mono text-surface-500 mt-0.5">legendary</div>
          </div>
          <div className={cn(
            'rounded-xl border p-3 text-center',
            epicCount > 0
              ? 'bg-purple/10 border-purple/40'
              : 'bg-surface-100 border-surface-300',
          )}>
            <div className={cn(
              'font-mono text-xl font-bold',
              epicCount > 0 ? 'text-purple' : 'text-surface-500',
            )}>{epicCount}</div>
            <div className="text-[10px] font-mono text-surface-500 mt-0.5">epic</div>
          </div>
          <div className={cn(
            'rounded-xl border p-3 text-center',
            rareCount > 0
              ? 'bg-for-500/10 border-for-500/40'
              : 'bg-surface-100 border-surface-300',
          )}>
            <div className={cn(
              'font-mono text-xl font-bold',
              rareCount > 0 ? 'text-for-400' : 'text-surface-500',
            )}>{rareCount}</div>
            <div className="text-[10px] font-mono text-surface-500 mt-0.5">rare</div>
          </div>
        </div>

        {/* Completion bar */}
        <div className="mb-8">
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-mono text-surface-500">Completion</span>
            <span className="text-xs font-mono text-white font-semibold">
              {earnedCount} / {totalCount}
            </span>
          </div>
          <div className="h-2 rounded-full bg-surface-300 overflow-hidden">
            <div
              className="h-full bg-gradient-to-r from-for-600 to-for-400 rounded-full transition-all duration-700"
              style={{ width: `${totalCount > 0 ? Math.round((earnedCount / totalCount) * 100) : 0}%` }}
            />
          </div>
          <div className="text-right mt-1">
            <span className="text-[11px] font-mono text-surface-600">
              {totalCount > 0 ? Math.round((earnedCount / totalCount) * 100) : 0}%
            </span>
          </div>
        </div>

        {/* Next achievements — owner only */}
        {isOwner && earnedCount < totalCount && (
          <section className="mb-8">
            <h2 className="font-mono text-sm font-semibold text-surface-400 uppercase tracking-widest mb-3">
              Next to unlock
            </h2>
            <NextAchievementsPanel userId={profile.id} limit={3} />
          </section>
        )}

        {/* Full achievement grid */}
        <section>
          <h2 className="font-mono text-sm font-semibold text-surface-400 uppercase tracking-widest mb-4">
            All achievements
          </h2>
          <AchievementGrid
            earnedAchievementIds={earnedAchievementIds}
            allAchievements={allAchievements}
          />
        </section>

        {/* View all achievements link */}
        <div className="mt-8 pt-6 border-t border-surface-300 text-center">
          <Link
            href="/achievements"
            className="text-sm font-mono text-surface-500 hover:text-for-400 transition-colors"
          >
            Browse the full achievement catalog →
          </Link>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
