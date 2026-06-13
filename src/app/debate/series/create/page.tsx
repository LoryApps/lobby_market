'use client'

/**
 * /debate/series/create — Create a New Debate Series
 *
 * Multi-round debate competitions (best-of-3 / 5 / 7) linking related
 * debates into a series to settle contested topics definitively.
 *
 * Distinct from:
 *   /debate/create         — create a single debate
 *   /debate/series         — browse all series
 *   /debate/series/[id]    — view a specific series
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle,
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronDown,
  Gavel,
  Layers,
  Loader2,
  Search,
  Swords,
  Trophy,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Button } from '@/components/ui/Button'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'
import type { Topic } from '@/lib/supabase/types'

// ─── Types ─────────────────────────────────────────────────────────────────────

type Format = 'best_of_3' | 'best_of_5' | 'best_of_7' | 'fixed'

interface FormatOption {
  value: Format
  label: string
  rounds: string
  desc: string
  icon: typeof Trophy
  accent: string
  border: string
  bg: string
}

// ─── Config ────────────────────────────────────────────────────────────────────

const FORMAT_OPTIONS: FormatOption[] = [
  {
    value: 'best_of_3',
    label: 'Best of 3',
    rounds: '2 wins to claim',
    desc: 'Quick. Decisive. 3 rounds maximum.',
    icon: Swords,
    accent: 'text-for-400',
    border: 'border-for-500/40',
    bg: 'bg-for-500/5',
  },
  {
    value: 'best_of_5',
    label: 'Best of 5',
    rounds: '3 wins to claim',
    desc: 'The standard championship format.',
    icon: Trophy,
    accent: 'text-gold',
    border: 'border-gold/40',
    bg: 'bg-gold/5',
  },
  {
    value: 'best_of_7',
    label: 'Best of 7',
    rounds: '4 wins to claim',
    desc: 'Epic contest. For the most contested topics.',
    icon: Layers,
    accent: 'text-purple',
    border: 'border-purple/40',
    bg: 'bg-purple/5',
  },
  {
    value: 'fixed',
    label: 'Fixed',
    rounds: 'All rounds play out',
    desc: 'No early finish — every round counts.',
    icon: Gavel,
    accent: 'text-against-400',
    border: 'border-against-500/40',
    bg: 'bg-against-500/5',
  },
]

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

// ─── Component ─────────────────────────────────────────────────────────────────

export default function CreateDebateSeriesPage() {
  const router = useRouter()

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [format, setFormat] = useState<Format>('best_of_3')

  // Topic search
  const [topicQuery, setTopicQuery] = useState('')
  const [topicResults, setTopicResults] = useState<Topic[]>([])
  const [selectedTopic, setSelectedTopic] = useState<Topic | null>(null)
  const [searchingTopics, setSearchingTopics] = useState(false)

  // Submission
  const [submitting, setSubmitting] = useState(false)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [globalError, setGlobalError] = useState<string | null>(null)

  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  // ── Debounced topic search ──────────────────────────────────────────────────
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    const q = topicQuery.trim()
    if (q.length < 2) {
      setTopicResults([])
      return
    }
    setSearchingTopics(true)
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/search?q=${encodeURIComponent(q)}&type=topics&limit=8`
        )
        if (!res.ok) return
        const data = await res.json()
        setTopicResults((data.topics ?? []) as Topic[])
      } catch {
        // best-effort
      } finally {
        setSearchingTopics(false)
      }
    }, 300)
    return () => {
      if (searchTimer.current) clearTimeout(searchTimer.current)
    }
  }, [topicQuery])

  // ── Submit ─────────────────────────────────────────────────────────────────
  const handleSubmit = useCallback(async () => {
    const errs: Record<string, string> = {}
    if (!title.trim()) errs.title = 'Title is required'
    if (title.trim().length > 120) errs.title = 'Title must be 120 characters or fewer'
    if (description.length > 500) errs.description = 'Description must be 500 characters or fewer'
    setErrors(errs)
    if (Object.keys(errs).length > 0) return

    setSubmitting(true)
    setGlobalError(null)

    try {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) {
        setGlobalError('You must be signed in to create a series.')
        return
      }

      const res = await fetch('/api/debate-series', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          topic_id: selectedTopic?.id ?? undefined,
          format,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }))
        setGlobalError(err.error ?? 'Failed to create series. Please try again.')
        return
      }

      const data = await res.json()
      const seriesId: string = data.series?.id ?? data.id
      router.push(`/debate/series/${seriesId}`)
    } catch {
      setGlobalError('Network error. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }, [title, description, format, selectedTopic, router])

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen bg-surface-900">
      <TopBar />
      <main className="flex-1 max-w-xl mx-auto w-full px-4 pb-32 pt-6">

        {/* Back link */}
        <Link
          href="/debate/series"
          className="inline-flex items-center gap-1.5 text-xs text-surface-500 hover:text-surface-300 transition-colors mb-6"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Debate Series
        </Link>

        {/* Header */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
          className="mb-8"
        >
          <div className="flex items-center gap-3 mb-2">
            <div className="w-9 h-9 rounded-xl bg-purple/10 border border-purple/30 flex items-center justify-center flex-shrink-0">
              <Swords className="h-4.5 w-4.5 text-purple" />
            </div>
            <h1 className="text-xl font-bold text-white">Create Debate Series</h1>
          </div>
          <p className="text-sm text-surface-500">
            Group related debates into a multi-round competition. The series winner is determined by first to win the majority of rounds.
          </p>
        </motion.div>

        {/* Global error */}
        <AnimatePresence>
          {globalError && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="flex items-start gap-2.5 p-3.5 rounded-xl bg-against-500/10 border border-against-500/30 mb-6"
            >
              <AlertCircle className="h-4 w-4 text-against-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-against-300">{globalError}</p>
            </motion.div>
          )}
        </AnimatePresence>

        <div className="space-y-6">

          {/* ── Title ──────────────────────────────────────────────────────── */}
          <Section label="Series title" required error={errors.title}>
            <input
              type="text"
              value={title}
              onChange={(e) => { setTitle(e.target.value); setErrors((p) => ({ ...p, title: '' })) }}
              placeholder="e.g. The UBI Trilogy"
              maxLength={120}
              className={cn(
                'w-full bg-surface-200 border rounded-xl px-4 py-3 text-sm text-white placeholder:text-surface-500',
                'focus:outline-none focus:ring-2 focus:ring-purple/40 transition-colors',
                errors.title ? 'border-against-500/60' : 'border-surface-400 focus:border-purple/50',
              )}
            />
            <p className="text-right text-[11px] text-surface-600 mt-1">
              {title.length}/120
            </p>
          </Section>

          {/* ── Description ────────────────────────────────────────────────── */}
          <Section label="Description" hint="Optional" error={errors.description}>
            <textarea
              value={description}
              onChange={(e) => { setDescription(e.target.value); setErrors((p) => ({ ...p, description: '' })) }}
              placeholder="What makes this series unique? What's at stake?"
              rows={3}
              maxLength={500}
              className={cn(
                'w-full bg-surface-200 border rounded-xl px-4 py-3 text-sm text-white placeholder:text-surface-500 resize-none',
                'focus:outline-none focus:ring-2 focus:ring-purple/40 transition-colors',
                errors.description ? 'border-against-500/60' : 'border-surface-400 focus:border-purple/50',
              )}
            />
            <p className="text-right text-[11px] text-surface-600 mt-1">
              {description.length}/500
            </p>
          </Section>

          {/* ── Format ─────────────────────────────────────────────────────── */}
          <Section label="Format">
            <div className="grid grid-cols-2 gap-2">
              {FORMAT_OPTIONS.map((opt) => {
                const Icon = opt.icon
                const selected = format === opt.value
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setFormat(opt.value)}
                    className={cn(
                      'group relative flex flex-col gap-1.5 p-3.5 rounded-xl border text-left transition-all',
                      selected
                        ? `${opt.border} ${opt.bg}`
                        : 'border-surface-400/60 bg-surface-200/40 hover:border-surface-400 hover:bg-surface-200/70',
                    )}
                  >
                    {selected && (
                      <span className="absolute top-2.5 right-2.5">
                        <Check className={cn('h-3.5 w-3.5', opt.accent)} />
                      </span>
                    )}
                    <div className="flex items-center gap-1.5">
                      <Icon className={cn('h-4 w-4', selected ? opt.accent : 'text-surface-500')} />
                      <span className={cn('text-sm font-semibold', selected ? opt.accent : 'text-surface-300')}>
                        {opt.label}
                      </span>
                    </div>
                    <span className="text-[11px] text-surface-500">{opt.rounds}</span>
                    <span className="text-[11px] text-surface-600">{opt.desc}</span>
                  </button>
                )
              })}
            </div>
          </Section>

          {/* ── Linked topic ───────────────────────────────────────────────── */}
          <Section label="Linked topic" hint="Optional — ties the series to a civic debate">
            {selectedTopic ? (
              <div className="flex items-start gap-3 p-3.5 rounded-xl bg-surface-200 border border-surface-400">
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium line-clamp-2">{selectedTopic.statement}</p>
                  <div className="flex items-center gap-2 mt-1.5">
                    {selectedTopic.category && (
                      <span className="text-[11px] text-surface-500">{selectedTopic.category}</span>
                    )}
                    <Badge variant={STATUS_BADGE[selectedTopic.status] ?? 'proposed'} className="text-[10px] py-0">
                      {selectedTopic.status}
                    </Badge>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => { setSelectedTopic(null); setTopicQuery(''); setTopicResults([]) }}
                  aria-label="Remove linked topic"
                  className="p-1 rounded-lg hover:bg-surface-300 text-surface-500 hover:text-surface-300 transition-colors flex-shrink-0"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <TopicSearch
                query={topicQuery}
                setQuery={setTopicQuery}
                results={topicResults}
                loading={searchingTopics}
                onSelect={(t) => { setSelectedTopic(t); setTopicQuery(''); setTopicResults([]) }}
              />
            )}
          </Section>

        </div>

        {/* ── Submit ──────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="mt-8"
        >
          <Button
            variant="gold"
            size="lg"
            onClick={handleSubmit}
            disabled={submitting || !title.trim()}
            className="w-full"
          >
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Creating series…
              </>
            ) : (
              <>
                <Swords className="h-4 w-4" />
                Create Series
                <ArrowRight className="h-4 w-4 ml-auto" />
              </>
            )}
          </Button>
          <p className="text-center text-[11px] text-surface-600 mt-3">
            You can add debates to this series when creating or editing a debate.
          </p>
        </motion.div>

      </main>
      <BottomNav />
    </div>
  )
}

// ─── Sub-components ─────────────────────────────────────────────────────────────

function Section({
  label,
  required,
  hint,
  error,
  children,
}: {
  label: string
  required?: boolean
  hint?: string
  error?: string
  children: React.ReactNode
}) {
  return (
    <div>
      <div className="flex items-baseline gap-2 mb-2">
        <label className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-wider">
          {label}
        </label>
        {required && <span className="text-[10px] text-against-400">required</span>}
        {hint && <span className="text-[10px] text-surface-600">{hint}</span>}
      </div>
      {children}
      {error && (
        <p className="flex items-center gap-1 mt-1.5 text-[11px] text-against-400">
          <AlertCircle className="h-3 w-3 flex-shrink-0" />
          {error}
        </p>
      )}
    </div>
  )
}

function TopicSearch({
  query,
  setQuery,
  results,
  loading,
  onSelect,
}: {
  query: string
  setQuery: (q: string) => void
  results: Topic[]
  loading: boolean
  onSelect: (t: Topic) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const showDropdown = query.length >= 2

  return (
    <div className="relative">
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search topics…"
          className="w-full bg-surface-200 border border-surface-400 rounded-xl pl-10 pr-4 py-3 text-sm text-white placeholder:text-surface-500 focus:outline-none focus:ring-2 focus:ring-purple/40 focus:border-purple/50 transition-colors"
        />
        {loading && (
          <Loader2 className="absolute right-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 animate-spin" />
        )}
      </div>

      <AnimatePresence>
        {showDropdown && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            transition={{ duration: 0.15 }}
            className="absolute z-20 w-full mt-1.5 rounded-xl bg-surface-100 border border-surface-300 shadow-xl overflow-hidden"
          >
            {results.map((t) => (
              <button
                key={t.id}
                type="button"
                onClick={() => onSelect(t)}
                className="w-full flex items-start gap-3 px-3.5 py-3 text-left hover:bg-surface-200 transition-colors group"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium line-clamp-2 group-hover:text-for-300 transition-colors">
                    {t.statement}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {t.category && (
                      <span className="text-[11px] text-surface-500">{t.category}</span>
                    )}
                    <Badge variant={STATUS_BADGE[t.status] ?? 'proposed'} className="text-[10px] py-0">
                      {t.status}
                    </Badge>
                  </div>
                </div>
                <ChevronDown className="h-4 w-4 text-surface-600 -rotate-90 flex-shrink-0 mt-0.5 group-hover:text-for-400 transition-colors" />
              </button>
            ))}
          </motion.div>
        )}
        {showDropdown && !loading && results.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute z-20 w-full mt-1.5 rounded-xl bg-surface-100 border border-surface-300 p-4 text-center"
          >
            <p className="text-sm text-surface-500">No topics found</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
