'use client'

/**
 * /simulate — Policy Outcome Simulator
 *
 * Users pick any topic from the platform (or type a custom policy statement)
 * and Claude generates a structured analysis: short-term effects, long-term
 * consequences, who benefits, who is harmed, historical precedents, risks,
 * and a viability score.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Bot,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  FlaskConical,
  Loader2,
  RefreshCw,
  Search,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Users,
  X,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { SimulationResult } from '@/app/api/simulate/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

const EXAMPLE_STATEMENTS = [
  'Universal basic income of $1,000/month should be provided to all citizens',
  'Social media platforms should be regulated as public utilities',
  'Four-day work week should become the standard in all industries',
  'All primary school education should be publicly funded and free',
  'Carbon tax should be implemented at $100 per metric ton',
]

// ─── Category colours ─────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-300',
  Philosophy: 'text-for-300',
  Culture: 'text-gold',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-purple',
}

// ─── Topic search result ──────────────────────────────────────────────────────

interface TopicOption {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
}

// ─── Viability score ring ─────────────────────────────────────────────────────

function ViabilityRing({ score, label }: { score: number; label: string }) {
  const radius = 36
  const stroke = 5
  const norm = (radius - stroke / 2)
  const circumference = 2 * Math.PI * norm
  const offset = circumference - (score / 100) * circumference

  const color =
    score >= 70 ? '#10b981'
    : score >= 45 ? '#3b82f6'
    : '#ef4444'

  return (
    <div className="flex flex-col items-center gap-1.5">
      <div className="relative h-20 w-20">
        <svg className="h-20 w-20 -rotate-90" viewBox="0 0 80 80">
          <circle
            cx="40" cy="40" r={norm}
            fill="none" stroke="rgba(255,255,255,0.07)" strokeWidth={stroke}
          />
          <motion.circle
            cx="40" cy="40" r={norm}
            fill="none"
            stroke={color}
            strokeWidth={stroke}
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset: offset }}
            transition={{ duration: 1, ease: 'easeOut' }}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="font-mono text-xl font-black text-white leading-none">
            {score}
          </span>
          <span className="font-mono text-[9px] text-surface-500 uppercase tracking-wider">
            /100
          </span>
        </div>
      </div>
      <span
        className="font-mono text-[10px] font-bold uppercase tracking-wider"
        style={{ color }}
      >
        {label}
      </span>
      <span className="text-[10px] text-surface-600 font-mono">Viability</span>
    </div>
  )
}

// ─── Balance badge ────────────────────────────────────────────────────────────

const BALANCE_CONFIG = {
  positive: {
    icon: TrendingUp,
    label: 'Net Positive',
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
  },
  mixed: {
    icon: Activity,
    label: 'Mixed Impact',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
  },
  negative: {
    icon: AlertTriangle,
    label: 'Net Negative',
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
  },
  uncertain: {
    icon: FlaskConical,
    label: 'Uncertain',
    color: 'text-surface-400',
    bg: 'bg-surface-300/40',
    border: 'border-surface-400/30',
  },
}

function BalanceBadge({ balance }: { balance: SimulationResult['overall_balance'] }) {
  const cfg = BALANCE_CONFIG[balance] ?? BALANCE_CONFIG.uncertain
  const Icon = cfg.icon
  return (
    <div className={cn('flex items-center gap-1.5 px-3 py-1.5 rounded-xl border', cfg.bg, cfg.border)}>
      <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', cfg.color)} />
      <span className={cn('text-xs font-mono font-semibold', cfg.color)}>{cfg.label}</span>
    </div>
  )
}

// ─── Result section ───────────────────────────────────────────────────────────

function ResultSection({
  icon: Icon,
  iconColor,
  iconBg,
  title,
  items,
  bulletColor,
}: {
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  iconBg: string
  title: string
  items: string[]
  bulletColor: string
}) {
  const [expanded, setExpanded] = useState(true)
  if (items.length === 0) return null

  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300/60 overflow-hidden">
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-3 px-5 py-4 text-left hover:bg-surface-200/40 transition-colors"
      >
        <div className={cn('flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg border', iconBg)}>
          <Icon className={cn('h-4 w-4', iconColor)} />
        </div>
        <span className="flex-1 font-mono text-sm font-bold text-white uppercase tracking-wider">
          {title}
        </span>
        <span className="text-xs font-mono text-surface-500 mr-1">{items.length}</span>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-surface-500 flex-shrink-0" />
        ) : (
          <ChevronDown className="h-4 w-4 text-surface-500 flex-shrink-0" />
        )}
      </button>

      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <ul className="px-5 pb-4 space-y-2.5">
              {items.map((item, i) => (
                <li key={i} className="flex items-start gap-2.5">
                  <span className={cn('flex-shrink-0 h-1.5 w-1.5 rounded-full mt-2', bulletColor)} />
                  <span className="text-sm text-surface-600 leading-snug">{item}</span>
                </li>
              ))}
            </ul>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function SimulateSkeleton() {
  return (
    <div className="space-y-4 mt-6">
      <div className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5">
        <div className="flex items-center gap-4 mb-5">
          <Skeleton className="h-20 w-20 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-24" />
          </div>
          <Skeleton className="h-8 w-28 rounded-xl" />
        </div>
        <Skeleton className="h-3 w-full mb-2" />
        <Skeleton className="h-3 w-4/5" />
      </div>
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5">
          <div className="flex items-center gap-3 mb-4">
            <Skeleton className="h-8 w-8 rounded-lg" />
            <Skeleton className="h-4 w-36" />
          </div>
          <div className="space-y-2">
            <Skeleton className="h-3 w-full" />
            <Skeleton className="h-3 w-5/6" />
            <Skeleton className="h-3 w-4/5" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Topic search dropdown ────────────────────────────────────────────────────

function TopicSearch({
  onSelect,
}: {
  onSelect: (topic: TopicOption) => void
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<TopicOption[]>([])
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleOutside)
    return () => document.removeEventListener('mousedown', handleOutside)
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (query.trim().length < 2) {
      setResults([])
      setOpen(false)
      return
    }
    setLoading(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&tab=topics&limit=8`)
        if (res.ok) {
          const data = await res.json()
          setResults((data.topics ?? []) as TopicOption[])
          setOpen(true)
        }
      } catch {
        // silently fail
      } finally {
        setLoading(false)
      }
    }, 300)
  }, [query])

  function handleSelect(topic: TopicOption) {
    setQuery('')
    setOpen(false)
    setResults([])
    onSelect(topic)
  }

  const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
    proposed: 'proposed',
    active: 'active',
    voting: 'active',
    law: 'law',
    failed: 'failed',
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 pointer-events-none" />
        {loading ? (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 animate-spin" />
        ) : query ? (
          <button
            onClick={() => { setQuery(''); setOpen(false) }}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-white"
          >
            <X className="h-4 w-4" />
          </button>
        ) : null}
        <input
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Search existing topics…"
          className="w-full bg-surface-200/60 border border-surface-300/60 rounded-xl pl-9 pr-9 py-2.5 text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-for-500/50 transition-colors"
        />
      </div>

      <AnimatePresence>
        {open && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute z-20 top-full mt-1 w-full bg-surface-100 border border-surface-300 rounded-xl overflow-hidden shadow-xl"
          >
            {results.map((t) => (
              <button
                key={t.id}
                onClick={() => handleSelect(t)}
                className="w-full flex items-start gap-3 px-4 py-3 hover:bg-surface-200/60 transition-colors text-left border-b border-surface-300/50 last:border-0"
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white leading-snug line-clamp-2">{t.statement}</p>
                  <div className="flex items-center gap-2 mt-1 flex-wrap">
                    {t.category && (
                      <span className={cn('text-[10px] font-mono uppercase tracking-wider', CATEGORY_COLORS[t.category] ?? 'text-surface-500')}>
                        {t.category}
                      </span>
                    )}
                    <Badge variant={STATUS_BADGE[t.status] ?? 'proposed'}>
                      {t.status}
                    </Badge>
                    {t.total_votes > 0 && (
                      <span className="text-[10px] font-mono text-surface-500">
                        {t.blue_pct}% for · {t.total_votes.toLocaleString()} votes
                      </span>
                    )}
                  </div>
                </div>
                <ArrowRight className="h-4 w-4 text-surface-500 flex-shrink-0 mt-1" />
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type Phase = 'idle' | 'loading' | 'result' | 'unavailable' | 'error'

export default function SimulatePage() {
  const router = useRouter()
  const [phase, setPhase] = useState<Phase>('idle')
  const [statement, setStatement] = useState('')
  const [category, setCategory] = useState<string | null>(null)
  const [topicId, setTopicId] = useState<string | null>(null)
  const [result, setResult] = useState<SimulationResult | null>(null)
  const [charCount, setCharCount] = useState(0)
  const resultRef = useRef<HTMLDivElement>(null)

  const MAX_CHARS = 400

  function handleTopicSelect(topic: TopicOption) {
    setStatement(topic.statement)
    setCategory(topic.category)
    setTopicId(topic.id)
    setCharCount(topic.statement.length)
  }

  function handleStatementChange(val: string) {
    if (val.length <= MAX_CHARS) {
      setStatement(val)
      setCharCount(val.length)
      // Clear linked topic if user manually edits
      if (topicId) setTopicId(null)
    }
  }

  function handleExampleClick(example: string) {
    setStatement(example)
    setCharCount(example.length)
    setTopicId(null)
    setCategory(null)
  }

  const handleSimulate = useCallback(async () => {
    const trimmed = statement.trim()
    if (trimmed.length < 10 || phase === 'loading') return

    setPhase('loading')
    setResult(null)

    try {
      const res = await fetch('/api/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          statement: trimmed,
          category,
          topic_id: topicId,
        }),
      })

      if (res.status === 401) {
        router.push('/login')
        return
      }

      const data: SimulationResult = await res.json()

      if (data.unavailable) {
        setPhase('unavailable')
        return
      }

      setResult(data)
      setPhase('result')

      // Scroll to results
      setTimeout(() => {
        resultRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      }, 100)
    } catch {
      setPhase('error')
    }
  }, [statement, category, topicId, phase, router])

  function handleReset() {
    setPhase('idle')
    setResult(null)
    setStatement('')
    setCategory(null)
    setTopicId(null)
    setCharCount(0)
  }

  const canSimulate = statement.trim().length >= 10 && phase !== 'loading'

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-4xl mx-auto px-4 pt-6 pb-28 md:pb-12">

        {/* Header */}
        <div className="mb-8">
          <Link
            href="/"
            className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-white transition-colors mb-5"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
            Back
          </Link>
          <div className="flex items-start gap-4">
            <div className="flex-shrink-0 h-12 w-12 bg-purple/20 border border-purple/30 rounded-2xl flex items-center justify-center">
              <FlaskConical className="h-6 w-6 text-purple" aria-hidden />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white font-mono tracking-tight">
                Policy Simulator
              </h1>
              <p className="text-sm text-surface-500 mt-0.5 max-w-xl">
                Enter any policy proposal and Claude will model the realistic downstream consequences — who benefits, who is harmed, and how feasible it really is.
              </p>
            </div>
          </div>
        </div>

        {/* Two-column layout */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">

          {/* ── Left: Input panel ─────────────────────────────────────────── */}
          <div
            className={cn(
              'lg:col-span-2 bg-surface-100 border border-surface-300 rounded-2xl p-5 space-y-5',
              phase === 'result' && 'lg:sticky lg:top-20 lg:self-start',
            )}
          >
            <div>
              <h2 className="text-sm font-mono font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="flex items-center justify-center h-5 w-5 rounded-full bg-purple/20 border border-purple/30 text-[10px] font-bold text-purple">
                  1
                </span>
                Pick a topic
              </h2>
              <TopicSearch onSelect={handleTopicSelect} />
              <p className="text-[11px] text-surface-500 mt-1.5 font-mono">
                Or type your own policy below
              </p>
            </div>

            {/* Statement textarea */}
            <div>
              <h2 className="text-sm font-mono font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="flex items-center justify-center h-5 w-5 rounded-full bg-purple/20 border border-purple/30 text-[10px] font-bold text-purple">
                  2
                </span>
                Policy statement
              </h2>
              <div className="relative">
                <textarea
                  value={statement}
                  onChange={(e) => handleStatementChange(e.target.value)}
                  placeholder="e.g. Universal basic income of $1,000/month should be provided to all citizens"
                  rows={4}
                  className="w-full bg-surface-200/60 border border-surface-300/60 rounded-xl px-4 py-3 text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-purple/50 transition-colors resize-none leading-relaxed"
                />
                <span
                  className={cn(
                    'absolute bottom-2 right-3 text-[10px] font-mono transition-colors',
                    charCount > MAX_CHARS * 0.9 ? 'text-against-400' : 'text-surface-600',
                  )}
                >
                  {charCount}/{MAX_CHARS}
                </span>
              </div>

              {/* Example pills */}
              <div className="mt-2">
                <p className="text-[10px] font-mono text-surface-600 mb-1.5">Examples:</p>
                <div className="flex flex-wrap gap-1.5">
                  {EXAMPLE_STATEMENTS.slice(0, 3).map((ex) => (
                    <button
                      key={ex}
                      onClick={() => handleExampleClick(ex)}
                      className="text-[10px] font-mono text-surface-500 hover:text-white bg-surface-200/40 hover:bg-surface-200 border border-surface-300/40 hover:border-surface-400 rounded-lg px-2.5 py-1 transition-all text-left line-clamp-1 max-w-[200px]"
                    >
                      {ex.slice(0, 45)}{ex.length > 45 ? '…' : ''}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            {/* Category selector */}
            <div>
              <h2 className="text-sm font-mono font-bold text-white uppercase tracking-wider mb-3 flex items-center gap-2">
                <span className="flex items-center justify-center h-5 w-5 rounded-full bg-purple/20 border border-purple/30 text-[10px] font-bold text-purple">
                  3
                </span>
                Category
                <span className="text-[10px] font-mono font-normal text-surface-600 normal-case tracking-normal">
                  (optional)
                </span>
              </h2>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORIES.map((cat) => (
                  <button
                    key={cat}
                    onClick={() => setCategory(category === cat ? null : cat)}
                    className={cn(
                      'px-2.5 py-1 rounded-lg text-[11px] font-mono border transition-all',
                      category === cat
                        ? 'bg-surface-200 border-surface-400 text-white'
                        : 'border-surface-300/40 text-surface-500 hover:border-surface-400 hover:text-surface-400',
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            </div>

            {/* Simulate button */}
            <button
              onClick={handleSimulate}
              disabled={!canSimulate}
              className={cn(
                'w-full flex items-center justify-center gap-2 py-3 rounded-xl font-mono font-bold text-sm transition-all',
                canSimulate
                  ? 'bg-purple hover:bg-purple/90 text-white shadow-lg shadow-purple/20'
                  : 'bg-surface-300/40 text-surface-600 cursor-not-allowed',
              )}
            >
              {phase === 'loading' ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Simulating…
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  Run Simulation
                </>
              )}
            </button>

            {phase === 'result' && (
              <button
                onClick={handleReset}
                className="w-full flex items-center justify-center gap-2 py-2.5 rounded-xl font-mono text-sm text-surface-500 hover:text-white border border-surface-300/60 hover:border-surface-400 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                New simulation
              </button>
            )}
          </div>

          {/* ── Right: Results ────────────────────────────────────────────── */}
          <div className="lg:col-span-3" ref={resultRef}>

            {/* Idle state */}
            {phase === 'idle' && (
              <div className="flex flex-col items-center justify-center h-full min-h-[320px] rounded-2xl bg-surface-100/40 border border-dashed border-surface-300/60 p-8 text-center">
                <div className="h-16 w-16 rounded-2xl bg-purple/10 border border-purple/20 flex items-center justify-center mb-4">
                  <FlaskConical className="h-8 w-8 text-purple/60" />
                </div>
                <h3 className="text-base font-mono font-bold text-white mb-2">
                  Ready to Simulate
                </h3>
                <p className="text-sm text-surface-500 max-w-xs">
                  Choose a topic from the Lobby or enter your own policy statement, then click Run Simulation.
                </p>
                <p className="text-[11px] font-mono text-surface-600 mt-4">
                  Powered by Claude — neutral analysis only
                </p>
              </div>
            )}

            {/* Loading */}
            {phase === 'loading' && (
              <div>
                <div className="mb-4 flex items-center gap-2">
                  <Loader2 className="h-4 w-4 animate-spin text-purple" />
                  <span className="text-sm font-mono text-surface-500">
                    Analyzing policy outcomes…
                  </span>
                </div>
                <SimulateSkeleton />
              </div>
            )}

            {/* Unavailable */}
            {phase === 'unavailable' && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center h-full min-h-[320px] rounded-2xl bg-surface-100 border border-surface-300 p-8 text-center"
              >
                <Bot className="h-10 w-10 text-surface-500 mb-3" />
                <h3 className="text-base font-mono font-bold text-white mb-1">
                  Simulator Unavailable
                </h3>
                <p className="text-sm text-surface-500 mb-5 max-w-xs">
                  The AI analysis service is not available right now. Try again later.
                </p>
                <button
                  onClick={handleReset}
                  className="flex items-center gap-2 px-4 py-2 bg-surface-200 border border-surface-300 rounded-xl text-sm text-white hover:bg-surface-300 transition-colors font-mono"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Reset
                </button>
              </motion.div>
            )}

            {/* Error */}
            {phase === 'error' && (
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                className="flex flex-col items-center justify-center h-full min-h-[320px] rounded-2xl bg-against-500/5 border border-against-500/30 p-8 text-center"
              >
                <XCircle className="h-10 w-10 text-against-400 mb-3" />
                <h3 className="text-base font-mono font-bold text-white mb-1">
                  Simulation Failed
                </h3>
                <p className="text-sm text-surface-500 mb-5 max-w-xs">
                  Something went wrong. Please try again.
                </p>
                <button
                  onClick={() => setPhase('idle')}
                  className="flex items-center gap-2 px-4 py-2 bg-surface-200 border border-surface-300 rounded-xl text-sm text-white hover:bg-surface-300 transition-colors font-mono"
                >
                  <RefreshCw className="h-3.5 w-3.5" />
                  Try again
                </button>
              </motion.div>
            )}

            {/* Result */}
            {phase === 'result' && result && (
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className="space-y-4"
              >
                {/* Header card */}
                <div className="rounded-2xl bg-surface-100 border border-surface-300/60 p-5">
                  {/* Title */}
                  <p className="text-sm text-surface-500 font-mono mb-2 uppercase tracking-wider">
                    Simulating
                  </p>
                  <p className="text-white font-medium leading-snug mb-4">
                    &ldquo;{result.statement}&rdquo;
                  </p>

                  {/* Score + balance row */}
                  <div className="flex items-center gap-4 flex-wrap">
                    <ViabilityRing
                      score={result.viability_score}
                      label={result.viability_label}
                    />
                    <div className="flex flex-col gap-2">
                      <BalanceBadge balance={result.overall_balance} />
                      {result.community_vote && (
                        <div className="flex items-center gap-2 px-3 py-1.5 rounded-xl border border-surface-300/60 bg-surface-200/40">
                          <div className="flex items-center gap-1">
                            <ThumbsUp className="h-3 w-3 text-for-400" />
                            <span className="text-xs font-mono text-for-400 font-bold">
                              {Math.round(result.community_vote.blue_pct)}%
                            </span>
                          </div>
                          <span className="text-[10px] text-surface-500 font-mono">
                            {result.community_vote.total_votes.toLocaleString()} votes
                          </span>
                        </div>
                      )}
                      {topicId && (
                        <Link
                          href={`/topic/${topicId}`}
                          className="flex items-center gap-1.5 text-[11px] font-mono text-surface-500 hover:text-for-400 transition-colors"
                        >
                          <ExternalLink className="h-3 w-3" />
                          View topic
                        </Link>
                      )}
                    </div>
                  </div>
                </div>

                {/* Effects sections */}
                <ResultSection
                  icon={Zap}
                  iconColor="text-for-400"
                  iconBg="bg-for-500/10 border-for-500/30"
                  title="Short-Term Effects (0–2 years)"
                  items={result.short_term}
                  bulletColor="bg-for-500"
                />

                <ResultSection
                  icon={TrendingUp}
                  iconColor="text-gold"
                  iconBg="bg-gold/10 border-gold/30"
                  title="Long-Term Effects (2+ years)"
                  items={result.long_term}
                  bulletColor="bg-gold"
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <ResultSection
                    icon={CheckCircle2}
                    iconColor="text-emerald"
                    iconBg="bg-emerald/10 border-emerald/30"
                    title="Who Benefits"
                    items={result.beneficiaries}
                    bulletColor="bg-emerald"
                  />
                  <ResultSection
                    icon={ThumbsDown}
                    iconColor="text-against-400"
                    iconBg="bg-against-500/10 border-against-500/30"
                    title="Who Is Harmed"
                    items={result.harmed}
                    bulletColor="bg-against-500"
                  />
                </div>

                <ResultSection
                  icon={BookOpen}
                  iconColor="text-purple"
                  iconBg="bg-purple/10 border-purple/30"
                  title="Historical Precedents"
                  items={result.precedents}
                  bulletColor="bg-purple"
                />

                <ResultSection
                  icon={AlertTriangle}
                  iconColor="text-against-300"
                  iconBg="bg-against-500/10 border-against-500/30"
                  title="Key Risks"
                  items={result.risks}
                  bulletColor="bg-against-400"
                />

                {/* CTA footer */}
                <div className="rounded-2xl border border-surface-300/40 bg-surface-100 p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <Bot className="h-4 w-4 text-surface-500 flex-shrink-0" />
                    <p className="text-[11px] font-mono text-surface-500">
                      AI analysis by Claude · For educational purposes only · Not a policy recommendation
                    </p>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    {topicId ? (
                      <Link
                        href={`/spar/${topicId}`}
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-for-600/20 border border-for-500/30 text-for-400 text-[11px] font-mono font-semibold hover:bg-for-600/30 transition-colors"
                      >
                        <Users className="h-3 w-3" />
                        Debate this
                      </Link>
                    ) : (
                      <Link
                        href="/spar"
                        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200/60 border border-surface-300/60 text-surface-400 text-[11px] font-mono font-semibold hover:text-white transition-colors"
                      >
                        <Users className="h-3 w-3" />
                        Debate arena
                      </Link>
                    )}
                    <button
                      onClick={handleReset}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200/60 border border-surface-300/60 text-surface-400 text-[11px] font-mono hover:text-white transition-colors"
                    >
                      <RefreshCw className="h-3 w-3" />
                      New
                    </button>
                  </div>
                </div>
              </motion.div>
            )}
          </div>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
