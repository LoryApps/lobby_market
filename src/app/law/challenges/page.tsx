'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  Clock,
  FileText,
  Filter,
  Gavel,
  RefreshCw,
  Scale,
  Shield,
  SlidersHorizontal,
  ThumbsDown,
  ThumbsUp,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  GlobalChallengesResponse,
  GlobalChallengeItem,
  ChallengeGrounds,
  ChallengeStatus,
} from '@/app/api/laws/challenges/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const GROUNDS_CONFIG: Record<
  ChallengeGrounds,
  { label: string; icon: typeof Shield; color: string; bg: string; border: string; badge: string }
> = {
  constitutional: {
    label: 'Constitutional',
    icon: Shield,
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/40',
    badge: 'bg-purple/20 text-purple border-purple/40',
  },
  procedural: {
    label: 'Procedural',
    icon: FileText,
    color: 'text-for-300',
    bg: 'bg-for-500/10',
    border: 'border-for-500/40',
    badge: 'bg-for-500/20 text-for-300 border-for-500/40',
  },
  factual: {
    label: 'Factual',
    icon: Scale,
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/40',
    badge: 'bg-emerald/20 text-emerald border-emerald/40',
  },
  ethical: {
    label: 'Ethical',
    icon: Gavel,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/40',
    badge: 'bg-gold/20 text-gold border-gold/40',
  },
  practical: {
    label: 'Practical',
    icon: Zap,
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/40',
    badge: 'bg-against-500/20 text-against-400 border-against-500/40',
  },
}

const STATUS_CONFIG: Record<
  ChallengeStatus,
  { label: string; icon: typeof CheckCircle2; color: string }
> = {
  open:      { label: 'Open',      icon: Clock,         color: 'text-gold' },
  upheld:    { label: 'Upheld',    icon: CheckCircle2,  color: 'text-emerald' },
  dismissed: { label: 'Dismissed', icon: XCircle,       color: 'text-surface-500' },
}

const SORT_OPTIONS = [
  { value: 'support',   label: 'Most Support' },
  { value: 'recent',    label: 'Most Recent'  },
  { value: 'contested', label: 'Most Contested' },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function timeAgo(date: string): string {
  const diff = Date.now() - new Date(date).getTime()
  const m = Math.floor(diff / 60_000)
  if (m < 2)   return 'just now'
  if (m < 60)  return `${m}m ago`
  const h = Math.floor(m / 60)
  if (h < 24)  return `${h}h ago`
  const d = Math.floor(h / 24)
  if (d < 30)  return `${d}d ago`
  return new Date(date).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ChallengeSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
      <div className="flex items-start justify-between gap-3">
        <div className="space-y-2 flex-1">
          <Skeleton className="h-4 w-24 rounded-full" />
          <Skeleton className="h-5 w-3/4" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
        </div>
        <Skeleton className="h-8 w-20 rounded-lg flex-shrink-0" />
      </div>
      <div className="flex items-center gap-3 pt-1">
        <Skeleton className="h-6 w-6 rounded-full" />
        <Skeleton className="h-3 w-24" />
        <Skeleton className="h-3 w-16 ml-auto" />
      </div>
    </div>
  )
}

// ─── Challenge card ───────────────────────────────────────────────────────────

function ChallengeCard({ item }: { item: GlobalChallengeItem }) {
  const [vote, setVote] = useState<'support' | 'oppose' | null>(item.user_vote)
  const [support, setSupport] = useState(item.support_count)
  const [oppose, setOppose]   = useState(item.oppose_count)
  const [busy, setBusy] = useState(false)
  const [expanded, setExpanded] = useState(false)

  const gc = GROUNDS_CONFIG[item.grounds]
  const sc = STATUS_CONFIG[item.status]
  const GroundsIcon = gc.icon
  const StatusIcon  = sc.icon

  const total = support + oppose
  const supportPct = total > 0 ? Math.round((support / total) * 100) : 50

  async function castVote(v: 'support' | 'oppose') {
    if (busy || item.status !== 'open') return
    setBusy(true)
    const newVote = vote === v ? null : v

    // Optimistic
    const prevVote = vote
    setVote(newVote)
    if (prevVote === 'support') setSupport((n) => Math.max(0, n - 1))
    if (prevVote === 'oppose')  setOppose((n)  => Math.max(0, n - 1))
    if (newVote  === 'support') setSupport((n) => n + 1)
    if (newVote  === 'oppose')  setOppose((n)  => n + 1)

    try {
      await fetch(`/api/laws/${item.law_id}/challenge`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challenge_id: item.id, vote: newVote }),
      })
    } catch {
      // revert
      setVote(prevVote)
      setSupport(item.support_count)
      setOppose(item.oppose_count)
    } finally {
      setBusy(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl bg-surface-100 border p-5 space-y-4 transition-colors',
        item.status === 'open'
          ? 'border-surface-300 hover:border-surface-400'
          : 'border-surface-300/60 opacity-80'
      )}
    >
      {/* Header */}
      <div className="flex items-start gap-3">
        <div className={cn('flex-shrink-0 mt-0.5 flex items-center justify-center h-8 w-8 rounded-lg', gc.bg, gc.border, 'border')}>
          <GroundsIcon className={cn('h-4 w-4', gc.color)} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-1.5">
            <span className={cn('inline-flex items-center gap-1 text-[11px] font-mono font-semibold px-2 py-0.5 rounded-full border', gc.badge)}>
              {gc.label}
            </span>
            <span className={cn('inline-flex items-center gap-1 text-[11px] font-mono px-2 py-0.5 rounded-full bg-surface-200 border border-surface-300', sc.color)}>
              <StatusIcon className="h-2.5 w-2.5" />
              {sc.label}
            </span>
          </div>
          <h3 className="text-sm font-semibold text-white leading-snug">{item.title}</h3>
        </div>
      </div>

      {/* Law being challenged */}
      <Link
        href={`/law/${item.law_id}`}
        className="flex items-start gap-2 rounded-xl bg-surface-200/60 border border-surface-300/60 p-3 hover:border-emerald/40 hover:bg-emerald/5 transition-colors group"
      >
        <Gavel className="h-3.5 w-3.5 text-emerald mt-0.5 flex-shrink-0" />
        <div className="min-w-0">
          <p className="text-[11px] font-mono text-surface-500 mb-0.5">Established Law</p>
          <p className="text-xs text-surface-300 group-hover:text-white transition-colors leading-snug truncate">
            {item.law_statement}
          </p>
          {item.law_category && (
            <span className="inline-block text-[10px] font-mono text-surface-500 mt-1">{item.law_category}</span>
          )}
        </div>
        <ArrowRight className="h-3.5 w-3.5 text-surface-500 group-hover:text-emerald ml-auto flex-shrink-0 transition-colors" />
      </Link>

      {/* Description with expand */}
      <div>
        <p className={cn('text-xs text-surface-400 leading-relaxed', !expanded && 'line-clamp-3')}>
          {item.description}
        </p>
        {item.description.length > 200 && (
          <button
            onClick={() => setExpanded((e) => !e)}
            className="mt-1 text-[11px] font-mono text-surface-500 hover:text-white transition-colors flex items-center gap-1"
          >
            {expanded ? 'Show less' : 'Show more'}
            <ChevronDown className={cn('h-3 w-3 transition-transform', expanded && 'rotate-180')} />
          </button>
        )}
      </div>

      {/* Vote bar */}
      {total > 0 && (
        <div className="space-y-1.5">
          <div className="relative h-1.5 rounded-full bg-surface-300 overflow-hidden">
            <div
              className="absolute left-0 top-0 h-full bg-for-500 rounded-full transition-all duration-500"
              style={{ width: `${supportPct}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-mono text-surface-500">
            <span>{supportPct}% support</span>
            <span>{total} votes</span>
          </div>
        </div>
      )}

      {/* Footer: author + actions */}
      <div className="flex items-center justify-between gap-3 pt-1">
        <div className="flex items-center gap-2 min-w-0">
          {item.author ? (
            <Link href={`/profile/${item.author.username}`} className="flex items-center gap-1.5 min-w-0 group">
              <Avatar
                src={item.author.avatar_url}
                fallback={item.author.display_name || item.author.username}
                size="xs"
              />
              <span className="text-[11px] font-mono text-surface-500 group-hover:text-white transition-colors truncate">
                {item.author.display_name || `@${item.author.username}`}
              </span>
            </Link>
          ) : (
            <span className="text-[11px] font-mono text-surface-600">Anonymous</span>
          )}
          <span className="text-[11px] font-mono text-surface-600 flex-shrink-0">
            · {timeAgo(item.created_at)}
          </span>
        </div>

        <div className="flex items-center gap-1.5 flex-shrink-0">
          {/* Support */}
          <button
            onClick={() => castVote('support')}
            disabled={busy || item.status !== 'open'}
            aria-label={`Support challenge: ${support} support votes`}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-semibold transition-all',
              'border disabled:opacity-40 disabled:cursor-default',
              vote === 'support'
                ? 'bg-for-600/20 border-for-600/40 text-for-300'
                : 'bg-surface-200 border-surface-300 text-surface-400 hover:border-for-600/40 hover:text-for-300 hover:bg-for-600/10'
            )}
          >
            <ThumbsUp className="h-3 w-3" />
            {support}
          </button>

          {/* Oppose */}
          <button
            onClick={() => castVote('oppose')}
            disabled={busy || item.status !== 'open'}
            aria-label={`Oppose challenge: ${oppose} oppose votes`}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1.5 rounded-lg text-[11px] font-mono font-semibold transition-all',
              'border disabled:opacity-40 disabled:cursor-default',
              vote === 'oppose'
                ? 'bg-against-600/20 border-against-600/40 text-against-400'
                : 'bg-surface-200 border-surface-300 text-surface-400 hover:border-against-600/40 hover:text-against-400 hover:bg-against-600/10'
            )}
          >
            <ThumbsDown className="h-3 w-3" />
            {oppose}
          </button>

          {/* View full challenge */}
          <Link
            href={`/law/${item.law_id}/challenge`}
            aria-label="View full challenge page"
            className={cn(
              'flex items-center justify-center h-8 w-8 rounded-lg transition-all',
              'bg-surface-200 border border-surface-300 text-surface-500',
              'hover:bg-surface-300 hover:text-white hover:border-surface-400'
            )}
          >
            <ArrowRight className="h-3.5 w-3.5" />
          </Link>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Stats bar ────────────────────────────────────────────────────────────────

function StatsBar({ data }: { data: GlobalChallengesResponse }) {
  const entries: { label: string; value: number; color: string }[] = [
    { label: 'Open',      value: data.by_status.open,      color: 'text-gold' },
    { label: 'Upheld',    value: data.by_status.upheld,    color: 'text-emerald' },
    { label: 'Dismissed', value: data.by_status.dismissed, color: 'text-surface-500' },
    { label: 'Total',     value: data.total,               color: 'text-white' },
  ]

  return (
    <div className="grid grid-cols-4 gap-2 mb-6">
      {entries.map((e) => (
        <div key={e.label} className="rounded-xl bg-surface-100 border border-surface-300 p-3 text-center">
          <p className={cn('text-lg font-mono font-bold', e.color)}>{e.value}</p>
          <p className="text-[10px] font-mono text-surface-500 mt-0.5">{e.label}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function LawChallengesPage() {
  const [data, setData]           = useState<GlobalChallengesResponse | null>(null)
  const [loading, setLoading]     = useState(true)
  const [grounds, setGrounds]     = useState<ChallengeGrounds | 'all'>('all')
  const [status, setStatus]       = useState<ChallengeStatus>('open')
  const [sort, setSort]           = useState<'support' | 'recent' | 'contested'>('support')
  const [showFilters, setShowFilters] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams({ sort, status })
      if (grounds !== 'all') params.set('grounds', grounds)
      const res = await fetch(`/api/laws/challenges?${params}`)
      if (!res.ok) throw new Error('Failed to load challenges')
      setData(await res.json())
    } catch {
      setData(null)
    } finally {
      setLoading(false)
    }
  }, [grounds, status, sort])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-8 pb-24 md:pb-12">
        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="mb-6">
          <Link
            href="/law"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to Codex
          </Link>

          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-against-500/10 border border-against-500/30">
              <AlertTriangle className="h-5 w-5 text-against-400" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Law Challenges</h1>
              <p className="text-xs font-mono text-surface-500 mt-0.5">
                Formal civic challenges to established laws across the Codex
              </p>
            </div>
          </div>

          <p className="text-sm font-mono text-surface-500 leading-relaxed">
            Citizens may challenge established laws on constitutional, procedural, factual, ethical, or
            practical grounds. Vote to support or oppose each challenge — the community&apos;s verdict
            shapes the law&apos;s standing.
          </p>
        </div>

        {/* ── Stats ──────────────────────────────────────────────────────── */}
        {data && <StatsBar data={data} />}

        {/* ── Filter / sort bar ──────────────────────────────────────────── */}
        <div className="flex items-center gap-2 mb-4">
          {/* Status toggle */}
          <div className="flex items-center gap-1 bg-surface-100 border border-surface-300 rounded-xl p-1">
            {(['open', 'upheld', 'dismissed'] as ChallengeStatus[]).map((s) => (
              <button
                key={s}
                onClick={() => setStatus(s)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold transition-all capitalize',
                  status === s
                    ? 'bg-surface-300 text-white shadow-sm'
                    : 'text-surface-500 hover:text-surface-300'
                )}
              >
                {s}
              </button>
            ))}
          </div>

          <button
            onClick={() => setShowFilters((f) => !f)}
            aria-label="Toggle filters"
            className={cn(
              'ml-auto flex items-center gap-1.5 px-3 py-2 rounded-xl text-xs font-mono font-semibold border transition-all',
              showFilters
                ? 'bg-purple/10 border-purple/40 text-purple'
                : 'bg-surface-100 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
            )}
          >
            <SlidersHorizontal className="h-3.5 w-3.5" />
            Filter
          </button>

          <button
            onClick={load}
            disabled={loading}
            aria-label="Refresh challenges"
            className={cn(
              'flex items-center justify-center h-9 w-9 rounded-xl border transition-all',
              'bg-surface-100 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400',
              loading && 'opacity-50 cursor-not-allowed'
            )}
          >
            <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* ── Expanded filters ────────────────────────────────────────────── */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              className="overflow-hidden mb-4"
            >
              <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-3">
                {/* Grounds filter */}
                <div>
                  <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-2 flex items-center gap-1">
                    <Filter className="h-3 w-3" />
                    Grounds
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    <button
                      onClick={() => setGrounds('all')}
                      className={cn(
                        'px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold border transition-all',
                        grounds === 'all'
                          ? 'bg-surface-300 border-surface-400 text-white'
                          : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white'
                      )}
                    >
                      All
                    </button>
                    {(Object.entries(GROUNDS_CONFIG) as [ChallengeGrounds, typeof GROUNDS_CONFIG[ChallengeGrounds]][]).map(([key, cfg]) => (
                      <button
                        key={key}
                        onClick={() => setGrounds(key)}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold border transition-all',
                          grounds === key
                            ? cn(cfg.badge)
                            : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white'
                        )}
                      >
                        {cfg.label}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Sort */}
                <div>
                  <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-2">Sort</p>
                  <div className="flex gap-1.5">
                    {SORT_OPTIONS.map((o) => (
                      <button
                        key={o.value}
                        onClick={() => setSort(o.value as typeof sort)}
                        className={cn(
                          'px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold border transition-all',
                          sort === o.value
                            ? 'bg-surface-300 border-surface-400 text-white'
                            : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white'
                        )}
                      >
                        {o.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Grounds pills (quick filter) ────────────────────────────────── */}
        {!showFilters && (
          <div className="flex gap-2 mb-4 overflow-x-auto pb-1 scrollbar-hide">
            <button
              onClick={() => setGrounds('all')}
              className={cn(
                'flex-shrink-0 px-3 py-1.5 rounded-full text-[11px] font-mono font-semibold border transition-all',
                grounds === 'all'
                  ? 'bg-white text-surface-900 border-white'
                  : 'bg-surface-200 border-surface-300 text-surface-400 hover:text-white'
              )}
            >
              All grounds
            </button>
            {(Object.entries(GROUNDS_CONFIG) as [ChallengeGrounds, typeof GROUNDS_CONFIG[ChallengeGrounds]][]).map(([key, cfg]) => {
              const count = data?.by_grounds[key] ?? 0
              return (
                <button
                  key={key}
                  onClick={() => setGrounds(key)}
                  className={cn(
                    'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-mono font-semibold border transition-all',
                    grounds === key
                      ? cn(cfg.badge)
                      : 'bg-surface-200 border-surface-300 text-surface-400 hover:text-white'
                  )}
                >
                  <cfg.icon className="h-3 w-3" />
                  {cfg.label}
                  {count > 0 && (
                    <span className="text-[10px] opacity-70">{count}</span>
                  )}
                </button>
              )
            })}
          </div>
        )}

        {/* ── List ───────────────────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3].map((i) => <ChallengeSkeleton key={i} />)}
          </div>
        ) : !data || data.challenges.length === 0 ? (
          <EmptyState
            icon={AlertTriangle}
            title="No challenges found"
            description={
              grounds !== 'all'
                ? `No ${status} challenges on ${GROUNDS_CONFIG[grounds].label.toLowerCase()} grounds.`
                : `No ${status} challenges have been filed yet.`
            }
            action={
              grounds !== 'all'
                ? { label: 'Show all grounds', onClick: () => setGrounds('all') }
                : undefined
            }
          />
        ) : (
          <div className="space-y-3">
            {data.challenges.map((item, i) => (
              <motion.div
                key={item.id}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: i * 0.04 }}
              >
                <ChallengeCard item={item} />
              </motion.div>
            ))}
          </div>
        )}

        {/* ── CTA: how challenges work ───────────────────────────────────── */}
        {!loading && data && data.challenges.length > 0 && (
          <div className="mt-8 rounded-2xl bg-surface-100 border border-surface-300 p-5">
            <h2 className="text-sm font-mono font-semibold text-white mb-2">How challenges work</h2>
            <p className="text-xs font-mono text-surface-500 leading-relaxed mb-3">
              Any citizen may file a formal challenge against an established law. Challenges must specify
              grounds and provide a substantive argument. Others vote to support or oppose each challenge.
              A challenge upheld by the community triggers a review process.
            </p>
            <Link
              href="/law"
              className="inline-flex items-center gap-2 text-xs font-mono text-emerald hover:text-emerald/80 transition-colors"
            >
              Browse the Codex <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
