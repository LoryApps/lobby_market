'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  BookOpen,
  Calendar,
  ChevronDown,
  Clock,
  FileText,
  Filter,
  MessageSquare,
  RefreshCw,
  Scale,
  Search,
  Sparkles,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { ConsultationSummary, ConsultationsResponse } from '@/app/api/consultations/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const STATUSES = [
  { value: 'open',      label: 'Open',      color: 'text-emerald' },
  { value: 'closed',    label: 'Closed',    color: 'text-surface-500' },
  { value: 'published', label: 'Published', color: 'text-for-400' },
  { value: 'all',       label: 'All',       color: 'text-surface-400' },
]

const PAPER_TYPES: Record<string, { label: string; color: string; icon: typeof FileText }> = {
  green_paper:      { label: 'Green Paper',       color: 'text-emerald',     icon: FileText },
  white_paper:      { label: 'White Paper',       color: 'text-surface-300', icon: Scale },
  call_for_evidence:{ label: 'Call for Evidence', color: 'text-purple',      icon: Search },
}

const CATEGORY_COLORS: Record<string, string> = {
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function daysUntilClose(closesAt: string): number {
  return Math.max(0, Math.ceil((new Date(closesAt).getTime() - Date.now()) / 86_400_000))
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function urgencyLabel(days: number): { text: string; color: string } | null {
  if (days === 0) return { text: 'Closes today', color: 'text-against-400' }
  if (days <= 7)  return { text: `${days}d left`, color: 'text-against-400' }
  if (days <= 14) return { text: `${days}d left`, color: 'text-gold' }
  return null
}

// ─── Consultation Card ────────────────────────────────────────────────────────

function ConsultationCard({
  consultation,
  idx,
}: {
  consultation: ConsultationSummary
  idx: number
}) {
  const { label: typeLabel, color: typeColor, icon: TypeIcon } = PAPER_TYPES[consultation.paper_type] ?? PAPER_TYPES.green_paper
  const catColor = CATEGORY_COLORS[consultation.category] ?? 'text-surface-400'
  const isOpen = consultation.status === 'open'
  const isPublished = consultation.status === 'published'
  const days = isOpen ? daysUntilClose(consultation.closes_at) : 0
  const urgency = isOpen ? urgencyLabel(days) : null

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: idx * 0.04 }}
    >
      <Link
        href={`/consultations/${consultation.id}`}
        className={cn(
          'group block p-5 rounded-xl bg-surface-100 border transition-colors',
          isOpen
            ? 'border-for-500/15 hover:border-for-500/35 hover:bg-surface-150'
            : isPublished
            ? 'border-emerald/15 hover:border-emerald/30'
            : 'border-surface-300 hover:border-surface-400'
        )}
      >
        {/* Row 1: badges */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <span className={cn('flex items-center gap-1 text-[11px] font-mono font-semibold', typeColor)}>
            <TypeIcon className="h-3 w-3" />
            {typeLabel}
          </span>
          <span className={cn('text-[11px] font-mono', catColor)}>{consultation.category}</span>
          {isOpen && (
            <span className="text-[11px] font-mono text-emerald bg-emerald/10 px-1.5 py-0.5 rounded">
              OPEN
            </span>
          )}
          {consultation.status === 'closed' && (
            <span className="text-[11px] font-mono text-surface-500 bg-surface-300/50 px-1.5 py-0.5 rounded">
              CLOSED
            </span>
          )}
          {isPublished && (
            <span className="text-[11px] font-mono text-for-400 bg-for-500/10 px-1.5 py-0.5 rounded">
              RESPONSE PUBLISHED
            </span>
          )}
          {urgency && (
            <span className={cn('text-[11px] font-mono font-semibold ml-auto', urgency.color)}>
              {urgency.text}
            </span>
          )}
        </div>

        {/* Row 2: title */}
        <h3 className="font-mono text-sm font-semibold text-white leading-snug mb-1.5 group-hover:text-surface-200 transition-colors line-clamp-2">
          {consultation.title}
        </h3>

        {/* Row 3: summary */}
        <p className="text-xs font-mono text-surface-500 leading-relaxed line-clamp-2 mb-3">
          {consultation.summary}
        </p>

        {/* Row 4: meta */}
        <div className="flex items-center gap-4 text-[11px] font-mono text-surface-600">
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {consultation.response_count} {consultation.response_count === 1 ? 'response' : 'responses'}
          </span>
          <span className="flex items-center gap-1 truncate">
            <BookOpen className="h-3 w-3 flex-shrink-0" />
            <span className="truncate">{consultation.department}</span>
          </span>
          {isOpen ? (
            <span className="flex items-center gap-1 ml-auto flex-shrink-0">
              <Calendar className="h-3 w-3" />
              Closes {formatDate(consultation.closes_at)}
            </span>
          ) : isPublished ? (
            <span className="flex items-center gap-1 ml-auto flex-shrink-0 text-for-400">
              <Sparkles className="h-3 w-3" />
              Gov response available
            </span>
          ) : (
            <span className="flex items-center gap-1 ml-auto flex-shrink-0">
              <Clock className="h-3 w-3" />
              Closed {formatDate(consultation.closes_at)}
            </span>
          )}
          <ArrowRight className="h-3.5 w-3.5 text-surface-700 group-hover:text-surface-400 flex-shrink-0 transition-colors" />
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Skeleton row ─────────────────────────────────────────────────────────────

function CardSkeleton({ i }: { i: number }) {
  return (
    <div key={i} className="p-5 rounded-xl bg-surface-100 border border-surface-300 space-y-3">
      <div className="flex gap-2">
        <Skeleton className="h-4 w-24 rounded-full" />
        <Skeleton className="h-4 w-16 rounded-full" />
      </div>
      <Skeleton className="h-5 w-full" />
      <Skeleton className="h-4 w-4/5" />
      <div className="flex gap-4">
        <Skeleton className="h-3 w-20" />
        <Skeleton className="h-3 w-32" />
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function ConsultationsClient() {
  const [data, setData] = useState<ConsultationsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState(false)
  const [status, setStatus] = useState<string>('open')
  const [paperType, setPaperType] = useState<string>('')
  const [showTypeFilter, setShowTypeFilter] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const params = new URLSearchParams({ status })
      if (paperType) params.set('type', paperType)
      const res = await fetch(`/api/consultations?${params}`)
      if (!res.ok) throw new Error('Failed')
      setData(await res.json())
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [status, paperType])

  useEffect(() => { load() }, [load])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ──────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/25 flex-shrink-0">
                <Scale className="h-5 w-5 text-for-400" />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white">Consultations</h1>
                <p className="text-sm font-mono text-surface-500 mt-0.5">
                  {loading
                    ? 'Loading…'
                    : data
                    ? `${data.total} consultation${data.total !== 1 ? 's' : ''}`
                    : 'Government consultation documents'}
                </p>
              </div>
            </div>

            <button
              onClick={load}
              disabled={loading}
              className={cn(
                'flex items-center gap-1.5 px-3 py-2 rounded-lg text-xs font-mono',
                'bg-surface-200 border border-surface-300 text-surface-500',
                'hover:bg-surface-300 hover:text-white transition-colors',
                'disabled:opacity-50 disabled:cursor-not-allowed'
              )}
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              <span className="hidden sm:inline">Refresh</span>
            </button>
          </div>

          {/* Intro blurb */}
          <p className="mt-4 text-xs font-mono text-surface-500 leading-relaxed max-w-2xl">
            The government issues consultation papers to seek public views before making policy decisions.
            Green Papers explore ideas; White Papers set out firm proposals; Calls for Evidence gather expert input.
            Your response shapes real civic outcomes.
          </p>
        </div>

        {/* ── Filters ─────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-6 flex-wrap">
          {/* Status tabs */}
          <div className="flex items-center gap-1 p-1 rounded-lg bg-surface-200 border border-surface-300">
            {STATUSES.map((s) => (
              <button
                key={s.value}
                onClick={() => setStatus(s.value)}
                className={cn(
                  'px-3 py-1.5 rounded-md text-xs font-mono transition-colors',
                  status === s.value
                    ? 'bg-surface-50 text-white shadow-sm'
                    : 'text-surface-500 hover:text-white'
                )}
              >
                {s.label}
              </button>
            ))}
          </div>

          {/* Paper type filter */}
          <div className="relative">
            <button
              onClick={() => setShowTypeFilter((v) => !v)}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border transition-colors',
                paperType
                  ? 'bg-for-500/10 border-for-500/30 text-for-300'
                  : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white'
              )}
            >
              <Filter className="h-3 w-3" />
              {paperType ? PAPER_TYPES[paperType]?.label : 'Paper type'}
              <ChevronDown className={cn('h-3 w-3 transition-transform', showTypeFilter && 'rotate-180')} />
            </button>

            <AnimatePresence>
              {showTypeFilter && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: 4 }}
                  className="absolute top-full mt-1 left-0 z-20 bg-surface-100 border border-surface-300 rounded-xl shadow-xl min-w-[180px] py-1 overflow-hidden"
                >
                  <button
                    onClick={() => { setPaperType(''); setShowTypeFilter(false) }}
                    className={cn(
                      'w-full text-left px-4 py-2 text-xs font-mono hover:bg-surface-200 transition-colors',
                      !paperType ? 'text-white' : 'text-surface-400'
                    )}
                  >
                    All types
                  </button>
                  {Object.entries(PAPER_TYPES).map(([key, { label, color }]) => (
                    <button
                      key={key}
                      onClick={() => { setPaperType(key); setShowTypeFilter(false) }}
                      className={cn(
                        'w-full text-left px-4 py-2 text-xs font-mono hover:bg-surface-200 transition-colors',
                        paperType === key ? 'text-white' : color
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {/* Active filter pills */}
          {paperType && (
            <button
              onClick={() => setPaperType('')}
              className="flex items-center gap-1 px-2 py-1 rounded-md bg-for-500/10 border border-for-500/25 text-[11px] font-mono text-for-300 hover:bg-for-500/20 transition-colors"
            >
              {PAPER_TYPES[paperType]?.label}
              <span className="text-for-500">×</span>
            </button>
          )}
        </div>

        {/* ── Content ─────────────────────────────────────────────── */}
        {loading ? (
          <div className="space-y-3">
            {[0, 1, 2, 3, 4].map((i) => <CardSkeleton key={i} i={i} />)}
          </div>
        ) : error ? (
          <EmptyState
            icon={RefreshCw}
            title="Couldn't load consultations"
            description="Something went wrong. Try refreshing."
            actions={[{ label: 'Try again', onClick: load }]}
          />
        ) : !data || data.consultations.length === 0 ? (
          <EmptyState
            icon={Scale}
            title={status === 'open' ? 'No open consultations' : 'No consultations'}
            description={
              status === 'open'
                ? 'There are no open consultations right now. Check back soon or view closed ones.'
                : 'No consultations match the current filter.'
            }
            actions={
              status !== 'all'
                ? [{ label: 'View all', onClick: () => setStatus('all') }]
                : undefined
            }
          />
        ) : (
          <AnimatePresence mode="wait">
            <motion.div
              key={`${status}-${paperType}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-3"
            >
              {data.consultations.map((c, i) => (
                <ConsultationCard key={c.id} consultation={c} idx={i} />
              ))}
            </motion.div>
          </AnimatePresence>
        )}

        {/* ── Info callout ─────────────────────────────────────────── */}
        {!loading && !error && data && data.consultations.length > 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.3 }}
            className="mt-8 p-4 rounded-xl bg-surface-100 border border-surface-300"
          >
            <div className="flex items-start gap-3">
              <MessageSquare className="h-4 w-4 text-for-400 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-xs font-mono text-surface-400 leading-relaxed">
                  <span className="text-white font-semibold">Your response matters.</span>{' '}
                  Consultation responses directly inform civic policy decisions.
                  Sign in to submit your views on open consultations before the deadline.
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
