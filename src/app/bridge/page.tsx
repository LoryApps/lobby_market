'use client'

/**
 * /bridge — The Civic Bridge
 *
 * Reveals where your votes cross partisan lines — the debates where you
 * agreed with the "other side," voted against your own usual lean, or
 * stood with the minority. These "bridge moments" show how often you
 * follow evidence over ideology.
 *
 * Distinct from:
 *   /diversity       — breadth across categories (do you vote in many areas?)
 *   /compare-users   — head-to-head with one specific user
 *   /compass         — ideology placement on a political spectrum
 *   /fingerprint     — how much you deviate from platform consensus
 *
 * The Bridge measures something different: do you ever reach across the
 * divide and agree with those who generally hold opposing views?
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  ChevronRight,
  ExternalLink,
  GitCompare,
  Globe,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  BridgeData,
  BridgeTopic,
  BridgeCategory,
  BridgeCitizen,
} from '@/app/api/bridge/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const BRIDGE_REASON_LABEL: Record<BridgeTopic['bridge_reason'], string> = {
  crossed_own_lean: 'Crossed your lean',
  crossed_platform_lean: 'Against the tide',
  minority_vote: 'Minority position',
}

const BRIDGE_REASON_COLOR: Record<BridgeTopic['bridge_reason'], string> = {
  crossed_own_lean: 'text-gold bg-gold/10 border-gold/30',
  crossed_platform_lean: 'text-purple bg-purple/10 border-purple/30',
  minority_vote: 'text-emerald bg-emerald/10 border-emerald/30',
}

const CATEGORY_COLORS: Record<string, string> = {
  Economics:   'bg-gold/20 text-gold border-gold/30',
  Politics:    'bg-for-500/20 text-for-400 border-for-500/30',
  Technology:  'bg-purple/20 text-purple border-purple/30',
  Science:     'bg-emerald/20 text-emerald border-emerald/30',
  Ethics:      'bg-against-500/20 text-against-300 border-against-500/30',
  Philosophy:  'bg-indigo-400/20 text-indigo-300 border-indigo-400/30',
  Culture:     'bg-orange-400/20 text-orange-300 border-orange-400/30',
  Health:      'bg-pink-400/20 text-pink-300 border-pink-400/30',
  Environment: 'bg-emerald/20 text-emerald border-emerald/30',
  Education:   'bg-cyan-400/20 text-cyan-300 border-cyan-400/30',
}

function catClass(cat: string): string {
  return CATEGORY_COLORS[cat] ?? 'bg-surface-300/20 text-surface-400 border-surface-400/30'
}

function scoreColor(score: number): { ring: string; fill: string; text: string } {
  if (score < 15) return { ring: 'stroke-against-500', fill: 'stroke-against-600', text: 'text-against-400' }
  if (score < 30) return { ring: 'stroke-gold',         fill: 'stroke-amber-600',  text: 'text-gold' }
  if (score < 50) return { ring: 'stroke-for-400',      fill: 'stroke-for-600',    text: 'text-for-400' }
  if (score < 70) return { ring: 'stroke-emerald',      fill: 'stroke-emerald',    text: 'text-emerald' }
  return               { ring: 'stroke-purple',         fill: 'stroke-purple',     text: 'text-purple' }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function BridgeGauge({ score, label, labelColor, labelDesc }: {
  score: number
  label: string
  labelColor: string
  labelDesc: string
}) {
  const r = 54
  const circumference = 2 * Math.PI * r
  const pct = Math.max(0, Math.min(100, score))
  const dashOffset = circumference * (1 - pct / 100)
  const { ring, text } = scoreColor(score)

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <svg width="140" height="140" className="-rotate-90">
          <circle cx="70" cy="70" r={r} fill="none" stroke="currentColor"
            className="stroke-surface-300" strokeWidth="10" />
          <motion.circle
            cx="70" cy="70" r={r} fill="none"
            className={ring}
            strokeWidth="10"
            strokeDasharray={circumference}
            strokeDashoffset={circumference}
            animate={{ strokeDashoffset: dashOffset }}
            transition={{ duration: 1.2, ease: 'easeOut' }}
            strokeLinecap="round"
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <motion.span
            className={cn('text-3xl font-bold font-mono', text)}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            {pct}
          </motion.span>
          <span className="text-[10px] font-mono text-surface-500 uppercase tracking-widest">bridge</span>
        </div>
      </div>
      <div className="text-center">
        <p className={cn('text-sm font-semibold font-mono', labelColor)}>{label}</p>
        <p className="text-xs text-surface-500 max-w-[240px] text-center leading-relaxed mt-1">{labelDesc}</p>
      </div>
    </div>
  )
}

function BridgeTopicCard({ topic }: { topic: BridgeTopic }) {
  const votedFor = topic.user_side === 'blue'
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="group rounded-xl border border-surface-300 bg-surface-200/60 hover:bg-surface-200 hover:border-surface-400 transition-all"
    >
      <div className="p-3.5">
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <p className="text-sm text-white leading-snug flex-1">{topic.statement}</p>
          <Link
            href={`/topic/${topic.id}`}
            className="flex-shrink-0 p-1 rounded text-surface-500 hover:text-white transition-colors"
            aria-label="View topic"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {/* Category */}
          <span className={cn(
            'px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border',
            catClass(topic.category)
          )}>
            {topic.category}
          </span>

          {/* Bridge reason */}
          <span className={cn(
            'px-2 py-0.5 rounded-full text-[10px] font-mono font-medium border',
            BRIDGE_REASON_COLOR[topic.bridge_reason]
          )}>
            {BRIDGE_REASON_LABEL[topic.bridge_reason]}
          </span>

          {/* User's vote */}
          <span className={cn(
            'flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border',
            votedFor
              ? 'bg-for-500/15 text-for-300 border-for-500/30'
              : 'bg-against-500/15 text-against-300 border-against-500/30'
          )}>
            {votedFor
              ? <ThumbsUp className="h-2.5 w-2.5" />
              : <ThumbsDown className="h-2.5 w-2.5" />}
            You voted {votedFor ? 'FOR' : 'AGAINST'}
          </span>
        </div>

        {/* Vote split bar */}
        <div className="mt-2.5">
          <div className="flex items-center gap-1.5 mb-1">
            <span className="text-[10px] font-mono text-for-400">{forPct}% FOR</span>
            <div className="flex-1 h-1.5 rounded-full bg-surface-400 overflow-hidden">
              <div
                className="h-full rounded-full bg-for-500 transition-all"
                style={{ width: `${forPct}%` }}
              />
            </div>
            <span className="text-[10px] font-mono text-against-400">{againstPct}% AGN</span>
          </div>
        </div>
      </div>
    </motion.div>
  )
}

function CategoryBar({ cat }: { cat: BridgeCategory }) {
  const deviation = cat.deviation
  const barWidth = Math.min(100, (deviation / 50) * 100)

  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-24 flex-shrink-0">
        <span className="text-xs font-mono text-white">{cat.category}</span>
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <div className="flex-1 h-1.5 bg-surface-400 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-for-500"
              style={{ width: `${cat.user_for_pct}%` }}
            />
          </div>
          <span className="text-[10px] font-mono text-surface-500 w-8 text-right">
            {cat.user_for_pct}%
          </span>
        </div>
        {cat.bridge_votes > 0 && (
          <div className="text-[10px] font-mono text-gold">
            {cat.bridge_votes} bridge moment{cat.bridge_votes !== 1 ? 's' : ''}
          </div>
        )}
      </div>
      {cat.deviation > 10 && (
        <div className="w-16 flex-shrink-0">
          <div
            className={cn(
              'h-1 rounded-full',
              cat.user_for_pct > cat.platform_for_pct ? 'bg-for-500' : 'bg-against-500'
            )}
            style={{ width: `${barWidth}%` }}
          />
          <span className="text-[9px] font-mono text-surface-500">
            {deviation > 0 ? '+' : ''}{cat.user_for_pct - cat.platform_for_pct}% vs avg
          </span>
        </div>
      )}
    </div>
  )
}

function CitizenCard({ citizen }: { citizen: BridgeCitizen }) {
  return (
    <Link href={`/profile/${citizen.username}`}>
      <motion.div
        initial={{ opacity: 0, scale: 0.97 }}
        animate={{ opacity: 1, scale: 1 }}
        className="flex items-center gap-3 p-3 rounded-xl bg-surface-200/60 border border-surface-300 hover:bg-surface-200 hover:border-surface-400 transition-all"
      >
        <Avatar
          src={citizen.avatar_url}
          fallback={citizen.display_name || citizen.username}
          size="sm"
        />
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white truncate">
            {citizen.display_name || citizen.username}
          </p>
          <p className="text-[11px] text-surface-500">@{citizen.username}</p>
        </div>
        <div className="text-right flex-shrink-0">
          <p className="text-xs font-mono font-bold text-emerald">
            {citizen.bridge_agreements} shared
          </p>
          <p className="text-[10px] font-mono text-surface-500">bridge topics</p>
        </div>
      </motion.div>
    </Link>
  )
}

// ─── Skeleton ──────────────────────────────────────────────────────────────────

function BridgeSkeleton() {
  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-6 pb-24">
        <div className="flex items-center gap-3 mb-6">
          <Skeleton className="h-9 w-9 rounded-lg" />
          <div>
            <Skeleton className="h-5 w-32 mb-1" />
            <Skeleton className="h-3 w-48" />
          </div>
        </div>
        <div className="flex justify-center mb-8">
          <Skeleton className="h-[140px] w-[140px] rounded-full" />
        </div>
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[1,2,3].map(i => <Skeleton key={i} className="h-20 rounded-xl" />)}
        </div>
        <Skeleton className="h-5 w-40 mb-3" />
        <div className="flex flex-col gap-2">
          {[1,2,3,4].map(i => <Skeleton key={i} className="h-24 rounded-xl" />)}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function BridgePage() {
  const [data, setData] = useState<BridgeData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [authed, setAuthed] = useState(true)
  const [tab, setTab] = useState<'topics' | 'categories' | 'citizens'>('topics')

  const load = useCallback(async (quiet = false) => {
    if (!quiet) setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/bridge', { cache: 'no-store' })
      if (res.status === 401) { setAuthed(false); setLoading(false); return }
      if (!res.ok) throw new Error('Failed to load bridge data')
      setData(await res.json() as BridgeData)
    } catch {
      setError('Could not load your bridge data. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <BridgeSkeleton />

  if (!authed) {
    return (
      <div className="flex flex-col min-h-screen bg-surface-50">
        <TopBar />
        <main className="flex-1 flex items-center justify-center px-4">
          <EmptyState
            icon={GitCompare}
            title="Sign in to see your bridge score"
            description="The Civic Bridge analyses your voting history to find where you cross partisan lines."
            action={{ label: 'Sign in', href: '/login' }}
          />
        </main>
        <BottomNav />
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex flex-col min-h-screen bg-surface-50">
        <TopBar />
        <main className="flex-1 flex items-center justify-center px-4">
          <div className="text-center">
            <p className="text-against-400 mb-4 text-sm">{error}</p>
            <button
              onClick={() => load()}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600 text-white text-sm font-mono mx-auto"
            >
              <RefreshCw className="h-4 w-4" /> Retry
            </button>
          </div>
        </main>
        <BottomNav />
      </div>
    )
  }

  if (!data) return <BridgeSkeleton />

  const tooFewVotes = data.totalVotes < data.minVotesRequired

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-6 pb-24">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/analytics"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Back to analytics"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <h1 className="text-base font-semibold text-white font-mono flex items-center gap-2">
              <GitCompare className="h-4 w-4 text-for-400" />
              The Civic Bridge
            </h1>
            <p className="text-xs text-surface-500">
              Where your votes cross partisan lines
            </p>
          </div>
          <button
            onClick={() => load(true)}
            className="ml-auto p-2 rounded-lg text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw className="h-4 w-4" />
          </button>
        </div>

        {tooFewVotes ? (
          <EmptyState
            icon={GitCompare}
            title="Not enough votes yet"
            description={`Vote on at least ${data.minVotesRequired} topics to reveal your bridge moments. You've cast ${data.totalVotes} vote${data.totalVotes !== 1 ? 's' : ''} so far.`}
            action={{ label: 'Explore topics', href: '/' }}
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="flex flex-col gap-5"
            >
              {/* Gauge */}
              <div className="rounded-2xl border border-surface-300 bg-surface-200/60 p-5 flex flex-col items-center gap-2">
                <BridgeGauge
                  score={data.bridgeScore}
                  label={data.label}
                  labelColor={data.labelColor}
                  labelDesc={data.labelDesc}
                />
              </div>

              {/* Summary stats */}
              <div className="grid grid-cols-3 gap-2.5">
                {[
                  {
                    label: 'Bridge moments',
                    value: data.summary.topicsAgreedWithOpponents,
                    icon: GitCompare,
                    color: 'text-for-400',
                  },
                  {
                    label: 'Categories bridged',
                    value: data.summary.categoriesWithBridgeMoments,
                    icon: BarChart2,
                    color: 'text-gold',
                  },
                  {
                    label: 'Avg surprise',
                    value: `${data.summary.averageSurpriseScore}%`,
                    icon: Sparkles,
                    color: 'text-purple',
                  },
                ].map(({ label, value, icon: Icon, color }) => (
                  <div
                    key={label}
                    className="rounded-xl border border-surface-300 bg-surface-200/60 p-3 text-center"
                  >
                    <Icon className={cn('h-4 w-4 mx-auto mb-1.5', color)} />
                    <p className={cn('text-lg font-bold font-mono', color)}>{value}</p>
                    <p className="text-[10px] text-surface-500 font-mono leading-tight mt-0.5">{label}</p>
                  </div>
                ))}
              </div>

              {/* Most bridged category callout */}
              {data.mostBridgedCategory && (
                <div className="rounded-xl border border-for-500/20 bg-for-500/5 p-3 flex items-center gap-3">
                  <Globe className="h-4 w-4 text-for-400 flex-shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-mono text-surface-400">
                      Most bridge moments in
                    </p>
                    <p className="text-sm font-semibold text-for-300">
                      {data.mostBridgedCategory}
                    </p>
                  </div>
                  <Link
                    href={`/categories/${data.mostBridgedCategory}`}
                    className="text-for-400 hover:text-for-300 transition-colors flex-shrink-0"
                    aria-label={`Browse ${data.mostBridgedCategory}`}
                  >
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
              )}

              {/* Tabs */}
              <div className="flex items-center gap-1 bg-surface-200/80 border border-surface-300 rounded-xl p-1">
                {(
                  [
                    { id: 'topics' as const,     label: 'Bridge Topics',   icon: Scale },
                    { id: 'categories' as const, label: 'By Category',     icon: BarChart2 },
                    { id: 'citizens' as const,   label: 'Bridge Citizens', icon: Users },
                  ] as Array<{ id: 'topics' | 'categories' | 'citizens'; label: string; icon: typeof Scale }>
                ).map(({ id, label, icon: Icon }) => (
                  <button
                    key={id}
                    onClick={() => setTab(id)}
                    aria-pressed={tab === id}
                    className={cn(
                      'flex-1 flex items-center justify-center gap-1.5 py-1.5 rounded-lg',
                      'text-xs font-mono font-medium transition-all duration-150',
                      tab === id
                        ? 'bg-for-600 text-white shadow-sm'
                        : 'text-surface-500 hover:text-surface-300'
                    )}
                  >
                    <Icon className="h-3 w-3 flex-shrink-0" />
                    <span className="hidden sm:inline">{label}</span>
                    <span className="sm:hidden">{label.split(' ')[0]}</span>
                  </button>
                ))}
              </div>

              {/* Tab content */}
              <AnimatePresence mode="wait">
                {tab === 'topics' && (
                  <motion.div
                    key="topics"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="flex flex-col gap-2"
                  >
                    {data.bridgeTopics.length === 0 ? (
                      <EmptyState
                        icon={GitCompare}
                        title="No bridge topics yet"
                        description="Vote on more topics — especially in categories outside your usual lean — to find your bridge moments."
                        action={{ label: 'Explore topics', href: '/' }}
                      />
                    ) : (
                      <>
                        <p className="text-xs font-mono text-surface-500 mb-1">
                          Topics where you voted against your typical lean or with the minority
                        </p>
                        {data.bridgeTopics.map((topic) => (
                          <BridgeTopicCard key={topic.id} topic={topic} />
                        ))}
                      </>
                    )}
                  </motion.div>
                )}

                {tab === 'categories' && (
                  <motion.div
                    key="categories"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="rounded-xl border border-surface-300 bg-surface-200/60 p-4"
                  >
                    <p className="text-xs font-mono text-surface-500 mb-4">
                      Your FOR% vs. platform average by category. Bridge moments shown in gold.
                    </p>
                    <div className="flex flex-col gap-0.5">
                      {data.byCategory.length === 0 ? (
                        <p className="text-sm text-surface-500 text-center py-4">
                          Vote in more categories to see your breakdown.
                        </p>
                      ) : (
                        data.byCategory.map((cat) => (
                          <CategoryBar key={cat.category} cat={cat} />
                        ))
                      )}
                    </div>
                    <div className="mt-4 pt-3 border-t border-surface-300 flex items-center gap-4 text-[10px] font-mono text-surface-500">
                      <span className="flex items-center gap-1.5">
                        <div className="h-1.5 w-6 bg-for-500 rounded-full" /> Your FOR%
                      </span>
                      <span className="flex items-center gap-1.5">
                        <div className="h-1 w-6 bg-for-500 rounded-full opacity-50" /> Deviation from platform
                      </span>
                    </div>
                  </motion.div>
                )}

                {tab === 'citizens' && (
                  <motion.div
                    key="citizens"
                    initial={{ opacity: 0, y: 4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="flex flex-col gap-2"
                  >
                    {data.bridgeCitizens.length === 0 ? (
                      <EmptyState
                        icon={Users}
                        title="No bridge citizens found yet"
                        description="As more users vote on the same bridge topics as you, we'll surface unexpected connections here."
                        action={{ label: 'Compare with users', href: '/compare-users' }}
                      />
                    ) : (
                      <>
                        <p className="text-xs font-mono text-surface-500 mb-1">
                          Citizens who share your bridge topic positions despite different overall leans
                        </p>
                        {data.bridgeCitizens.map((c) => (
                          <CitizenCard key={c.id} citizen={c} />
                        ))}
                      </>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>

              {/* Related links */}
              <div className="rounded-xl border border-surface-300 bg-surface-200/60 p-4">
                <p className="text-xs font-mono text-surface-500 uppercase tracking-widest mb-3">
                  Related tools
                </p>
                <div className="flex flex-col gap-1.5">
                  {[
                    { href: '/diversity',      icon: Globe,      label: 'Civic Diversity Score',    desc: 'How broadly you engage across categories' },
                    { href: '/compare-users',  icon: GitCompare, label: 'Compare with any user',    desc: 'Head-to-head stance comparison' },
                    { href: '/fingerprint',    icon: BarChart2,  label: 'Civic Fingerprint',         desc: 'How unique your voice is vs. platform consensus' },
                    { href: '/compass',        icon: Zap,        label: 'Political Compass',         desc: 'Your ideology placement' },
                  ].map(({ href, icon: Icon, label, desc }) => (
                    <Link
                      key={href}
                      href={href}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg hover:bg-surface-300/40 transition-colors group"
                    >
                      <Icon className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 group-hover:text-white" />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white">{label}</p>
                        <p className="text-[10px] text-surface-500">{desc}</p>
                      </div>
                      <ChevronRight className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 group-hover:text-white" />
                    </Link>
                  ))}
                </div>
              </div>
            </motion.div>
          </AnimatePresence>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
