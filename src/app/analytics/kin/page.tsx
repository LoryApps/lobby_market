'use client'

/**
 * /analytics/kin — Civic Kin Report
 *
 * Finds the citizens who vote most similarly (Allies) and most differently
 * (Rivals) to you, based on your overlapping topic votes.
 *
 * Distinct from:
 *   /analytics/following  — your followed network's activity
 *   /analytics/alignment  — alignment score for a specific user
 *   /compare-users        — side-by-side vote comparison with any user
 *   /cohort               — discover users with similar voting patterns
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ChevronRight,
  ExternalLink,
  GitCompare,
  Heart,
  Info,
  RefreshCw,
  Scale,
  Sparkles,
  Swords,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { KinProfile, KinResponse } from '@/app/api/analytics/kin/route'

// ─── Types ────────────────────────────────────────────────────────────────────

interface MeResponse {
  id: string | null
  username?: string
  display_name?: string | null
  avatar_url?: string | null
  role?: string
  authenticated: boolean
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  person: 'Citizen',
  debator: 'Debator',
  troll_catcher: 'Troll Catcher',
  elder: 'Elder',
}

function agreementLabel(pct: number): string {
  if (pct >= 90) return 'Twin minds'
  if (pct >= 80) return 'Strong ally'
  if (pct >= 70) return 'Aligned'
  if (pct >= 60) return 'Mostly agree'
  if (pct >= 50) return 'Some overlap'
  if (pct >= 35) return 'Often diverge'
  if (pct >= 20) return 'Frequent rival'
  return 'Polar opposite'
}

function agreementInsight(kin: KinProfile[]): string {
  if (kin.length === 0) return ''
  const avg = Math.round(kin.reduce((s, k) => s + k.agreement_pct, 0) / kin.length)
  if (avg >= 85) return `Your inner circle agrees ${avg}% of the time — a remarkably tight civic consensus.`
  if (avg >= 70) return `Your closest allies agree with you ${avg}% of the time — strong ideological alignment.`
  if (avg >= 55) return `Your allies agree ${avg}% of the time — a broad coalition with room for debate.`
  return `Even your closest kin only agree ${avg}% of the time — you chart an independent civic path.`
}

function rivalInsight(opposites: KinProfile[]): string {
  if (opposites.length === 0) return ''
  const lowest = opposites[opposites.length - 1]
  if (lowest.agreement_pct <= 20) return `Your fiercest rival agrees just ${lowest.agreement_pct}% of the time — a near-total ideological clash.`
  if (lowest.agreement_pct <= 35) return `Your biggest rival shares only ${lowest.agreement_pct}% of your civic positions.`
  return `Your rivals diverge sharply on ${lowest.common_topics} shared topics — rich ground for debate.`
}

// ─── Page skeleton ────────────────────────────────────────────────────────────

function PageSkeleton() {
  return (
    <div className="space-y-5 animate-pulse">
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {[...Array(3)].map((_, i) => (
          <div key={i} className="rounded-xl bg-surface-100 border border-surface-300/60 p-4 space-y-3">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-7 w-16" />
            <Skeleton className="h-3 w-24" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
        <Skeleton className="h-4 w-32 mb-4" />
        {[...Array(5)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-3 border-b border-surface-300 last:border-0">
            <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-2 w-full rounded-full" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-8 w-20 rounded-lg flex-shrink-0" />
          </div>
        ))}
      </div>
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
        <Skeleton className="h-4 w-28 mb-4" />
        {[...Array(3)].map((_, i) => (
          <div key={i} className="flex items-center gap-3 py-3 border-b border-surface-300 last:border-0">
            <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-2 w-full rounded-full" />
              <Skeleton className="h-3 w-24" />
            </div>
            <Skeleton className="h-8 w-20 rounded-lg flex-shrink-0" />
          </div>
        ))}
      </div>
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  iconColor,
  iconBg,
  animateValue,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  iconBg: string
  animateValue?: number
}) {
  return (
    <div className="rounded-xl bg-surface-100 border border-surface-300/60 p-4 flex flex-col gap-2">
      <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center', iconBg)}>
        <Icon className={cn('h-4 w-4', iconColor)} />
      </div>
      <div>
        <p className="font-mono text-xl font-bold text-white tabular-nums">
          {animateValue !== undefined ? <AnimatedNumber value={animateValue} /> : value}
        </p>
        {sub && <p className="text-[11px] font-mono text-surface-500 mt-0.5">{sub}</p>}
      </div>
      <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wider">{label}</p>
    </div>
  )
}

// ─── Kin profile card ─────────────────────────────────────────────────────────

function KinCard({
  person,
  type,
  rank,
  myUsername,
}: {
  person: KinProfile
  type: 'ally' | 'rival'
  rank: number
  myUsername: string | undefined
}) {
  const isAlly = type === 'ally'
  const pct = person.agreement_pct

  const barColor = isAlly
    ? pct >= 80 ? 'bg-emerald' : 'bg-for-400'
    : 'bg-against-400'

  const pctColor = isAlly
    ? pct >= 80 ? 'text-emerald' : 'text-for-400'
    : 'text-against-400'

  const borderColor = isAlly
    ? pct >= 80 ? 'border-emerald/30' : 'border-for-500/30'
    : 'border-against-500/30'

  const rankBg = isAlly
    ? pct >= 80 ? 'bg-emerald/10 text-emerald' : 'bg-for-500/10 text-for-400'
    : 'bg-against-500/10 text-against-400'

  const label = agreementLabel(pct)

  const roleLabel = ROLE_LABELS[person.role] ?? person.role

  const compareHref =
    myUsername
      ? `/compare-users?a=${myUsername}&b=${person.username}`
      : `/compare-users`

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.3, delay: rank * 0.06 }}
      className={cn(
        'flex items-center gap-4 px-4 py-4 rounded-2xl border transition-colors',
        'bg-surface-100',
        borderColor,
        isAlly ? 'hover:bg-emerald/5' : 'hover:bg-against-500/5'
      )}
    >
      {/* Rank badge */}
      <div className={cn('flex-shrink-0 h-7 w-7 rounded-full flex items-center justify-center text-[11px] font-mono font-bold', rankBg)}>
        #{rank + 1}
      </div>

      {/* Avatar */}
      <Link href={`/profile/${person.username}`} className="flex-shrink-0">
        <Avatar
          src={person.avatar_url}
          fallback={person.display_name ?? person.username}
          size="md"
          className="ring-2 ring-surface-300 hover:ring-surface-400 transition-all"
        />
      </Link>

      {/* Name + bar */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 mb-0.5">
          <Link href={`/profile/${person.username}`} className="text-sm font-semibold text-white hover:text-surface-300 transition-colors truncate">
            {person.display_name ?? person.username}
          </Link>
          <span className="text-[10px] font-mono text-surface-500 flex-shrink-0 truncate hidden sm:block">
            @{person.username}
          </span>
        </div>

        <div className="flex items-center gap-2 mb-1.5">
          <Badge variant={person.role as 'person' | 'debator' | 'elder' | 'troll_catcher'}>
            {roleLabel}
          </Badge>
          <span className="text-[10px] font-mono text-surface-500">
            {person.common_topics} shared topic{person.common_topics !== 1 ? 's' : ''}
          </span>
        </div>

        {/* Agreement bar */}
        <div className="flex items-center gap-2">
          <div className="relative h-1.5 flex-1 rounded-full bg-surface-300 overflow-hidden">
            <motion.div
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, delay: rank * 0.06 + 0.2, ease: 'easeOut' }}
              className={cn('absolute inset-y-0 left-0 rounded-full', barColor)}
            />
          </div>
          <span className={cn('text-xs font-mono font-bold flex-shrink-0 w-9 text-right', pctColor)}>
            {pct}%
          </span>
        </div>
        <p className="text-[10px] font-mono text-surface-500 mt-0.5">{label}</p>
      </div>

      {/* Actions */}
      <div className="flex-shrink-0 flex flex-col gap-1.5 items-end">
        <Link
          href={compareHref}
          className={cn(
            'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-medium border transition-colors',
            isAlly
              ? 'bg-for-600/10 border-for-600/30 text-for-400 hover:bg-for-600/20'
              : 'bg-against-600/10 border-against-600/30 text-against-400 hover:bg-against-600/20'
          )}
        >
          <GitCompare className="h-3 w-3" />
          Compare
        </Link>
        <Link
          href={`/profile/${person.username}`}
          className="flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-mono text-surface-500 hover:text-white transition-colors"
        >
          <ExternalLink className="h-2.5 w-2.5" />
          Profile
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Insight banner ───────────────────────────────────────────────────────────

function InsightBanner({ text, type }: { text: string; type: 'ally' | 'rival' | 'neutral' }) {
  const styles = {
    ally: 'bg-emerald/5 border-emerald/20 text-emerald',
    rival: 'bg-against-500/5 border-against-500/20 text-against-400',
    neutral: 'bg-for-500/5 border-for-500/20 text-for-400',
  }
  const icons = {
    ally: Heart,
    rival: Swords,
    neutral: Sparkles,
  }
  const Icon = icons[type]
  return (
    <div className={cn('flex items-start gap-3 rounded-xl border px-4 py-3', styles[type])}>
      <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
      <p className="text-sm font-mono">{text}</p>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function CivicKinPage() {
  const router = useRouter()
  const [data, setData] = useState<KinResponse | null>(null)
  const [myUsername, setMyUsername] = useState<string | undefined>(undefined)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const [kinRes, meRes] = await Promise.all([
        fetch('/api/analytics/kin', { cache: 'no-store' }),
        fetch('/api/me', { cache: 'no-store' }),
      ])

      if (kinRes.status === 401) {
        router.push('/login')
        return
      }
      if (!kinRes.ok) throw new Error('kin fetch failed')

      const kinData = await kinRes.json() as KinResponse
      setData(kinData)

      if (meRes.ok) {
        const meData = await meRes.json() as MeResponse
        if (meData.username) setMyUsername(meData.username)
      }
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  // Derived stats
  const kinCount = data?.kin.length ?? 0
  const oppositeCount = data?.opposites.length ?? 0
  const avgAllyAgreement =
    kinCount > 0
      ? Math.round(data!.kin.reduce((s, k) => s + k.agreement_pct, 0) / kinCount)
      : null
  const avgRivalAgreement =
    oppositeCount > 0
      ? Math.round(data!.opposites.reduce((s, k) => s + k.agreement_pct, 0) / oppositeCount)
      : null

  const totalSharedTopics =
    data
      ? Math.max(
          ...[...data.kin, ...data.opposites].map((p) => p.common_topics),
          0
        )
      : 0

  const hasAny = kinCount > 0 || oppositeCount > 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">

        {/* ── Header ── */}
        <div className="mb-6 flex items-start gap-4">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0 mt-0.5"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="flex-1">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-emerald/10 border border-emerald/30">
                <Users className="h-5 w-5 text-emerald" />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white">Civic Kin</h1>
                <p className="text-sm font-mono text-surface-500 mt-0.5">
                  Your political soulmates and civic rivals
                </p>
              </div>
            </div>
          </div>
          <button
            onClick={load}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Refresh"
            disabled={loading}
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* ── Content ── */}
        {loading ? (
          <PageSkeleton />
        ) : error ? (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-8 text-center">
            <p className="text-surface-500 font-mono text-sm mb-4">Failed to load Civic Kin data</p>
            <button
              onClick={load}
              className="inline-flex items-center gap-2 text-for-400 hover:text-for-300 text-sm font-mono transition-colors"
            >
              <RefreshCw className="h-4 w-4" /> Try again
            </button>
          </div>
        ) : !hasAny ? (
          <EmptyState
            icon={Users}
            iconColor="text-emerald"
            iconBg="bg-emerald/10"
            iconBorder="border-emerald/30"
            title="No kin found yet"
            description="Cast more votes on civic topics to discover citizens who think like you — and those who don't. You need at least 3 overlapping topics with another user."
            actions={[
              { label: 'Go to feed', href: '/', variant: 'primary' },
              { label: 'Explore topics', href: '/categories', variant: 'secondary' },
            ]}
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-5"
            >
              {/* ── Stat cards ── */}
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                <StatCard
                  label="Civic Allies"
                  value={kinCount}
                  animateValue={kinCount}
                  sub="by vote agreement"
                  icon={Heart}
                  iconColor="text-emerald"
                  iconBg="bg-emerald/10"
                />
                {avgAllyAgreement !== null && (
                  <StatCard
                    label="Avg Ally Agreement"
                    value={`${avgAllyAgreement}%`}
                    sub="shared vote positions"
                    icon={Scale}
                    iconColor="text-for-400"
                    iconBg="bg-for-500/10"
                  />
                )}
                {oppositeCount > 0 && avgRivalAgreement !== null && (
                  <StatCard
                    label="Avg Rival Agreement"
                    value={`${avgRivalAgreement}%`}
                    sub={`${oppositeCount} rival${oppositeCount !== 1 ? 's' : ''} found`}
                    icon={Swords}
                    iconColor="text-against-400"
                    iconBg="bg-against-500/10"
                  />
                )}
                {avgAllyAgreement === null && (
                  <StatCard
                    label="Max Shared Topics"
                    value={totalSharedTopics}
                    animateValue={totalSharedTopics}
                    sub="topics in common"
                    icon={Zap}
                    iconColor="text-gold"
                    iconBg="bg-gold/10"
                  />
                )}
              </div>

              {/* ── Insight banners ── */}
              <div className="space-y-2">
                {kinCount > 0 && (
                  <InsightBanner
                    text={agreementInsight(data!.kin)}
                    type="ally"
                  />
                )}
                {oppositeCount > 0 && (
                  <InsightBanner
                    text={rivalInsight(data!.opposites)}
                    type="rival"
                  />
                )}
                {kinCount === 0 && oppositeCount === 0 && (
                  <InsightBanner
                    text="Vote on more topics to discover your civic kin and rivals."
                    type="neutral"
                  />
                )}
              </div>

              {/* ── Allies section ── */}
              {kinCount > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.1 }}
                  className="rounded-2xl bg-surface-100 border border-emerald/20 overflow-hidden"
                >
                  {/* Section header */}
                  <div className="flex items-center gap-2 px-5 py-4 border-b border-surface-300/60">
                    <Heart className="h-4 w-4 text-emerald flex-shrink-0" />
                    <span className="text-sm font-mono font-semibold text-white">
                      Civic Allies
                    </span>
                    <span className="text-xs font-mono text-surface-500">
                      — citizens who vote most like you
                    </span>
                  </div>

                  <div className="p-4 space-y-3">
                    {data!.kin.map((person, i) => (
                      <KinCard
                        key={person.id}
                        person={person}
                        type="ally"
                        rank={i}
                        myUsername={myUsername}
                      />
                    ))}
                  </div>

                  {/* Footer hint */}
                  <div className="px-5 pb-4 flex items-start gap-2">
                    <Info className="h-3.5 w-3.5 text-surface-600 flex-shrink-0 mt-0.5" />
                    <p className="text-[10px] font-mono text-surface-600">
                      Agreement % is computed from your most recent {' '}
                      <span className="text-surface-500">300 votes</span> compared against topics
                      where you both voted. Requires 3+ overlapping topics.
                    </p>
                  </div>
                </motion.div>
              )}

              {/* ── Rivals section ── */}
              {oppositeCount > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: 10 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.35, delay: 0.2 }}
                  className="rounded-2xl bg-surface-100 border border-against-500/20 overflow-hidden"
                >
                  {/* Section header */}
                  <div className="flex items-center gap-2 px-5 py-4 border-b border-surface-300/60">
                    <Swords className="h-4 w-4 text-against-400 flex-shrink-0" />
                    <span className="text-sm font-mono font-semibold text-white">
                      Civic Rivals
                    </span>
                    <span className="text-xs font-mono text-surface-500">
                      — citizens who vote least like you
                    </span>
                  </div>

                  <div className="p-4 space-y-3">
                    {data!.opposites.map((person, i) => (
                      <KinCard
                        key={person.id}
                        person={person}
                        type="rival"
                        rank={i}
                        myUsername={myUsername}
                      />
                    ))}
                  </div>

                  <div className="px-5 pb-4 flex items-start gap-2">
                    <Info className="h-3.5 w-3.5 text-surface-600 flex-shrink-0 mt-0.5" />
                    <p className="text-[10px] font-mono text-surface-600">
                      Rivals are chosen from citizens with the lowest vote agreement among those
                      with 3+ topics in common. A low score means lively debate, not animosity.
                    </p>
                  </div>
                </motion.div>
              )}

              {/* ── Related links ── */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.35, delay: 0.3 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-2"
              >
                <p className="text-[11px] font-mono text-surface-500 uppercase tracking-wider mb-3">
                  Explore further
                </p>
                {[
                  {
                    href: '/compare-users',
                    label: 'Compare with any citizen',
                    sub: 'Side-by-side vote comparison',
                    icon: GitCompare,
                    color: 'text-for-400',
                    bg: 'bg-for-500/10',
                    border: 'border-for-500/20',
                  },
                  {
                    href: '/cohort',
                    label: 'Find your civic cohort',
                    sub: 'Discover users with similar voting patterns',
                    icon: Users,
                    color: 'text-emerald',
                    bg: 'bg-emerald/10',
                    border: 'border-emerald/20',
                  },
                  {
                    href: '/analytics/following',
                    label: 'Network analytics',
                    sub: 'What your followed network is voting on',
                    icon: Scale,
                    color: 'text-purple',
                    bg: 'bg-purple/10',
                    border: 'border-purple/20',
                  },
                ].map((item) => (
                  <Link
                    key={item.href}
                    href={item.href}
                    className="flex items-center gap-3 p-3 rounded-xl border border-surface-300/60 hover:border-surface-400/60 hover:bg-surface-200/50 transition-colors group"
                  >
                    <div className={cn('h-8 w-8 rounded-lg flex items-center justify-center border flex-shrink-0', item.bg, item.border)}>
                      <item.icon className={cn('h-4 w-4', item.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white">{item.label}</p>
                      <p className="text-[11px] font-mono text-surface-500">{item.sub}</p>
                    </div>
                    <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-white transition-colors flex-shrink-0" />
                  </Link>
                ))}
              </motion.div>
            </motion.div>
          </AnimatePresence>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
