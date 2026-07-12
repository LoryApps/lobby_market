'use client'

/**
 * /coalitions/[id]/whip — The Coalition Whip Office
 *
 * Parliamentary whip system for coalition voting coordination.
 * Officers can issue formal voting guidance on specific topics:
 *
 *   Advisory   — one-line whip: guidance only, members free to deviate
 *   Strong     — two-line whip: expected to vote as directed
 *   Critical   — three-line whip: attendance + compliance mandatory
 *
 * Members see the guidance with a coloured badge when viewing those topics.
 * Compliance rates are tracked after members cast their votes.
 *
 * Distinct from:
 *   /coalitions/[id]/stance-map  — general coalition positions across topics
 *   /coalitions/[id]/war-room    — tactical command overview
 *   coalition_stances            — persistent stance (no compliance tracking)
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  BarChart2,
  CheckCircle2,
  ChevronRight,
  CircleAlert,
  Flag,
  Info,
  Loader2,
  Megaphone,
  Plus,
  Search,
  Shield,
  ThumbsDown,
  ThumbsUp,
  Trash2,
  Users,
  Vote,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils/cn'
import type { WhipGuidance, WhipResponse, WhipStats } from '@/app/api/coalitions/[id]/whip/route'

// ─── Config ───────────────────────────────────────────────────────────────────

const DIRECTION_CONFIG = {
  for: {
    label: 'Vote FOR',
    icon: ThumbsUp,
    classes: 'bg-for-600/20 border-for-500/40 text-for-400',
    badge: 'bg-for-600/10 text-for-400 border border-for-500/30',
  },
  against: {
    label: 'Vote AGAINST',
    icon: ThumbsDown,
    classes: 'bg-against-600/20 border-against-500/40 text-against-400',
    badge: 'bg-against-600/10 text-against-400 border border-against-500/30',
  },
  free: {
    label: 'Free Vote',
    icon: Vote,
    classes: 'bg-surface-300/60 border-surface-400/40 text-surface-200',
    badge: 'bg-surface-300/20 text-surface-300 border border-surface-400/30',
  },
} as const

const STRENGTH_CONFIG = {
  advisory: {
    label: 'Advisory',
    sublabel: 'One-line whip — guidance only',
    color: 'text-surface-300',
    dotClass: 'bg-surface-400',
  },
  strong: {
    label: 'Strong',
    sublabel: 'Two-line whip — expected to comply',
    color: 'text-gold',
    dotClass: 'bg-gold',
  },
  critical: {
    label: 'Critical',
    sublabel: 'Three-line whip — mandatory compliance',
    color: 'text-against-400',
    dotClass: 'bg-against-500',
  },
} as const

// ─── Issue Guidance Modal ─────────────────────────────────────────────────────

interface TopicResult {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
}

interface IssueModalProps {
  coalitionId: string
  onClose: () => void
  onIssued: () => void
}

function IssueGuidanceModal({ coalitionId, onClose, onIssued }: IssueModalProps) {
  const [step, setStep] = useState<'search' | 'configure'>('search')
  const [query, setQuery] = useState('')
  const [searching, setSearching] = useState(false)
  const [results, setResults] = useState<TopicResult[]>([])
  const [selected, setSelected] = useState<TopicResult | null>(null)
  const [direction, setDirection] = useState<'for' | 'against' | 'free'>('for')
  const [strength, setStrength] = useState<'advisory' | 'strong' | 'critical'>('advisory')
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const searchRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doSearch = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return }
    setSearching(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&tab=topics&limit=8`)
      const data = await res.json() as { topics?: TopicResult[] }
      setResults(data.topics ?? [])
    } catch {
      setResults([])
    } finally {
      setSearching(false)
    }
  }, [])

  useEffect(() => {
    if (searchRef.current) clearTimeout(searchRef.current)
    searchRef.current = setTimeout(() => doSearch(query), 300)
    return () => { if (searchRef.current) clearTimeout(searchRef.current) }
  }, [query, doSearch])

  async function submit() {
    if (!selected) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/coalitions/${coalitionId}/whip`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          topic_id: selected.id,
          direction,
          strength,
          message: message.trim() || undefined,
        }),
      })
      if (!res.ok) {
        const d = await res.json() as { error?: string }
        throw new Error(d.error ?? 'Failed to issue guidance')
      }
      onIssued()
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to issue guidance')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 20 }}
        className="w-full max-w-md bg-surface-100 border border-surface-300/60 rounded-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-surface-300/40">
          <div className="flex items-center gap-2">
            {step === 'configure' && (
              <button
                onClick={() => { setStep('search'); setSelected(null) }}
                className="p-1 rounded-lg hover:bg-surface-200 text-surface-400 transition-colors"
              >
                <ArrowLeft className="h-4 w-4" />
              </button>
            )}
            <Megaphone className="h-4 w-4 text-gold" />
            <span className="text-sm font-semibold text-white">Issue Whip Guidance</span>
          </div>
          <button onClick={onClose} className="p-1 rounded-lg hover:bg-surface-200 text-surface-400 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Step 1: Topic search */}
        {step === 'search' && (
          <div className="p-5 space-y-3">
            <p className="text-xs text-surface-400">Search for the topic you want to issue guidance on.</p>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search topics…"
                className="w-full pl-9 pr-4 py-2.5 bg-surface-200 border border-surface-300/60 rounded-xl text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-gold/50"
              />
              {searching && <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-400 animate-spin" />}
            </div>
            <div className="space-y-1.5 max-h-64 overflow-y-auto">
              {results.map((t) => (
                <button
                  key={t.id}
                  onClick={() => { setSelected(t); setStep('configure') }}
                  className="w-full text-left flex items-start gap-3 p-3 rounded-xl hover:bg-surface-200 border border-transparent hover:border-surface-300/40 transition-all group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white line-clamp-2 group-hover:text-gold transition-colors">{t.statement}</p>
                    <div className="flex items-center gap-2 mt-1">
                      {t.category && <span className="text-[10px] text-surface-400 font-mono">{t.category}</span>}
                      <span className={cn(
                        'text-[10px] font-mono px-1.5 py-0.5 rounded-md',
                        t.status === 'active' ? 'bg-emerald/10 text-emerald' :
                        t.status === 'voting' ? 'bg-gold/10 text-gold' :
                        t.status === 'law' ? 'bg-for-600/20 text-for-400' :
                        'bg-surface-300/40 text-surface-400'
                      )}>{t.status.toUpperCase()}</span>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-surface-500 flex-shrink-0 mt-1 group-hover:text-gold transition-colors" />
                </button>
              ))}
              {results.length === 0 && query.length >= 2 && !searching && (
                <p className="text-xs text-surface-500 text-center py-4">No matching topics found</p>
              )}
            </div>
          </div>
        )}

        {/* Step 2: Configure guidance */}
        {step === 'configure' && selected && (
          <div className="p-5 space-y-4">
            {/* Selected topic */}
            <div className="p-3 rounded-xl bg-surface-200/60 border border-surface-300/40">
              <p className="text-xs text-surface-400 mb-1">Topic</p>
              <p className="text-sm text-white line-clamp-2">{selected.statement}</p>
            </div>

            {/* Direction */}
            <div>
              <p className="text-xs text-surface-400 mb-2">Guidance Direction</p>
              <div className="grid grid-cols-3 gap-2">
                {(['for', 'against', 'free'] as const).map((d) => {
                  const cfg = DIRECTION_CONFIG[d]
                  const Icon = cfg.icon
                  return (
                    <button
                      key={d}
                      onClick={() => setDirection(d)}
                      className={cn(
                        'flex flex-col items-center gap-1.5 p-3 rounded-xl border transition-all text-center',
                        direction === d ? cfg.classes : 'bg-surface-200/40 border-surface-300/40 text-surface-400 hover:border-surface-400/60'
                      )}
                    >
                      <Icon className="h-4 w-4" />
                      <span className="text-[11px] font-semibold leading-tight">{cfg.label}</span>
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Strength */}
            <div>
              <p className="text-xs text-surface-400 mb-2">Whip Strength</p>
              <div className="space-y-2">
                {(['advisory', 'strong', 'critical'] as const).map((s) => {
                  const cfg = STRENGTH_CONFIG[s]
                  return (
                    <button
                      key={s}
                      onClick={() => setStrength(s)}
                      className={cn(
                        'w-full flex items-center gap-3 p-3 rounded-xl border transition-all text-left',
                        strength === s
                          ? 'bg-surface-200 border-surface-300/80'
                          : 'bg-surface-200/40 border-surface-300/40 hover:border-surface-400/60'
                      )}
                    >
                      <div className={cn('w-2 h-2 rounded-full flex-shrink-0', cfg.dotClass)} />
                      <div className="min-w-0">
                        <p className={cn('text-xs font-semibold', cfg.color)}>{cfg.label}</p>
                        <p className="text-[11px] text-surface-500 mt-0.5">{cfg.sublabel}</p>
                      </div>
                      {strength === s && <CheckCircle2 className="h-4 w-4 text-for-400 flex-shrink-0 ml-auto" />}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Optional message */}
            <div>
              <p className="text-xs text-surface-400 mb-2">Message to Members <span className="text-surface-600">(optional)</span></p>
              <textarea
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                maxLength={500}
                rows={2}
                placeholder="Explain the rationale for this guidance…"
                className="w-full px-3 py-2 bg-surface-200 border border-surface-300/60 rounded-xl text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-gold/50 resize-none"
              />
              <p className="text-[11px] text-surface-600 mt-1 text-right">{message.length}/500</p>
            </div>

            {error && (
              <div className="flex items-center gap-2 p-3 bg-against-600/10 border border-against-500/30 rounded-xl">
                <AlertTriangle className="h-3.5 w-3.5 text-against-400 flex-shrink-0" />
                <p className="text-xs text-against-400">{error}</p>
              </div>
            )}

            <button
              onClick={submit}
              disabled={submitting}
              className={cn(
                'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl text-sm font-semibold transition-all',
                'bg-gold text-surface-900 hover:bg-gold/90 disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Megaphone className="h-4 w-4" />}
              Issue Whip Guidance
            </button>
          </div>
        )}
      </motion.div>
    </div>
  )
}

// ─── Guidance Card ────────────────────────────────────────────────────────────

function GuidanceCard({
  g,
  canManage,
  onWithdraw,
}: {
  g: WhipGuidance
  canManage: boolean
  onWithdraw: (topicId: string) => void
}) {
  const [withdrawing, setWithdrawing] = useState(false)
  const dirCfg = DIRECTION_CONFIG[g.direction]
  const strCfg = STRENGTH_CONFIG[g.strength]
  const DirIcon = dirCfg.icon

  async function handleWithdraw() {
    setWithdrawing(true)
    try {
      await onWithdraw(g.topic_id)
    } finally {
      setWithdrawing(false)
    }
  }

  const compliancePct = g.compliance_pct
  const hasVotes = g.total_votes > 0

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="bg-surface-100 border border-surface-300/40 rounded-2xl overflow-hidden hover:border-surface-300/70 transition-colors group"
    >
      {/* Direction stripe */}
      <div className={cn('h-1', g.direction === 'for' ? 'bg-for-500' : g.direction === 'against' ? 'bg-against-500' : 'bg-surface-400')} />

      <div className="p-4">
        {/* Header row */}
        <div className="flex items-start gap-3">
          <Link href={`/topic/${g.topic_id}`} className="flex-1 min-w-0">
            <p className="text-sm font-medium text-white line-clamp-2 group-hover:text-gold transition-colors">
              {g.topic_statement}
            </p>
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              {g.topic_category && (
                <span className="text-[10px] text-surface-400 font-mono">{g.topic_category}</span>
              )}
              <span className={cn(
                'text-[10px] font-mono px-1.5 py-0.5 rounded-md',
                g.topic_status === 'active' ? 'bg-emerald/10 text-emerald' :
                g.topic_status === 'voting' ? 'bg-gold/10 text-gold' :
                g.topic_status === 'law' ? 'bg-for-600/20 text-for-400' :
                'bg-surface-300/40 text-surface-400'
              )}>{g.topic_status.toUpperCase()}</span>
            </div>
          </Link>

          {canManage && (
            <button
              onClick={handleWithdraw}
              disabled={withdrawing}
              title="Withdraw guidance"
              className="p-1.5 rounded-lg text-surface-500 hover:text-against-400 hover:bg-against-600/10 transition-colors disabled:opacity-50 flex-shrink-0"
            >
              {withdrawing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </button>
          )}
        </div>

        {/* Guidance pill + strength */}
        <div className="flex items-center gap-2 mt-3">
          <div className={cn('flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-semibold border', dirCfg.badge)}>
            <DirIcon className="h-3 w-3" />
            {dirCfg.label}
          </div>
          <div className="flex items-center gap-1.5">
            <div className={cn('w-1.5 h-1.5 rounded-full', strCfg.dotClass)} />
            <span className={cn('text-[11px] font-medium', strCfg.color)}>{strCfg.label} Whip</span>
          </div>
        </div>

        {/* Issuer */}
        <div className="flex items-center gap-2 mt-3">
          <Avatar
            src={g.issuer_avatar_url}
            fallback={g.issuer_display_name || g.issuer_username}
            size="xs"
          />
          <span className="text-[11px] text-surface-400">
            Issued by{' '}
            <Link href={`/profile/${g.issuer_username}`} className="text-white hover:text-gold transition-colors">
              {g.issuer_display_name || `@${g.issuer_username}`}
            </Link>
          </span>
          <span className="text-[11px] text-surface-600 ml-auto">
            {new Date(g.created_at).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })}
          </span>
        </div>

        {/* Whip message */}
        {g.message && (
          <div className="mt-3 p-3 bg-surface-200/60 rounded-xl border border-surface-300/30">
            <p className="text-xs text-surface-300 italic">&ldquo;{g.message}&rdquo;</p>
          </div>
        )}

        {/* Compliance stats */}
        {hasVotes && (
          <div className="mt-3 pt-3 border-t border-surface-300/30">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-[11px] text-surface-400 flex items-center gap-1">
                <BarChart2 className="h-3 w-3" />
                Compliance
              </span>
              <span className={cn(
                'text-[11px] font-semibold font-mono',
                (compliancePct ?? 0) >= 80 ? 'text-for-400' :
                (compliancePct ?? 0) >= 50 ? 'text-gold' : 'text-against-400'
              )}>
                {compliancePct !== null ? `${compliancePct}%` : '—'}
              </span>
            </div>
            <div className="h-1.5 bg-surface-300/40 rounded-full overflow-hidden">
              <motion.div
                initial={{ width: 0 }}
                animate={{ width: `${compliancePct ?? 0}%` }}
                transition={{ delay: 0.2, duration: 0.6, ease: 'easeOut' }}
                className={cn(
                  'h-full rounded-full',
                  (compliancePct ?? 0) >= 80 ? 'bg-for-500' :
                  (compliancePct ?? 0) >= 50 ? 'bg-gold' : 'bg-against-500'
                )}
              />
            </div>
            <p className="text-[11px] text-surface-500 mt-1">
              {g.compliant_votes} of {g.total_votes} member{g.total_votes !== 1 ? 's' : ''} on record
            </p>
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── Stats Banner ─────────────────────────────────────────────────────────────

function StatsBanner({ stats }: { stats: WhipStats }) {
  return (
    <div className="grid grid-cols-3 gap-3">
      {[
        {
          label: 'Active Guidance',
          value: stats.active_guidance_count,
          icon: Flag,
          color: 'text-gold',
        },
        {
          label: 'Avg Compliance',
          value: stats.overall_compliance_pct !== null ? `${stats.overall_compliance_pct}%` : '—',
          icon: BarChart2,
          color: (stats.overall_compliance_pct ?? 0) >= 70 ? 'text-for-400' : 'text-gold',
        },
        {
          label: 'Members on Record',
          value: stats.members_on_record,
          icon: Users,
          color: 'text-purple',
        },
      ].map(({ label, value, icon: Icon, color }) => (
        <div key={label} className="bg-surface-100 border border-surface-300/40 rounded-xl p-3 text-center">
          <Icon className={cn('h-4 w-4 mx-auto mb-1', color)} />
          <p className="text-lg font-bold text-white font-mono">{value}</p>
          <p className="text-[10px] text-surface-400 mt-0.5">{label}</p>
        </div>
      ))}
    </div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CoalitionWhipPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<WhipResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [showIssueModal, setShowIssueModal] = useState(false)

  const fetchData = useCallback(async () => {
    try {
      const res = await fetch(`/api/coalitions/${id}/whip`)
      if (!res.ok) throw new Error('Failed')
      const json = await res.json() as WhipResponse
      setData(json)
    } catch {
      // leave null — error state handled below
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { fetchData() }, [fetchData])

  async function handleWithdraw(topicId: string) {
    await fetch(`/api/coalitions/${id}/whip?topic_id=${topicId}`, { method: 'DELETE' })
    await fetchData()
  }

  const canManage = data?.user_role === 'leader' || data?.user_role === 'officer'

  return (
    <div className="flex flex-col min-h-screen">
      <TopBar />
      <main className="flex-1 overflow-y-auto pb-24">
        <div className="max-w-2xl mx-auto px-4 py-6 space-y-5">
          {/* Back nav */}
          <Link
            href={`/coalitions/${id}`}
            className="inline-flex items-center gap-1.5 text-sm text-surface-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to coalition
          </Link>

          {/* Page header */}
          <div className="flex items-center justify-between">
            <div>
              <div className="flex items-center gap-2 mb-1">
                <Shield className="h-5 w-5 text-gold" />
                <h1 className="text-xl font-bold text-white">Whip Office</h1>
              </div>
              <p className="text-sm text-surface-400">
                Parliamentary voting guidance for coalition members
              </p>
            </div>
            {canManage && (
              <button
                onClick={() => setShowIssueModal(true)}
                className="flex items-center gap-1.5 px-3 py-2 bg-gold text-surface-900 rounded-xl text-xs font-semibold hover:bg-gold/90 transition-colors"
              >
                <Plus className="h-3.5 w-3.5" />
                Issue Guidance
              </button>
            )}
          </div>

          {/* Explainer */}
          <div className="flex items-start gap-3 p-3.5 bg-surface-200/50 border border-surface-300/30 rounded-xl">
            <Info className="h-4 w-4 text-surface-400 flex-shrink-0 mt-0.5" />
            <div className="text-xs text-surface-400 space-y-0.5">
              <p>The Whip Office coordinates coalition voting across key debates. Officers issue guidance on specific topics, and member compliance is tracked after they vote.</p>
              <p className="text-surface-500">Three strength levels: <span className="text-surface-300">Advisory</span> (guidance only) · <span className="text-gold">Strong</span> (expected) · <span className="text-against-400">Critical</span> (mandatory)</p>
            </div>
          </div>

          {/* Loading */}
          {loading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="bg-surface-100 border border-surface-300/40 rounded-2xl overflow-hidden">
                  <div className="h-1 bg-surface-300/30" />
                  <div className="p-4 space-y-3">
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-3 w-1/2" />
                    <div className="flex gap-2">
                      <Skeleton className="h-6 w-24" />
                      <Skeleton className="h-6 w-20" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Stats */}
          {!loading && data && data.guidance.length > 0 && (
            <StatsBanner stats={data.stats} />
          )}

          {/* Guidance list */}
          {!loading && data && (
            <AnimatePresence mode="popLayout">
              {data.guidance.length === 0 ? (
                <EmptyState
                  icon={<Flag className="h-8 w-8 text-surface-500" />}
                  title="No active whip guidance"
                  description={
                    canManage
                      ? 'Issue guidance on specific topics to coordinate your coalition\'s votes.'
                      : 'Your coalition officers have not issued any voting guidance yet.'
                  }
                  action={
                    canManage ? (
                      <button
                        onClick={() => setShowIssueModal(true)}
                        className="flex items-center gap-2 px-4 py-2 bg-gold text-surface-900 rounded-xl text-sm font-semibold hover:bg-gold/90 transition-colors"
                      >
                        <Megaphone className="h-4 w-4" />
                        Issue First Guidance
                      </button>
                    ) : undefined
                  }
                />
              ) : (
                <div className="space-y-3">
                  {data.guidance.map((g) => (
                    <GuidanceCard
                      key={g.id}
                      g={g}
                      canManage={canManage}
                      onWithdraw={handleWithdraw}
                    />
                  ))}
                </div>
              )}
            </AnimatePresence>
          )}

          {/* What is a whip? Info section */}
          {!loading && (
            <div className="border border-surface-300/30 rounded-xl divide-y divide-surface-300/20">
              <div className="px-4 py-3">
                <p className="text-xs font-semibold text-surface-300">About the Whip System</p>
              </div>
              {[
                {
                  icon: Zap,
                  title: 'Advisory (One-Line Whip)',
                  desc: 'Guidance is shared with members. They are free to vote as they see fit without consequence.',
                },
                {
                  icon: AlertTriangle,
                  title: 'Strong (Two-Line Whip)',
                  desc: 'Members are expected to vote as directed. Compliance is tracked and reported to coalition leadership.',
                },
                {
                  icon: CircleAlert,
                  title: 'Critical (Three-Line Whip)',
                  desc: 'The most serious form of whip. Attendance and compliance are mandatory. Used only on defining votes.',
                },
              ].map(({ icon: Icon, title, desc }) => (
                <div key={title} className="px-4 py-3 flex items-start gap-3">
                  <Icon className="h-4 w-4 text-surface-500 flex-shrink-0 mt-0.5" />
                  <div>
                    <p className="text-xs font-medium text-white">{title}</p>
                    <p className="text-[11px] text-surface-400 mt-0.5">{desc}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </main>
      <BottomNav />

      {/* Issue guidance modal */}
      <AnimatePresence>
        {showIssueModal && (
          <IssueGuidanceModal
            coalitionId={id}
            onClose={() => setShowIssueModal(false)}
            onIssued={() => {
              setShowIssueModal(false)
              fetchData()
            }}
          />
        )}
      </AnimatePresence>
    </div>
  )
}
