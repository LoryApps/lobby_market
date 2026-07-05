'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  Check,
  ChevronDown,
  ChevronUp,
  Clock,
  Gavel,
  Loader2,
  MinusCircle,
  Scale,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldX,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { VetoEntry, VetoStatus, GroundsType } from '@/app/api/vetoes/route'

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

// ─── Grounds type config ──────────────────────────────────────────────────────

const GROUNDS_CONFIG: Record<GroundsType, { label: string; color: string }> = {
  unconstitutional: { label: 'Unconstitutional', color: 'text-against-400' },
  ineffective:      { label: 'Ineffective',      color: 'text-gold' },
  harmful:          { label: 'Harmful',           color: 'text-against-300' },
  outdated:         { label: 'Outdated',          color: 'text-surface-400' },
  procedural:       { label: 'Procedural',        color: 'text-purple' },
}

// ─── Status config ────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<VetoStatus, {
  label: string
  icon: typeof Scale
  color: string
  bg: string
  border: string
}> = {
  open:      { label: 'Active',     icon: ShieldAlert,  color: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  succeeded: { label: 'Succeeded',  icon: ShieldCheck,  color: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  failed:    { label: 'Failed',     icon: ShieldX,      color: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  withdrawn: { label: 'Withdrawn',  icon: MinusCircle,  color: 'text-surface-500', bg: 'bg-surface-300/10', border: 'border-surface-400/20' },
}

// ─── Tab config ───────────────────────────────────────────────────────────────

type TabId = 'open' | 'succeeded' | 'all'

const TABS: { id: TabId; label: string; param: string }[] = [
  { id: 'open',      label: 'Active',    param: 'open' },
  { id: 'succeeded', label: 'Succeeded', param: 'succeeded' },
  { id: 'all',       label: 'All',       param: 'all' },
]

// ─── Signature progress bar ───────────────────────────────────────────────────

function SignatureBar({ count, target }: { count: number; target: number }) {
  const pct = Math.min(100, Math.round((count / Math.max(1, target)) * 100))
  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-white font-semibold">{count.toLocaleString()} / {target.toLocaleString()} signatures</span>
        <span className={cn('font-semibold', pct >= 100 ? 'text-emerald' : pct >= 60 ? 'text-gold' : 'text-surface-500')}>
          {pct}%
        </span>
      </div>
      <div className="h-2 rounded-full bg-surface-300 overflow-hidden">
        <motion.div
          className={cn(
            'h-full rounded-full',
            pct >= 100 ? 'bg-emerald' : pct >= 60 ? 'bg-gold' : 'bg-for-500'
          )}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut' }}
        />
      </div>
    </div>
  )
}

// ─── Veto Card ────────────────────────────────────────────────────────────────

function VetoCard({ veto, onSign }: { veto: VetoEntry; onSign: (id: string, signed: boolean) => void }) {
  const [expanded, setExpanded] = useState(false)
  const [signing, setSigning] = useState(false)
  const [signed, setSigned] = useState(veto.user_has_signed)
  const [sigCount, setSigCount] = useState(veto.signature_count)

  const status = STATUS_CONFIG[veto.status]
  const StatusIcon = status.icon
  const grounds = GROUNDS_CONFIG[veto.grounds_type]
  const isOpen = veto.status === 'open'
  const isExpiringSoon =
    isOpen && new Date(veto.closes_at).getTime() - Date.now() < 3 * 86_400_000

  async function handleSign() {
    if (signing) return
    setSigning(true)
    try {
      const method = signed ? 'DELETE' : 'POST'
      const res = await fetch(`/api/vetoes/${veto.id}/sign`, { method })
      if (res.ok) {
        const next = !signed
        setSigned(next)
        setSigCount((c) => c + (next ? 1 : -1))
        onSign(veto.id, next)
      }
    } catch {
      // best-effort
    } finally {
      setSigning(false)
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border overflow-hidden',
        'bg-surface-100 transition-colors',
        isOpen ? 'border-gold/20 hover:border-gold/40' : `${status.border}`,
      )}
    >
      {/* Header */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Icon */}
          <div className={cn('flex-shrink-0 h-9 w-9 rounded-xl flex items-center justify-center', status.bg)}>
            <StatusIcon className={cn('h-4.5 w-4.5', status.color)} />
          </div>

          <div className="flex-1 min-w-0">
            {/* Status + grounds */}
            <div className="flex items-center gap-2 flex-wrap mb-1.5">
              <span className={cn('text-[10px] font-mono font-bold uppercase tracking-wide', status.color)}>
                {status.label}
              </span>
              <span className="text-surface-600 text-[10px]">·</span>
              <span className={cn('text-[10px] font-mono', grounds.color)}>
                {grounds.label}
              </span>
              {isExpiringSoon && (
                <>
                  <span className="text-surface-600 text-[10px]">·</span>
                  <span className="text-[10px] font-mono text-against-400 flex items-center gap-1">
                    <Clock className="h-2.5 w-2.5" />
                    {timeLeft(veto.closes_at)}
                  </span>
                </>
              )}
              {!isExpiringSoon && isOpen && (
                <>
                  <span className="text-surface-600 text-[10px]">·</span>
                  <span className="text-[10px] font-mono text-surface-500">
                    {timeLeft(veto.closes_at)}
                  </span>
                </>
              )}
            </div>

            {/* Title */}
            <h2 className="text-sm font-semibold text-white leading-snug">
              {veto.title}
            </h2>

            {/* Law reference */}
            {veto.law && (
              <div className="flex items-start gap-1.5 mt-2 p-2.5 rounded-lg bg-gold/5 border border-gold/15">
                <Gavel className="h-3 w-3 text-gold flex-shrink-0 mt-0.5" />
                <div className="min-w-0">
                  <Link
                    href={`/law/${veto.law.id}`}
                    className="text-[11px] text-gold/90 hover:text-gold line-clamp-1 leading-tight transition-colors"
                  >
                    {veto.law.statement}
                  </Link>
                  {veto.law.category && (
                    <span className="text-[10px] text-surface-600 mt-0.5 block">{veto.law.category}</span>
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Signature progress */}
        <div className="mt-4">
          <SignatureBar count={sigCount} target={veto.target_signatures} />
        </div>

        {/* Actions row */}
        <div className="flex items-center justify-between mt-3">
          {/* Challenger */}
          <div className="flex items-center gap-2">
            {veto.challenger ? (
              <Link href={`/profile/${veto.challenger.username}`} className="flex items-center gap-1.5 group">
                <Avatar
                  src={veto.challenger.avatar_url}
                  fallback={veto.challenger.display_name || veto.challenger.username}
                  size="xs"
                />
                <span className="text-xs text-surface-500 group-hover:text-surface-400 transition-colors">
                  {veto.challenger.display_name || veto.challenger.username}
                </span>
              </Link>
            ) : (
              <span className="text-xs text-surface-600">Anonymous</span>
            )}
            <span className="text-surface-700 text-[10px]">·</span>
            <span className="text-[10px] text-surface-600">{relativeTime(veto.created_at)}</span>
          </div>

          <div className="flex items-center gap-2">
            {/* Expand/collapse button */}
            <button
              onClick={() => setExpanded((e) => !e)}
              className="flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
              aria-expanded={expanded}
            >
              {expanded ? (
                <>Collapse <ChevronUp className="h-3 w-3" /></>
              ) : (
                <>Grounds <ChevronDown className="h-3 w-3" /></>
              )}
            </button>

            {/* Sign / unsign button (only for open vetoes) */}
            {isOpen && (
              <button
                onClick={handleSign}
                disabled={signing}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold',
                  'border transition-all duration-150 disabled:opacity-50',
                  signed
                    ? 'bg-emerald/10 border-emerald/40 text-emerald hover:bg-against-500/10 hover:border-against-500/40 hover:text-against-400'
                    : 'bg-surface-300 border-surface-400 text-white hover:bg-gold/20 hover:border-gold/50 hover:text-gold'
                )}
              >
                {signing ? (
                  <Loader2 className="h-3 w-3 animate-spin" />
                ) : signed ? (
                  <>
                    <Check className="h-3 w-3" />
                    Signed
                  </>
                ) : (
                  <>
                    <Shield className="h-3 w-3" />
                    Sign
                  </>
                )}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Expanded grounds */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4">
              <div className="p-3.5 rounded-xl bg-surface-200/60 border border-surface-300">
                <p className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-2">
                  Grounds for Veto
                </p>
                <p className="text-sm text-surface-700 leading-relaxed whitespace-pre-wrap">
                  {veto.grounds}
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Skeleton list ────────────────────────────────────────────────────────────

function VetoListSkeleton() {
  return (
    <div className="space-y-3">
      {[1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3">
          <div className="flex items-start gap-3">
            <Skeleton className="h-9 w-9 rounded-xl flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3 w-32" />
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-10 w-full rounded-lg" />
            </div>
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
          <div className="flex items-center justify-between">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-7 w-20 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function VetoesPage() {
  const [activeTab, setActiveTab] = useState<TabId>('open')
  const [vetoes, setVetoes] = useState<VetoEntry[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)

  const fetchVetoes = useCallback(async (tab: TabId, offset = 0) => {
    const param = TABS.find((t) => t.id === tab)?.param ?? 'open'
    const res = await fetch(`/api/vetoes?status=${param}&limit=20&offset=${offset}`)
    if (!res.ok) return null
    return res.json() as Promise<{ vetoes: VetoEntry[]; total: number }>
  }, [])

  useEffect(() => {
    setLoading(true)
    setVetoes([])
    fetchVetoes(activeTab, 0)
      .then((data) => {
        if (data) {
          setVetoes(data.vetoes)
          setTotal(data.total)
        }
      })
      .finally(() => setLoading(false))
  }, [activeTab, fetchVetoes])

  async function loadMore() {
    if (loadingMore) return
    setLoadingMore(true)
    const data = await fetchVetoes(activeTab, vetoes.length)
    if (data) {
      setVetoes((prev) => [...prev, ...data.vetoes])
      setTotal(data.total)
    }
    setLoadingMore(false)
  }

  function handleSign(id: string, _signed: boolean) {
    // Refresh count is already done optimistically in the card; nothing to do here.
    void id
  }

  const hasMore = vetoes.length < total

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-start gap-3 mb-6">
          <Link
            href="/law"
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0 mt-0.5"
            aria-label="Back to Law Codex"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div>
            <div className="flex items-center gap-2">
              <div className="h-8 w-8 rounded-xl bg-against-500/10 border border-against-500/20 flex items-center justify-center">
                <ShieldAlert className="h-4 w-4 text-against-400" />
              </div>
              <h1 className="text-xl font-bold font-mono text-white">Civic Vetoes</h1>
            </div>
            <p className="text-xs text-surface-500 mt-1 leading-relaxed max-w-sm">
              Citizens collectively challenge established laws. A veto that gathers
              enough signatures queues the law for mandatory re-examination.
            </p>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 gap-3 mb-6">
          {[
            { label: 'Total Vetoes', value: total, icon: ShieldAlert, color: 'text-gold' },
            { label: 'Threshold', value: '10%', icon: Users, color: 'text-for-400' },
            { label: 'Window', value: '21 days', icon: Clock, color: 'text-purple' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div
              key={label}
              className="rounded-xl bg-surface-100 border border-surface-300 p-3 text-center"
            >
              <Icon className={cn('h-4 w-4 mx-auto mb-1', color)} />
              <div className={cn('text-sm font-bold font-mono', color)}>{value}</div>
              <div className="text-[10px] font-mono text-surface-600 uppercase tracking-wide mt-0.5">{label}</div>
            </div>
          ))}
        </div>

        {/* Info banner */}
        <div className="flex items-start gap-3 p-3.5 rounded-xl bg-against-500/5 border border-against-500/15 mb-6">
          <AlertTriangle className="h-4 w-4 text-against-400 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-surface-500 leading-relaxed">
            A Civic Veto requires{' '}
            <span className="text-white font-medium">10% of the law&rsquo;s original voter count</span>
            {' '}(minimum 50) within 21 days. Signing is a formal democratic act.
            Succeeded vetoes trigger a new voting round on the underlying topic.
          </p>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-surface-200 rounded-xl mb-5" role="tablist">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              role="tab"
              aria-selected={activeTab === tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={cn(
                'flex-1 h-8 rounded-lg text-sm font-mono font-medium transition-colors',
                activeTab === tab.id
                  ? 'bg-surface-100 text-white shadow-sm'
                  : 'text-surface-500 hover:text-surface-700'
              )}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* List */}
        {loading ? (
          <VetoListSkeleton />
        ) : vetoes.length === 0 ? (
          <EmptyState
            icon={ShieldCheck}
            title="No vetoes here"
            description={
              activeTab === 'open'
                ? 'All established laws are currently unchallenged.'
                : 'No vetoes match this filter.'
            }
          />
        ) : (
          <div className="space-y-3">
            {vetoes.map((veto) => (
              <VetoCard key={veto.id} veto={veto} onSign={handleSign} />
            ))}
          </div>
        )}

        {/* Load more */}
        {hasMore && !loading && (
          <div className="mt-4 flex justify-center">
            <button
              onClick={loadMore}
              disabled={loadingMore}
              className={cn(
                'flex items-center gap-2 px-5 py-2 rounded-xl text-sm font-mono',
                'bg-surface-200 border border-surface-300 text-surface-500',
                'hover:bg-surface-300 hover:text-white transition-colors disabled:opacity-50'
              )}
            >
              {loadingMore ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {loadingMore ? 'Loading…' : 'Load more'}
            </button>
          </div>
        )}

        {/* Footer link */}
        <div className="mt-8 pt-6 border-t border-surface-300 flex items-center justify-between">
          <div className="text-xs text-surface-600">
            Challenged laws go through a new public vote before any reversal.
          </div>
          <Link
            href="/law"
            className="flex items-center gap-1.5 text-xs font-mono text-gold hover:text-amber-300 transition-colors"
          >
            <Gavel className="h-3 w-3" />
            Law Codex
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
