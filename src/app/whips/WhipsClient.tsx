'use client'

/**
 * /whips — The Whip's Office
 *
 * Displays active coalition whip guidance. Coalition leaders and officers
 * can issue formal voting directives (one-line, two-line, three-line whip,
 * or free vote) on topics. Compliance rates are tracked after members vote.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle,
  ArrowLeft,
  BarChart3,
  Check,
  ChevronRight,
  Flag,
  Loader2,
  MessageSquare,
  Plus,
  Scale,
  Search,
  Shield,
  ThumbsDown,
  ThumbsUp,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { WhipGuidance, WhipsResponse } from '@/app/api/whips/route'

// ─── Config ────────────────────────────────────────────────────────────────────

const DIRECTION_CONFIG = {
  for:     { label: 'For',     icon: ThumbsUp,   color: 'text-for-400 bg-for-900/30 border-for-700/40' },
  against: { label: 'Against', icon: ThumbsDown, color: 'text-against-400 bg-against-900/30 border-against-700/40' },
  free:    { label: 'Free Vote', icon: Scale,    color: 'text-surface-300 bg-surface-800/60 border-surface-700/40' },
} as const

const STRENGTH_CONFIG = {
  advisory: {
    label: 'One-Line Whip',
    sublabel: 'Advisory guidance',
    color: 'text-surface-400',
    barColor: 'bg-surface-500',
    bars: 1,
  },
  strong: {
    label: 'Two-Line Whip',
    sublabel: 'Strong recommendation',
    color: 'text-gold',
    barColor: 'bg-gold',
    bars: 2,
  },
  critical: {
    label: 'Three-Line Whip',
    sublabel: 'Mandatory attendance & vote',
    color: 'text-against-400',
    barColor: 'bg-against-500',
    bars: 3,
  },
} as const

const CATEGORY_COLOR: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-400',
  Philosophy:  'text-for-300',
  Culture:     'text-pink-400',
  Health:      'text-red-400',
  Environment: 'text-emerald',
  Education:   'text-amber-400',
}

// ─── Whip Lines component ──────────────────────────────────────────────────────

function WhipLines({ strength }: { strength: keyof typeof STRENGTH_CONFIG }) {
  const conf = STRENGTH_CONFIG[strength]
  return (
    <div className="flex flex-col gap-0.5" title={conf.label}>
      {[1, 2, 3].map((n) => (
        <div
          key={n}
          className={cn(
            'h-0.5 w-5 rounded-full transition-colors',
            n <= conf.bars ? conf.barColor : 'bg-surface-700'
          )}
        />
      ))}
    </div>
  )
}

// ─── Whip Guidance Card ────────────────────────────────────────────────────────

function WhipCard({
  whip,
  isMyCoalition,
  onRevoke,
}: {
  whip: WhipGuidance
  isMyCoalition: boolean
  onRevoke?: (id: string) => void
}) {
  const [revoking, setRevoking] = useState(false)
  const dirConf = DIRECTION_CONFIG[whip.direction as keyof typeof DIRECTION_CONFIG]
  const DirIcon = dirConf?.icon ?? Scale
  const strengthConf = STRENGTH_CONFIG[whip.strength as keyof typeof STRENGTH_CONFIG]

  async function handleRevoke() {
    if (!onRevoke || revoking) return
    setRevoking(true)
    try {
      await fetch(`/api/whips/${whip.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ active: false }),
      })
      onRevoke(whip.id)
    } catch {
      // best-effort
    } finally {
      setRevoking(false)
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.97 }}
      className="rounded-xl border border-surface-700/50 bg-surface-900 p-4 hover:border-surface-600/60 transition-colors"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          {whip.coalition ? (
            <Avatar
              src={whip.coalition.avatar_url}
              username={whip.coalition.name}
              size="sm"
            />
          ) : (
            <div className="h-7 w-7 rounded-full bg-surface-700 flex-shrink-0" />
          )}
          <div className="min-w-0">
            {whip.coalition ? (
              <Link
                href={`/lobby/${whip.coalition.id}`}
                className="text-xs font-semibold text-white hover:text-for-400 transition-colors truncate block"
              >
                {whip.coalition.name}
              </Link>
            ) : (
              <span className="text-xs font-semibold text-surface-400">Unknown coalition</span>
            )}
            <p className="text-[11px] text-surface-500">
              {new Date(whip.created_at).toLocaleDateString('en-GB', {
                day: 'numeric', month: 'short', year: 'numeric',
              })}
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-shrink-0">
          <WhipLines strength={whip.strength as keyof typeof STRENGTH_CONFIG} />
          {isMyCoalition && onRevoke && (
            <button
              onClick={handleRevoke}
              disabled={revoking}
              className="h-6 w-6 flex items-center justify-center rounded-lg bg-surface-800 hover:bg-against-900/50 hover:text-against-400 text-surface-500 transition-colors"
              title="Revoke guidance"
              aria-label="Revoke guidance"
            >
              {revoking ? (
                <Loader2 className="h-3 w-3 animate-spin" />
              ) : (
                <X className="h-3 w-3" />
              )}
            </button>
          )}
        </div>
      </div>

      {/* Topic */}
      {whip.topic ? (
        <Link
          href={`/topic/${whip.topic.id}`}
          className="block mb-3 group"
        >
          <p className="text-sm text-white leading-snug group-hover:text-for-300 transition-colors line-clamp-2">
            {whip.topic.statement}
          </p>
          <p className={cn('text-[11px] mt-0.5', CATEGORY_COLOR[whip.topic.category ?? ''] ?? 'text-surface-500')}>
            {whip.topic.category}
          </p>
        </Link>
      ) : (
        <p className="text-sm text-surface-500 mb-3 italic">Topic removed</p>
      )}

      {/* Direction badge + strength label */}
      <div className="flex items-center gap-2 mb-3">
        <span
          className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-semibold border',
            dirConf?.color ?? 'text-surface-400 bg-surface-800 border-surface-700'
          )}
        >
          <DirIcon className="h-3 w-3" />
          {dirConf?.label ?? whip.direction}
        </span>
        <span className={cn('text-[11px] font-medium', strengthConf?.color ?? 'text-surface-400')}>
          {strengthConf?.label ?? whip.strength}
        </span>
      </div>

      {/* Optional message */}
      {whip.message && (
        <div className="flex items-start gap-2 mb-3 p-2.5 rounded-lg bg-surface-800/60 border border-surface-700/40">
          <MessageSquare className="h-3 w-3 text-surface-500 flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-surface-400 leading-relaxed">{whip.message}</p>
        </div>
      )}

      {/* Compliance */}
      {whip.total_votes > 0 && (
        <div className="mt-2">
          <div className="flex items-center justify-between mb-1">
            <span className="text-[11px] text-surface-500 flex items-center gap-1">
              <BarChart3 className="h-3 w-3" />
              Compliance ({whip.total_votes} votes)
            </span>
            <span className={cn(
              'text-[11px] font-mono font-semibold',
              (whip.compliance_pct ?? 0) >= 80 ? 'text-emerald' :
              (whip.compliance_pct ?? 0) >= 50 ? 'text-gold' : 'text-against-400'
            )}>
              {whip.compliance_pct !== null ? `${whip.compliance_pct}%` : '—'}
            </span>
          </div>
          <div className="h-1 w-full rounded-full bg-surface-800 overflow-hidden">
            <div
              className={cn(
                'h-full rounded-full transition-all',
                (whip.compliance_pct ?? 0) >= 80 ? 'bg-emerald' :
                (whip.compliance_pct ?? 0) >= 50 ? 'bg-gold' : 'bg-against-500'
              )}
              style={{ width: `${whip.compliance_pct ?? 0}%` }}
            />
          </div>
        </div>
      )}
    </motion.div>
  )
}

// ─── Issue Guidance Modal ──────────────────────────────────────────────────────

interface IssuanceForm {
  topic_id: string
  topic_statement: string
  direction: 'for' | 'against' | 'free'
  strength: 'advisory' | 'strong' | 'critical'
  message: string
}

function IssueGuidanceModal({
  coalitionId,
  onClose,
  onIssued,
}: {
  coalitionId: string
  onClose: () => void
  onIssued: () => void
}) {
  const [form, setForm] = useState<IssuanceForm>({
    topic_id: '',
    topic_statement: '',
    direction: 'for',
    strength: 'advisory',
    message: '',
  })
  const [topicSearch, setTopicSearch] = useState('')
  const [topicResults, setTopicResults] = useState<Array<{ id: string; statement: string; category: string | null }>>([])
  const [searchLoading, setSearchLoading] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const searchTopics = useCallback(async (q: string) => {
    if (q.length < 2) { setTopicResults([]); return }
    setSearchLoading(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&tab=topics&limit=8`)
      const data = await res.json()
      setTopicResults(data.results ?? [])
    } catch {
      setTopicResults([])
    } finally {
      setSearchLoading(false)
    }
  }, [])

  useEffect(() => {
    const t = setTimeout(() => searchTopics(topicSearch), 300)
    return () => clearTimeout(t)
  }, [topicSearch, searchTopics])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.topic_id) { setError('Please select a topic.'); return }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/whips', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          coalition_id: coalitionId,
          topic_id: form.topic_id,
          direction: form.direction,
          strength: form.strength,
          message: form.message.trim() || undefined,
        }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error ?? 'Failed to issue guidance.'); return }
      onIssued()
      onClose()
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center px-4 pb-4">
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        className="relative w-full max-w-md rounded-2xl border border-surface-700/60 bg-surface-950 p-5 shadow-2xl"
      >
        <div className="flex items-center justify-between mb-5">
          <div className="flex items-center gap-2">
            <Flag className="h-4 w-4 text-gold" />
            <h2 className="text-sm font-bold text-white">Issue Whip Guidance</h2>
          </div>
          <button
            onClick={onClose}
            className="h-7 w-7 flex items-center justify-center rounded-lg bg-surface-800 hover:bg-surface-700 text-surface-400 transition-colors"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Topic search */}
          <div>
            <label className="block text-[11px] font-semibold text-surface-400 uppercase tracking-wide mb-1.5">
              Topic
            </label>
            {form.topic_id ? (
              <div className="flex items-start gap-2 p-2.5 rounded-lg bg-for-900/20 border border-for-700/40">
                <Check className="h-3.5 w-3.5 text-for-400 flex-shrink-0 mt-0.5" />
                <p className="text-xs text-white flex-1 leading-snug">{form.topic_statement}</p>
                <button
                  type="button"
                  onClick={() => setForm((f) => ({ ...f, topic_id: '', topic_statement: '' }))}
                  className="text-surface-500 hover:text-against-400 transition-colors flex-shrink-0"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ) : (
              <div className="relative">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-500 pointer-events-none" />
                <input
                  type="text"
                  value={topicSearch}
                  onChange={(e) => setTopicSearch(e.target.value)}
                  placeholder="Search topics..."
                  className="w-full pl-8 pr-3 py-2 rounded-lg bg-surface-800 border border-surface-700/60 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-for-500/60"
                />
                {searchLoading && (
                  <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-500 animate-spin" />
                )}
              </div>
            )}

            {/* Topic results */}
            {!form.topic_id && topicResults.length > 0 && (
              <div className="mt-1 rounded-lg border border-surface-700/60 bg-surface-900 overflow-hidden">
                {topicResults.map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={() => {
                      setForm((f) => ({ ...f, topic_id: t.id, topic_statement: t.statement }))
                      setTopicSearch('')
                      setTopicResults([])
                    }}
                    className="w-full flex items-start gap-2 px-3 py-2.5 hover:bg-surface-800 text-left transition-colors border-b border-surface-700/40 last:border-0"
                  >
                    <ChevronRight className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 mt-0.5" />
                    <div>
                      <p className="text-xs text-white leading-snug">{t.statement}</p>
                      {t.category && (
                        <p className={cn('text-[10px] mt-0.5', CATEGORY_COLOR[t.category] ?? 'text-surface-500')}>
                          {t.category}
                        </p>
                      )}
                    </div>
                  </button>
                ))}
              </div>
            )}
          </div>

          {/* Direction */}
          <div>
            <label className="block text-[11px] font-semibold text-surface-400 uppercase tracking-wide mb-1.5">
              Direction
            </label>
            <div className="grid grid-cols-3 gap-2">
              {(['for', 'against', 'free'] as const).map((d) => {
                const conf = DIRECTION_CONFIG[d]
                const Icon = conf.icon
                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, direction: d }))}
                    className={cn(
                      'flex flex-col items-center gap-1 py-2.5 rounded-lg border text-xs font-semibold transition-colors',
                      form.direction === d ? conf.color : 'text-surface-500 bg-surface-800 border-surface-700/60 hover:border-surface-600'
                    )}
                  >
                    <Icon className="h-4 w-4" />
                    {conf.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Strength */}
          <div>
            <label className="block text-[11px] font-semibold text-surface-400 uppercase tracking-wide mb-1.5">
              Whip Strength
            </label>
            <div className="space-y-2">
              {(['advisory', 'strong', 'critical'] as const).map((s) => {
                const conf = STRENGTH_CONFIG[s]
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, strength: s }))}
                    className={cn(
                      'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg border text-left transition-colors',
                      form.strength === s
                        ? 'border-surface-500 bg-surface-800'
                        : 'border-surface-700/60 bg-surface-900 hover:border-surface-600/60'
                    )}
                  >
                    <WhipLines strength={s} />
                    <div>
                      <p className={cn('text-xs font-semibold', conf.color)}>{conf.label}</p>
                      <p className="text-[11px] text-surface-500">{conf.sublabel}</p>
                    </div>
                    {form.strength === s && (
                      <Check className="h-3.5 w-3.5 text-emerald ml-auto" />
                    )}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Optional message */}
          <div>
            <label className="block text-[11px] font-semibold text-surface-400 uppercase tracking-wide mb-1.5">
              Message <span className="text-surface-600 normal-case font-normal">(optional)</span>
            </label>
            <textarea
              value={form.message}
              onChange={(e) => setForm((f) => ({ ...f, message: e.target.value }))}
              rows={2}
              maxLength={500}
              placeholder="Brief rationale for the guidance..."
              className="w-full px-3 py-2 rounded-lg bg-surface-800 border border-surface-700/60 text-sm text-white placeholder-surface-500 focus:outline-none focus:border-for-500/60 resize-none"
            />
            <p className="text-[11px] text-surface-600 text-right mt-0.5">{form.message.length}/500</p>
          </div>

          {error && (
            <div className="flex items-center gap-2 p-2.5 rounded-lg bg-against-900/30 border border-against-700/40">
              <AlertCircle className="h-3.5 w-3.5 text-against-400 flex-shrink-0" />
              <p className="text-xs text-against-300">{error}</p>
            </div>
          )}

          <button
            type="submit"
            disabled={submitting || !form.topic_id}
            className="w-full py-2.5 rounded-xl bg-for-600 hover:bg-for-500 disabled:opacity-50 disabled:cursor-not-allowed text-white text-sm font-semibold transition-colors flex items-center justify-center gap-2"
          >
            {submitting ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Issuing...</>
            ) : (
              <><Flag className="h-4 w-4" /> Issue Guidance</>
            )}
          </button>
        </form>
      </motion.div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

type Tab = 'all' | 'my_coalition'

export function WhipsClient() {
  const [data, setData] = useState<WhipsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [tab, setTab] = useState<Tab>('all')
  const [showModal, setShowModal] = useState(false)
  const [filterStrength, setFilterStrength] = useState<string | null>(null)

  const load = useCallback(async (coalitionId?: string) => {
    setLoading(true)
    try {
      const url = new URL('/api/whips', window.location.origin)
      if (coalitionId) url.searchParams.set('coalition_id', coalitionId)
      const res = await fetch(url.toString())
      if (res.ok) setData(await res.json())
    } catch {
      // best-effort
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // When switching to "my coalition" tab, reload with coalition filter
  useEffect(() => {
    if (tab === 'my_coalition' && data?.my_coalition) {
      load(data.my_coalition.id)
    } else if (tab === 'all') {
      load()
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tab])

  function handleRevoke(id: string) {
    setData((prev) => {
      if (!prev) return prev
      return { ...prev, whips: prev.whips.filter((w) => w.id !== id) }
    })
  }

  const isLeader = data?.my_coalition?.role === 'leader' || data?.my_coalition?.role === 'officer'

  const displayedWhips = filterStrength
    ? (data?.whips ?? []).filter((w) => w.strength === filterStrength)
    : (data?.whips ?? [])

  return (
    <div className="flex flex-col min-h-screen bg-surface-950">
      <TopBar />

      <main className="flex-1 overflow-y-auto pb-24">
        <div className="max-w-2xl mx-auto px-4 py-4">
          {/* Header */}
          <div className="flex items-center gap-3 mb-5">
            <Link
              href="/parliament"
              className="h-8 w-8 flex items-center justify-center rounded-lg bg-surface-800 hover:bg-surface-700 text-surface-400 transition-colors flex-shrink-0"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <Flag className="h-5 w-5 text-gold" />
                <h1 className="text-lg font-bold text-white">The Whip&apos;s Office</h1>
              </div>
              <p className="text-xs text-surface-500">Coalition voting guidance and party discipline</p>
            </div>
            {isLeader && (
              <button
                onClick={() => setShowModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-for-600 hover:bg-for-500 text-white text-xs font-semibold transition-colors flex-shrink-0"
              >
                <Plus className="h-3.5 w-3.5" />
                Issue Whip
              </button>
            )}
          </div>

          {/* Stats */}
          {loading ? (
            <div className="grid grid-cols-3 gap-2 mb-5">
              {[...Array(3)].map((_, i) => (
                <Skeleton key={i} className="h-16 rounded-xl" />
              ))}
            </div>
          ) : data ? (
            <div className="grid grid-cols-3 gap-2 mb-5">
              <div className="rounded-xl border border-surface-700/50 bg-surface-900 p-3 text-center">
                <p className="text-xl font-bold text-white font-mono">{data.stats.active_total}</p>
                <p className="text-[11px] text-surface-500 mt-0.5">Active Whips</p>
              </div>
              <div className="rounded-xl border border-surface-700/50 bg-surface-900 p-3 text-center">
                <p className="text-xl font-bold text-gold font-mono">{data.stats.coalitions_issuing}</p>
                <p className="text-[11px] text-surface-500 mt-0.5">Coalitions</p>
              </div>
              <div className="rounded-xl border border-surface-700/50 bg-surface-900 p-3 text-center">
                <p className={cn(
                  'text-xl font-bold font-mono',
                  data.stats.avg_compliance === null ? 'text-surface-500' :
                  data.stats.avg_compliance >= 80 ? 'text-emerald' :
                  data.stats.avg_compliance >= 50 ? 'text-gold' : 'text-against-400'
                )}>
                  {data.stats.avg_compliance !== null ? `${data.stats.avg_compliance}%` : '—'}
                </p>
                <p className="text-[11px] text-surface-500 mt-0.5">Avg Compliance</p>
              </div>
            </div>
          ) : null}

          {/* Tabs */}
          <div className="flex gap-1 mb-4 p-1 rounded-xl bg-surface-900 border border-surface-700/50">
            {([
              { id: 'all', label: 'All Active Whips', icon: Flag },
              { id: 'my_coalition', label: 'My Coalition', icon: Shield },
            ] as const).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setTab(id)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-xs font-semibold transition-colors',
                  tab === id
                    ? 'bg-surface-800 text-white shadow-sm'
                    : 'text-surface-400 hover:text-surface-300'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </button>
            ))}
          </div>

          {/* My Coalition — no membership prompt */}
          {tab === 'my_coalition' && !loading && !data?.my_coalition && (
            <EmptyState
              icon={Users}
              title="Not a coalition officer"
              description="Only coalition leaders and officers can issue whip guidance. Join a coalition and get promoted to access this panel."
              action={<Link href="/lobby" className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-for-600 hover:bg-for-500 text-white text-sm font-semibold transition-colors"><Users className="h-3.5 w-3.5" />Browse Coalitions</Link>}
            />
          )}

          {/* Strength filter pills */}
          {!loading && displayedWhips.length > 0 && (
            <div className="flex gap-2 mb-4 overflow-x-auto pb-1">
              {([
                { id: null, label: 'All' },
                { id: 'critical', label: 'Three-Line' },
                { id: 'strong', label: 'Two-Line' },
                { id: 'advisory', label: 'One-Line' },
              ]).map(({ id, label }) => (
                <button
                  key={id ?? 'all'}
                  onClick={() => setFilterStrength(id)}
                  className={cn(
                    'flex-shrink-0 px-3 py-1 rounded-full text-xs font-mono font-semibold border transition-colors',
                    filterStrength === id
                      ? 'bg-surface-700 border-surface-500 text-white'
                      : 'bg-surface-900 border-surface-700/50 text-surface-400 hover:border-surface-600'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          )}

          {/* Whip list */}
          {loading ? (
            <div className="space-y-3">
              {[...Array(4)].map((_, i) => (
                <Skeleton key={i} className="h-36 rounded-xl" />
              ))}
            </div>
          ) : displayedWhips.length === 0 ? (
            <EmptyState
              icon={Flag}
              title={tab === 'my_coalition' ? 'No active guidance' : 'No whip guidance issued'}
              description={
                tab === 'my_coalition' && isLeader
                  ? 'Issue your first whip guidance to direct your coalition members on how to vote.'
                  : 'No coalitions have issued formal voting guidance at this time.'
              }
              action={
                tab === 'my_coalition' && isLeader ? (
                  <button
                    onClick={() => setShowModal(true)}
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-for-600 hover:bg-for-500 text-white text-sm font-semibold transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Issue Guidance
                  </button>
                ) : undefined
              }
            />
          ) : (
            <AnimatePresence mode="popLayout">
              <div className="space-y-3">
                {displayedWhips.map((whip) => (
                  <WhipCard
                    key={whip.id}
                    whip={whip}
                    isMyCoalition={tab === 'my_coalition' && !!isLeader}
                    onRevoke={tab === 'my_coalition' && isLeader ? handleRevoke : undefined}
                  />
                ))}
              </div>
            </AnimatePresence>
          )}

          {/* How it works */}
          <div className="mt-8 rounded-xl border border-surface-700/40 bg-surface-900/60 p-4">
            <h3 className="text-xs font-bold text-surface-300 mb-3 flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-gold" />
              How Whip Guidance Works
            </h3>
            <div className="space-y-2">
              {[
                { bars: 1, barColor: 'bg-surface-500', label: 'One-Line Whip', desc: 'Advisory — members are encouraged but not required to follow.' },
                { bars: 2, barColor: 'bg-gold', label: 'Two-Line Whip', desc: 'Strong guidance — attendance and compliance are expected.' },
                { bars: 3, barColor: 'bg-against-500', label: 'Three-Line Whip', desc: 'Mandatory — members who defy this may lose coalition standing.' },
              ].map(({ bars, barColor, label, desc }) => (
                <div key={bars} className="flex items-start gap-3">
                  <div className="flex flex-col gap-0.5 pt-0.5 flex-shrink-0">
                    {[1, 2, 3].map((n) => (
                      <div key={n} className={cn('h-0.5 w-5 rounded-full', n <= bars ? barColor : 'bg-surface-700')} />
                    ))}
                  </div>
                  <div>
                    <p className="text-xs font-semibold text-surface-300">{label}</p>
                    <p className="text-[11px] text-surface-500">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </main>

      <BottomNav />

      {/* Issue modal */}
      <AnimatePresence>
        {showModal && data?.my_coalition && (
          <IssueGuidanceModal
            coalitionId={data.my_coalition.id}
            onClose={() => setShowModal(false)}
            onIssued={() => {
              load(data.my_coalition!.id)
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
