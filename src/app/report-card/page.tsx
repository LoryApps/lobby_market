'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Award,
  BarChart2,
  BookOpen,
  CheckCircle2,
  FileText,
  Flame,
  RefreshCw,
  Share2,
  Star,
  Target,
  TrendingUp,
  Users,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { ReportCardData, ReportCardSubject, GradeLetter } from '@/app/api/analytics/report-card/route'

// ─── Grade colors ─────────────────────────────────────────────────────────────

const GRADE_STYLE: Record<GradeLetter, { text: string; bg: string; border: string; ring: string }> = {
  'A+': { text: 'text-emerald',    bg: 'bg-emerald/10',       border: 'border-emerald/40',    ring: 'ring-emerald/30' },
  'A':  { text: 'text-emerald',    bg: 'bg-emerald/10',       border: 'border-emerald/40',    ring: 'ring-emerald/30' },
  'A-': { text: 'text-emerald',    bg: 'bg-emerald/10',       border: 'border-emerald/30',    ring: 'ring-emerald/20' },
  'B+': { text: 'text-for-300',    bg: 'bg-for-500/10',       border: 'border-for-500/40',    ring: 'ring-for-500/20' },
  'B':  { text: 'text-for-400',    bg: 'bg-for-500/10',       border: 'border-for-500/40',    ring: 'ring-for-500/20' },
  'B-': { text: 'text-for-400',    bg: 'bg-for-500/10',       border: 'border-for-500/30',    ring: 'ring-for-500/20' },
  'C+': { text: 'text-gold',       bg: 'bg-gold/10',          border: 'border-gold/40',       ring: 'ring-gold/20' },
  'C':  { text: 'text-gold',       bg: 'bg-gold/10',          border: 'border-gold/40',       ring: 'ring-gold/20' },
  'C-': { text: 'text-gold',       bg: 'bg-gold/10',          border: 'border-gold/30',       ring: 'ring-gold/20' },
  'D':  { text: 'text-against-400', bg: 'bg-against-500/10',  border: 'border-against-500/30', ring: 'ring-against-500/20' },
  'F':  { text: 'text-against-400', bg: 'bg-against-600/10',  border: 'border-against-500/40', ring: 'ring-against-500/20' },
}

const SUBJECT_ICON: Record<string, typeof Star> = {
  participation: Flame,
  predictions:   Target,
  influence:     TrendingUp,
  breadth:       BookOpen,
  standing:      Users,
  consistency:   CheckCircle2,
}

const SUBJECT_COLOR: Record<string, string> = {
  participation: 'text-for-400',
  predictions:   'text-purple',
  influence:     'text-emerald',
  breadth:       'text-gold',
  standing:      'text-for-300',
  consistency:   'text-emerald',
}

const SUBJECT_BG: Record<string, string> = {
  participation: 'bg-for-500/10',
  predictions:   'bg-purple/10',
  influence:     'bg-emerald/10',
  breadth:       'bg-gold/10',
  standing:      'bg-for-400/10',
  consistency:   'bg-emerald/10',
}

// ─── GPA description ──────────────────────────────────────────────────────────

function gpaDescription(gpa: number): string {
  if (gpa >= 4.0) return 'Exceptional civic performance — you are setting the standard.'
  if (gpa >= 3.5) return 'Outstanding civic engagement across all dimensions.'
  if (gpa >= 3.0) return 'Strong civic contributor with room to grow.'
  if (gpa >= 2.5) return 'Solid participation — focus on your weaker subjects to improve.'
  if (gpa >= 2.0) return 'Moderate engagement. Regular participation will raise your GPA.'
  if (gpa >= 1.0) return 'Getting started. Consistent daily activity will transform your record.'
  return 'Your civic journey begins now. Every vote counts.'
}

// ─── Progress bar ──────────────────────────────────────────────────���───────────

function ScoreBar({
  score,
  maxScore,
  gradeStyle,
  animated,
}: {
  score: number
  maxScore: number
  gradeStyle: typeof GRADE_STYLE['A']
  animated: boolean
}) {
  const pct = Math.round((score / maxScore) * 100)
  return (
    <div className="relative h-1.5 rounded-full bg-surface-300 overflow-hidden">
      <motion.div
        className={cn('absolute inset-y-0 left-0 rounded-full', gradeStyle.bg.replace('/10', '/60'))}
        initial={{ width: 0 }}
        animate={{ width: animated ? `${pct}%` : 0 }}
        transition={{ duration: 0.7, ease: 'easeOut', delay: 0.1 }}
      />
    </div>
  )
}

// ─── Subject card ──────────────────────────────────────────────────────────────

function SubjectCard({
  subject,
  rank,
}: {
  subject: ReportCardSubject
  rank: number
}) {
  const gs = GRADE_STYLE[subject.grade]
  const Icon = SUBJECT_ICON[subject.id] ?? Star
  const iconColor = SUBJECT_COLOR[subject.id] ?? 'text-surface-400'
  const iconBg = SUBJECT_BG[subject.id] ?? 'bg-surface-200'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: rank * 0.06, duration: 0.3 }}
      className={cn(
        'rounded-2xl border p-4 bg-surface-100',
        'hover:bg-surface-200/60 transition-colors',
        gs.border
      )}
    >
      <div className="flex items-start gap-3">
        {/* Subject icon */}
        <div className={cn('flex items-center justify-center h-9 w-9 rounded-xl flex-shrink-0', iconBg)}>
          <Icon className={cn('h-4 w-4', iconColor)} aria-hidden="true" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <span className="font-mono text-sm font-semibold text-white">
              {subject.label}
            </span>
            {/* Grade badge */}
            <div
              className={cn(
                'flex-shrink-0 inline-flex items-center justify-center',
                'h-8 w-8 rounded-lg font-mono font-bold text-sm',
                gs.bg, gs.border, gs.text, 'border'
              )}
              aria-label={`Grade: ${subject.grade}`}
            >
              {subject.grade}
            </div>
          </div>

          <p className="text-[11px] font-mono text-surface-500 mb-2 leading-relaxed">
            {subject.description}
          </p>

          <ScoreBar
            score={subject.score}
            maxScore={subject.maxScore}
            gradeStyle={gs}
            animated={true}
          />

          {subject.tip && (
            <p className="mt-2 text-[10px] font-mono text-gold/80 leading-relaxed">
              {subject.tip}
            </p>
          )}
        </div>
      </div>
    </motion.div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────��

function LoadingSkeleton() {
  return (
    <div className="space-y-4 animate-pulse">
      {/* GPA card */}
      <div className="h-40 rounded-2xl bg-surface-100 border border-surface-300/40" />
      {/* Subject cards */}
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="h-24 rounded-2xl bg-surface-100 border border-surface-300/40" />
      ))}
    </div>
  )
}

// ─── GPA ring ─────────────────────────────────────────────────────────────────

function GpaRing({ gpa }: { gpa: number }) {
  const pct = (gpa / 4.3) * 100
  const r = 42
  const circumference = 2 * Math.PI * r
  const filled = (pct / 100) * circumference

  const color =
    pct >= 90 ? '#10b981'
    : pct >= 75 ? '#60a5fa'
    : pct >= 60 ? '#f59e0b'
    : '#f87171'

  return (
    <div className="relative flex items-center justify-center" style={{ width: 100, height: 100 }}>
      <svg width="100" height="100" className="-rotate-90" aria-hidden="true">
        <circle cx="50" cy="50" r={r} fill="none" stroke="currentColor" className="text-surface-300" strokeWidth="6" />
        <motion.circle
          cx="50"
          cy="50"
          r={r}
          fill="none"
          stroke={color}
          strokeWidth="6"
          strokeDasharray={circumference}
          strokeLinecap="round"
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: circumference - filled }}
          transition={{ duration: 1.2, ease: 'easeOut' }}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="font-mono font-bold text-xl text-white leading-none">{gpa.toFixed(2)}</span>
        <span className="font-mono text-[10px] text-surface-500 mt-0.5">GPA</span>
      </div>
    </div>
  )
}

// ─── Share button ──────────────────────────────────────────────────��──────────

function ShareButton({ data }: { data: ReportCardData }) {
  const [copied, setCopied] = useState(false)

  const share = useCallback(async () => {
    const lines = [
      `🏛 My Lobby Market Civic Report Card`,
      `Overall GPA: ${data.gpa.toFixed(2)} (${data.gpaLetter})`,
      '',
      ...data.subjects.map((s) => `${s.label}: ${s.grade}`),
      '',
      `lobby.market/report-card`,
    ]
    const text = lines.join('\n')
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // fallback — ignore
    }
  }, [data])

  return (
    <button
      onClick={share}
      className={cn(
        'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl',
        'text-xs font-mono font-semibold transition-all',
        'border border-surface-400/40 text-surface-400',
        'hover:border-for-500/40 hover:text-for-400',
        copied && 'border-emerald/40 text-emerald'
      )}
      aria-label="Copy report card to clipboard"
    >
      <Share2 className="h-3.5 w-3.5" />
      {copied ? 'Copied!' : 'Share'}
    </button>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ReportCardPage() {
  const [data, setData] = useState<ReportCardData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/analytics/report-card')
      if (res.status === 401) {
        setError('Sign in to view your Civic Report Card.')
        return
      }
      if (!res.ok) throw new Error('Failed to load')
      const json: ReportCardData = await res.json()
      setData(json)
    } catch {
      setError('Could not load your report card. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    load()
  }, [load])

  const gs = data ? GRADE_STYLE[data.gpaLetter] : null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-8 pb-24 md:pb-12">

        {/* Header */}
        <div className="mb-6 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30">
              <FileText className="h-5 w-5 text-for-400" aria-hidden="true" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">
                Civic Report Card
              </h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                Your performance across 6 civic dimensions
              </p>
            </div>
          </div>

          {data && (
            <div className="flex items-center gap-2">
              <ShareButton data={data} />
              <button
                onClick={load}
                className="flex items-center justify-center h-8 w-8 rounded-lg border border-surface-300/40 text-surface-500 hover:text-white hover:border-surface-400 transition-all"
                aria-label="Refresh report card"
              >
                <RefreshCw className="h-3.5 w-3.5" />
              </button>
            </div>
          )}
        </div>

        {/* Loading */}
        {loading && <LoadingSkeleton />}

        {/* Error */}
        {!loading && error && (
          <EmptyState
            icon={FileText}
            iconColor="text-against-400"
            iconBg="bg-against-500/10"
            iconBorder="border-against-500/30"
            title="Couldn't load report card"
            description={error}
            actions={
              error.includes('Sign in')
                ? [{ label: 'Sign in', href: '/login', variant: 'primary', icon: ArrowRight }]
                : [{ label: 'Try again', onClick: load, variant: 'primary', icon: RefreshCw }]
            }
          />
        )}

        {/* Content */}
        <AnimatePresence mode="wait">
          {!loading && !error && data && (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.2 }}
              className="space-y-4"
            >
              {/* GPA Summary Card */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.3 }}
                className={cn(
                  'rounded-2xl border p-6 bg-surface-100',
                  gs?.border ?? 'border-surface-300/40'
                )}
              >
                <div className="flex items-center gap-6">
                  {/* GPA ring */}
                  <GpaRing gpa={data.gpa} />

                  {/* Right side */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1 flex-wrap">
                      <span className="font-mono text-sm text-surface-500">
                        {data.displayName ?? data.username}
                      </span>
                      <span className="text-surface-600 font-mono text-xs">·</span>
                      <span className="font-mono text-xs text-surface-600">
                        {data.memberDays}d member
                      </span>
                    </div>

                    <div className="flex items-baseline gap-2 mb-2">
                      <span
                        className={cn(
                          'font-mono font-bold text-3xl',
                          gs?.text ?? 'text-white'
                        )}
                      >
                        {data.gpaLetter}
                      </span>
                      <span className="font-mono text-sm text-surface-500">
                        overall
                      </span>
                    </div>

                    <p className="text-[11px] font-mono text-surface-500 leading-relaxed">
                      {gpaDescription(data.gpa)}
                    </p>

                    {/* Quick stats */}
                    <div className="mt-3 flex items-center gap-4 flex-wrap">
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-surface-600">
                        <BarChart2 className="h-3 w-3" aria-hidden="true" />
                        {data.totalVotes.toLocaleString()} votes
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-surface-600">
                        <Award className="h-3 w-3" aria-hidden="true" />
                        {data.reputation.toLocaleString()} rep
                      </span>
                      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-surface-600">
                        <Flame className="h-3 w-3" aria-hidden="true" />
                        {data.voteStreak}d streak
                      </span>
                    </div>
                  </div>
                </div>
              </motion.div>

              {/* Subject cards */}
              <div className="space-y-3">
                {data.subjects.map((subject, i) => (
                  <SubjectCard key={subject.id} subject={subject} rank={i} />
                ))}
              </div>

              {/* Actions footer */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5, duration: 0.3 }}
                className="pt-2 rounded-2xl border border-surface-300/40 bg-surface-100 p-4"
              >
                <p className="font-mono text-xs text-surface-500 mb-3 font-semibold uppercase tracking-wider">
                  Raise your grades
                </p>
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {[
                    { label: 'Cast votes', href: '/', icon: Zap, color: 'text-for-400' },
                    { label: 'Predict outcomes', href: '/predictions', icon: Target, color: 'text-purple' },
                    { label: 'Post arguments', href: '/trending', icon: TrendingUp, color: 'text-emerald' },
                    { label: 'Explore categories', href: '/categories', icon: BookOpen, color: 'text-gold' },
                    { label: 'Join a debate', href: '/debate', icon: Users, color: 'text-for-300' },
                    { label: 'Daily challenge', href: '/challenge', icon: Star, color: 'text-gold' },
                  ].map(({ label, href, icon: Icon, color }) => (
                    <Link
                      key={href}
                      href={href}
                      className={cn(
                        'flex items-center gap-2 px-3 py-2 rounded-xl',
                        'text-xs font-mono text-surface-500',
                        'border border-surface-300/40 bg-surface-200/30',
                        'hover:text-white hover:border-surface-400/60 hover:bg-surface-200/70',
                        'transition-all'
                      )}
                    >
                      <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', color)} aria-hidden="true" />
                      {label}
                    </Link>
                  ))}
                </div>
              </motion.div>

              {/* Analytics link */}
              <div className="text-center pt-1">
                <Link
                  href="/analytics"
                  className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-for-400 transition-colors"
                >
                  View full analytics
                  <ArrowRight className="h-3 w-3" />
                </Link>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
