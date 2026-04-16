import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Trophy } from 'lucide-react'
import * as Icons from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AchievementShareButton } from '@/components/ui/AchievementShareButton'
import { cn } from '@/lib/utils/cn'
import type { Achievement, AchievementTier } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

interface AchievementPageProps {
  params: { id: string }
}

// ─── Tier styles ──────────────────────────────────────────────────────────────

const TIER_STYLES: Record<
  AchievementTier,
  {
    label: string
    border: string
    bg: string
    glow: string
    text: string
    badge: string
    badgeBg: string
    dot: string
  }
> = {
  legendary: {
    label: 'Legendary',
    border: 'border-gold/60',
    bg: 'bg-gold/10',
    glow: 'shadow-gold/30',
    text: 'text-gold',
    badge: 'bg-gold/15 border-gold/40 text-gold',
    badgeBg: 'bg-gold/5',
    dot: 'bg-gold',
  },
  epic: {
    label: 'Epic',
    border: 'border-purple/50',
    bg: 'bg-purple/10',
    glow: 'shadow-purple/20',
    text: 'text-purple',
    badge: 'bg-purple/15 border-purple/40 text-purple',
    badgeBg: 'bg-purple/5',
    dot: 'bg-purple',
  },
  rare: {
    label: 'Rare',
    border: 'border-for-500/50',
    bg: 'bg-for-500/10',
    glow: 'shadow-for-500/20',
    text: 'text-for-400',
    badge: 'bg-for-500/15 border-for-500/40 text-for-400',
    badgeBg: 'bg-for-500/5',
    dot: 'bg-for-500',
  },
  common: {
    label: 'Common',
    border: 'border-surface-400/40',
    bg: 'bg-surface-200/50',
    glow: '',
    text: 'text-surface-400',
    badge: 'bg-surface-300/40 border-surface-400/30 text-surface-400',
    badgeBg: 'bg-surface-200/30',
    dot: 'bg-surface-500',
  },
}

function resolveIcon(name: string): LucideIcon {
  const map = Icons as unknown as Record<string, LucideIcon>
  return map[name] ?? Trophy
}

// ─── OG metadata ──────────────────────────────────────────────────────────────

export async function generateMetadata({
  params,
}: AchievementPageProps): Promise<Metadata> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('achievements')
    .select('name, description, tier')
    .eq('id', params.id)
    .single()

  if (!data) return { title: 'Achievement · Lobby Market' }

  const tierLabel =
    data.tier.charAt(0).toUpperCase() + data.tier.slice(1)
  const title = `${data.name} · ${tierLabel} Achievement · Lobby Market`
  const description =
    data.description ??
    `A ${tierLabel.toLowerCase()} achievement earned on Lobby Market.`
  const ogImage = `/api/og/achievement/${params.id}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: 'Lobby Market',
      images: [{ url: ogImage, width: 1200, height: 630, alt: data.name }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function AchievementPage({
  params,
}: AchievementPageProps) {
  const supabase = await createClient()

  const { data: achievement } = await supabase
    .from('achievements')
    .select('*')
    .eq('id', params.id)
    .single()

  if (!achievement) notFound()

  const a = achievement as Achievement
  const tier = a.tier as AchievementTier
  const styles = TIER_STYLES[tier] ?? TIER_STYLES.common
  const Icon = resolveIcon(a.icon ?? '')

  // Count how many users have earned this achievement
  const { count: earnedCount } = await supabase
    .from('user_achievements')
    .select('*', { count: 'exact', head: true })
    .eq('achievement_id', a.id)

  const shareUrl = `https://lobby.market/achievements/${a.id}`
  const shareText = `I earned the "${a.name}" achievement on Lobby Market! ${a.description ?? ''}`

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main
        className="max-w-2xl mx-auto px-4 py-10 pb-28 md:pb-12"
        id="main-content"
      >
        {/* Back nav */}
        <Link
          href="/leaderboard"
          className={cn(
            'inline-flex items-center gap-2 text-sm font-mono text-surface-500',
            'hover:text-surface-300 transition-colors mb-8 group',
          )}
        >
          <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
          Back to Leaderboard
        </Link>

        {/* Achievement card */}
        <div
          className={cn(
            'relative rounded-3xl border p-8 md:p-10 overflow-hidden',
            styles.border,
            styles.bg,
            styles.glow && `shadow-2xl ${styles.glow}`,
          )}
        >
          {/* Subtle radial glow behind icon */}
          <div
            aria-hidden
            className={cn(
              'absolute top-0 left-1/2 -translate-x-1/2 -translate-y-1/2',
              'w-80 h-80 rounded-full blur-3xl opacity-30 pointer-events-none',
              styles.bg,
            )}
          />

          <div className="relative flex flex-col items-center gap-6 text-center">
            {/* Tier badge */}
            <span
              className={cn(
                'inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-bold border',
                'uppercase tracking-widest',
                styles.badge,
              )}
            >
              <span className={cn('h-1.5 w-1.5 rounded-full', styles.dot)} />
              {styles.label}
            </span>

            {/* Icon bubble */}
            <div
              className={cn(
                'flex items-center justify-center h-24 w-24 rounded-3xl border-2',
                styles.border,
                styles.bg,
              )}
            >
              <Icon className={cn('h-12 w-12', styles.text)} aria-hidden />
            </div>

            {/* "Achievement Unlocked" label */}
            <div className="flex items-center gap-3">
              <div className={cn('h-px w-8 opacity-50', styles.bg.replace('bg-', 'bg-'))} />
              <p className={cn('text-xs font-mono font-semibold tracking-widest uppercase', styles.text)}>
                Achievement Unlocked
              </p>
              <div className={cn('h-px w-8 opacity-50', styles.bg.replace('bg-', 'bg-'))} />
            </div>

            {/* Name */}
            <h1 className="text-3xl md:text-4xl font-bold text-white tracking-tight leading-tight">
              {a.name}
            </h1>

            {/* Description */}
            {a.description && (
              <p className="text-base text-surface-400 max-w-sm leading-relaxed">
                {a.description}
              </p>
            )}

            {/* Earned count */}
            {earnedCount !== null && earnedCount > 0 && (
              <p className="text-xs font-mono text-surface-600">
                Earned by{' '}
                <span className="text-surface-400 font-semibold">
                  {earnedCount.toLocaleString()}
                </span>{' '}
                {earnedCount === 1 ? 'person' : 'people'} in the Lobby
              </p>
            )}

            {/* Share button */}
            <AchievementShareButton
              url={shareUrl}
              text={shareText}
              achievementName={a.name}
              tier={tier}
            />
          </div>
        </div>

        {/* CTA strip */}
        <div className="mt-8 rounded-2xl border border-surface-300 bg-surface-100 p-6 text-center space-y-3">
          <p className="text-sm text-surface-500 font-mono">
            Earn this achievement by participating in the Lobby.
          </p>
          <div className="flex items-center justify-center gap-3">
            <Link
              href="/"
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-mono font-semibold',
                'bg-for-600 text-white hover:bg-for-500 transition-colors',
              )}
            >
              Join the Debate
            </Link>
            <Link
              href="/leaderboard"
              className={cn(
                'inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-mono font-semibold',
                'bg-surface-200 text-surface-400 border border-surface-300 hover:bg-surface-300 hover:text-white transition-colors',
              )}
            >
              View Leaderboard
            </Link>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
