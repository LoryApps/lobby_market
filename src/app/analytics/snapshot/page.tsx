'use client'

/**
 * /analytics/snapshot — Civic Identity Snapshot
 *
 * A single-screen, shareable summary of the user's complete civic identity:
 * archetype, top categories, core stats, alignment, and key achievements.
 *
 * Designed as the "TL;DR" of all analytics pages — the one card you'd share
 * to show someone who you are in the Lobby.
 *
 * Distinct from:
 *   /analytics         — hub linking all sub-pages
 *   /report-card       — academic letter grades by subject
 *   /karma             — composite civic credit score
 *   /wrapped           — year-in-review narrative
 *   /fingerprint       — raw category divergence bars
 *   /analytics/lens    — detailed community alignment breakdown
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  BarChart2,
  BookOpen,
  Check,
  ChevronRight,
  Coins,
  Copy,
  ExternalLink,
  Flame,
  Gavel,
  Globe,
  Mic,
  RefreshCw,
  Scale,
  Share2,
  Sparkles,
  Target,
  Trophy,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { SnapshotData } from '@/app/api/analytics/snapshot/route'

function memberSinceDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

const CATEGORY_COLORS: Record<string, string> = {
  Politics:    'text-for-400',
  Economics:   'text-gold',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-300',
  Philosophy:  'text-for-300',
  Culture:     'text-purple',
  Health:      'text-emerald',
  Environment: 'text-emerald',
  Education:   'text-for-400',
}

const ROLE_LABEL: Record<string, string> = {
  person:        'Citizen',
  debator:       'Debator',
  troll_catcher: 'Troll Catcher',
  elder:         'Elder',
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function SnapshotSkeleton() {
  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-surface-300 bg-surface-100 p-6">
        <div className="flex items-center gap-4 mb-6">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-5 w-32" />
            <Skeleton className="h-3 w-20" />
          </div>
          <Skeleton className="h-10 w-28 rounded-xl" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl" />
          ))}
        </div>
      </div>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    </div>
  )
}

// ─── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({
  label, value, icon: Icon, color,
}: {
  label: string
  value: number | string
  icon: React.ComponentType<{ className?: string }>
  color: string
}) {
  return (
    <div className="flex flex-col gap-1.5 rounded-xl border border-surface-300 bg-surface-200/50 px-4 py-3">
      <div className={cn('flex items-center gap-1.5', color)}>
        <Icon className="h-3.5 w-3.5" />
        <span className="text-[10px] font-mono font-semibold uppercase tracking-wider">{label}</span>
      </div>
      <p className="text-xl font-bold text-white font-mono">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
    </div>
  )
}

// ─── Score bar ────────────────────────────────────────────────────────────────

function ScoreBar({
  label, value, maxColor, help,
}: {
  label: string
  value: number
  maxColor: string
  help: string
}) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs text-surface-400 font-mono">{label}</span>
        <span className={cn('text-xs font-mono font-semibold', maxColor)}>{value}%</span>
      </div>
      <div className="h-1.5 w-full rounded-full bg-surface-300">
        <div
          className={cn('h-full rounded-full transition-all', maxColor.replace('text-', 'bg-'))}
          style={{ width: `${value}%` }}
        />
      </div>
      <p className="text-[10px] text-surface-500">{help}</p>
    </div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function SnapshotPage() {
  const router = useRouter()
  const [data, setData] = useState<SnapshotData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const cardRef = useRef<HTMLDivElement>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/snapshot')
      if (res.status === 401) { router.push('/login'); return }
      if (!res.ok) throw new Error(await res.text())
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load snapshot')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  const copyLink = useCallback(async () => {
    await navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }, [])

  const shareNative = useCallback(async () => {
    if (!data) return
    const text = `My Civic Snapshot on Lobby Market\n${data.archetypeLabel} · ${data.totalVotes} votes · ${data.totalArguments} arguments\n${window.location.href}`
    if (navigator.share) {
      try { await navigator.share({ title: 'My Civic Snapshot', text, url: window.location.href }) } catch { /* cancelled */ }
    } else {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }, [data])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-8 pb-24 md:pb-12">

        {/* Header */}
        <div className="mb-6 flex items-center gap-3">
          <Link
            href="/analytics"
            className="flex items-center gap-1.5 text-sm text-surface-400 hover:text-white transition-colors font-mono"
          >
            <ArrowLeft className="h-4 w-4" />
            Analytics
          </Link>
          <span className="text-surface-600">/</span>
          <span className="text-sm text-white font-mono font-semibold">Snapshot</span>
        </div>

        <div className="mb-6 flex items-start gap-3">
          <div className="flex-1 min-w-0">
            <h1 className="text-2xl font-bold text-white">Civic Identity Snapshot</h1>
            <p className="text-sm text-surface-400 mt-1">
              Your complete civic profile at a glance — shareable in one link.
            </p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            aria-label="Refresh snapshot"
            className="p-2 rounded-lg text-surface-400 hover:text-white hover:bg-surface-200 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Content */}
        {loading ? (
          <SnapshotSkeleton />
        ) : error ? (
          <EmptyState
            icon={BarChart2}
            title="Could not load snapshot"
            description={error}
            action={{ label: 'Try again', onClick: load }}
          />
        ) : data ? (
          <div className="space-y-4">

            {/* Identity card */}
            <motion.div
              ref={cardRef}
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="rounded-2xl border border-surface-300 bg-gradient-to-br from-surface-100 to-surface-200/60 p-5 sm:p-6"
            >
              {/* Top row: avatar + identity + share */}
              <div className="flex items-start gap-4 mb-5">
                <Avatar
                  src={data.avatarUrl}
                  fallback={data.displayName || data.username}
                  size="lg"
                  className="flex-shrink-0"
                />
                <div className="flex-1 min-w-0">
                  <h2 className="text-lg font-bold text-white leading-tight truncate">
                    {data.displayName || data.username}
                  </h2>
                  <p className="text-xs text-surface-400 font-mono">@{data.username}</p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    <Badge variant="outline" className="text-[10px] font-mono">
                      {ROLE_LABEL[data.role] ?? data.role}
                    </Badge>
                    <span className="text-[11px] text-surface-500 font-mono">
                      Member {memberSinceDate(data.memberSince)}
                    </span>
                  </div>
                </div>

                {/* Share button */}
                <button
                  onClick={shareNative}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all',
                    'border',
                    copied
                      ? 'bg-emerald/20 border-emerald/40 text-emerald'
                      : 'bg-surface-200 border-surface-400 text-surface-300 hover:text-white hover:bg-surface-300',
                  )}
                >
                  {copied ? <Check className="h-3.5 w-3.5" /> : <Share2 className="h-3.5 w-3.5" />}
                  {copied ? 'Copied' : 'Share'}
                </button>
              </div>

              {/* Archetype banner */}
              <div className="mb-5 flex items-center gap-3 rounded-xl border border-for-600/30 bg-for-600/10 px-4 py-3">
                <span className="text-2xl">{data.archetypeEmoji}</span>
                <div>
                  <p className="text-sm font-bold text-for-300">{data.archetypeLabel}</p>
                  <p className="text-xs text-surface-400">{data.archetypeDescription}</p>
                </div>
                <Link
                  href="/analytics/lens"
                  className="ml-auto text-for-400 hover:text-for-300 transition-colors"
                  aria-label="View full lens analysis"
                >
                  <ExternalLink className="h-3.5 w-3.5" />
                </Link>
              </div>

              {/* Core stats grid */}
              <div className="grid grid-cols-2 gap-2.5 sm:grid-cols-4">
                <StatTile
                  label="Votes"
                  value={data.totalVotes}
                  icon={Scale}
                  color="text-for-400"
                />
                <StatTile
                  label="Arguments"
                  value={data.totalArguments}
                  icon={BookOpen}
                  color="text-purple"
                />
                <StatTile
                  label="Clout"
                  value={data.clout}
                  icon={Coins}
                  color="text-gold"
                />
                <StatTile
                  label="Streak"
                  value={`${data.voteStreak}d`}
                  icon={Flame}
                  color="text-against-400"
                />
              </div>

              {/* Secondary row */}
              <div className="grid grid-cols-3 gap-2.5 mt-2.5">
                <StatTile
                  label="Debates"
                  value={data.totalDebates}
                  icon={Mic}
                  color="text-purple"
                />
                <StatTile
                  label="Laws Backed"
                  value={data.lawsHelped}
                  icon={Gavel}
                  color="text-gold"
                />
                <StatTile
                  label="Followers"
                  value={data.followersCount}
                  icon={Users}
                  color="text-for-300"
                />
              </div>

              {/* FOR / AGAINST bar */}
              <div className="mt-4">
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-[10px] font-mono text-surface-400 uppercase tracking-wider">Vote Split</span>
                  <div className="flex items-center gap-3 text-[10px] font-mono">
                    <span className="text-for-400">{data.forPct}% For</span>
                    <span className="text-against-400">{100 - data.forPct}% Against</span>
                  </div>
                </div>
                <div className="flex h-2 w-full overflow-hidden rounded-full">
                  <div
                    className="bg-for-500 transition-all"
                    style={{ width: `${data.forPct}%` }}
                  />
                  <div
                    className="bg-against-500 flex-1"
                  />
                </div>
              </div>
            </motion.div>

            {/* Two-column: top categories + alignment scores */}
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">

              {/* Top categories */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.1 }}
                className="rounded-2xl border border-surface-300 bg-surface-100 p-5"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Globe className="h-4 w-4 text-emerald" />
                  <h3 className="text-sm font-semibold text-white">Top Categories</h3>
                  <Badge variant="outline" className="ml-auto text-[10px] font-mono">
                    {data.categoriesEngaged} / 10
                  </Badge>
                </div>

                {data.topCategories.length === 0 ? (
                  <p className="text-xs text-surface-500">Vote on more topics to see your top categories.</p>
                ) : (
                  <div className="space-y-3">
                    {data.topCategories.map((cat, i) => (
                      <div key={cat.category} className="space-y-1">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-1.5">
                            <span className={cn('text-xs font-semibold', CATEGORY_COLORS[cat.category] ?? 'text-surface-300')}>
                              {i === 0 ? '⬥ ' : ''}{cat.category}
                            </span>
                          </div>
                          <div className="flex items-center gap-2 text-[10px] font-mono">
                            <span className="text-for-400">{cat.forPct}% For</span>
                            <span className="text-surface-500">{cat.voteCount}v</span>
                          </div>
                        </div>
                        <div className="flex h-1.5 w-full overflow-hidden rounded-full bg-surface-300">
                          <div
                            className="bg-for-500 transition-all"
                            style={{ width: `${cat.forPct}%` }}
                          />
                          <div className="bg-against-600 flex-1" />
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <Link
                  href="/analytics/lens"
                  className="mt-4 flex items-center gap-1 text-[11px] text-surface-400 hover:text-for-400 transition-colors font-mono"
                >
                  Full category breakdown <ChevronRight className="h-3 w-3" />
                </Link>
              </motion.div>

              {/* Alignment scores */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4, delay: 0.15 }}
                className="rounded-2xl border border-surface-300 bg-surface-100 p-5"
              >
                <div className="flex items-center gap-2 mb-4">
                  <Target className="h-4 w-4 text-purple" />
                  <h3 className="text-sm font-semibold text-white">Civic Profile Scores</h3>
                </div>

                <div className="space-y-4">
                  <ScoreBar
                    label="Community Alignment"
                    value={data.alignmentScore}
                    maxColor="text-for-400"
                    help="How closely your votes match platform consensus"
                  />
                  <ScoreBar
                    label="Civic Diversity"
                    value={data.diversityScore}
                    maxColor="text-emerald"
                    help="Breadth of categories you engage with"
                  />
                  <ScoreBar
                    label="Contrarian Index"
                    value={data.contrarianScore}
                    maxColor="text-against-400"
                    help="How often you vote against the majority"
                  />
                </div>

                <Link
                  href="/fingerprint"
                  className="mt-4 flex items-center gap-1 text-[11px] text-surface-400 hover:text-purple transition-colors font-mono"
                >
                  Civic fingerprint <ChevronRight className="h-3 w-3" />
                </Link>
              </motion.div>
            </div>

            {/* Quick links to deeper analytics */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4, delay: 0.2 }}
              className="rounded-2xl border border-surface-300 bg-surface-100 p-5"
            >
              <div className="flex items-center gap-2 mb-4">
                <Sparkles className="h-4 w-4 text-gold" />
                <h3 className="text-sm font-semibold text-white">Dive Deeper</h3>
              </div>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {[
                  { href: '/analytics/votes', icon: Scale, label: 'Vote History', color: 'text-for-400' },
                  { href: '/analytics/arguments', icon: BookOpen, label: 'Arguments', color: 'text-purple' },
                  { href: '/analytics/calibration', icon: Target, label: 'Calibration', color: 'text-emerald' },
                  { href: '/analytics/lens', icon: Globe, label: 'Lens', color: 'text-for-300' },
                  { href: '/analytics/growth', icon: Trophy, label: 'Growth', color: 'text-gold' },
                  { href: '/report-card', icon: Award, label: 'Report Card', color: 'text-against-400' },
                ].map((link) => (
                  <Link
                    key={link.href}
                    href={link.href}
                    className="flex items-center gap-2 rounded-xl border border-surface-300 bg-surface-200/50 px-3 py-2.5 hover:bg-surface-200 transition-colors group"
                  >
                    <link.icon className={cn('h-3.5 w-3.5 flex-shrink-0', link.color)} />
                    <span className="text-xs font-mono text-surface-300 group-hover:text-white transition-colors truncate">
                      {link.label}
                    </span>
                  </Link>
                ))}
              </div>
            </motion.div>

            {/* Copy link row */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.4, delay: 0.25 }}
              className="flex items-center gap-3 rounded-2xl border border-surface-300 bg-surface-100 px-4 py-3"
            >
              <div className="flex-1 min-w-0">
                <p className="text-xs text-surface-400 font-mono truncate">
                  {typeof window !== 'undefined' ? window.location.href : '/analytics/snapshot'}
                </p>
              </div>
              <button
                onClick={copyLink}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all flex-shrink-0',
                  copied
                    ? 'bg-emerald/20 border-emerald/40 text-emerald'
                    : 'bg-surface-200 border-surface-400 text-surface-300 hover:text-white',
                )}
              >
                {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                {copied ? 'Copied!' : 'Copy link'}
              </button>
            </motion.div>
          </div>
        ) : null}
      </main>
      <BottomNav />
    </div>
  )
}
