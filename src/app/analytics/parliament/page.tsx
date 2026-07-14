'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  BookOpen,
  CheckCircle2,
  ChevronRight,
  Circle,
  Crown,
  FileText,
  MessageSquare,
  Mic2,
  PenLine,
  RefreshCw,
  Scale,
  Scroll,
  Sparkles,
  ThumbsUp,
  ThumbsDown,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { AnimatedNumber } from '@/components/ui/AnimatedNumber'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  ParliamentAnalyticsResponse,
  ParliamentaryRole,
  BillStat,
  EdmStat,
  QuestionStat,
  LordsReviewStat,
} from '@/app/api/analytics/parliament/route'

// ─── Role config ───────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<
  ParliamentaryRole,
  {
    description: string
    icon: typeof Crown
    color: string
    bg: string
    border: string
  }
> = {
  'The Legislator': {
    description: 'You draft and sponsor bills, shaping law at its source. A true parliamentary force with a deep legislative record.',
    icon: Scroll,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
  },
  'The Questioner': {
    description: 'You hold power to account through oral, written, and PMQs. Scrutiny is your tool; answers are your reward.',
    icon: MessageSquare,
    color: 'text-for-300',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
  },
  'The Lord': {
    description: 'You review and ratify laws in the upper chamber, providing the final check before Royal Assent.',
    icon: Crown,
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
  },
  'The Campaigner': {
    description: 'Early Day Motions are your weapon. You build coalitions, gather seconds, and push causes into the parliamentary record.',
    icon: Sparkles,
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
  },
  'The Back-Bencher': {
    description: 'Your parliamentary career is just beginning. Sponsor a bill, file an EDM, or ask a question to unlock your role.',
    icon: Users,
    color: 'text-surface-400',
    bg: 'bg-surface-300/10',
    border: 'border-surface-300/20',
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  if (d === 0) return 'today'
  if (d === 1) return 'yesterday'
  if (d < 30) return `${d}d ago`
  if (d < 365) return `${Math.floor(d / 30)}mo ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })
}

// ─── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  color,
}: {
  label: string
  value: number | string
  sub?: string
  icon: typeof Crown
  color: string
}) {
  return (
    <div className="bg-surface-100 border border-surface-300/60 rounded-xl p-4 flex flex-col gap-1">
      <div className={cn('flex items-center gap-1.5 text-xs font-medium', color)}>
        <Icon className="w-3.5 h-3.5 shrink-0" />
        <span>{label}</span>
      </div>
      <div className="text-2xl font-bold text-white mt-0.5">
        {typeof value === 'number' ? <AnimatedNumber value={value} /> : value}
      </div>
      {sub && <div className="text-[11px] text-surface-500 font-mono">{sub}</div>}
    </div>
  )
}

// ─── Bill row ──────────────────────────────────────────────────────────────────

function BillRow({ bill }: { bill: BillStat }) {
  const statusColor =
    bill.status === 'enacted'
      ? 'text-emerald bg-emerald/10 border-emerald/30'
      : bill.status === 'rejected'
      ? 'text-against-400 bg-against-500/10 border-against-500/30'
      : 'text-gold bg-gold/10 border-gold/30'

  const total = (bill.votes_for ?? 0) + (bill.votes_against ?? 0)
  const forPct = total > 0 ? Math.round((bill.votes_for / total) * 100) : 0

  return (
    <Link href="/bills">
      <div className="bg-surface-100 border border-surface-300/60 rounded-xl p-3.5 hover:border-surface-400/60 transition-colors group">
        <div className="flex items-start gap-3">
          <Scroll className="w-4 h-4 text-gold mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate group-hover:text-gold transition-colors">
              {bill.short_title}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <span className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border uppercase',
                statusColor,
              )}>
                {bill.status}
              </span>
              {bill.stage && (
                <span className="text-[10px] font-mono text-surface-500">{bill.stage}</span>
              )}
              {bill.category && (
                <span className="text-[10px] text-surface-600">{bill.category}</span>
              )}
              <span className="text-[10px] text-surface-600">{relDate(bill.created_at)}</span>
            </div>
            {total > 0 && (
              <div className="mt-2 flex items-center gap-2">
                <span className="text-[10px] font-mono text-for-400 w-8 text-right shrink-0">{forPct}%</span>
                <div className="flex-1 h-1 rounded-full bg-surface-300 overflow-hidden">
                  <div className="h-full bg-for-500 rounded-full" style={{ width: `${forPct}%` }} />
                </div>
                <span className="text-[10px] font-mono text-against-400 w-8 shrink-0">{100 - forPct}%</span>
              </div>
            )}
          </div>
          <ChevronRight className="w-4 h-4 text-surface-600 group-hover:text-surface-400 shrink-0 mt-0.5" />
        </div>
      </div>
    </Link>
  )
}

// ─── Question row ──────────────────────────────────────────────────────────────

function QuestionRow({ q }: { q: QuestionStat }) {
  const typeConfig = {
    pmq: { label: 'PMQ', color: 'text-purple bg-purple/10 border-purple/30', icon: Mic2 },
    oral: { label: 'Oral', color: 'text-for-300 bg-for-500/10 border-for-500/30', icon: MessageSquare },
    written: { label: 'Written', color: 'text-gold bg-gold/10 border-gold/30', icon: PenLine },
  }[q.type]

  return (
    <Link href={q.type === 'pmq' ? '/pmq' : q.type === 'oral' ? '/oral-questions' : '/written-questions'}>
      <div className="bg-surface-100 border border-surface-300/60 rounded-xl p-3.5 hover:border-surface-400/60 transition-colors group">
        <div className="flex items-start gap-3">
          <typeConfig.icon className="w-4 h-4 mt-0.5 shrink-0 text-surface-500" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white line-clamp-2 group-hover:text-for-300 transition-colors">
              {q.text}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <span className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border',
                typeConfig.color,
              )}>
                {typeConfig.label}
              </span>
              {q.is_answered ? (
                <span className="inline-flex items-center gap-1 text-[10px] text-emerald font-mono">
                  <CheckCircle2 className="w-3 h-3" />
                  Answered
                </span>
              ) : (
                <span className="inline-flex items-center gap-1 text-[10px] text-surface-500 font-mono">
                  <Circle className="w-3 h-3" />
                  Pending
                </span>
              )}
              {q.department && (
                <span className="text-[10px] text-surface-600">{q.department}</span>
              )}
              {q.upvotes > 0 && (
                <span className="text-[10px] font-mono text-surface-500">
                  ↑{q.upvotes}
                </span>
              )}
              <span className="text-[10px] text-surface-600">{relDate(q.created_at)}</span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-surface-600 group-hover:text-surface-400 shrink-0 mt-0.5" />
        </div>
      </div>
    </Link>
  )
}

// ─── EDM row ───────────────────────────────────────────────────────────────────

function EdmRow({ edm }: { edm: EdmStat }) {
  const statusColor =
    edm.status === 'passed'
      ? 'text-emerald bg-emerald/10 border-emerald/30'
      : edm.status === 'rejected'
      ? 'text-against-400 bg-against-500/10 border-against-500/30'
      : 'text-gold bg-gold/10 border-gold/30'

  return (
    <Link href="/edm">
      <div className="bg-surface-100 border border-surface-300/60 rounded-xl p-3.5 hover:border-surface-400/60 transition-colors group">
        <div className="flex items-start gap-3">
          <FileText className="w-4 h-4 text-emerald mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-white truncate group-hover:text-emerald transition-colors">
              {edm.title}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <span className={cn(
                'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border uppercase',
                statusColor,
              )}>
                {edm.status}
              </span>
              {edm.second_count > 0 && (
                <span className="text-[10px] font-mono text-surface-400">
                  {edm.second_count} second{edm.second_count !== 1 ? 's' : ''}
                </span>
              )}
              {edm.category && (
                <span className="text-[10px] text-surface-600">{edm.category}</span>
              )}
              <span className="text-[10px] text-surface-600">{relDate(edm.created_at)}</span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-surface-600 group-hover:text-surface-400 shrink-0 mt-0.5" />
        </div>
      </div>
    </Link>
  )
}

// ─── Lords review row ──────────────────────────────────────────────────────────

function LordsRow({ review }: { review: LordsReviewStat }) {
  const verdictConfig = {
    ratify: {
      label: 'Ratified',
      color: 'text-emerald bg-emerald/10 border-emerald/30',
      icon: ThumbsUp,
    },
    send_back: {
      label: 'Sent Back',
      color: 'text-against-400 bg-against-500/10 border-against-500/30',
      icon: ThumbsDown,
    },
    abstain: {
      label: 'Abstained',
      color: 'text-surface-400 bg-surface-200 border-surface-400/30',
      icon: Scale,
    },
  }[review.verdict]

  return (
    <Link href="/lords">
      <div className="bg-surface-100 border border-surface-300/60 rounded-xl p-3.5 hover:border-surface-400/60 transition-colors group">
        <div className="flex items-start gap-3">
          <Crown className="w-4 h-4 text-purple mt-0.5 shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-sm text-white line-clamp-2 group-hover:text-purple transition-colors">
              {review.law_statement}
            </p>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <span className={cn(
                'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-bold border',
                verdictConfig.color,
              )}>
                <verdictConfig.icon className="w-2.5 h-2.5" />
                {verdictConfig.label}
              </span>
              {review.amendment_note && (
                <span className="text-[10px] text-surface-500 truncate max-w-[160px]">
                  {review.amendment_note}
                </span>
              )}
              <span className="text-[10px] text-surface-600">{relDate(review.created_at)}</span>
            </div>
          </div>
          <ChevronRight className="w-4 h-4 text-surface-600 group-hover:text-surface-400 shrink-0 mt-0.5" />
        </div>
      </div>
    </Link>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function ParliamentAnalyticsPage() {
  const router = useRouter()
  const [data, setData] = useState<ParliamentAnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/parliament', { cache: 'no-store' })
      if (!res.ok) {
        if (res.status === 401) { router.push('/login'); return }
        throw new Error('Failed to load parliamentary analytics')
      }
      setData(await res.json())
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  const isEmpty = data &&
    data.total_bills === 0 &&
    data.total_edms === 0 &&
    data.total_pmqs === 0 &&
    data.total_oral_questions === 0 &&
    data.total_written_questions === 0 &&
    data.total_lords_reviews === 0

  const roleConfig = data ? ROLE_CONFIG[data.role] : null

  return (
    <div className="min-h-screen bg-surface-50 pb-24">
      <TopBar />

      <div className="max-w-3xl mx-auto px-4 pt-4">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.push('/analytics')}
            className="p-2 rounded-lg bg-surface-200 hover:bg-surface-300 border border-surface-400/50 text-surface-400 hover:text-white transition-all"
            aria-label="Back to analytics"
          >
            <ArrowLeft className="w-4 h-4" />
          </button>

          <div className="w-10 h-10 rounded-xl bg-gold/15 border border-gold/30 flex items-center justify-center shrink-0">
            <BookOpen className="w-5 h-5 text-gold" />
          </div>

          <div>
            <h1 className="text-lg font-bold text-white leading-tight">Parliament Analytics</h1>
            <p className="text-[12px] text-surface-500">Your Westminster legislative record</p>
          </div>

          <button
            onClick={load}
            disabled={loading}
            className="ml-auto p-2 rounded-lg bg-surface-200 hover:bg-surface-300 border border-surface-400/50 text-surface-400 hover:text-white transition-all disabled:opacity-50"
            aria-label="Refresh"
          >
            <RefreshCw className={cn('w-4 h-4', loading && 'animate-spin')} />
          </button>
        </div>

        {/* Loading */}
        <AnimatePresence>
          {loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[...Array(6)].map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-xl" />
                ))}
              </div>
              <Skeleton className="h-28 rounded-2xl" />
              <Skeleton className="h-36 rounded-2xl" />
              <div className="space-y-3">
                {[...Array(4)].map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-xl" />
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        {!loading && error && (
          <div className="text-center py-16 text-surface-500">
            <BarChart2 className="w-10 h-10 mx-auto mb-3 opacity-40" />
            <p className="font-semibold text-white mb-1">Could not load data</p>
            <p className="text-sm mb-4">{error}</p>
            <button
              onClick={load}
              className="px-4 py-2 rounded-lg bg-surface-200 border border-surface-400/50 text-sm text-white hover:bg-surface-300 transition-colors"
            >
              Try again
            </button>
          </div>
        )}

        {/* Content */}
        {!loading && !error && data && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-5"
          >
            {isEmpty ? (
              <EmptyState
                icon={BookOpen}
                title="No parliamentary activity yet"
                description="Sponsor a Bill, file an Early Day Motion, ask a Question, or review legislation in the Lords Chamber to build your parliamentary record."
                action={{ label: 'Browse Bills', href: '/bills' }}
              />
            ) : (
              <>
                {/* Stats grid */}
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  <StatCard
                    label="Bills Sponsored"
                    value={data.total_bills}
                    sub={`${data.bills_enacted} enacted · ${data.bills_in_progress} in progress`}
                    icon={Scroll}
                    color="text-gold"
                  />
                  <StatCard
                    label="EDMs Filed"
                    value={data.total_edms}
                    sub={data.edm_seconds_gathered > 0 ? `${data.edm_seconds_gathered} seconds gathered` : 'file motions to campaign'}
                    icon={FileText}
                    color="text-emerald"
                  />
                  <StatCard
                    label="PMQs Asked"
                    value={data.total_pmqs}
                    sub="Prime Minister Questions"
                    icon={Mic2}
                    color="text-purple"
                  />
                  <StatCard
                    label="Oral Questions"
                    value={data.total_oral_questions}
                    sub="departmental scrutiny"
                    icon={MessageSquare}
                    color="text-for-300"
                  />
                  <StatCard
                    label="Written Questions"
                    value={data.total_written_questions}
                    sub={`${data.questions_answered} answered`}
                    icon={PenLine}
                    color="text-for-400"
                  />
                  <StatCard
                    label="Lords Reviews"
                    value={data.total_lords_reviews}
                    sub={`${data.lords_ratifications} ratified`}
                    icon={Crown}
                    color="text-purple"
                  />
                </div>

                {/* Role archetype */}
                {roleConfig && (
                  <div className={cn(
                    'rounded-2xl border p-4 flex items-start gap-4',
                    roleConfig.bg, roleConfig.border,
                  )}>
                    <div className={cn(
                      'w-12 h-12 rounded-xl flex items-center justify-center shrink-0 border',
                      roleConfig.bg, roleConfig.border,
                    )}>
                      <roleConfig.icon className={cn('w-6 h-6', roleConfig.color)} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={cn('text-base font-bold', roleConfig.color)}>
                          {data.role}
                        </span>
                        <span className="text-[10px] font-mono uppercase tracking-widest text-surface-500 bg-surface-200 px-2 py-0.5 rounded-full border border-surface-400/50">
                          Parliamentary Role
                        </span>
                      </div>
                      <p className="text-xs text-surface-400 mt-1 leading-relaxed">
                        {roleConfig.description}
                      </p>
                    </div>
                  </div>
                )}

                {/* Recent bills */}
                {data.recent_bills.length > 0 && (
                  <div>
                    <h2 className="text-xs font-semibold text-surface-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Scroll className="w-3.5 h-3.5" />
                      Recent Bills
                      <span className="text-surface-600 normal-case font-normal">({data.total_bills})</span>
                    </h2>
                    <div className="space-y-2">
                      {data.recent_bills.map((bill) => (
                        <BillRow key={bill.id} bill={bill} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent questions */}
                {data.recent_questions.length > 0 && (
                  <div>
                    <h2 className="text-xs font-semibold text-surface-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <MessageSquare className="w-3.5 h-3.5" />
                      Recent Questions
                      <span className="text-surface-600 normal-case font-normal">
                        ({data.total_pmqs + data.total_oral_questions + data.total_written_questions})
                      </span>
                    </h2>
                    <div className="space-y-2">
                      {data.recent_questions.map((q) => (
                        <QuestionRow key={`${q.type}-${q.id}`} q={q} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent EDMs */}
                {data.recent_edms.length > 0 && (
                  <div>
                    <h2 className="text-xs font-semibold text-surface-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <FileText className="w-3.5 h-3.5" />
                      Recent EDMs
                      <span className="text-surface-600 normal-case font-normal">({data.total_edms})</span>
                    </h2>
                    <div className="space-y-2">
                      {data.recent_edms.map((edm) => (
                        <EdmRow key={edm.id} edm={edm} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Recent Lords reviews */}
                {data.recent_lords.length > 0 && (
                  <div>
                    <h2 className="text-xs font-semibold text-surface-400 uppercase tracking-widest mb-3 flex items-center gap-2">
                      <Crown className="w-3.5 h-3.5" />
                      Lords Reviews
                      <span className="text-surface-600 normal-case font-normal">({data.total_lords_reviews})</span>
                    </h2>
                    <div className="space-y-2">
                      {data.recent_lords.map((r) => (
                        <LordsRow key={r.id} review={r} />
                      ))}
                    </div>
                  </div>
                )}

                {/* Nav links */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                  <Link
                    href="/bills"
                    className="flex items-center gap-3 p-3.5 rounded-xl bg-surface-100 border border-surface-300/60 hover:border-gold/40 hover:bg-gold/5 transition-all group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-gold/10 border border-gold/30 flex items-center justify-center shrink-0">
                      <Scroll className="w-4 h-4 text-gold" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white group-hover:text-gold transition-colors">Bills Chamber</p>
                      <p className="text-[11px] text-surface-500">Sponsor and vote on legislation</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-surface-600 group-hover:text-gold transition-colors shrink-0" />
                  </Link>

                  <Link
                    href="/edm"
                    className="flex items-center gap-3 p-3.5 rounded-xl bg-surface-100 border border-surface-300/60 hover:border-emerald/40 hover:bg-emerald/5 transition-all group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-emerald/10 border border-emerald/30 flex items-center justify-center shrink-0">
                      <FileText className="w-4 h-4 text-emerald" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white group-hover:text-emerald transition-colors">Early Day Motions</p>
                      <p className="text-[11px] text-surface-500">File motions and gather seconds</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-surface-600 group-hover:text-emerald transition-colors shrink-0" />
                  </Link>

                  <Link
                    href="/written-questions"
                    className="flex items-center gap-3 p-3.5 rounded-xl bg-surface-100 border border-surface-300/60 hover:border-for-500/40 hover:bg-for-500/5 transition-all group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-for-500/10 border border-for-500/30 flex items-center justify-center shrink-0">
                      <PenLine className="w-4 h-4 text-for-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white group-hover:text-for-300 transition-colors">Written Questions</p>
                      <p className="text-[11px] text-surface-500">Ask departments for written answers</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-surface-600 group-hover:text-for-400 transition-colors shrink-0" />
                  </Link>

                  <Link
                    href="/lords"
                    className="flex items-center gap-3 p-3.5 rounded-xl bg-surface-100 border border-surface-300/60 hover:border-purple/40 hover:bg-purple/5 transition-all group"
                  >
                    <div className="w-8 h-8 rounded-lg bg-purple/10 border border-purple/30 flex items-center justify-center shrink-0">
                      <Crown className="w-4 h-4 text-purple" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white group-hover:text-purple transition-colors">Lords Chamber</p>
                      <p className="text-[11px] text-surface-500">Review and ratify laws</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-surface-600 group-hover:text-purple transition-colors shrink-0" />
                  </Link>

                  <Link
                    href="/analytics"
                    className="flex items-center gap-3 p-3.5 rounded-xl bg-surface-100 border border-surface-300/60 hover:border-for-500/40 hover:bg-for-500/5 transition-all group sm:col-span-2"
                  >
                    <div className="w-8 h-8 rounded-lg bg-for-500/10 border border-for-500/30 flex items-center justify-center shrink-0">
                      <BarChart2 className="w-4 h-4 text-for-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold text-white group-hover:text-for-300 transition-colors">Analytics Hub</p>
                      <p className="text-[11px] text-surface-500">All your civic stats in one place</p>
                    </div>
                    <ChevronRight className="w-4 h-4 text-surface-600 group-hover:text-for-400 transition-colors shrink-0" />
                  </Link>
                </div>
              </>
            )}
          </motion.div>
        )}
      </div>

      <BottomNav />
    </div>
  )
}
