'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BarChart2,
  BookOpen,
  Cpu,
  FlaskConical,
  GraduationCap,
  Heart,
  Landmark,
  Leaf,
  MessageSquare,
  Music2,
  RefreshCw,
  Scale,
  Star,
  TrendingUp,
  Users,
  Vote,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { CivicVoice, VoicesResponse } from '@/app/api/voices/route'

// ─── Config ────────────────────────────────────────────────────────────────────

const ALL_CATEGORIES = [
  { id: 'all',         label: 'All',         icon: Users      },
  { id: 'Politics',    label: 'Politics',     icon: Landmark   },
  { id: 'Economics',   label: 'Economics',    icon: TrendingUp },
  { id: 'Technology',  label: 'Technology',   icon: Cpu        },
  { id: 'Science',     label: 'Science',      icon: FlaskConical },
  { id: 'Ethics',      label: 'Ethics',       icon: Scale      },
  { id: 'Philosophy',  label: 'Philosophy',   icon: BookOpen   },
  { id: 'Culture',     label: 'Culture',      icon: Music2     },
  { id: 'Health',      label: 'Health',       icon: Heart      },
  { id: 'Environment', label: 'Environment',  icon: Leaf       },
  { id: 'Education',   label: 'Education',    icon: GraduationCap },
] as const

const SORT_OPTIONS = [
  { id: 'arguments', label: 'Top Debaters',   icon: MessageSquare },
  { id: 'votes',     label: 'Most Active',     icon: Vote          },
  { id: 'expertise', label: 'Q&A Experts',     icon: Star          },
] as const

const CATEGORY_COLOR: Record<string, string> = {
  Politics:    'text-for-400',
  Economics:   'text-gold',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-400',
  Philosophy:  'text-for-300',
  Culture:     'text-gold',
  Health:      'text-against-300',
  Environment: 'text-emerald',
  Education:   'text-purple',
}

const TIER_CONFIG = {
  sage:        { label: 'Sage',        color: 'text-gold',    bg: 'bg-gold/15 border-gold/30'          },
  expert:      { label: 'Expert',      color: 'text-emerald', bg: 'bg-emerald/15 border-emerald/30'    },
  contributor: { label: 'Contributor', color: 'text-for-300', bg: 'bg-for-500/15 border-for-500/30'   },
} as const

const ROLE_STYLE: Record<string, string> = {
  debator:      'bg-for-500/15 text-for-400',
  elder:        'bg-gold/15 text-gold',
  troll_catcher: 'bg-emerald/15 text-emerald',
  person:       'bg-surface-300/30 text-surface-500',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString('en-US')
}

function rankLabel(rank: number): { text: string; cls: string } {
  if (rank === 1) return { text: '#1', cls: 'text-gold font-bold' }
  if (rank === 2) return { text: '#2', cls: 'text-surface-300 font-bold' }
  if (rank === 3) return { text: '#3', cls: 'text-against-300 font-bold' }
  return { text: `#${rank}`, cls: 'text-surface-500' }
}

// ─── Voice card ───────────────────────────────────────────────────────────────

function VoiceCard({
  voice,
  sort,
  index,
}: {
  voice: CivicVoice
  sort: string
  index: number
}) {
  const { text: rankText, cls: rankCls } = rankLabel(voice.rank)
  const tier = voice.expertise_tier ? TIER_CONFIG[voice.expertise_tier] : null
  const roleStyle = ROLE_STYLE[voice.role] ?? ROLE_STYLE.person
  const roleLabel = voice.role === 'troll_catcher' ? 'Troll Catcher' : voice.role.charAt(0).toUpperCase() + voice.role.slice(1)

  const primaryMetric =
    sort === 'votes'
      ? { value: voice.votes_cast,        label: 'votes cast',       icon: Vote          }
      : sort === 'expertise'
      ? { value: voice.accepted_answers,  label: 'accepted answers', icon: Star          }
      : { value: voice.argument_upvotes,  label: 'arg upvotes',      icon: MessageSquare }

  const secondaryMetrics = [
    ...(sort !== 'arguments' ? [{ value: voice.argument_upvotes, label: 'args', icon: MessageSquare }] : []),
    ...(sort !== 'votes'     ? [{ value: voice.votes_cast,       label: 'votes', icon: Vote         }] : []),
    { value: voice.topic_count, label: 'topics', icon: BarChart2 },
  ].slice(0, 2)

  return (
    <motion.article
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.03 }}
    >
      <Link
        href={`/profile/${voice.username}`}
        className={cn(
          'group flex items-start gap-3 px-4 py-4 rounded-2xl border',
          'bg-surface-100 border-surface-300/70',
          'hover:border-surface-400/80 hover:bg-surface-100/90',
          'transition-all duration-150'
        )}
      >
        {/* Rank */}
        <div className="w-8 flex-shrink-0 flex items-center justify-center mt-1">
          <span className={cn('text-sm font-mono tabular-nums', rankCls)}>
            {rankText}
          </span>
        </div>

        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <Avatar
            src={voice.avatar_url}
            fallback={voice.display_name || voice.username}
            size="md"
          />
          {voice.rank <= 3 && (
            <span
              className={cn(
                'absolute -top-1 -right-1 text-[9px] font-mono font-bold',
                'h-4 w-4 rounded-full flex items-center justify-center border',
                voice.rank === 1
                  ? 'bg-gold/20 border-gold/40 text-gold'
                  : voice.rank === 2
                  ? 'bg-surface-300/40 border-surface-400/40 text-surface-300'
                  : 'bg-against-500/20 border-against-400/40 text-against-300'
              )}
              aria-hidden="true"
            >
              {voice.rank}
            </span>
          )}
        </div>

        {/* Info */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-sm font-mono font-semibold text-white leading-tight truncate">
              {voice.display_name || voice.username}
            </span>
            <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded-full', roleStyle)}>
              {roleLabel}
            </span>
            {tier && (
              <span
                className={cn(
                  'text-[10px] font-mono px-1.5 py-0.5 rounded-full border',
                  tier.bg, tier.color
                )}
              >
                {tier.label}
              </span>
            )}
          </div>
          <p className="text-[11px] font-mono text-surface-500 mt-0.5">
            @{voice.username} · {fmtNum(voice.clout)} clout
          </p>

          {/* Secondary metrics */}
          <div className="flex items-center gap-3 mt-2">
            {secondaryMetrics.map(({ value, label, icon: Icon }) => (
              <span key={label} className="flex items-center gap-1 text-[10px] font-mono text-surface-500">
                <Icon className="h-2.5 w-2.5" />
                {fmtNum(value)} {label}
              </span>
            ))}
          </div>
        </div>

        {/* Primary metric */}
        <div className="flex-shrink-0 flex flex-col items-end gap-0.5">
          <div className="flex items-center gap-1">
            <primaryMetric.icon className="h-3 w-3 text-gold" />
            <span className="text-base font-mono font-bold text-gold tabular-nums">
              {fmtNum(primaryMetric.value)}
            </span>
          </div>
          <span className="text-[10px] font-mono text-surface-500 text-right">
            {primaryMetric.label}
          </span>
        </div>
      </Link>
    </motion.article>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function VoiceCardSkeleton() {
  return (
    <div className="flex items-start gap-3 px-4 py-4 rounded-2xl border border-surface-300/60 bg-surface-100">
      <Skeleton className="h-4 w-7 rounded mt-1" />
      <Skeleton className="h-10 w-10 rounded-full flex-shrink-0" />
      <div className="flex-1 space-y-2">
        <div className="flex gap-2">
          <Skeleton className="h-4 w-24 rounded" />
          <Skeleton className="h-4 w-16 rounded-full" />
        </div>
        <Skeleton className="h-3 w-32 rounded" />
        <Skeleton className="h-3 w-20 rounded" />
      </div>
      <div className="flex flex-col items-end gap-1">
        <Skeleton className="h-5 w-12 rounded" />
        <Skeleton className="h-2.5 w-16 rounded" />
      </div>
    </div>
  )
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StatsBar({ data }: { data: VoicesResponse }) {
  return (
    <div className="flex flex-wrap items-center gap-4 px-4 py-3 rounded-xl bg-surface-200/40 border border-surface-300/60">
      <div className="flex items-center gap-1.5">
        <Users className="h-3.5 w-3.5 text-for-400" />
        <span className="text-sm font-mono font-bold text-for-400">{fmtNum(data.total_voices)}</span>
        <span className="text-xs font-mono text-surface-500">civic voices</span>
      </div>
      {data.category !== 'all' && (
        <div className="flex items-center gap-1.5">
          <BarChart2 className={cn('h-3.5 w-3.5', CATEGORY_COLOR[data.category] ?? 'text-surface-500')} />
          <span className={cn('text-sm font-mono font-bold', CATEGORY_COLOR[data.category] ?? 'text-surface-500')}>
            {data.category}
          </span>
        </div>
      )}
      <div className="flex items-center gap-1.5 ml-auto">
        <span className="text-[10px] font-mono text-surface-600">
          Showing top {data.voices.length}
        </span>
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function VoicesPage() {
  const [data, setData] = useState<VoicesResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [category, setCategory] = useState('all')
  const [sort, setSort] = useState<'arguments' | 'votes' | 'expertise'>('arguments')

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({ category, sort, limit: '24' })
      const res = await fetch(`/api/voices?${params}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load voices')
      const json = (await res.json()) as VoicesResponse
      setData(json)
    } catch {
      setError('Could not load civic voices. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [category, sort])

  useEffect(() => {
    load()
  }, [load])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12" id="main-content">
        {/* ── Header ────────────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-3 mb-5">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Users className="h-5 w-5 text-for-400" aria-hidden="true" />
                <h1 className="font-mono text-2xl font-bold text-white">Civic Voices</h1>
              </div>
              <p className="text-sm font-mono text-surface-500">
                The platform&apos;s most influential debaters, voters, and Q&amp;A experts
              </p>
            </div>

            <button
              onClick={load}
              disabled={loading}
              aria-label="Refresh voices"
              className={cn(
                'flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0',
                'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white',
                'transition-colors disabled:opacity-50'
              )}
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
            </button>
          </div>

          {/* Sort pills */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <span className="text-xs font-mono text-surface-500 mr-1">Rank by:</span>
            {SORT_OPTIONS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setSort(id)}
                aria-pressed={sort === id}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium',
                  'border transition-all',
                  sort === id
                    ? 'bg-for-500/15 border-for-500/40 text-for-300'
                    : 'bg-surface-200/60 border-surface-300/60 text-surface-500 hover:text-white hover:border-surface-400'
                )}
              >
                <Icon className="h-3 w-3" />
                {label}
              </button>
            ))}
          </div>

          {/* Category tabs */}
          <div className="flex gap-1.5 overflow-x-auto pb-1 scrollbar-none">
            {ALL_CATEGORIES.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setCategory(id)}
                aria-pressed={category === id}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono whitespace-nowrap flex-shrink-0',
                  'border transition-all',
                  category === id
                    ? 'bg-surface-200 border-surface-400 text-white'
                    : 'bg-surface-100/60 border-surface-300/40 text-surface-500 hover:text-white hover:border-surface-400'
                )}
              >
                <Icon className={cn('h-3 w-3', category === id && id !== 'all' ? (CATEGORY_COLOR[id] ?? '') : '')} />
                {label}
              </button>
            ))}
          </div>

          {/* Stats bar */}
          {!loading && data && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="mt-4"
            >
              <StatsBar data={data} />
            </motion.div>
          )}
        </div>

        {/* ── Content ───────────────────────────────────────────────── */}
        <AnimatePresence mode="wait">
          {loading ? (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              {Array.from({ length: 8 }).map((_, i) => (
                <VoiceCardSkeleton key={i} />
              ))}
            </motion.div>
          ) : error ? (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <EmptyState
                icon={Users}
                title="Couldn't load voices"
                description={error}
                actions={[{ label: 'Retry', onClick: load }]}
              />
            </motion.div>
          ) : !data || data.voices.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              <EmptyState
                icon={Users}
                title="No voices yet"
                description={
                  category === 'all'
                    ? 'Be the first to debate and vote on civic topics.'
                    : `No active voices in ${category} yet. Vote and debate to be first.`
                }
                actions={[{ label: 'Browse Topics', href: category === 'all' ? '/' : `/categories/${category.toLowerCase()}` }]}
              />
            </motion.div>
          ) : (
            <motion.div
              key={`${category}-${sort}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-2"
            >
              {data.voices.map((voice, i) => (
                <VoiceCard key={voice.user_id} voice={voice} sort={sort} index={i} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Footer ────────────────────────────────────────────────── */}
        {!loading && data && data.voices.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-8 flex items-center justify-between gap-4 text-sm font-mono text-surface-500"
          >
            <Link href="/leaderboard" className="flex items-center gap-1.5 hover:text-white transition-colors">
              <Zap className="h-3.5 w-3.5" />
              Full Leaderboard
            </Link>
            <Link href="/citizens" className="flex items-center gap-1.5 hover:text-white transition-colors">
              <Users className="h-3.5 w-3.5" />
              All Citizens
            </Link>
          </motion.div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
