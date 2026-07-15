'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Bell,
  BellOff,
  BellRing,
  CheckCircle2,
  ChevronRight,
  Loader2,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { AlertsResponse, PriceAlert } from '@/app/api/exchange/alerts/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString()
}

function priceColor(pct: number, status: string): string {
  if (status === 'law') return 'text-gold'
  if (status === 'failed') return 'text-against-400'
  if (pct >= 67) return 'text-gold'
  if (pct >= 55) return 'text-for-400'
  if (pct <= 33) return 'text-against-400'
  if (pct <= 45) return 'text-against-300'
  return 'text-surface-500'
}

const CATEGORY_COLOR: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-400',
  Philosophy:  'text-purple',
  Culture:     'text-gold',
  Health:      'text-emerald',
  Environment: 'text-emerald',
  Education:   'text-for-300',
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
}

// ─── Topic search result ──────────────────────────────────────────────────────

interface TopicSearchResult {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
}

// ─── Add Alert Modal ──────────────────────────────────────────────────────────

function AddAlertModal({
  onClose,
  onCreated,
  prefilledTopicId,
}: {
  onClose: () => void
  onCreated: () => void
  prefilledTopicId?: string
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TopicSearchResult[]>([])
  const [selectedTopic, setSelectedTopic] = useState<TopicSearchResult | null>(null)
  const [threshold, setThreshold] = useState(66)
  const [direction, setDirection] = useState<'above' | 'below'>('above')
  const [searching, setSearching] = useState(false)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Pre-load topic if given
  useEffect(() => {
    if (!prefilledTopicId) return
    const supabase = createClient()
    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .eq('id', prefilledTopicId)
      .maybeSingle()
      .then(({ data }) => {
        if (data) setSelectedTopic(data as TopicSearchResult)
      })
  }, [prefilledTopicId])

  // Debounced topic search
  useEffect(() => {
    if (selectedTopic) return
    if (query.trim().length < 2) { setResults([]); return }

    const timer = setTimeout(async () => {
      setSearching(true)
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('topics')
          .select('id, statement, category, status, blue_pct, total_votes')
          .ilike('statement', `%${query.trim()}%`)
          .in('status', ['active', 'voting', 'proposed'])
          .order('total_votes', { ascending: false })
          .limit(8)
        setResults((data ?? []) as TopicSearchResult[])
      } finally {
        setSearching(false)
      }
    }, 350)

    return () => clearTimeout(timer)
  }, [query, selectedTopic])

  async function handleSave() {
    if (!selectedTopic) return
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/exchange/alerts', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic_id: selectedTopic.id, threshold, direction }),
      })
      if (!res.ok) {
        const err = await res.json()
        throw new Error(err.error ?? 'Failed to create alert')
      }
      onCreated()
      onClose()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Error')
    } finally {
      setSaving(false)
    }
  }

  const currentPct = Math.round(selectedTopic?.blue_pct ?? 50)
  const dirLabel = direction === 'above' ? 'rises above' : 'falls below'
  const alreadyMet =
    selectedTopic &&
    (direction === 'above' ? currentPct >= threshold : currentPct <= threshold)

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95, y: 16 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.95, y: 16 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-lg bg-surface-100 border border-surface-300 rounded-2xl shadow-2xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-surface-300">
          <div className="flex items-center gap-2.5">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-for-500/10 border border-for-500/30">
              <BellRing className="h-4 w-4 text-for-400" />
            </div>
            <div>
              <h2 className="font-semibold text-white text-sm">New Price Alert</h2>
              <p className="text-xs text-surface-500">Get notified when a market moves</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="p-5 space-y-4">
          {/* Topic picker */}
          <div>
            <label className="block text-xs font-mono text-surface-500 uppercase tracking-wider mb-2">
              Market
            </label>
            {selectedTopic ? (
              <div className="flex items-start gap-3 rounded-xl bg-surface-200 border border-surface-300 p-3">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white leading-snug line-clamp-2">{selectedTopic.statement}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    {selectedTopic.category && (
                      <span className={cn('text-xs font-mono', CATEGORY_COLOR[selectedTopic.category] ?? 'text-surface-500')}>
                        {selectedTopic.category}
                      </span>
                    )}
                    <span className="text-xs font-mono text-surface-500">
                      {Math.round(selectedTopic.blue_pct ?? 50)}¢ FOR
                    </span>
                    <span className={cn('text-xs font-mono', priceColor(Math.round(selectedTopic.blue_pct ?? 50), selectedTopic.status))}>
                      {STATUS_LABEL[selectedTopic.status] ?? selectedTopic.status}
                    </span>
                  </div>
                </div>
                {!prefilledTopicId && (
                  <button
                    onClick={() => { setSelectedTopic(null); setQuery('') }}
                    className="flex-shrink-0 text-surface-500 hover:text-white transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 pointer-events-none" />
                <input
                  type="text"
                  placeholder="Search markets…"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  autoFocus
                  className="w-full pl-9 pr-4 py-2.5 text-sm bg-surface-200 border border-surface-300 rounded-xl text-white placeholder:text-surface-500 focus:outline-none focus:ring-1 focus:ring-for-500"
                />
                {searching && (
                  <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 animate-spin" />
                )}
                {results.length > 0 && (
                  <div className="absolute top-full left-0 right-0 mt-1 z-10 bg-surface-100 border border-surface-300 rounded-xl shadow-xl overflow-hidden">
                    {results.map((r) => (
                      <button
                        key={r.id}
                        onClick={() => { setSelectedTopic(r); setQuery('') }}
                        className="w-full text-left px-3 py-2.5 hover:bg-surface-200 transition-colors border-b border-surface-300 last:border-0"
                      >
                        <p className="text-sm text-white line-clamp-1">{r.statement}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          {r.category && (
                            <span className={cn('text-xs font-mono', CATEGORY_COLOR[r.category] ?? 'text-surface-500')}>
                              {r.category}
                            </span>
                          )}
                          <span className="text-xs font-mono text-surface-500">{Math.round(r.blue_pct ?? 50)}¢</span>
                        </div>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* Alert direction */}
          <div>
            <label className="block text-xs font-mono text-surface-500 uppercase tracking-wider mb-2">
              Alert when price
            </label>
            <div className="grid grid-cols-2 gap-2">
              {(['above', 'below'] as const).map((d) => (
                <button
                  key={d}
                  onClick={() => setDirection(d)}
                  className={cn(
                    'flex items-center gap-2 px-3 py-2.5 rounded-xl text-sm font-medium border transition-colors',
                    direction === d
                      ? d === 'above'
                        ? 'bg-for-500/15 border-for-500/50 text-for-300'
                        : 'bg-against-500/15 border-against-500/50 text-against-300'
                      : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400',
                  )}
                >
                  {d === 'above'
                    ? <TrendingUp className="h-4 w-4 flex-shrink-0" />
                    : <TrendingDown className="h-4 w-4 flex-shrink-0" />
                  }
                  {d === 'above' ? 'Rises above' : 'Falls below'}
                </button>
              ))}
            </div>
          </div>

          {/* Threshold */}
          <div>
            <label className="block text-xs font-mono text-surface-500 uppercase tracking-wider mb-2">
              Threshold: <span className="text-white">{threshold}¢</span>
            </label>
            <input
              type="range"
              min={1}
              max={99}
              value={threshold}
              onChange={(e) => setThreshold(Number(e.target.value))}
              className="w-full accent-for-500"
            />
            {/* Quick presets */}
            <div className="flex items-center gap-2 mt-2 flex-wrap">
              {[33, 45, 50, 55, 66, 75, 90].map((p) => (
                <button
                  key={p}
                  onClick={() => setThreshold(p)}
                  className={cn(
                    'px-2 py-0.5 rounded-full text-xs font-mono border transition-colors',
                    threshold === p
                      ? 'bg-for-500/20 border-for-500/50 text-for-300'
                      : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white',
                  )}
                >
                  {p}¢
                </button>
              ))}
            </div>
          </div>

          {/* Summary + warnings */}
          {selectedTopic && (
            <div className={cn(
              'rounded-xl px-4 py-3 text-xs font-mono border',
              alreadyMet
                ? 'bg-amber-500/10 border-amber-500/30 text-amber-300'
                : 'bg-surface-200 border-surface-300 text-surface-400',
            )}>
              {alreadyMet ? (
                <span>
                  <Zap className="inline h-3.5 w-3.5 mr-1 text-amber-300" />
                  Already met — alert will trigger immediately on save.
                </span>
              ) : (
                <span>
                  Alert when <span className="text-white">{selectedTopic.statement.slice(0, 60)}{selectedTopic.statement.length > 60 ? '…' : ''}</span>{' '}
                  {dirLabel} <span className="text-white">{threshold}¢</span>
                  {' '}(current: <span className={priceColor(currentPct, selectedTopic.status)}>{currentPct}¢</span>).
                </span>
              )}
            </div>
          )}

          {error && (
            <p className="text-xs text-against-400 font-mono">{error}</p>
          )}

          {/* Actions */}
          <div className="flex items-center gap-3 pt-1">
            <Button variant="ghost" onClick={onClose} className="flex-1">
              Cancel
            </Button>
            <Button
              onClick={handleSave}
              disabled={!selectedTopic || saving}
              className="flex-1"
            >
              {saving ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : (
                <Bell className="h-4 w-4 mr-2" />
              )}
              Set Alert
            </Button>
          </div>
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Alert row ────────────────────────────────────────────────────────────────

function AlertRow({
  alert,
  onDelete,
}: {
  alert: PriceAlert
  onDelete: (id: string) => void
}) {
  const [deleting, setDeleting] = useState(false)
  const currentPct = Math.round(alert.topic?.blue_pct ?? 50)

  async function handleDelete() {
    setDeleting(true)
    await fetch(`/api/exchange/alerts?id=${alert.id}`, { method: 'DELETE' })
    onDelete(alert.id)
  }

  const dirIcon = alert.direction === 'above'
    ? <TrendingUp className="h-3.5 w-3.5 text-for-400 flex-shrink-0" />
    : <TrendingDown className="h-3.5 w-3.5 text-against-400 flex-shrink-0" />

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className={cn(
        'group rounded-2xl border p-4 transition-colors',
        alert.is_triggered
          ? 'bg-emerald/5 border-emerald/30'
          : 'bg-surface-100 border-surface-300 hover:border-surface-400',
      )}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className={cn(
          'flex-shrink-0 flex items-center justify-center h-9 w-9 rounded-lg border mt-0.5',
          alert.is_triggered
            ? 'bg-emerald/10 border-emerald/30'
            : 'bg-surface-200 border-surface-300',
        )}>
          {alert.is_triggered
            ? <CheckCircle2 className="h-4 w-4 text-emerald" />
            : <Bell className="h-4 w-4 text-for-400" />
          }
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <Link
            href={`/exchange/${alert.topic_id}`}
            className="block text-sm text-white hover:text-for-300 transition-colors leading-snug line-clamp-2 mb-1.5"
          >
            {alert.topic?.statement}
          </Link>

          <div className="flex items-center gap-3 flex-wrap">
            {/* Condition */}
            <div className="flex items-center gap-1 text-xs font-mono text-surface-400">
              {dirIcon}
              <span>{alert.direction === 'above' ? '≥' : '≤'}</span>
              <span className="text-white">{alert.threshold}¢</span>
            </div>

            {/* Current price */}
            <div className="flex items-center gap-1 text-xs font-mono text-surface-500">
              <span>now:</span>
              <span className={priceColor(currentPct, alert.topic?.status ?? '')}>
                {currentPct}¢
              </span>
            </div>

            {/* Category */}
            {alert.topic?.category && (
              <span className={cn('text-xs font-mono', CATEGORY_COLOR[alert.topic.category] ?? 'text-surface-500')}>
                {alert.topic.category}
              </span>
            )}

            {/* Triggered */}
            {alert.is_triggered && (
              <span className="text-xs font-mono text-emerald flex items-center gap-1">
                <Zap className="h-3 w-3" />
                {alert.triggered_at ? `Triggered ${relTime(alert.triggered_at)}` : 'Triggered'}
              </span>
            )}
          </div>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <Link
            href={`/exchange/${alert.topic_id}`}
            className="h-7 w-7 flex items-center justify-center rounded-lg text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
          <button
            onClick={handleDelete}
            disabled={deleting}
            className="h-7 w-7 flex items-center justify-center rounded-lg text-surface-500 hover:text-against-400 hover:bg-against-500/10 transition-colors opacity-0 group-hover:opacity-100"
          >
            {deleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
          </button>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function AlertsSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 4 }).map((_, i) => (
        <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-4">
          <div className="flex items-start gap-3">
            <Skeleton className="h-9 w-9 rounded-lg flex-shrink-0" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-4/5" />
              <Skeleton className="h-3 w-2/5" />
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function AlertsClient({ prefilledTopicId }: { prefilledTopicId?: string }) {
  const router = useRouter()
  const [alerts, setAlerts] = useState<PriceAlert[]>([])
  const [loading, setLoading] = useState(true)
  const [showModal, setShowModal] = useState(!!prefilledTopicId)
  const [filter, setFilter] = useState<'all' | 'active' | 'triggered'>('all')
  const [authed, setAuthed] = useState<boolean | null>(null)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) { router.push('/login'); return }
      setAuthed(true)
    })
  }, [router])

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/exchange/alerts')
      if (!res.ok) throw new Error()
      const data: AlertsResponse = await res.json()
      setAlerts(data.alerts)
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authed) load()
  }, [authed, load])

  function handleDelete(id: string) {
    setAlerts((prev) => prev.filter((a) => a.id !== id))
  }

  const filtered = alerts.filter((a) => {
    if (filter === 'active') return !a.is_triggered
    if (filter === 'triggered') return a.is_triggered
    return true
  })

  const activeCount = alerts.filter((a) => !a.is_triggered).length
  const triggeredCount = alerts.filter((a) => a.is_triggered).length

  if (authed === null) return null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/exchange"
            className="h-9 w-9 flex items-center justify-center rounded-xl bg-surface-200 border border-surface-300 text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-lg font-semibold text-white flex items-center gap-2">
              <Bell className="h-5 w-5 text-for-400" />
              Price Alerts
            </h1>
            <p className="text-xs text-surface-500 font-mono">
              Notify me when a market crosses a threshold
            </p>
          </div>
          <button
            onClick={() => { setShowModal(true) }}
            className="flex items-center gap-2 px-3 py-2 rounded-xl bg-for-500/10 border border-for-500/30 text-for-300 text-sm font-medium hover:bg-for-500/20 transition-colors"
          >
            <Plus className="h-4 w-4" />
            New alert
          </button>
        </div>

        {/* Stats row */}
        {!loading && alerts.length > 0 && (
          <div className="grid grid-cols-3 gap-3 mb-5">
            {[
              { label: 'Total',     value: alerts.length,   color: 'text-white' },
              { label: 'Watching',  value: activeCount,     color: 'text-for-400' },
              { label: 'Triggered', value: triggeredCount,  color: 'text-emerald' },
            ].map(({ label, value, color }) => (
              <div key={label} className="rounded-xl bg-surface-100 border border-surface-300 p-3 text-center">
                <div className={cn('text-2xl font-mono font-bold', color)}>{value}</div>
                <div className="text-xs font-mono text-surface-500 mt-0.5">{label}</div>
              </div>
            ))}
          </div>
        )}

        {/* Filter tabs */}
        {!loading && alerts.length > 0 && (
          <div className="flex items-center gap-2 mb-4">
            {([
              { id: 'all',       label: 'All' },
              { id: 'active',    label: 'Watching' },
              { id: 'triggered', label: 'Triggered' },
            ] as const).map(({ id, label }) => (
              <button
                key={id}
                onClick={() => setFilter(id)}
                className={cn(
                  'px-3 py-1.5 rounded-full text-xs font-mono border transition-colors',
                  filter === id
                    ? 'bg-for-500/15 border-for-500/40 text-for-300'
                    : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white',
                )}
              >
                {label}
              </button>
            ))}
            <button
              onClick={load}
              className="ml-auto h-7 w-7 flex items-center justify-center rounded-lg text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            </button>
          </div>
        )}

        {/* List */}
        {loading ? (
          <AlertsSkeleton />
        ) : filtered.length === 0 ? (
          <EmptyState
            icon={filter === 'triggered' ? CheckCircle2 : BellOff}
            title={
              filter === 'triggered'
                ? 'No triggered alerts'
                : filter === 'active'
                ? 'No active alerts'
                : 'No alerts set'
            }
            description={
              filter !== 'all'
                ? undefined
                : 'Set price thresholds on any market and get notified when consensus crosses your level.'
            }
            action={filter === 'all' ? {
              label: 'Set your first alert',
              onClick: () => setShowModal(true),
            } : undefined}
          />
        ) : (
          <AnimatePresence mode="popLayout">
            <div className="space-y-3">
              {filtered.map((a) => (
                <AlertRow key={a.id} alert={a} onDelete={handleDelete} />
              ))}
            </div>
          </AnimatePresence>
        )}

        {/* Help callout */}
        {!loading && alerts.length === 0 && (
          <div className="mt-8 rounded-2xl bg-surface-100 border border-surface-300 p-5">
            <h3 className="text-sm font-semibold text-white mb-3 flex items-center gap-2">
              <Zap className="h-4 w-4 text-for-400" />
              How price alerts work
            </h3>
            <ul className="space-y-2 text-xs font-mono text-surface-400">
              <li>• Set a <span className="text-white">threshold</span> (e.g. 66¢ FOR)</li>
              <li>• Choose <span className="text-white">direction</span> — rises above or falls below</li>
              <li>• Get <span className="text-white">notified</span> when the market crosses your level</li>
              <li>• Price = % of votes cast FOR (0–99¢)</li>
              <li>• 66¢ = consensus threshold for law passage</li>
            </ul>
          </div>
        )}
      </main>
      <BottomNav />

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <AddAlertModal
            onClose={() => setShowModal(false)}
            onCreated={load}
            prefilledTopicId={prefilledTopicId}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
