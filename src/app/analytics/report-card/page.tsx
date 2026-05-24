'use client'

/**
 * /analytics/report-card — Civic Report Card
 *
 * Six graded subjects measuring different dimensions of civic engagement:
 * Participation, Predictive Accuracy, Debate Influence, Category Breadth,
 * Community Standing, and Consistency. Each earns an A–F letter grade.
 * A composite GPA summarises overall civic performance.
 *
 * Distinct from:
 *   /analytics/benchmark    — cohort-relative percentile ranking
 *   /analytics/calibration  — raw prediction accuracy deep-dive
 *   /analytics/streak       — streak history timeline
 *   /karma                  — composite civic credit score (broader)
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  BookOpen,
  ChevronRight,
  Flame,
  Lightbulb,
  MessageSquare,
  RefreshCw,
  Shield,
  Star,
  Target,
  Trophy,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type {
  ReportCardData,
  ReportCardSubject,
  GradeLetter,
} from '@/app/api/analytics/report-card/route'

// ─── Grade styling ────────────────────────────────────────────────────────────

function gradeStyle(letter: GradeLetter): {
  color: string
  bg: string
  ring: string
  label: string
} {
  switch (letter) {
    case 'A+': return { color: 'text-gold',         bg: 'bg-gold/10',         ring: 'ring-gold/50',         label: 'Exceptional' }
    case 'A':  return { color: 'text-gold',         bg: 'bg-gold/10',         ring: 'ring-gold/40',         label: 'Outstanding' }
    case 'A-': return { color: 'text-emerald',      bg: 'bg-emerald/10',      ring: 'ring-emerald/40',      label: 'Excellent' }
    case 'B+': return { color: 'text-emerald',      bg: 'bg-emerald/10',      ring: 'ring-emerald/30',      label: 'Very Good' }
    case 'B':  return { color: 'text-for-300',      bg: 'bg-for-500/10',      ring: 'ring-for-500/30',      label: 'Good' }
    case 'B-': return { color: 'text-for-400',      bg: 'bg-for-500/10',      ring: 'ring-for-500/20',      label: 'Above Average' }
    case 'C+': return { color: 'text-for-400',      bg: 'bg-for-600/10',      ring: 'ring-for-600/20',      label: 'Average' }
    case 'C':  return { color: 'text-surface-300',  bg: 'bg-surface-200',     ring: 'ring-surface-400/30',  label: 'Satisfactory' }
    case 'C-': return { color: 'text-surface-400',  bg: 'bg-surface-200',     ring: 'ring-surface-400/20',  label: 'Adequate' }
    case 'D':  return { color: 'text-against-300',  bg: 'bg-against-600/10',  ring: 'ring-against-500/20',  label: 'Needs Work' }
    case 'F':  return { color: 'text-against-400',  bg: 'bg-against-600/10',  ring: 'ring-against-500/30',  label: 'Getting Started' }
  }
}

// ─── Subject icons ────────────────────────────────────────────────────────────

const SUBJECT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  participation: Zap,
  predictions:   Target,
  influence:     MessageSquare,
  breadth:       BookOpen,
  standing:      Shield,
  consistency:   Flame,
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ReportCardSkeleton() {
  return (
    <div className="space-y-4 p-4">
      <Skeleton className="h-32 rounded-2xl" />
      {[...Array(6)].map((_, i) => (
        <Skeleton key={i} className="h-20 rounded-xl" />
      ))}
    </div>
  )
}

// ─── Subject row ──────────────────────────────────────────────────────────────

function SubjectRow({
  subject,
  index,
}: {
  subject: ReportCardSubject
  index: number
}) {
  const style = gradeStyle(subject.grade)
  const Icon = SUBJECT_ICONS[subject.id] ?? Star
  const pct = Math.round((subject.score / subject.maxScore) * 100)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.06 }}
      className="bg-surface-200/80 border border-surface-300/60 rounded-xl p-4 space-y-3"
    >
      {/* Header row */}
      <div className="flex items-center gap-3">
        <div className={cn('flex-shrink-0 w-9 h-9 rounded-lg flex items-center justify-center', style.bg)}>
          <Icon className={cn('w-4 h-4', style.color)} />
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white">{subject.label}</p>
          <p className="text-xs text-surface-400 truncate">{subject.description}</p>
        </div>

        {/* Grade badge */}
        <div
          className={cn(
            'flex-shrink-0 flex items-center justify-center',
            'w-12 h-12 rounded-xl ring-2 font-mono font-bold text-xl',
            style.bg, style.ring, style.color
          )}
        >
          {subject.grade}
        </div>
      </div>

      {/* Progress bar */}
      <div className="space-y-1">
        <div className="h-1.5 bg-surface-300 rounded-full overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ delay: index * 0.06 + 0.2, duration: 0.6, ease: 'easeOut' }}
            className={cn(
              'h-full rounded-full',
              pct >= 90 ? 'bg-gold'
              : pct >= 75 ? 'bg-emerald'
              : pct >= 60 ? 'bg-for-400'
              : pct >= 40 ? 'bg-surface-400'
              : 'bg-against-500'
            )}
          />
        </div>
      </div>

      {/* Tip */}
      {subject.tip && (
        <div className="flex items-start gap-2 bg-surface-300/40 rounded-lg px-3 py-2">
          <Lightbulb className="w-3.5 h-3.5 text-gold flex-shrink-0 mt-0.5" />
          <p className="text-[11px] text-surface-300 leading-relaxed">{subject.tip}</p>
        </div>
      )}
    </motion.div>
  )
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function ReportCardPage() {
  const router = useRouter()
  const [data, setData] = useState<ReportCardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/report-card')
      if (res.status === 401) { router.push('/login'); return }
      if (!res.ok) throw new Error('Failed to load')
      const json = (await res.json()) as ReportCardData
      setData(json)
    } catch {
      setError('Could not load your report card.')
    } finally {
      setLoading(false)
    }
  }, [router])

  useEffect(() => { load() }, [load])

  const gpa = data?.gpa ?? 0
  const gpaStyle = data ? gradeStyle(data.gpaLetter) : null

  return (
    <div className="flex flex-col min-h-screen bg-surface-100">
      <TopBar />

      <main className="flex-1 overflow-y-auto pb-24">
        {/* ── Header ── */}
        <div className="sticky top-0 z-10 bg-surface-100/95 backdrop-blur-sm border-b border-surface-300/60 px-4 py-3 flex items-center gap-3">
          <Link
            href="/analytics"
            className="p-1.5 rounded-lg hover:bg-surface-200 transition-colors"
            aria-label="Back to Analytics"
          >
            <ArrowLeft className="w-4 h-4 text-surface-400" />
          </Link>
          <div className="flex-1 min-w-0">
            <h1 className="text-sm font-semibold text-white">Civic Report Card</h1>
            <p className="text-[11px] text-surface-400">Your engagement grades</p>
          </div>
          <button
            onClick={load}
            disabled={loading}
            aria-label="Refresh report card"
            className="p-1.5 rounded-lg hover:bg-surface-200 transition-colors disabled:opacity-40"
          >
            <RefreshCw className={cn('w-4 h-4 text-surface-400', loading && 'animate-spin')} />
          </button>
        </div>

        {/* ── Content ── */}
        <div className="max-w-xl mx-auto px-4 py-4 space-y-4">
          {loading ? (
            <ReportCardSkeleton />
          ) : error ? (
            <EmptyState
              icon={BarChart2}
              title="Report card unavailable"
              description={error}
              action={{ label: 'Retry', onClick: load }}
            />
          ) : data ? (
            <>
              {/* ── Profile + GPA card ── */}
              <motion.div
                initial={{ opacity: 0, scale: 0.96 }}
                animate={{ opacity: 1, scale: 1 }}
                className="relative overflow-hidden bg-surface-200 border border-surface-300/60 rounded-2xl p-5"
              >
                {/* Background watermark */}
                <div
                  aria-hidden
                  className={cn(
                    'absolute -right-4 -top-4 text-[120px] font-mono font-black opacity-5 leading-none select-none pointer-events-none',
                    gpaStyle?.color
                  )}
                >
                  {data.gpaLetter}
                </div>

                <div className="relative flex items-center gap-4">
                  <Avatar
                    src={null}
                    fallback={data.displayName || data.username}
                    size="lg"
                  />

                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-white truncate">
                      {data.displayName || data.username}
                    </p>
                    <p className="text-xs text-surface-400">@{data.username}</p>
                    <div className="flex items-center gap-2 mt-1.5">
                      <span className="text-[10px] font-mono text-surface-400">
                        Member {data.memberDays} day{data.memberDays !== 1 ? 's' : ''}
                      </span>
                      <span className="text-surface-500">·</span>
                      <span className="text-[10px] font-mono text-surface-400">
                        {data.totalVotes.toLocaleString()} votes
                      </span>
                    </div>
                  </div>

                  {/* GPA display */}
                  <div className="flex-shrink-0 flex flex-col items-center gap-1">
                    <div
                      className={cn(
                        'w-16 h-16 rounded-2xl ring-2 flex items-center justify-center',
                        'font-mono font-black text-2xl',
                        gpaStyle?.bg, gpaStyle?.ring, gpaStyle?.color
                      )}
                    >
                      {data.gpaLetter}
                    </div>
                    <p className="text-[10px] font-mono text-surface-400">
                      GPA {gpa.toFixed(2)}
                    </p>
                  </div>
                </div>

                {/* Quick stats strip */}
                <div className="grid grid-cols-3 gap-2 mt-4 pt-4 border-t border-surface-300/50">
                  {[
                    { label: 'Votes', value: data.totalVotes.toLocaleString() },
                    { label: 'Arguments', value: data.totalArguments.toLocaleString() },
                    { label: 'Streak', value: `${data.voteStreak}d` },
                  ].map(({ label, value }) => (
                    <div key={label} className="text-center">
                      <p className="text-base font-mono font-bold text-white">{value}</p>
                      <p className="text-[10px] text-surface-400">{label}</p>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* ── Subjects ── */}
              <div className="space-y-3">
                <h2 className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-widest px-1">
                  Subject Grades
                </h2>
                {data.subjects.map((subject, i) => (
                  <SubjectRow key={subject.id} subject={subject} index={i} />
                ))}
              </div>

              {/* ── Footer links ── */}
              <div className="grid grid-cols-2 gap-2 pt-2">
                {[
                  { href: '/analytics/benchmark', label: 'Cohort Benchmark', icon: Trophy },
                  { href: '/analytics/consistency', label: 'Consistency', icon: Flame },
                  { href: '/analytics/calibration', label: 'Prediction Accuracy', icon: Target },
                  { href: '/analytics', label: 'All Analytics', icon: BarChart2 },
                ].map(({ href, label, icon: Icon }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-2 p-3 bg-surface-200/60 border border-surface-300/40 rounded-xl hover:border-surface-400/60 transition-colors"
                  >
                    <Icon className="w-3.5 h-3.5 text-surface-400 flex-shrink-0" />
                    <span className="text-xs text-surface-300 truncate">{label}</span>
                    <ChevronRight className="w-3 h-3 text-surface-500 ml-auto flex-shrink-0" />
                  </Link>
                ))}
              </div>
            </>
          ) : null}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
