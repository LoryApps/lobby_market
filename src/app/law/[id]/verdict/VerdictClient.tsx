'use client'

/**
 * /law/[id]/verdict — Community Verdict
 *
 * After a topic becomes an established law, citizens can cast a retrospective
 * verdict: did this law achieve its stated goals?
 *
 * 5-point scale: Succeeded → Mostly Succeeded → Mixed → Mostly Failed → Failed
 *
 * Distinct from:
 *   /law/[id]/impact     — vote timeline and stats from the original debate
 *   /law/[id]/reviews    — qualitative community ratings
 *   /law/[id]/dissent    — the dissenting opposition voices
 *   /law/[id]/amendments — proposed changes to the law
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  ChevronRight,
  Gavel,
  HelpCircle,
  Loader2,
  MinusCircle,
  RefreshCw,
  Scale,
  Send,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Users,
  X,
  XCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  LawVerdictData,
  VerdictOption,
  VerdictVoter,
  PrescientArg,
} from '@/app/api/laws/[id]/verdict/route'

// ─── Verdict config ───────────────────────────────────────────────────────────

const VERDICT_CONFIG: Record<
  VerdictOption,
  { label: string; sublabel: string; icon: typeof Trophy; color: string; bg: string; border: string; barColor: string }
> = {
  succeeded: {
    label: 'Succeeded',
    sublabel: 'Achieved its stated goals',
    icon: Trophy,
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/40',
    barColor: 'bg-emerald',
  },
  mostly_succeeded: {
    label: 'Mostly Succeeded',
    sublabel: 'More good than bad',
    icon: CheckCircle2,
    color: 'text-for-300',
    bg: 'bg-for-500/10',
    border: 'border-for-500/40',
    barColor: 'bg-for-400',
  },
  mixed: {
    label: 'Mixed',
    sublabel: 'Both gains and failures',
    icon: Scale,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/40',
    barColor: 'bg-gold',
  },
  mostly_failed: {
    label: 'Mostly Failed',
    sublabel: 'More harm than good',
    icon: MinusCircle,
    color: 'text-against-300',
    bg: 'bg-against-500/10',
    border: 'border-against-500/40',
    barColor: 'bg-against-400',
  },
  failed: {
    label: 'Failed',
    sublabel: 'Did not achieve its goals',
    icon: XCircle,
    color: 'text-against-500',
    bg: 'bg-against-600/10',
    border: 'border-against-600/40',
    barColor: 'bg-against-600',
  },
}

const VERDICT_ORDER: VerdictOption[] = [
  'succeeded',
  'mostly_succeeded',
  'mixed',
  'mostly_failed',
  'failed',
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function fmtNumber(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}K`
  return n.toString()
}

function overallVerdict(counts: LawVerdictData['counts'], total: number): VerdictOption | null {
  if (total === 0) return null
  const scores: Record<VerdictOption, number> = {
    succeeded: 4,
    mostly_succeeded: 3,
    mixed: 2,
    mostly_failed: 1,
    failed: 0,
  }
  let weighted = 0
  for (const c of counts) weighted += scores[c.verdict] * c.count
  const avg = weighted / total
  if (avg >= 3.5) return 'succeeded'
  if (avg >= 2.5) return 'mostly_succeeded'
  if (avg >= 1.5) return 'mixed'
  if (avg >= 0.5) return 'mostly_failed'
  return 'failed'
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function VerdictSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-20 w-full rounded-2xl" />
      <div className="space-y-3">
        {VERDICT_ORDER.map((v) => (
          <Skeleton key={v} className="h-14 w-full rounded-xl" />
        ))}
      </div>
      <Skeleton className="h-32 w-full rounded-2xl" />
      <div className="grid grid-cols-2 gap-4">
        <Skeleton className="h-40 rounded-2xl" />
        <Skeleton className="h-40 rounded-2xl" />
      </div>
    </div>
  )
}

// ─── Voter row ────────────────────────────────────────────────────────────────

function VoterRow({ voter }: { voter: VerdictVoter }) {
  const cfg = VERDICT_CONFIG[voter.verdict]
  const Icon = cfg.icon
  return (
    <motion.div
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      className="flex items-start gap-3 py-3 border-b border-surface-300 last:border-0"
    >
      <Avatar
        src={voter.profile?.avatar_url ?? null}
        username={voter.profile?.username ?? 'unknown'}
        size={32}
        role={voter.profile?.role}
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-xs font-mono font-semibold text-white">
            {voter.profile?.display_name ?? voter.profile?.username ?? 'Citizen'}
          </span>
          <span className={cn('inline-flex items-center gap-1 text-[11px] font-mono font-bold', cfg.color)}>
            <Icon className="h-3 w-3" aria-hidden />
            {cfg.label}
          </span>
          <span className="text-[10px] font-mono text-surface-600 ml-auto">{relTime(voter.created_at)}</span>
        </div>
        {voter.reasoning && (
          <p className="text-xs font-mono text-surface-400 mt-0.5 line-clamp-2">
            &ldquo;{voter.reasoning}&rdquo;
          </p>
        )}
      </div>
    </motion.div>
  )
}

// ─── Prescient arg card ───────────────────────────────────────────────────────

function PrescientCard({ arg }: { arg: PrescientArg }) {
  const isFor = arg.side === 'for'
  return (
    <div
      className={cn(
        'rounded-xl border p-3 space-y-2',
        isFor ? 'border-for-500/30 bg-for-500/5' : 'border-against-500/30 bg-against-500/5',
      )}
    >
      <div className="flex items-center gap-1.5">
        {isFor
          ? <ThumbsUp className="h-3 w-3 text-for-400" aria-hidden />
          : <ThumbsDown className="h-3 w-3 text-against-400" aria-hidden />}
        <span className={cn('text-[10px] font-mono font-bold uppercase tracking-widest', isFor ? 'text-for-400' : 'text-against-400')}>
          {isFor ? 'FOR' : 'AGAINST'}
        </span>
        <span className="ml-auto text-[10px] font-mono text-surface-500 flex items-center gap-0.5">
          <ThumbsUp className="h-3 w-3" />
          {arg.upvotes}
        </span>
      </div>
      <p className="text-xs font-mono text-surface-300 leading-relaxed line-clamp-3">
        &ldquo;{arg.content}&rdquo;
      </p>
      {arg.author_username && (
        <div className="flex items-center gap-1.5">
          <Avatar
            src={arg.author_avatar_url}
            username={arg.author_username}
            size={16}
          />
          <span className="text-[10px] font-mono text-surface-500">
            {arg.author_display_name ?? arg.author_username}
          </span>
        </div>
      )}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

interface VerdictClientProps {
  lawId: string
}

export function VerdictClient({ lawId }: VerdictClientProps) {
  const [data, setData] = useState<LawVerdictData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [selectedVerdict, setSelectedVerdict] = useState<VerdictOption | null>(null)
  const [reasoning, setReasoning] = useState('')
  const [showVoteForm, setShowVoteForm] = useState(false)
  const [isAuthed, setIsAuthed] = useState(false)
  const [showAllVoters, setShowAllVoters] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/laws/${lawId}/verdict`)
      if (!res.ok) throw new Error('Failed to load')
      const json = (await res.json()) as LawVerdictData
      setData(json)
      if (json.user_verdict) {
        setSelectedVerdict(json.user_verdict)
        setReasoning(json.user_reasoning ?? '')
      }
    } catch {
      setError('Could not load verdict data.')
    } finally {
      setLoading(false)
    }
  }, [lawId])

  useEffect(() => {
    void load()
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setIsAuthed(!!user)
    })
  }, [load])

  async function handleSubmit() {
    if (!selectedVerdict) return
    setSubmitting(true)
    try {
      const res = await fetch(`/api/laws/${lawId}/verdict`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ verdict: selectedVerdict, reasoning: reasoning.trim() }),
      })
      if (!res.ok) throw new Error('Failed to submit')
      await load()
      setShowVoteForm(false)
    } catch {
      // silent fail — data refresh will reflect actual state
    } finally {
      setSubmitting(false)
    }
  }

  async function handleRetract() {
    setSubmitting(true)
    try {
      await fetch(`/api/laws/${lawId}/verdict`, { method: 'DELETE' })
      setSelectedVerdict(null)
      setReasoning('')
      await load()
      setShowVoteForm(false)
    } catch {
      // silent fail
    } finally {
      setSubmitting(false)
    }
  }

  const overall = data ? overallVerdict(data.counts, data.total_verdicts) : null
  const overallCfg = overall ? VERDICT_CONFIG[overall] : null
  const OverallIcon = overallCfg?.icon ?? Scale

  const topCount = data ? Math.max(...data.counts.map((c) => c.count), 1) : 1
  const displayedVoters = showAllVoters ? data?.recent_voters : data?.recent_voters.slice(0, 5)

  return (
    <div className="min-h-screen bg-surface-50 pb-20 md:pb-8">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-5" id="main-content">
        {/* ── Back nav ── */}
        <Link
          href={`/law/${lawId}`}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors mb-4"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Law
        </Link>

        {/* ── Header ── */}
        <div className="mb-6">
          <div className="flex items-center gap-2 mb-2">
            <Scale className="h-5 w-5 text-gold" aria-hidden />
            <h1 className="text-xl font-mono font-bold text-white">Community Verdict</h1>
          </div>
          {data && (
            <p className="text-sm font-mono text-surface-400 leading-relaxed">
              Did this law achieve its stated goals? Cast your retrospective verdict.
            </p>
          )}
        </div>

        {loading ? (
          <VerdictSkeleton />
        ) : error ? (
          <div className="flex flex-col items-center gap-3 py-20 text-center">
            <Scale className="h-10 w-10 text-surface-600" aria-hidden />
            <p className="text-sm font-mono text-surface-500">{error}</p>
            <button
              onClick={() => void load()}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-lg bg-surface-200 text-white text-xs font-mono hover:bg-surface-300 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Retry
            </button>
          </div>
        ) : data ? (
          <div className="space-y-5">
            {/* ── Law summary card ── */}
            <div className="rounded-2xl border border-gold/30 bg-gold/5 p-4">
              <div className="flex items-start gap-3">
                <div className="p-1.5 rounded-lg bg-gold/15 flex-shrink-0 mt-0.5">
                  <Gavel className="h-4 w-4 text-gold" aria-hidden />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 flex-wrap mb-1">
                    <Badge variant="law" size="sm">ESTABLISHED LAW</Badge>
                    {data.law_category && (
                      <span className="text-[11px] font-mono text-surface-500">{data.law_category}</span>
                    )}
                  </div>
                  <p className="text-sm font-mono text-white font-semibold leading-snug line-clamp-2">
                    {data.law_statement}
                  </p>
                  <div className="flex items-center gap-3 mt-2 text-[11px] font-mono text-surface-500">
                    <span className="text-for-400">{Math.round(data.law_blue_pct)}% FOR</span>
                    <span>·</span>
                    <span>{fmtNumber(data.law_total_votes)} votes</span>
                    {data.law_established_at && (
                      <>
                        <span>·</span>
                        <span>Established {new Date(data.law_established_at).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}</span>
                      </>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* ── Community verdict summary ── */}
            {data.total_verdicts > 0 && overall && overallCfg && (
              <motion.div
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'rounded-2xl border p-4 flex items-center gap-4',
                  overallCfg.bg,
                  overallCfg.border,
                )}
              >
                <div className={cn('p-2.5 rounded-xl flex-shrink-0', overallCfg.bg)}>
                  <OverallIcon className={cn('h-6 w-6', overallCfg.color)} aria-hidden />
                </div>
                <div>
                  <p className="text-[11px] font-mono text-surface-500 uppercase tracking-widest mb-0.5">
                    Community Verdict
                  </p>
                  <p className={cn('text-lg font-mono font-bold', overallCfg.color)}>
                    {overallCfg.label}
                  </p>
                  <p className="text-xs font-mono text-surface-400 mt-0.5">
                    {data.total_verdicts} citizen{data.total_verdicts !== 1 ? 's' : ''} have weighed in
                  </p>
                </div>
              </motion.div>
            )}

            {/* ── Verdict bars ── */}
            <div className="rounded-2xl border border-surface-300 bg-surface-100 divide-y divide-surface-300 overflow-hidden">
              {VERDICT_ORDER.map((verdict, i) => {
                const cfg = VERDICT_CONFIG[verdict]
                const Icon = cfg.icon
                const countRow = data.counts.find((c) => c.verdict === verdict)
                const count = countRow?.count ?? 0
                const pct = data.total_verdicts > 0 ? Math.round((count / data.total_verdicts) * 100) : 0
                const barWidth = topCount > 0 ? (count / topCount) * 100 : 0
                const isSelected = selectedVerdict === verdict
                const isUserChoice = data.user_verdict === verdict

                return (
                  <motion.div
                    key={verdict}
                    initial={{ opacity: 0, x: -8 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.05 }}
                    className={cn(
                      'relative p-3.5 transition-colors',
                      isAuthed && !data.user_verdict ? 'cursor-pointer hover:bg-surface-200' : 'cursor-default',
                    )}
                    onClick={() => {
                      if (!isAuthed || data.user_verdict) return
                      setSelectedVerdict(verdict)
                      setShowVoteForm(true)
                    }}
                    role={isAuthed && !data.user_verdict ? 'button' : undefined}
                    aria-pressed={isSelected}
                    tabIndex={isAuthed && !data.user_verdict ? 0 : undefined}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ' ') {
                        if (!isAuthed || data.user_verdict) return
                        setSelectedVerdict(verdict)
                        setShowVoteForm(true)
                      }
                    }}
                  >
                    {/* Progress bar background */}
                    <div
                      className={cn('absolute inset-y-0 left-0 opacity-15 transition-all duration-700', cfg.barColor)}
                      style={{ width: `${barWidth}%` }}
                      aria-hidden
                    />

                    <div className="relative flex items-center gap-3">
                      <Icon className={cn('h-4 w-4 flex-shrink-0', cfg.color)} aria-hidden />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <p className={cn('text-sm font-mono font-semibold', isUserChoice ? cfg.color : 'text-white')}>
                            {cfg.label}
                            {isUserChoice && (
                              <span className="ml-2 text-[10px] font-normal text-surface-500">your vote</span>
                            )}
                          </p>
                          <div className="flex items-center gap-2 text-xs font-mono text-surface-500">
                            <span className={cn('font-bold', count > 0 && cfg.color)}>{pct}%</span>
                            <span className="text-surface-600">({count})</span>
                          </div>
                        </div>
                        <p className="text-[11px] font-mono text-surface-500 mt-0.5">{cfg.sublabel}</p>
                      </div>
                    </div>
                  </motion.div>
                )
              })}
            </div>

            {/* ── Vote CTA for unauthed users ── */}
            {!isAuthed && (
              <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 text-center">
                <Scale className="h-8 w-8 text-surface-600 mx-auto mb-3" aria-hidden />
                <p className="text-sm font-mono text-white font-semibold mb-1">Cast Your Verdict</p>
                <p className="text-xs font-mono text-surface-500 mb-4">
                  Sign in to weigh in on whether this law achieved its goals.
                </p>
                <Link
                  href="/sign-in"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600 hover:bg-for-500 text-white text-xs font-mono font-bold transition-colors"
                >
                  Sign in to vote
                </Link>
              </div>
            )}

            {/* ── Vote form (already voted — allow change) ── */}
            {isAuthed && data.user_verdict && !showVoteForm && (
              <div className={cn(
                'rounded-2xl border p-4',
                VERDICT_CONFIG[data.user_verdict].bg,
                VERDICT_CONFIG[data.user_verdict].border,
              )}>
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    {(() => { const Ic = VERDICT_CONFIG[data.user_verdict!].icon; return <Ic className={cn('h-4 w-4', VERDICT_CONFIG[data.user_verdict!].color)} aria-hidden /> })()}
                    <div>
                      <p className="text-xs font-mono text-surface-400">Your verdict</p>
                      <p className={cn('text-sm font-mono font-bold', VERDICT_CONFIG[data.user_verdict].color)}>
                        {VERDICT_CONFIG[data.user_verdict].label}
                      </p>
                      {data.user_reasoning && (
                        <p className="text-[11px] font-mono text-surface-400 mt-0.5 line-clamp-1">
                          &ldquo;{data.user_reasoning}&rdquo;
                        </p>
                      )}
                    </div>
                  </div>
                  <button
                    onClick={() => setShowVoteForm(true)}
                    className="text-[11px] font-mono text-surface-500 hover:text-white transition-colors underline underline-offset-2 flex-shrink-0"
                  >
                    Change
                  </button>
                </div>
              </div>
            )}

            {/* ── Vote form (for authed, no vote yet OR changing vote) ── */}
            <AnimatePresence>
              {isAuthed && showVoteForm && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 8 }}
                  className="rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-4"
                >
                  <div className="flex items-center justify-between">
                    <p className="text-sm font-mono font-bold text-white">
                      {selectedVerdict ? `Verdict: ${VERDICT_CONFIG[selectedVerdict].label}` : 'Select your verdict'}
                    </p>
                    <button
                      onClick={() => setShowVoteForm(false)}
                      className="text-surface-500 hover:text-white transition-colors"
                      aria-label="Close vote form"
                    >
                      <X className="h-4 w-4" />
                    </button>
                  </div>

                  {/* Verdict selector in form */}
                  <div className="grid grid-cols-1 gap-2">
                    {VERDICT_ORDER.map((v) => {
                      const cfg = VERDICT_CONFIG[v]
                      const Ic = cfg.icon
                      return (
                        <button
                          key={v}
                          onClick={() => setSelectedVerdict(v)}
                          className={cn(
                            'flex items-center gap-3 p-3 rounded-xl border text-left transition-all',
                            selectedVerdict === v
                              ? cn(cfg.bg, cfg.border, cfg.color)
                              : 'border-surface-300 text-surface-400 hover:border-surface-400 hover:text-white',
                          )}
                        >
                          <Ic className={cn('h-4 w-4 flex-shrink-0', selectedVerdict === v ? cfg.color : 'text-surface-500')} aria-hidden />
                          <div>
                            <p className="text-xs font-mono font-semibold">{cfg.label}</p>
                            <p className="text-[10px] font-mono opacity-70">{cfg.sublabel}</p>
                          </div>
                        </button>
                      )
                    })}
                  </div>

                  {/* Reasoning */}
                  <div>
                    <label className="block text-[11px] font-mono text-surface-500 mb-1.5 uppercase tracking-widest">
                      Reasoning <span className="normal-case">(optional)</span>
                    </label>
                    <textarea
                      value={reasoning}
                      onChange={(e) => setReasoning(e.target.value.slice(0, 400))}
                      placeholder="Explain your verdict in a sentence or two…"
                      rows={3}
                      className="w-full bg-surface-200 border border-surface-300 rounded-lg px-3 py-2 text-sm font-mono text-white placeholder:text-surface-500 focus:outline-none focus:border-gold/50 resize-none"
                    />
                    <p className="text-[10px] font-mono text-surface-600 text-right mt-1">
                      {reasoning.length}/400
                    </p>
                  </div>

                  <div className="flex items-center gap-3">
                    <button
                      onClick={handleSubmit}
                      disabled={!selectedVerdict || submitting}
                      className="flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-gold hover:bg-gold/90 text-surface-900 text-sm font-mono font-bold transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {submitting ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <>
                          <Send className="h-4 w-4" />
                          Submit Verdict
                        </>
                      )}
                    </button>
                    {data.user_verdict && (
                      <button
                        onClick={handleRetract}
                        disabled={submitting}
                        className="px-4 py-2.5 rounded-xl border border-surface-300 text-surface-400 hover:text-white hover:border-surface-400 text-sm font-mono transition-colors disabled:opacity-50"
                      >
                        Retract
                      </button>
                    )}
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* ── Prescient arguments ── */}
            {(data.prescient_for.length > 0 || data.prescient_against.length > 0) && (
              <div>
                <div className="flex items-center gap-2 mb-3">
                  <Award className="h-4 w-4 text-gold" aria-hidden />
                  <h2 className="text-sm font-mono font-bold text-white">Top Original Arguments</h2>
                  <span className="text-[11px] font-mono text-surface-500">from the original debate</span>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div>
                    <p className="text-[10px] font-mono text-for-400 uppercase tracking-widest mb-2">
                      FOR arguments
                    </p>
                    {data.prescient_for.length > 0 ? (
                      <div className="space-y-2">
                        {data.prescient_for.map((arg) => (
                          <PrescientCard key={arg.id} arg={arg} />
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] font-mono text-surface-600 py-4 text-center border border-surface-300 rounded-xl">
                        No FOR arguments found
                      </p>
                    )}
                  </div>
                  <div>
                    <p className="text-[10px] font-mono text-against-400 uppercase tracking-widest mb-2">
                      AGAINST arguments
                    </p>
                    {data.prescient_against.length > 0 ? (
                      <div className="space-y-2">
                        {data.prescient_against.map((arg) => (
                          <PrescientCard key={arg.id} arg={arg} />
                        ))}
                      </div>
                    ) : (
                      <p className="text-[11px] font-mono text-surface-600 py-4 text-center border border-surface-300 rounded-xl">
                        No AGAINST arguments found
                      </p>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/* ── Recent voters ── */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <Users className="h-4 w-4 text-surface-400" aria-hidden />
                  <h2 className="text-sm font-mono font-bold text-white">
                    Recent Verdicts
                  </h2>
                </div>
                {(data.recent_voters.length === 0 && data.total_verdicts === 0) ? null : (
                  <span className="text-[11px] font-mono text-surface-500">
                    {fmtNumber(data.total_verdicts)} total
                  </span>
                )}
              </div>

              {data.recent_voters.length === 0 ? (
                <EmptyState
                  icon={Scale}
                  title="No verdicts yet"
                  description="Be the first citizen to assess whether this law achieved its goals."
                />
              ) : (
                <>
                  <div className="rounded-2xl border border-surface-300 bg-surface-100 px-4 divide-y divide-surface-300">
                    {(displayedVoters ?? []).map((voter) => (
                      <VoterRow key={voter.user_id} voter={voter} />
                    ))}
                  </div>
                  {data.recent_voters.length > 5 && (
                    <button
                      onClick={() => setShowAllVoters((v) => !v)}
                      className="w-full mt-2 py-2 text-xs font-mono text-surface-500 hover:text-white transition-colors flex items-center justify-center gap-1"
                    >
                      {showAllVoters ? 'Show less' : `Show all ${data.recent_voters.length} verdicts`}
                      <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', showAllVoters && 'rotate-90')} />
                    </button>
                  )}
                </>
              )}
            </div>

            {/* ── Help / context ── */}
            <div className="rounded-2xl border border-surface-300 bg-surface-100/50 p-4">
              <div className="flex items-start gap-2">
                <HelpCircle className="h-4 w-4 text-surface-500 flex-shrink-0 mt-0.5" aria-hidden />
                <div>
                  <p className="text-xs font-mono font-semibold text-surface-400 mb-1">How verdicts work</p>
                  <p className="text-[11px] font-mono text-surface-600 leading-relaxed">
                    The Community Verdict is a retrospective assessment — after debate settles and a law is established,
                    citizens reflect on whether it achieved what the FOR side claimed it would.
                    This is separate from the original FOR/AGAINST vote.
                  </p>
                  <div className="flex items-center gap-4 mt-3 flex-wrap">
                    <Link
                      href={`/law/${lawId}/impact`}
                      className="text-xs font-mono text-surface-500 hover:text-white transition-colors flex items-center gap-1"
                    >
                      Original debate stats
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                    <Link
                      href={`/law/${lawId}/dissent`}
                      className="text-xs font-mono text-surface-500 hover:text-white transition-colors flex items-center gap-1"
                    >
                      Loyal opposition
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                    <Link
                      href={`/law/${lawId}/amendments`}
                      className="text-xs font-mono text-surface-500 hover:text-white transition-colors flex items-center gap-1"
                    >
                      Amendments
                      <ChevronRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ) : null}
      </main>

      <BottomNav />
    </div>
  )
}
