'use client'

/**
 * /reports — Civic Committee Reports
 *
 * Formal published reports from citizens who have investigated a topic or
 * attended committee hearings. Each report includes findings, analysis,
 * and a policy recommendation. Community members can endorse reports they
 * find credible.
 *
 * Distinct from:
 *   /hearings     — the testimony phase (evidence gathering)
 *   /motions      — short EDM-style tabled notices
 *   /tribunal     — argument quality review
 *   /brief        — AI-generated topic briefs
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FileText,
  Gavel,
  Loader2,
  Plus,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsUp,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import { createClient } from '@/lib/supabase/client'
import type { CommitteeReport, ReportsResponse } from '@/app/api/committee-reports/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'All', 'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Education', 'Environment',
]

const CAT_STYLE: Record<string, { text: string; bg: string; border: string }> = {
  Economics:   { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Technology:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Science:     { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Politics:    { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
  Ethics:      { text: 'text-against-300', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  Environment: { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Education:   { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Health:      { text: 'text-against-300', bg: 'bg-against-400/10', border: 'border-against-400/30' },
  Culture:     { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Philosophy:  { text: 'text-for-300',     bg: 'bg-for-300/10',     border: 'border-for-300/30' },
}

const RECOMMENDATION_CONFIG = {
  for:     { label: 'Recommend FOR',     color: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
  against: { label: 'Recommend AGAINST', color: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  neutral: { label: 'No Recommendation', color: 'text-surface-400', bg: 'bg-surface-200',    border: 'border-surface-300' },
  hold:    { label: 'Hold — More Study', color: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
} as const

function catStyle(cat: string) {
  return CAT_STYLE[cat] ?? { text: 'text-surface-500', bg: 'bg-surface-200', border: 'border-surface-300' }
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: d > 365 ? 'numeric' : undefined })
}

// ─── Report card ──────────────────────────────────────────────────────────────

function ReportCard({
  report,
  onEndorse,
  endorsing,
}: {
  report: CommitteeReport
  onEndorse: (id: string) => void
  endorsing: boolean
}) {
  const [expanded, setExpanded] = useState(false)
  const rec = RECOMMENDATION_CONFIG[report.recommendation]
  const cs = catStyle(report.category)

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.25 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden"
    >
      {/* Header */}
      <div className="p-5 space-y-3">
        {/* Badges */}
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-medium border', cs.bg, cs.border, cs.text)}>
            {report.category}
          </span>
          <span className={cn('inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[11px] font-mono font-medium border', rec.bg, rec.border, rec.color)}>
            <Scale className="h-3 w-3" aria-hidden />
            {rec.label}
          </span>
        </div>

        {/* Title */}
        <h2 className="text-base font-mono font-semibold text-white leading-snug">
          {report.title}
        </h2>

        {/* Summary */}
        <p className="text-sm text-surface-400 leading-relaxed font-mono line-clamp-2">
          {report.summary}
        </p>

        {/* Topic link if present */}
        {report.topic_id && report.topic_statement && (
          <Link
            href={`/topic/${report.topic_id}`}
            className="inline-flex items-center gap-1.5 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
          >
            <ExternalLink className="h-3 w-3" aria-hidden />
            <span className="truncate max-w-[280px]">{report.topic_statement}</span>
          </Link>
        )}

        {/* Full content toggle */}
        <AnimatePresence>
          {expanded && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden"
            >
              <div className="pt-2 pb-1 border-t border-surface-300 mt-2">
                <p className="text-sm text-surface-300 font-mono leading-relaxed whitespace-pre-wrap">
                  {report.content}
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Footer */}
      <div className="px-5 py-3 border-t border-surface-300 flex items-center justify-between gap-3 flex-wrap">
        {/* Author + time */}
        <div className="flex items-center gap-2 min-w-0">
          <Avatar
            src={report.author?.avatar_url ?? null}
            fallback={report.author?.display_name ?? report.author?.username ?? '?'}
            username={report.author?.username}
            size="xs"
          />
          <span className="text-xs font-mono text-surface-500 truncate">
            {report.author?.display_name ?? `@${report.author?.username}`}
          </span>
          <span className="text-xs text-surface-600 font-mono">·</span>
          <span className="text-xs text-surface-600 font-mono">{relTime(report.published_at ?? report.created_at)}</span>
        </div>

        {/* Actions */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setExpanded((e) => !e)}
            className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
            aria-label={expanded ? 'Collapse report' : 'Read full report'}
          >
            {expanded ? (
              <><ChevronUp className="h-3 w-3" aria-hidden />Collapse</>
            ) : (
              <><ChevronDown className="h-3 w-3" aria-hidden />Read</>
            )}
          </button>

          <button
            onClick={() => onEndorse(report.id)}
            disabled={endorsing}
            className={cn(
              'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium border transition-colors',
              report.user_endorsed
                ? 'bg-for-600/20 border-for-600/40 text-for-400 hover:bg-for-600/30'
                : 'bg-surface-200 border-surface-300 text-surface-400 hover:text-white hover:border-surface-400'
            )}
            aria-label={report.user_endorsed ? 'Remove endorsement' : 'Endorse this report'}
          >
            {endorsing ? (
              <Loader2 className="h-3 w-3 animate-spin" aria-hidden />
            ) : (
              <ThumbsUp className={cn('h-3 w-3', report.user_endorsed && 'text-for-400')} aria-hidden />
            )}
            <span>{report.endorsement_count}</span>
          </button>
        </div>
      </div>
    </motion.article>
  )
}

// ─── New report form ──────────────────────────────────────────────────────────

const REPORT_CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Education', 'Environment',
]

interface NewReportFormProps {
  onClose: () => void
  onSuccess: (id: string) => void
}

function NewReportForm({ onClose, onSuccess }: NewReportFormProps) {
  const [title, setTitle] = useState('')
  const [summary, setSummary] = useState('')
  const [content, setContent] = useState('')
  const [category, setCategory] = useState('')
  const [recommendation, setRecommendation] = useState<'for' | 'against' | 'neutral' | 'hold'>('neutral')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!title.trim() || !summary.trim() || !content.trim() || !category) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/committee-reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, summary, content, category, recommendation }),
      })
      if (!res.ok) {
        const d = await res.json().catch(() => ({}))
        throw new Error(d.error ?? 'Failed to publish report')
      }
      const data = await res.json()
      onSuccess(data.id)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to publish')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-end sm:items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <motion.div
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: 24 }}
        className="w-full max-w-xl bg-surface-100 border border-surface-300 rounded-2xl p-6 space-y-5 max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-mono font-bold text-white text-lg">Publish Committee Report</h2>
            <p className="text-xs text-surface-500 font-mono mt-0.5">
              Formal findings and policy recommendation
            </p>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 flex items-center justify-center text-surface-400 hover:text-white transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" aria-hidden />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Title */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-medium text-surface-400 uppercase tracking-wide">
              Report Title
            </label>
            <input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={200}
              placeholder="e.g. Findings on AI Regulation in Civic Technology"
              className="w-full h-10 rounded-xl bg-surface-200 border border-surface-300 px-3 font-mono text-sm text-white placeholder:text-surface-600 focus:outline-none focus:border-for-500/60 focus:ring-1 focus:ring-for-500/30 transition-colors"
              required
            />
          </div>

          {/* Category + Recommendation */}
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-mono font-medium text-surface-400 uppercase tracking-wide">
                Category
              </label>
              <select
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="w-full h-10 rounded-xl bg-surface-200 border border-surface-300 px-3 font-mono text-sm text-white focus:outline-none focus:border-for-500/60 focus:ring-1 focus:ring-for-500/30 transition-colors"
                required
              >
                <option value="" disabled>Select…</option>
                {REPORT_CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-mono font-medium text-surface-400 uppercase tracking-wide">
                Recommendation
              </label>
              <select
                value={recommendation}
                onChange={(e) => setRecommendation(e.target.value as typeof recommendation)}
                className="w-full h-10 rounded-xl bg-surface-200 border border-surface-300 px-3 font-mono text-sm text-white focus:outline-none focus:border-for-500/60 focus:ring-1 focus:ring-for-500/30 transition-colors"
              >
                <option value="for">Recommend FOR</option>
                <option value="against">Recommend AGAINST</option>
                <option value="neutral">No Recommendation</option>
                <option value="hold">Hold — More Study</option>
              </select>
            </div>
          </div>

          {/* Summary */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-medium text-surface-400 uppercase tracking-wide">
              Executive Summary <span className="text-surface-600 normal-case">(20–500 chars)</span>
            </label>
            <textarea
              value={summary}
              onChange={(e) => setSummary(e.target.value)}
              maxLength={500}
              rows={2}
              placeholder="A concise overview of the committee's key finding…"
              className="w-full rounded-xl bg-surface-200 border border-surface-300 px-3 py-2.5 font-mono text-sm text-white placeholder:text-surface-600 focus:outline-none focus:border-for-500/60 focus:ring-1 focus:ring-for-500/30 transition-colors resize-y"
              required
            />
            <p className="text-[11px] text-surface-600 font-mono text-right">{summary.length}/500</p>
          </div>

          {/* Full report content */}
          <div className="space-y-1.5">
            <label className="text-xs font-mono font-medium text-surface-400 uppercase tracking-wide">
              Full Report <span className="text-surface-600 normal-case">(100–10,000 chars)</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              maxLength={10000}
              rows={8}
              placeholder="Background, methodology, evidence reviewed, analysis, conclusions, and formal recommendation…"
              className="w-full rounded-xl bg-surface-200 border border-surface-300 px-3 py-2.5 font-mono text-sm text-white placeholder:text-surface-600 focus:outline-none focus:border-for-500/60 focus:ring-1 focus:ring-for-500/30 transition-colors resize-y"
              required
            />
            <p className="text-[11px] text-surface-600 font-mono text-right">{content.length}/10,000</p>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2.5 rounded-xl bg-against-500/10 border border-against-500/30">
              <AlertCircle className="h-4 w-4 text-against-400 flex-shrink-0" aria-hidden />
              <p className="text-sm font-mono text-against-300">{error}</p>
            </div>
          )}

          {/* Submit */}
          <div className="flex gap-3 pt-1">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-10 rounded-xl bg-surface-200 border border-surface-300 text-sm font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={submitting || title.length < 10 || summary.length < 20 || content.length < 100 || !category}
              className="flex-1 h-10 rounded-xl bg-for-600 hover:bg-for-500 disabled:opacity-50 disabled:cursor-not-allowed text-sm font-mono font-medium text-white transition-colors inline-flex items-center justify-center gap-2"
            >
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Publishing…</>
              ) : (
                <><Sparkles className="h-4 w-4" aria-hidden />Publish Report</>
              )}
            </button>
          </div>
        </form>
      </motion.div>
    </motion.div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export function ReportsClient() {
  const router = useRouter()
  const [reports, setReports] = useState<CommitteeReport[]>([])
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [hasMore, setHasMore] = useState(true)
  const [category, setCategory] = useState<string>('All')
  const [sort, setSort] = useState<'recent' | 'top'>('recent')
  const [endorsingIds, setEndorsingIds] = useState<Set<string>>(new Set())
  const [showForm, setShowForm] = useState(false)
  const [user, setUser] = useState<{ id: string } | null>(null)
  const offsetRef = useRef(0)
  const LIMIT = 15

  // Auth check
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => setUser(data.user ? { id: data.user.id } : null))
  }, [])

  const fetchReports = useCallback(async (reset: boolean) => {
    const offset = reset ? 0 : offsetRef.current
    if (reset) setLoading(true)
    else setLoadingMore(true)

    try {
      const params = new URLSearchParams({
        limit: String(LIMIT),
        offset: String(offset),
        sort,
        ...(category !== 'All' ? { category } : {}),
      })
      const res = await fetch(`/api/committee-reports?${params}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      const data: ReportsResponse = await res.json()

      if (reset) {
        setReports(data.reports)
        offsetRef.current = data.reports.length
      } else {
        setReports((prev) => [...prev, ...data.reports])
        offsetRef.current += data.reports.length
      }
      setHasMore(data.reports.length === LIMIT)
    } catch {
      // keep existing data on error
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [category, sort])

  useEffect(() => {
    offsetRef.current = 0
    fetchReports(true)
  }, [fetchReports])

  async function handleEndorse(id: string) {
    if (!user) {
      router.push('/login')
      return
    }
    if (endorsingIds.has(id)) return
    setEndorsingIds((prev) => new Set([...prev, id]))
    try {
      const res = await fetch(`/api/committee-reports/${id}/endorse`, { method: 'POST' })
      if (!res.ok) return
      const { endorsed } = await res.json()
      setReports((prev) => prev.map((r) =>
        r.id === id
          ? { ...r, user_endorsed: endorsed, endorsement_count: r.endorsement_count + (endorsed ? 1 : -1) }
          : r
      ))
    } finally {
      setEndorsingIds((prev) => { const next = new Set(prev); next.delete(id); return next })
    }
  }

  function handleFormSuccess(id: string) {
    setShowForm(false)
    router.push(`/reports/${id}`)
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12 space-y-6">

        {/* Page header */}
        <div className="flex items-start justify-between gap-4">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <FileText className="h-5 w-5 text-for-400" aria-hidden />
              <h1 className="font-mono font-bold text-white text-2xl">Committee Reports</h1>
            </div>
            <p className="text-sm text-surface-500 font-mono">
              Formal civic findings and policy recommendations from the community
            </p>
          </div>
          {user && (
            <button
              onClick={() => setShowForm(true)}
              className="flex-shrink-0 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-medium transition-colors"
            >
              <Plus className="h-4 w-4" aria-hidden />
              Publish Report
            </button>
          )}
        </div>

        {/* Filters */}
        <div className="space-y-3">
          {/* Category pills */}
          <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-none">
            {CATEGORIES.map((cat) => {
              const active = category === cat
              const cs = cat === 'All' ? null : catStyle(cat)
              return (
                <button
                  key={cat}
                  onClick={() => setCategory(cat)}
                  className={cn(
                    'flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-mono font-medium border transition-colors',
                    active
                      ? cs
                        ? cn(cs.bg, cs.border, cs.text)
                        : 'bg-for-600/20 border-for-600/40 text-for-400'
                      : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
                  )}
                >
                  {cat}
                </button>
              )
            })}
          </div>

          {/* Sort */}
          <div className="flex items-center gap-2">
            <span className="text-xs text-surface-600 font-mono">Sort:</span>
            {(['recent', 'top'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSort(s)}
                className={cn(
                  'px-3 py-1 rounded-lg text-xs font-mono border transition-colors capitalize',
                  sort === s
                    ? 'bg-surface-200 border-surface-400 text-white'
                    : 'bg-transparent border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
                )}
              >
                {s === 'recent' ? 'Latest' : 'Most Endorsed'}
              </button>
            ))}
          </div>
        </div>

        {/* Reports list */}
        {loading ? (
          <div className="space-y-4">
            {[0, 1, 2].map((i) => (
              <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3 animate-pulse">
                <div className="flex gap-2">
                  <div className="h-5 w-20 rounded-full bg-surface-300/50" />
                  <div className="h-5 w-28 rounded-full bg-surface-300/50" />
                </div>
                <div className="h-5 w-4/5 rounded bg-surface-300/50" />
                <div className="h-4 w-full rounded bg-surface-300/50" />
                <div className="h-4 w-3/4 rounded bg-surface-300/50" />
              </div>
            ))}
          </div>
        ) : reports.length === 0 ? (
          <EmptyState
            icon={FileText}
            iconColor="text-surface-500"
            title="No reports yet"
            description={
              category !== 'All'
                ? `No committee reports in ${category} yet. Be the first to publish one.`
                : 'No committee reports have been published yet. Submit your first formal finding.'
            }
            action={user ? {
              label: 'Publish First Report',
              onClick: () => setShowForm(true),
            } : {
              label: 'Sign in to publish',
              href: '/login',
            }}
          />
        ) : (
          <div className="space-y-4">
            {reports.map((report) => (
              <ReportCard
                key={report.id}
                report={report}
                onEndorse={handleEndorse}
                endorsing={endorsingIds.has(report.id)}
              />
            ))}

            {hasMore && (
              <div className="flex justify-center pt-2">
                <button
                  onClick={() => fetchReports(false)}
                  disabled={loadingMore}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-sm font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors disabled:opacity-50"
                >
                  {loadingMore ? (
                    <><Loader2 className="h-4 w-4 animate-spin" aria-hidden />Loading…</>
                  ) : (
                    <><RefreshCw className="h-4 w-4" aria-hidden />Load more</>
                  )}
                </button>
              </div>
            )}
          </div>
        )}

        {/* Info block */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <h3 className="font-mono font-semibold text-white text-sm flex items-center gap-2">
            <Gavel className="h-4 w-4 text-gold" aria-hidden />
            About Committee Reports
          </h3>
          <div className="space-y-2 text-xs font-mono text-surface-500 leading-relaxed">
            <p>
              Committee Reports are formal civic documents published by citizens who have investigated a policy topic,
              reviewed evidence, or attended committee hearings. They are part of the permanent public record.
            </p>
            <p>
              Each report includes an executive summary, full analysis, and a policy recommendation.
              The community can endorse reports they find credible and well-reasoned.
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-1 pt-1">
              <Link href="/hearings" className="text-for-400 hover:text-for-300 transition-colors flex items-center gap-1">
                <span>→</span> Civic Hearings
              </Link>
              <Link href="/motions" className="text-for-400 hover:text-for-300 transition-colors flex items-center gap-1">
                <span>→</span> Civic Motions
              </Link>
              <Link href="/tribunal" className="text-for-400 hover:text-for-300 transition-colors flex items-center gap-1">
                <span>→</span> Tribunal
              </Link>
              <Link href="/grand-council" className="text-for-400 hover:text-for-300 transition-colors flex items-center gap-1">
                <span>→</span> Grand Council
              </Link>
            </div>
          </div>
        </div>
      </main>

      <BottomNav />

      {/* New report modal */}
      <AnimatePresence>
        {showForm && (
          <NewReportForm onClose={() => setShowForm(false)} onSuccess={handleFormSuccess} />
        )}
      </AnimatePresence>
    </div>
  )
}
