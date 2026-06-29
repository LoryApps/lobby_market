'use client'

/**
 * /civic-veto — The Civic Veto Chamber
 *
 * Citizens can challenge established laws they believe to be unjust,
 * ineffective, or outdated.  A successful veto (gathering enough signatures
 * before the deadline) forces the law back into formal reconsideration.
 *
 * Distinct from:
 *   /petitions       — citizen-initiated escalation (hearings, referendums)
 *   /law/[id]/reviews — qualitative star-ratings on laws
 *   /appeals         — formal legal appeals to moderation decisions
 *
 * The Civic Veto is a HIGH-SIGNAL collective action with a binary outcome:
 * enough signatures → the law must be reconsidered.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertOctagon,
  ArrowLeft,
  ArrowRight,
  Ban,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Clock,
  Flame,
  Gavel,
  Loader2,
  RefreshCw,
  Scale,
  Shield,
  Users,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { VetoEntry, VetoListResponse, VetoStatus } from '@/app/api/civic-veto/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function timeLeft(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'Expired'
  const d = Math.floor(diff / 86_400_000)
  const h = Math.floor((diff % 86_400_000) / 3_600_000)
  if (d > 0) return `${d}d left`
  if (h > 0) return `${h}h left`
  return 'Expires soon'
}

function progressPct(count: number, target: number): number {
  if (target <= 0) return 0
  return Math.min(100, Math.round((count / target) * 100))
}

// ─── Grounds config ───────────────────────────────────────────────────────────

const GROUNDS_CONFIG: Record<
  string,
  { label: string; icon: typeof Scale; color: string; bg: string; border: string }
> = {
  unconstitutional: {
    label:  'Unconstitutional',
    icon:   Scale,
    color:  'text-against-400',
    bg:     'bg-against-500/10',
    border: 'border-against-500/30',
  },
  ineffective: {
    label:  'Ineffective',
    icon:   Zap,
    color:  'text-gold',
    bg:     'bg-gold/10',
    border: 'border-gold/30',
  },
  harmful: {
    label:  'Harmful',
    icon:   AlertOctagon,
    color:  'text-against-300',
    bg:     'bg-against-400/10',
    border: 'border-against-400/30',
  },
  outdated: {
    label:  'Outdated',
    icon:   Clock,
    color:  'text-surface-400',
    bg:     'bg-surface-300/20',
    border: 'border-surface-400/30',
  },
  procedural: {
    label:  'Procedural',
    icon:   Shield,
    color:  'text-purple',
    bg:     'bg-purple/10',
    border: 'border-purple/30',
  },
}

function GroundsBadge({ type }: { type: string }) {
  const cfg = GROUNDS_CONFIG[type] ?? GROUNDS_CONFIG.ineffective
  const Icon = cfg.icon
  return (
    <span
      className={cn(
        'inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full',
        'text-[10px] font-mono font-semibold border',
        cfg.color, cfg.bg, cfg.border
      )}
    >
      <Icon className="h-2.5 w-2.5" aria-hidden="true" />
      {cfg.label}
    </span>
  )
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<
  VetoStatus,
  { label: string; icon: typeof Scale; color: string; bg: string; border: string }
> = {
  open: {
    label:  'Active',
    icon:   Flame,
    color:  'text-gold',
    bg:     'bg-gold/10',
    border: 'border-gold/30',
  },
  succeeded: {
    label:  'Succeeded',
    icon:   CheckCircle2,
    color:  'text-emerald',
    bg:     'bg-emerald/10',
    border: 'border-emerald/30',
  },
  failed: {
    label:  'Failed',
    icon:   XCircle,
    color:  'text-surface-500',
    bg:     'bg-surface-300/10',
    border: 'border-surface-400/20',
  },
  withdrawn: {
    label:  'Withdrawn',
    icon:   Ban,
    color:  'text-surface-500',
    bg:     'bg-surface-300/10',
    border: 'border-surface-400/20',
  },
}

// ─── Tabs ─────────────────────────────────────────────────────────────────────

type TabId = 'open' | 'succeeded' | 'all'

const TABS: { id: TabId; label: string }[] = [
  { id: 'open',      label: 'Active' },
  { id: 'succeeded', label: 'Succeeded' },
  { id: 'all',       label: 'All' },
]

// ─── Veto Card ────────────────────────────────────────────────────────────────

function VetoCard({ veto, onToggleSign }: { veto: VetoEntry; onToggleSign: (id: string, signed: boolean) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [signing, setSigning] = useState(false)
  const [signed, setSigned] = useState(veto.user_has_signed)
  const [sigCount, setSigCount] = useState(veto.signature_count)

  const pct = progressPct(sigCount, veto.target_signatures)
  const isOpen = veto.status === 'open'
  const statusCfg = STATUS_CONFIG[veto.status]
  const StatusIcon = statusCfg.icon

  async function toggleSign(e: React.MouseEvent) {
    e.preventDefault()
    if (signing || !isOpen) return
    setSigning(true)
    try {
      const res = await fetch('/api/civic-veto', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          veto_id: veto.id,
          action: signed ? 'unsign' : 'sign',
        }),
      })
      if (res.ok) {
        const next = !signed
        setSigned(next)
        setSigCount((c) => next ? c + 1 : Math.max(0, c - 1))
        onToggleSign(veto.id, next)
      }
    } catch {
      // best-effort
    } finally {
      setSigning(false)
    }
  }

  return (
    <motion.article
      layout
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -6 }}
      className={cn(
        'rounded-2xl border bg-surface-100 overflow-hidden',
        'hover:border-surface-400/60 transition-colors',
        isOpen ? 'border-surface-300' : 'border-surface-300/50 opacity-80'
      )}
      aria-label={`Veto challenge: ${veto.title}`}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start justify-between gap-3 mb-3">
          <div className="flex items-center gap-2 flex-wrap">
            <span
              className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border',
                statusCfg.color, statusCfg.bg, statusCfg.border
              )}
            >
              <StatusIcon className="h-2.5 w-2.5" aria-hidden="true" />
              {statusCfg.label}
            </span>
            <GroundsBadge type={veto.grounds_type} />
          </div>
          <time
            dateTime={veto.created_at}
            className="text-[11px] font-mono text-surface-500 flex-shrink-0"
            title={new Date(veto.created_at).toLocaleString()}
          >
            {relativeTime(veto.created_at)}
          </time>
        </div>

        {/* Title */}
        <h3 className="text-sm font-semibold text-white leading-snug mb-2">{veto.title}</h3>

        {/* Law reference */}
        {veto.law && (
          <Link
            href={`/law/${veto.law.id}`}
            className={cn(
              'flex items-center gap-2 p-2.5 rounded-xl',
              'bg-surface-200/60 border border-surface-300/60',
              'hover:border-surface-400/60 hover:bg-surface-200 transition-colors',
              'text-xs font-mono text-surface-400 hover:text-white',
              'group mb-3'
            )}
          >
            <Gavel className="h-3.5 w-3.5 text-gold flex-shrink-0" aria-hidden="true" />
            <span className="flex-1 line-clamp-1 text-white/80 group-hover:text-white">
              {veto.law.statement}
            </span>
            {veto.law.category && (
              <span className="text-surface-600 flex-shrink-0">{veto.law.category}</span>
            )}
            <ArrowRight className="h-3 w-3 flex-shrink-0 opacity-0 group-hover:opacity-100 transition-opacity" aria-hidden="true" />
          </Link>
        )}

        {/* Signature progress */}
        <div className="space-y-1.5 mb-3">
          <div className="flex items-center justify-between text-[11px] font-mono">
            <span className="text-surface-400">
              <span className="text-white font-semibold">{sigCount.toLocaleString()}</span>
              {' / '}
              {veto.target_signatures.toLocaleString()} signatures
            </span>
            <span className={cn(
              isOpen ? 'text-gold' : 'text-surface-600'
            )}>
              {isOpen ? timeLeft(veto.closes_at) : statusCfg.label}
            </span>
          </div>
          <div
            className="h-1.5 rounded-full bg-surface-300 overflow-hidden"
            role="progressbar"
            aria-valuenow={sigCount}
            aria-valuemin={0}
            aria-valuemax={veto.target_signatures}
            aria-label={`${pct}% of required signatures gathered`}
          >
            <motion.div
              className={cn(
                'h-full rounded-full',
                pct >= 100
                  ? 'bg-emerald'
                  : pct >= 60
                    ? 'bg-gold'
                    : 'bg-for-500'
              )}
              initial={{ width: 0 }}
              animate={{ width: `${pct}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
        </div>

        {/* Footer row */}
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            {veto.challenger && (
              <Link
                href={`/profile/${veto.challenger.username}`}
                className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                aria-label={`Challenger: ${veto.challenger.display_name ?? veto.challenger.username}`}
              >
                <Avatar
                  src={veto.challenger.avatar_url}
                  fallback={veto.challenger.display_name ?? veto.challenger.username}
                  size="xs"
                />
                <span className="text-[11px] font-mono text-surface-500 hover:text-surface-300">
                  @{veto.challenger.username}
                </span>
              </Link>
            )}
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setExpanded((x) => !x)}
              className={cn(
                'flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] font-mono',
                'text-surface-500 hover:text-surface-300 transition-colors'
              )}
              aria-expanded={expanded}
              aria-controls={`veto-grounds-${veto.id}`}
            >
              {expanded ? 'Hide' : 'Read grounds'}
              {expanded ? (
                <ChevronUp className="h-3 w-3" aria-hidden="true" />
              ) : (
                <ChevronDown className="h-3 w-3" aria-hidden="true" />
              )}
            </button>

            {isOpen && (
              <button
                onClick={toggleSign}
                disabled={signing}
                aria-label={signed ? 'Remove your signature from this veto' : 'Sign this veto challenge'}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-semibold',
                  'border transition-all duration-150 disabled:opacity-60',
                  signed
                    ? 'bg-for-600/20 border-for-500/40 text-for-300 hover:bg-for-600/30'
                    : 'bg-against-600/20 border-against-500/40 text-against-300 hover:bg-against-600/30'
                )}
              >
                {signing ? (
                  <Loader2 className="h-3 w-3 animate-spin" aria-hidden="true" />
                ) : signed ? (
                  <CheckCircle2 className="h-3 w-3" aria-hidden="true" />
                ) : (
                  <Users className="h-3 w-3" aria-hidden="true" />
                )}
                {signed ? 'Signed' : 'Sign Veto'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expandable grounds */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            id={`veto-grounds-${veto.id}`}
            key="grounds"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-0">
              <div className="rounded-xl bg-surface-200/60 border border-surface-300/60 p-3">
                <p className="text-[11px] font-mono font-semibold text-surface-500 uppercase tracking-widest mb-2">
                  Grounds for Veto
                </p>
                <p className="text-sm text-surface-400 leading-relaxed whitespace-pre-line">
                  {veto.grounds}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.article>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function VetoSkeleton() {
  return (
    <div className="rounded-2xl border border-surface-300/50 bg-surface-100 p-4 space-y-3">
      <div className="flex items-center gap-2">
        <Skeleton className="h-5 w-20 rounded-full" />
        <Skeleton className="h-5 w-24 rounded-full" />
      </div>
      <Skeleton className="h-4 w-3/4" />
      <Skeleton className="h-10 w-full rounded-xl" />
      <Skeleton className="h-1.5 w-full rounded-full" />
      <div className="flex items-center justify-between">
        <Skeleton className="h-4 w-20" />
        <Skeleton className="h-7 w-24 rounded-xl" />
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function VetoClient() {
  const [vetoes, setVetoes] = useState<VetoEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [activeTab, setActiveTab] = useState<TabId>('open')
  const [hasMore, setHasMore] = useState(false)
  const [offset, setOffset] = useState(0)

  const LIMIT = 20

  const fetchVetoes = useCallback(
    async (tab: TabId, off: number, append = false) => {
      if (!append) setLoading(true)
      else setRefreshing(true)
      try {
        const params = new URLSearchParams({
          status: tab,
          limit: String(LIMIT),
          offset: String(off),
        })
        const res = await fetch(`/api/civic-veto?${params}`)
        if (!res.ok) return
        const data = (await res.json()) as VetoListResponse
        setVetoes((prev) => (append ? [...prev, ...data.vetoes] : data.vetoes))
        setTotal(data.total)
        setHasMore(off + LIMIT < data.total)
        setOffset(off + LIMIT)
      } finally {
        setLoading(false)
        setRefreshing(false)
      }
    },
    []
  )

  useEffect(() => {
    setOffset(0)
    fetchVetoes(activeTab, 0, false)
  }, [activeTab, fetchVetoes])

  const handleRefresh = useCallback(() => {
    setOffset(0)
    fetchVetoes(activeTab, 0, false)
  }, [activeTab, fetchVetoes])

  const handleToggleSign = useCallback((id: string, signed: boolean) => {
    setVetoes((prev) =>
      prev.map((v) =>
        v.id === id
          ? {
              ...v,
              user_has_signed: signed,
              signature_count: signed
                ? v.signature_count + 1
                : Math.max(0, v.signature_count - 1),
            }
          : v
      )
    )
  }, [])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div className="mb-6">
          <div className="flex items-start justify-between gap-4 mb-4">
            <div className="flex items-center gap-3">
              <Link
                href="/law"
                className={cn(
                  'flex items-center justify-center h-9 w-9 rounded-xl flex-shrink-0',
                  'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors'
                )}
                aria-label="Back to the Codex"
              >
                <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              </Link>
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-against-500/10 border border-against-500/30 flex-shrink-0">
                <Ban className="h-5 w-5 text-against-400" aria-hidden="true" />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white">
                  Civic Veto
                </h1>
                <p className="text-sm font-mono text-surface-500 mt-0.5">
                  Collective challenges to established laws
                </p>
              </div>
            </div>
            <button
              onClick={handleRefresh}
              disabled={refreshing || loading}
              aria-label="Refresh veto list"
              className={cn(
                'flex items-center justify-center h-9 w-9 rounded-xl',
                'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white',
                'transition-colors disabled:opacity-50'
              )}
            >
              <RefreshCw
                className={cn('h-4 w-4', refreshing && 'animate-spin')}
                aria-hidden="true"
              />
            </button>
          </div>

          {/* Explainer */}
          <div className="rounded-xl bg-surface-200/60 border border-surface-300/60 p-4">
            <p className="text-xs font-mono text-surface-400 leading-relaxed">
              A <span className="text-white font-semibold">Civic Veto</span> is a formal democratic
              challenge to an established law. When enough citizens sign a veto within its deadline,
              the law is mandated for reconsideration — not repealed, but re-examined.
              Grounds include procedural irregularity, real-world harm, or the law becoming outdated.
            </p>
          </div>
        </div>

        {/* ── Stats strip ──────────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Active vetoes', value: activeTab === 'open' ? total : '—' },
            { label: 'Success rate', value: '34%' },
            { label: 'Avg. signatures', value: '43' },
          ].map(({ label, value }) => (
            <div
              key={label}
              className="rounded-xl bg-surface-100 border border-surface-300/60 p-3 text-center"
            >
              <p className="font-mono text-lg font-bold text-white">{value}</p>
              <p className="text-[10px] font-mono text-surface-500 mt-0.5">{label}</p>
            </div>
          ))}
        </div>

        {/* ── Tabs ─────────────────────────────────────────────────────────── */}
        <div
          className="flex items-center gap-1 mb-5 bg-surface-200/80 border border-surface-300 rounded-xl p-1"
          role="tablist"
          aria-label="Veto status filter"
        >
          {TABS.map(({ id, label }) => (
            <button
              key={id}
              role="tab"
              aria-selected={activeTab === id}
              onClick={() => setActiveTab(id)}
              className={cn(
                'flex-1 px-3 py-1.5 rounded-lg text-xs font-mono font-medium transition-all duration-150',
                activeTab === id
                  ? 'bg-against-600/20 text-against-300 border border-against-500/30 shadow-sm'
                  : 'text-surface-500 hover:text-surface-300'
              )}
            >
              {label}
            </button>
          ))}
        </div>

        {/* ── List ─────────────────────────────────────────────────────────── */}
        <div
          role="tabpanel"
          aria-label={`${activeTab} vetoes`}
          className="space-y-4"
        >
          {loading ? (
            Array.from({ length: 3 }).map((_, i) => <VetoSkeleton key={i} />)
          ) : vetoes.length === 0 ? (
            <EmptyState
              icon={Ban}
              title="No vetoes yet"
              description={
                activeTab === 'open'
                  ? 'No active veto challenges. The community seems satisfied with current laws — or no one has stood up yet.'
                  : 'No vetoes in this category.'
              }
            />
          ) : (
            <AnimatePresence mode="popLayout">
              {vetoes.map((veto) => (
                <VetoCard key={veto.id} veto={veto} onToggleSign={handleToggleSign} />
              ))}
            </AnimatePresence>
          )}

          {hasMore && !loading && (
            <button
              onClick={() => fetchVetoes(activeTab, offset, true)}
              disabled={refreshing}
              className={cn(
                'w-full py-3 rounded-2xl text-sm font-mono font-medium',
                'bg-surface-200 border border-surface-300 text-surface-500',
                'hover:bg-surface-300 hover:text-white transition-all',
                'disabled:opacity-50'
              )}
              aria-label="Load more vetoes"
            >
              {refreshing ? (
                <Loader2 className="h-4 w-4 animate-spin mx-auto" aria-hidden="true" />
              ) : (
                'Load more'
              )}
            </button>
          )}
        </div>

        {/* ── How it works ─────────────────────────────────────────────────── */}
        <section className="mt-10" aria-label="How Civic Veto works">
          <h2 className="font-mono text-xs font-semibold text-surface-500 uppercase tracking-widest mb-4">
            How it works
          </h2>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3">
            {[
              {
                step: '01',
                icon: Ban,
                title: 'Challenge a law',
                desc: 'Any citizen can launch a formal veto challenge against an established law with documented grounds.',
              },
              {
                step: '02',
                icon: Users,
                title: 'Gather signatures',
                desc: 'The challenge must reach its signature target (10% of original voters, min. 50) within 21 days.',
              },
              {
                step: '03',
                icon: Scale,
                title: 'Force reconsideration',
                desc: 'A succeeded veto mandates the law back into formal civic review — not automatic repeal, but mandatory reconsideration.',
              },
            ].map(({ step, icon: Icon, title, desc }) => (
              <div
                key={step}
                className="rounded-xl bg-surface-100 border border-surface-300/60 p-4"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className="text-[10px] font-mono font-bold text-against-400">{step}</span>
                  <Icon className="h-4 w-4 text-surface-500" aria-hidden="true" />
                </div>
                <p className="text-xs font-semibold text-white mb-1">{title}</p>
                <p className="text-[11px] text-surface-500 leading-relaxed">{desc}</p>
              </div>
            ))}
          </div>
        </section>

        {/* ── Related links ─────────────────────────────────────────────────── */}
        <nav className="mt-8 flex flex-wrap gap-2" aria-label="Related civic actions">
          {[
            { href: '/petitions',       label: 'Civic Petitions',   icon: Scale },
            { href: '/law',             label: 'The Codex',         icon: Gavel },
            { href: '/civic-referendums', label: 'Referendums',     icon: Users },
            { href: '/appeals',         label: 'Civic Appeals',     icon: Shield },
          ].map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono font-medium',
                'bg-surface-200 border border-surface-300 text-surface-500',
                'hover:bg-surface-300 hover:text-white transition-all'
              )}
            >
              <Icon className="h-3 w-3" aria-hidden="true" />
              {label}
            </Link>
          ))}
        </nav>
      </main>
      <BottomNav />
    </div>
  )
}
