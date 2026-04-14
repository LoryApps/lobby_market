'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ExternalLink,
  Gavel,
  Lightbulb,
  Loader2,
  Scale,
  Zap,
  FileText,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Politics',
  'Technology',
  'Ethics',
  'Culture',
  'Economics',
  'Science',
  'Philosophy',
  'Health',
  'Environment',
  'Education',
  'Other',
]

const SCOPES = ['Global', 'National', 'Regional', 'Local']

const MAX_CHARS = 280

// ─── Types ────────────────────────────────────────────────────────────────────

interface SimilarTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
}

const STATUS_COLOR: Record<string, string> = {
  proposed: 'text-surface-500 border-surface-500/40 bg-surface-500/10',
  active: 'text-for-400 border-for-500/40 bg-for-500/10',
  voting: 'text-purple border-purple/40 bg-purple/10',
  law: 'text-emerald border-emerald/40 bg-emerald/10',
  failed: 'text-against-400 border-against-500/40 bg-against-500/10',
}

function StatusIcon({ status }: { status: string }) {
  const cls = 'h-3 w-3 flex-shrink-0'
  switch (status) {
    case 'active': return <Zap className={cn(cls, 'text-for-400')} />
    case 'voting': return <Scale className={cn(cls, 'text-purple')} />
    case 'law': return <Gavel className={cn(cls, 'text-emerald')} />
    default: return <FileText className={cn(cls, 'text-surface-500')} />
  }
}

// ─── Similar Topic Card ───────────────────────────────────────────────────────

function SimilarTopicCard({ topic }: { topic: SimilarTopic }) {
  const forPct = Math.round(topic.blue_pct ?? 50)
  const againstPct = 100 - forPct

  return (
    <Link
      href={`/topic/${topic.id}`}
      className={cn(
        'group flex flex-col gap-2 rounded-xl p-3.5',
        'bg-surface-200 border border-surface-300',
        'hover:border-surface-400 hover:bg-surface-200/80',
        'transition-all duration-150'
      )}
    >
      {/* Header: status pill + votes */}
      <div className="flex items-center justify-between gap-2">
        <span
          className={cn(
            'inline-flex items-center gap-1 text-[10px] font-mono font-semibold',
            'px-2 py-0.5 rounded-full border',
            STATUS_COLOR[topic.status] ?? STATUS_COLOR.proposed
          )}
        >
          <StatusIcon status={topic.status} />
          {STATUS_LABEL[topic.status] ?? topic.status}
        </span>
        <span className="text-[10px] font-mono text-surface-500">
          {topic.total_votes > 0
            ? `${topic.total_votes.toLocaleString()} votes`
            : 'No votes yet'}
        </span>
      </div>

      {/* Statement */}
      <p className="text-sm text-white font-mono leading-snug line-clamp-2">
        {topic.statement}
      </p>

      {/* Vote bar (only if votes exist) */}
      {topic.total_votes > 0 && (
        <div className="space-y-1">
          <div className="flex h-1 w-full rounded-full overflow-hidden bg-surface-400">
            <div className="bg-for-500 h-full" style={{ width: `${forPct}%` }} />
            <div className="bg-against-500 h-full" style={{ width: `${againstPct}%` }} />
          </div>
          <div className="flex justify-between text-[9px] font-mono">
            <span className="text-for-400">{forPct}% For</span>
            <span className="text-against-400">{againstPct}% Against</span>
          </div>
        </div>
      )}

      {/* CTA */}
      <div className="flex items-center gap-1 text-[10px] font-mono text-surface-500 group-hover:text-surface-300 transition-colors">
        <span>
          {topic.status === 'law'
            ? 'View this law'
            : topic.status === 'voting' || topic.status === 'active'
              ? 'Vote on this topic'
              : 'View this topic'}
        </span>
        <ArrowRight className="h-3 w-3" />
      </div>
    </Link>
  )
}

// ─── Similar Topics Panel ─────────────────────────────────────────────────────

function SimilarTopicsPanel({
  topics,
  loading,
  dismissed,
  onDismiss,
}: {
  topics: SimilarTopic[]
  loading: boolean
  dismissed: boolean
  onDismiss: () => void
}) {
  if (dismissed) return null

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-xs text-surface-500 font-mono py-1">
        <Loader2 className="h-3 w-3 animate-spin" />
        Checking for similar topics…
      </div>
    )
  }

  if (topics.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2 }}
      className={cn(
        'rounded-xl border p-4 space-y-3',
        'bg-gold/5 border-gold/25'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2">
          <AlertTriangle className="h-4 w-4 text-gold flex-shrink-0 mt-px" />
          <div>
            <p className="text-sm font-mono font-semibold text-gold">
              Similar topic{topics.length > 1 ? 's' : ''} already exist
            </p>
            <p className="text-xs text-surface-500 font-mono mt-0.5">
              Consider joining an existing debate instead of creating a duplicate.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={onDismiss}
          className="text-surface-500 hover:text-surface-300 transition-colors text-xs font-mono flex-shrink-0 mt-0.5"
          aria-label="Dismiss similar topics warning"
        >
          Dismiss
        </button>
      </div>

      {/* Topic cards */}
      <div className="space-y-2">
        {topics.map((t) => (
          <SimilarTopicCard key={t.id} topic={t} />
        ))}
      </div>

      {/* Still want to proceed note */}
      <p className="text-[11px] text-surface-500 font-mono">
        If your topic is genuinely different, go ahead and submit it below.
      </p>
    </motion.div>
  )
}

// ─── Writing tips ─────────────────────────────────────────────────────────────

function WritingTips() {
  const [open, setOpen] = useState(false)

  const tips = [
    { good: true, text: 'Use a clear, falsifiable statement: "AI will replace 30% of jobs by 2030"' },
    { good: true, text: 'Make it binary — the community will vote For or Against' },
    { good: true, text: 'Be specific: "The UK should ban petrol cars by 2035"' },
    { good: false, text: 'Avoid vague opinions: "Technology is good"' },
    { good: false, text: 'Avoid loaded questions or rhetoric' },
  ]

  return (
    <div className="rounded-xl border border-surface-300 bg-surface-100 overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-mono text-surface-500 hover:text-surface-300 transition-colors"
      >
        <span className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-gold" />
          Tips for a strong topic statement
        </span>
        <span className="text-xs">{open ? '▲' : '▼'}</span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-2 border-t border-surface-300">
              {tips.map((tip, i) => (
                <div key={i} className="flex items-start gap-2 pt-2">
                  {tip.good ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald flex-shrink-0 mt-0.5" />
                  ) : (
                    <ExternalLink className="h-4 w-4 text-against-400 flex-shrink-0 mt-0.5 rotate-45" />
                  )}
                  <p className="text-xs text-surface-500 font-mono leading-relaxed">
                    {tip.text}
                  </p>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CreateTopicPage() {
  const router = useRouter()
  const [statement, setStatement] = useState('')
  const [description, setDescription] = useState('')
  const [category, setCategory] = useState('')
  const [scope, setScope] = useState('Global')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})

  // Similar topic detection state
  const [similarTopics, setSimilarTopics] = useState<SimilarTopic[]>([])
  const [loadingSimilar, setLoadingSimilar] = useState(false)
  const [dismissedSimilar, setDismissedSimilar] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastQueryRef = useRef('')

  const charCount = statement.length
  const isOverLimit = charCount > MAX_CHARS
  const descCount = description.length
  const DESC_MAX = 2000

  // ── Similar topic search ─────────────────────────────────────────────────

  const searchSimilar = useCallback(async (q: string) => {
    if (q.length < 10) {
      setSimilarTopics([])
      setLoadingSimilar(false)
      return
    }
    // Don't re-search if query hasn't meaningfully changed
    if (q === lastQueryRef.current) return
    lastQueryRef.current = q

    setLoadingSimilar(true)
    try {
      const res = await fetch(
        `/api/topics/similar?q=${encodeURIComponent(q)}`,
        { cache: 'no-store' }
      )
      if (!res.ok) return
      const data = await res.json()
      setSimilarTopics(data.topics ?? [])
      // Reset dismissed state when new similar topics appear
      if ((data.topics ?? []).length > 0) {
        setDismissedSimilar(false)
      }
    } catch {
      // Silently fail — don't block the user
    } finally {
      setLoadingSimilar(false)
    }
  }, [])

  // Debounce input changes
  useEffect(() => {
    const q = statement.trim()
    if (debounceRef.current) clearTimeout(debounceRef.current)

    if (q.length < 10) {
      setSimilarTopics([])
      setLoadingSimilar(false)
      return
    }

    setLoadingSimilar(true)
    debounceRef.current = setTimeout(() => {
      searchSimilar(q)
    }, 600)

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [statement, searchSimilar])

  // ── Form handling ────────────────────────────────────────────────────────

  const validate = (): boolean => {
    const newErrors: Record<string, string> = {}
    if (!statement.trim()) {
      newErrors.statement = 'Statement is required'
    } else if (statement.length > MAX_CHARS) {
      newErrors.statement = `Statement must be ${MAX_CHARS} characters or fewer`
    }
    if (description.trim().length > DESC_MAX) {
      newErrors.description = `Context must be ${DESC_MAX} characters or fewer`
    }
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validate()) return

    setIsSubmitting(true)
    setErrors({})

    try {
      const res = await fetch('/api/topics', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          statement: statement.trim(),
          description: description.trim() || undefined,
          category: category || undefined,
          scope,
        }),
      })

      if (!res.ok) {
        const data = await res.json()
        if (res.status === 401) {
          router.push('/login')
          return
        }
        setErrors({ form: data.error || 'Failed to create topic' })
        return
      }

      const topic = await res.json()
      router.push(`/topic/${topic.id}`)
    } catch {
      setErrors({ form: 'Something went wrong. Please try again.' })
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Header */}
      <div className="sticky top-0 z-40 bg-surface-100 border-b border-surface-300">
        <div className="max-w-2xl mx-auto flex items-center h-14 px-4 gap-3">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            aria-label="Go back"
          >
            <ArrowLeft className="h-5 w-5" />
          </button>
          <span className="text-sm font-mono font-medium text-white">
            Propose a Topic
          </span>
        </div>
      </div>

      {/* Form */}
      <div className="max-w-2xl mx-auto px-4 py-8 pb-24">
        <form onSubmit={handleSubmit} className="space-y-5">

          {/* Page title */}
          <div className="mb-6">
            <h1 className="text-2xl font-mono font-bold text-white">
              New Topic
            </h1>
            <p className="text-sm font-mono text-surface-500 mt-1">
              Propose a binary statement for the community to debate and vote on.
            </p>
          </div>

          {/* Form-level error */}
          {errors.form && (
            <div className="bg-against-600/10 border border-against-600/30 text-against-400 text-sm font-mono rounded-xl px-4 py-3">
              {errors.form}
            </div>
          )}

          {/* Statement */}
          <div className="space-y-2">
            <label
              htmlFor="statement"
              className="block text-sm font-mono font-medium text-surface-600"
            >
              Statement
              <span className="text-against-400 ml-1">*</span>
            </label>
            <textarea
              id="statement"
              value={statement}
              onChange={(e) => setStatement(e.target.value)}
              placeholder="e.g. Universal basic income should be implemented globally"
              rows={4}
              className={cn(
                'w-full rounded-xl border px-4 py-3 text-base font-mono',
                'bg-surface-200 text-white placeholder:text-surface-500',
                'focus:outline-none focus:ring-2 transition-colors resize-none',
                errors.statement
                  ? 'border-against-500 focus:ring-against-500/30'
                  : 'border-surface-300 focus:border-for-500/50 focus:ring-for-500/20'
              )}
              aria-describedby={errors.statement ? 'statement-error' : 'statement-hint'}
            />
            <div className="flex items-center justify-between gap-2">
              {errors.statement ? (
                <p id="statement-error" className="text-xs text-against-400 font-mono">
                  {errors.statement}
                </p>
              ) : (
                <p id="statement-hint" className="text-xs text-surface-500 font-mono">
                  Make it clear, specific, and binary.
                </p>
              )}
              <span
                className={cn(
                  'text-xs font-mono flex-shrink-0',
                  isOverLimit ? 'text-against-400' : charCount > MAX_CHARS * 0.8 ? 'text-gold' : 'text-surface-500'
                )}
              >
                {charCount}/{MAX_CHARS}
              </span>
            </div>
          </div>

          {/* Similar topics panel */}
          <AnimatePresence mode="wait">
            {(loadingSimilar || similarTopics.length > 0) && (
              <SimilarTopicsPanel
                key="similar"
                topics={similarTopics}
                loading={loadingSimilar}
                dismissed={dismissedSimilar}
                onDismiss={() => setDismissedSimilar(true)}
              />
            )}
          </AnimatePresence>

          {/* Description / Context */}
          <div className="space-y-2">
            <label
              htmlFor="description"
              className="block text-sm font-mono font-medium text-surface-600"
            >
              Context
              <span className="ml-2 text-[10px] font-normal text-surface-500 uppercase tracking-wider">
                optional
              </span>
            </label>
            <textarea
              id="description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Add context, evidence, links, or reasoning to help the community understand this topic…"
              rows={5}
              className={cn(
                'w-full rounded-xl border px-4 py-3 text-sm font-mono',
                'bg-surface-200 text-white placeholder:text-surface-500',
                'focus:outline-none focus:ring-2 transition-colors resize-none',
                errors.description
                  ? 'border-against-500 focus:ring-against-500/30'
                  : 'border-surface-300 focus:border-for-500/50 focus:ring-for-500/20'
              )}
              aria-describedby={errors.description ? 'description-error' : 'description-hint'}
            />
            <div className="flex items-center justify-between gap-2">
              {errors.description ? (
                <p id="description-error" className="text-xs text-against-400 font-mono">
                  {errors.description}
                </p>
              ) : (
                <p id="description-hint" className="text-xs text-surface-500 font-mono">
                  Background, evidence, external links — give voters the full picture.
                </p>
              )}
              <span
                className={cn(
                  'text-xs font-mono flex-shrink-0',
                  descCount > DESC_MAX ? 'text-against-400' : descCount > DESC_MAX * 0.85 ? 'text-gold' : 'text-surface-500'
                )}
              >
                {descCount}/{DESC_MAX}
              </span>
            </div>
          </div>

          {/* Category */}
          <div className="space-y-2">
            <label
              htmlFor="category"
              className="block text-sm font-mono font-medium text-surface-600"
            >
              Category
            </label>
            <div className="relative">
              <select
                id="category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className={cn(
                  'w-full rounded-xl border px-4 py-3 pr-10 text-sm font-mono',
                  'bg-surface-200 text-white border-surface-300',
                  'focus:outline-none focus:border-for-500/50 focus:ring-2 focus:ring-for-500/20',
                  'transition-colors appearance-none cursor-pointer',
                  !category && 'text-surface-500'
                )}
              >
                <option value="">Select a category (optional)</option>
                {CATEGORIES.map((cat) => (
                  <option key={cat} value={cat}>
                    {cat}
                  </option>
                ))}
              </select>
              {/* Caret */}
              <div className="pointer-events-none absolute inset-y-0 right-3 flex items-center">
                <svg className="h-4 w-4 text-surface-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                </svg>
              </div>
            </div>
          </div>

          {/* Scope */}
          <div className="space-y-2">
            <label
              htmlFor="scope"
              className="block text-sm font-mono font-medium text-surface-600"
            >
              Scope
            </label>
            {/* Pill buttons instead of a select for better mobile UX */}
            <div className="flex flex-wrap gap-2">
              {SCOPES.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => setScope(s)}
                  aria-pressed={scope === s}
                  className={cn(
                    'px-4 py-2 rounded-xl text-sm font-mono font-medium',
                    'border transition-all duration-150',
                    scope === s
                      ? 'bg-for-600 border-for-500 text-white'
                      : 'bg-surface-200 border-surface-300 text-surface-500 hover:border-surface-400 hover:text-surface-300'
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-surface-500 font-mono">
              How broadly does this topic apply?
            </p>
          </div>

          {/* Writing tips (collapsible) */}
          <WritingTips />

          {/* Submit */}
          <Button
            type="submit"
            variant="for"
            size="lg"
            className="w-full"
            disabled={isSubmitting || isOverLimit || descCount > DESC_MAX || !statement.trim()}
          >
            {isSubmitting ? (
              <span className="flex items-center gap-2">
                <Loader2 className="h-4 w-4 animate-spin" />
                Proposing…
              </span>
            ) : (
              'Propose Topic'
            )}
          </Button>

          {/* Footer note */}
          <p className="text-center text-xs text-surface-500 font-mono">
            Topics go through community review before becoming active debates.{' '}
            <Link href="/guidelines" className="text-surface-400 hover:text-white underline underline-offset-2 transition-colors">
              Community guidelines
            </Link>
          </p>
        </form>
      </div>
    </div>
  )
}
