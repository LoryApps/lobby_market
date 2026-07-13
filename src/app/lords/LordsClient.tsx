'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2,
  ChevronRight,
  Crown,
  ExternalLink,
  Loader2,
  RefreshCw,
  RotateCcw,
  Scale,
  ScrollText,
  Shield,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { LordsData, LawUnderReview } from '@/app/api/lords/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d === 1) return 'yesterday'
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

const CATEGORY_COLORS: Record<string, string> = {
  Politics:    'text-for-400',
  Economics:   'text-gold',
  Healthcare:  'text-emerald',
  Environment: 'text-emerald',
  Education:   'text-purple',
  Technology:  'text-purple',
  Justice:     'text-against-400',
  Security:    'text-against-400',
}

function categoryColor(cat: string | null): string {
  if (!cat) return 'text-surface-400'
  return CATEGORY_COLORS[cat] ?? 'text-surface-400'
}

// ─── Ratification bar ─────────────────────────────────────────────────────────

function RatificationBar({ ratify, sendBack, abstain }: { ratify: number; sendBack: number; abstain: number }) {
  const total = ratify + sendBack + abstain
  if (total === 0) return (
    <div className="h-1.5 rounded-full bg-surface-300 w-full" aria-label="No votes yet" />
  )
  const ratifyPct = (ratify / total) * 100
  const sendBackPct = (sendBack / total) * 100
  return (
    <div className="flex h-1.5 rounded-full overflow-hidden w-full gap-px" role="meter" aria-valuenow={Math.round(ratifyPct)} aria-valuemin={0} aria-valuemax={100} aria-label={`${Math.round(ratifyPct)}% ratify`}>
      <div className="bg-emerald transition-all" style={{ width: `${ratifyPct}%` }} />
      <div className="bg-against-500 transition-all" style={{ width: `${sendBackPct}%` }} />
      <div className="bg-surface-400 transition-all flex-1" />
    </div>
  )
}

// ─── Vote buttons ─────────────────────────────────────────────────────────────

function VerdictButton({
  icon: Icon,
  label,
  active,
  color,
  onClick,
  disabled,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  active: boolean
  color: string
  onClick: () => void
  disabled?: boolean
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      aria-pressed={active}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
        'border',
        active
          ? `${color} border-current ring-1 ring-current/40`
          : 'text-surface-500 border-surface-300 hover:border-surface-500 hover:text-surface-200',
        disabled && 'opacity-40 cursor-not-allowed',
      )}
    >
      <Icon className="h-3.5 w-3.5" aria-hidden="true" />
      {label}
    </button>
  )
}

// ─── Law card ─────────────────────────────────────────────────────────────────

function LawReviewCard({
  law,
  isLord,
  onVote,
  submitting,
}: {
  law: LawUnderReview
  isLord: boolean
  onVote: (lawId: string, verdict: 'ratify' | 'send_back' | 'abstain', note?: string) => void
  submitting: string | null
}) {
  const [showNote, setShowNote] = useState(false)
  const [note, setNote] = useState('')
  const [pendingVerdict, setPendingVerdict] = useState<'ratify' | 'send_back' | 'abstain' | null>(null)

  const userVerdict = law.user_review?.verdict ?? null
  const isSubmitting = submitting === law.id

  function handleVerdict(v: 'ratify' | 'send_back' | 'abstain') {
    if (!isLord) return
    if (v === 'send_back') {
      setPendingVerdict(v)
      setShowNote(true)
      return
    }
    onVote(law.id, v)
  }

  function submitWithNote() {
    if (!pendingVerdict) return
    onVote(law.id, pendingVerdict, note.trim() || undefined)
    setShowNote(false)
    setNote('')
    setPendingVerdict(null)
  }

  const ratifyPct = law.total_reviews > 0
    ? Math.round((law.ratify_count / law.total_reviews) * 100)
    : 0

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface-200 border border-surface-300 rounded-xl p-4 space-y-3"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1 flex-wrap">
            {law.category && (
              <span className={cn('text-[10px] font-semibold uppercase tracking-wider', categoryColor(law.category))}>
                {law.category}
              </span>
            )}
            <span className="text-[10px] text-surface-400 flex items-center gap-1">
              <ScrollText className="h-2.5 w-2.5" aria-hidden="true" />
              Established {relativeTime(law.established_at)}
            </span>
          </div>
          <p className="text-sm font-medium text-surface-900 leading-snug line-clamp-2">
            {law.statement}
          </p>
        </div>
        <Link
          href={`/law/${law.topic_id}`}
          aria-label="View law"
          className="text-surface-400 hover:text-surface-200 transition-colors flex-shrink-0"
        >
          <ExternalLink className="h-4 w-4" aria-hidden="true" />
        </Link>
      </div>

      {/* Commons vote stats */}
      {law.total_votes != null && (
        <div className="flex items-center gap-3 text-[11px] text-surface-400">
          <span>Commons: {Math.round(law.blue_pct ?? 50)}% For</span>
          <span className="text-surface-600">·</span>
          <span>{(law.total_votes ?? 0).toLocaleString()} votes</span>
        </div>
      )}

      {/* Lords review progress */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-surface-400">Lords review</span>
          <span className="text-surface-300 tabular-nums">
            {law.total_reviews} vote{law.total_reviews !== 1 ? 's' : ''}
            {law.total_reviews > 0 && ` · ${ratifyPct}% ratify`}
          </span>
        </div>
        <RatificationBar ratify={law.ratify_count} sendBack={law.send_back_count} abstain={law.abstain_count} />
        {law.total_reviews > 0 && (
          <div className="flex gap-3 text-[10px] text-surface-500">
            <span className="text-emerald">{law.ratify_count} ratify</span>
            <span className="text-against-400">{law.send_back_count} send back</span>
            <span>{law.abstain_count} abstain</span>
          </div>
        )}
      </div>

      {/* Verdict buttons (lords only) */}
      {isLord && (
        <div className="pt-1 space-y-2">
          <div className="flex gap-2 flex-wrap">
            <VerdictButton
              icon={CheckCircle2}
              label="Ratify"
              active={userVerdict === 'ratify'}
              color="text-emerald"
              onClick={() => handleVerdict('ratify')}
              disabled={isSubmitting}
            />
            <VerdictButton
              icon={RotateCcw}
              label="Send Back"
              active={userVerdict === 'send_back'}
              color="text-gold"
              onClick={() => handleVerdict('send_back')}
              disabled={isSubmitting}
            />
            <VerdictButton
              icon={Scale}
              label="Abstain"
              active={userVerdict === 'abstain'}
              color="text-surface-400"
              onClick={() => handleVerdict('abstain')}
              disabled={isSubmitting}
            />
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin text-surface-500 self-center" aria-label="Submitting..." />}
          </div>

          {/* Amendment note input */}
          <AnimatePresence>
            {showNote && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden"
              >
                <div className="bg-surface-300 rounded-lg p-3 space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium text-gold">Amendment Note</span>
                    <button
                      onClick={() => { setShowNote(false); setPendingVerdict(null) }}
                      className="text-surface-500 hover:text-surface-200"
                      aria-label="Cancel amendment note"
                    >
                      <X className="h-3.5 w-3.5" aria-hidden="true" />
                    </button>
                  </div>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value.slice(0, 500))}
                    placeholder="Briefly explain what amendments you recommend…"
                    className="w-full bg-surface-200 border border-surface-400 rounded-lg px-3 py-2 text-xs text-surface-200 placeholder:text-surface-500 resize-none focus:outline-none focus:border-gold/50"
                    rows={3}
                    aria-label="Amendment note"
                    maxLength={500}
                  />
                  <div className="flex items-center justify-between">
                    <span className="text-[10px] text-surface-500">{note.length}/500</span>
                    <button
                      onClick={submitWithNote}
                      disabled={isSubmitting}
                      className="px-3 py-1 bg-gold/20 border border-gold/40 rounded-lg text-xs text-gold font-medium hover:bg-gold/30 transition-colors disabled:opacity-40"
                    >
                      Submit
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {userVerdict && (
            <p className="text-[10px] text-surface-500">
              Your verdict: <span className={cn(
                'font-medium',
                userVerdict === 'ratify' ? 'text-emerald' :
                userVerdict === 'send_back' ? 'text-gold' : 'text-surface-400'
              )}>
                {userVerdict === 'ratify' ? 'Ratify' : userVerdict === 'send_back' ? 'Send Back' : 'Abstain'}
              </span>
            </p>
          )}
        </div>
      )}
    </motion.div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export function LordsClient() {
  const [data, setData] = useState<LordsData | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const [submitting, setSubmitting] = useState<string | null>(null)
  const [activeTab, setActiveTab] = useState<'review' | 'lords' | 'decisions'>('review')

  const fetchData = useCallback(async (silent = false) => {
    if (!silent) setLoading(true)
    else setRefreshing(true)
    try {
      const res = await fetch('/api/lords', { cache: 'no-store' })
      if (res.ok) setData(await res.json())
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { fetchData() }, [fetchData])

  const handleVote = useCallback(async (
    lawId: string,
    verdict: 'ratify' | 'send_back' | 'abstain',
    amendmentNote?: string
  ) => {
    setSubmitting(lawId)
    try {
      const res = await fetch('/api/lords/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ law_id: lawId, verdict, amendment_note: amendmentNote }),
      })
      if (res.ok) {
        await fetchData(true)
      }
    } finally {
      setSubmitting(null)
    }
  }, [fetchData])

  // ── Skeleton ───────────────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-surface-100">
        <TopBar />
        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 space-y-6 pb-24">
          <Skeleton className="h-24 w-full rounded-xl" />
          <div className="flex gap-2">
            {[1,2,3].map(i => <Skeleton key={i} className="h-8 w-24 rounded-full" />)}
          </div>
          {[1,2,3].map(i => <Skeleton key={i} className="h-40 w-full rounded-xl" />)}
        </main>
        <BottomNav />
      </div>
    )
  }

  if (!data) {
    return (
      <div className="flex flex-col min-h-screen bg-surface-100">
        <TopBar />
        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 pb-24">
          <EmptyState icon={Crown} title="Chamber unavailable" description="The House of Lords could not be reached. Try refreshing." />
        </main>
        <BottomNav />
      </div>
    )
  }

  const tabs: { id: 'review' | 'lords' | 'decisions'; label: string; count?: number }[] = [
    { id: 'review', label: 'Under Review', count: data.laws_under_review.length },
    { id: 'lords', label: 'The Lords', count: data.lords.length },
    { id: 'decisions', label: 'Decisions', count: data.recent_decisions.length },
  ]

  return (
    <div className="flex flex-col min-h-screen bg-surface-100">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-4 pb-24 space-y-5">

        {/* ── Hero banner ───────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="relative overflow-hidden bg-gradient-to-br from-surface-200 to-surface-300 border border-gold/20 rounded-2xl p-5"
        >
          <div className="absolute inset-0 opacity-[0.03]" style={{
            backgroundImage: 'repeating-linear-gradient(45deg, currentColor 0, currentColor 1px, transparent 0, transparent 50%)',
            backgroundSize: '6px 6px',
          }} />
          <div className="relative flex items-start gap-4">
            <div className="p-2.5 bg-gold/10 border border-gold/30 rounded-xl flex-shrink-0">
              <Crown className="h-6 w-6 text-gold" aria-hidden="true" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-surface-900 tracking-tight">
                The House of Lords
              </h1>
              <p className="text-xs text-surface-400 mt-0.5 leading-relaxed">
                The second chamber of the Lobby Parliament. Lords — the platform&apos;s top civic contributors — review newly established laws and vote to ratify or send them back for reconsideration.
              </p>
              {data.is_lord ? (
                <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-gold/10 border border-gold/30 rounded-full text-[11px] text-gold font-medium">
                  <Crown className="h-3 w-3" aria-hidden="true" />
                  You sit in the House · {data.user_clout} clout
                </div>
              ) : (
                <div className="mt-2 inline-flex items-center gap-1.5 px-2.5 py-1 bg-surface-300 border border-surface-400 rounded-full text-[11px] text-surface-400">
                  <Shield className="h-3 w-3" aria-hidden="true" />
                  {data.lords_threshold - data.user_clout} more clout needed to sit
                </div>
              )}
            </div>
          </div>
        </motion.div>

        {/* ── Tab bar ───────────────────────────────────────────────────── */}
        <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              aria-pressed={activeTab === tab.id}
              className={cn(
                'flex items-center gap-1.5 px-3.5 py-2 rounded-full text-xs font-medium whitespace-nowrap transition-all',
                'border',
                activeTab === tab.id
                  ? 'bg-gold/10 border-gold/40 text-gold'
                  : 'border-surface-300 text-surface-400 hover:text-surface-200 hover:border-surface-400',
              )}
            >
              {tab.label}
              {tab.count !== undefined && (
                <span className={cn(
                  'text-[10px] rounded-full px-1.5 py-0.5 leading-none',
                  activeTab === tab.id ? 'bg-gold/20 text-gold' : 'bg-surface-300 text-surface-500',
                )}>
                  {tab.count}
                </span>
              )}
            </button>
          ))}

          <button
            onClick={() => fetchData(true)}
            disabled={refreshing}
            className="ml-auto flex-shrink-0 text-surface-500 hover:text-surface-200 transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} aria-hidden="true" />
          </button>
        </div>

        {/* ── Under Review tab ──────────────────────────────────────────── */}
        {activeTab === 'review' && (
          <div className="space-y-3">
            {!data.is_lord && (
              <div className="bg-surface-200 border border-surface-300 rounded-xl px-4 py-3 text-xs text-surface-400">
                Earn <span className="text-gold font-medium">{data.lords_threshold} clout</span> to unlock your seat in the House of Lords and vote on newly established laws.
              </div>
            )}

            {data.laws_under_review.length === 0 ? (
              <EmptyState
                icon={ScrollText}
                title="No laws under review"
                description="All recently established laws have completed their review period. Check back when new laws pass."
              />
            ) : (
              data.laws_under_review.map((law) => (
                <LawReviewCard
                  key={law.id}
                  law={law}
                  isLord={data.is_lord}
                  onVote={handleVote}
                  submitting={submitting}
                />
              ))
            )}
          </div>
        )}

        {/* ── The Lords tab ─────────────────────────────────────────────── */}
        {activeTab === 'lords' && (
          <div className="space-y-2">
            {data.lords.length === 0 ? (
              <EmptyState
                icon={Crown}
                title="No lords yet"
                description={`Be the first to earn ${data.lords_threshold} clout and take a seat in the House of Lords.`}
              />
            ) : (
              data.lords.map((lord, i) => (
                <motion.div
                  key={lord.user_id}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                >
                  <Link
                    href={`/profile/${lord.username}`}
                    className="flex items-center gap-3 p-3 bg-surface-200 border border-surface-300 rounded-xl hover:border-surface-400 transition-all group"
                  >
                    <span className="text-[11px] font-mono text-surface-500 w-5 text-right flex-shrink-0">
                      {i + 1}
                    </span>
                    <Avatar
                      src={lord.avatar_url ?? undefined}
                      fallback={lord.display_name ?? lord.username}
                      size="sm"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-xs font-semibold text-surface-900 truncate">
                          {lord.display_name ?? lord.username}
                        </span>
                        <Badge
                          variant="outline"
                          className="text-[9px] px-1.5 py-0 text-gold border-gold/40 bg-gold/5 flex-shrink-0"
                        >
                          {lord.title}
                        </Badge>
                      </div>
                      <span className="text-[11px] text-surface-500">@{lord.username}</span>
                    </div>
                    <div className="flex items-center gap-1 text-xs font-mono text-gold flex-shrink-0">
                      <Crown className="h-3 w-3" aria-hidden="true" />
                      {lord.clout.toLocaleString()}
                    </div>
                    <ChevronRight className="h-4 w-4 text-surface-600 group-hover:text-surface-400 transition-colors flex-shrink-0" aria-hidden="true" />
                  </Link>
                </motion.div>
              ))
            )}
          </div>
        )}

        {/* ── Decisions tab ─────────────────────────────────────────────── */}
        {activeTab === 'decisions' && (
          <div className="space-y-2">
            {data.recent_decisions.length === 0 ? (
              <EmptyState
                icon={Scale}
                title="No decisions recorded"
                description="Past Lords decisions will appear here once laws have been reviewed."
              />
            ) : (
              data.recent_decisions.map((decision, i) => (
                <motion.div
                  key={decision.law_id}
                  initial={{ opacity: 0, y: 6 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.04 }}
                  className="bg-surface-200 border border-surface-300 rounded-xl p-4 flex items-start gap-3"
                >
                  <div className={cn(
                    'flex-shrink-0 p-1.5 rounded-lg mt-0.5',
                    decision.outcome === 'ratified' ? 'bg-emerald/10' :
                    decision.outcome === 'sent_back' ? 'bg-gold/10' : 'bg-surface-300',
                  )}>
                    {decision.outcome === 'ratified' ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald" aria-hidden="true" />
                    ) : decision.outcome === 'sent_back' ? (
                      <RotateCcw className="h-4 w-4 text-gold" aria-hidden="true" />
                    ) : (
                      <Scale className="h-4 w-4 text-surface-400" aria-hidden="true" />
                    )}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      {decision.category && (
                        <span className={cn('text-[10px] font-semibold uppercase tracking-wider', categoryColor(decision.category))}>
                          {decision.category}
                        </span>
                      )}
                      <span className={cn(
                        'text-[10px] font-medium',
                        decision.outcome === 'ratified' ? 'text-emerald' :
                        decision.outcome === 'sent_back' ? 'text-gold' : 'text-surface-400',
                      )}>
                        {decision.outcome === 'ratified' ? 'Ratified' :
                         decision.outcome === 'sent_back' ? 'Sent Back' : 'Under Review'}
                      </span>
                    </div>
                    <p className="text-xs font-medium text-surface-200 line-clamp-2 leading-snug">
                      {decision.statement}
                    </p>
                    <div className="flex items-center gap-3 mt-1.5 text-[10px] text-surface-500">
                      <span>{formatDate(decision.established_at)}</span>
                      <span>{Math.round(decision.ratify_pct)}% ratify</span>
                    </div>
                  </div>
                  <Link
                    href={`/law/${decision.law_id}`}
                    aria-label="View law"
                    className="flex-shrink-0 text-surface-500 hover:text-surface-200 transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  </Link>
                </motion.div>
              ))
            )}
          </div>
        )}

        {/* ── Footer nav ────────────────────────────────────────────────── */}
        <div className="flex flex-wrap gap-2 pt-2">
          {[
            { href: '/parliament', label: 'Parliament Hub' },
            { href: '/government', label: 'HM Government' },
            { href: '/laws', label: 'Law Codex' },
            { href: '/grand-council', label: 'Grand Council' },
          ].map((l) => (
            <Link
              key={l.href}
              href={l.href}
              className="flex items-center gap-1 px-3 py-1.5 bg-surface-200 border border-surface-300 rounded-full text-xs text-surface-400 hover:text-surface-200 hover:border-surface-400 transition-all"
            >
              {l.label}
              <ChevronRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          ))}
        </div>

      </main>

      <BottomNav />
    </div>
  )
}
