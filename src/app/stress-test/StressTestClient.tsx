'use client'

/**
 * /stress-test — Civic Argument Stress Tester
 *
 * Submit any civic argument → get it attacked from 5 angles:
 * Empirical, Logical, Practical, Systemic, Alternatives.
 * Each vector gets a vulnerability score 1-10 and a defense tip.
 *
 * Distinct from:
 *   /coach   — critiques your draft argument broadly
 *   /spar    — live AI debate opponent
 *   /steelman — generates best version of both sides
 *   /workshop — step-by-step guided builder
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Loader2,
  RefreshCw,
  Search,
  Shield,
  ShieldAlert,
  ShieldCheck,
  ShieldOff,
  Sparkles,
  X,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'
import type { StressTestResponse, StressVector, AttackVector } from '@/app/api/stress-test/route'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TopicOption {
  id: string
  statement: string
  category: string | null
  blue_pct: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function vulnerabilityLabel(score: number): { label: string; color: string; bg: string } {
  if (score <= 3) return { label: 'Resilient', color: 'text-emerald', bg: 'bg-emerald/10 border-emerald/30' }
  if (score <= 6) return { label: 'Moderate', color: 'text-gold', bg: 'bg-gold/10 border-gold/30' }
  return { label: 'Vulnerable', color: 'text-against-400', bg: 'bg-against-500/10 border-against-500/30' }
}

function overallGrade(score: number): { grade: string; label: string; color: string; Icon: typeof Shield } {
  if (score <= 3) return { grade: 'A', label: 'Fortress', color: 'text-emerald', Icon: ShieldCheck }
  if (score <= 5) return { grade: 'B', label: 'Solid', color: 'text-for-400', Icon: Shield }
  if (score <= 7) return { grade: 'C', label: 'Exposed', color: 'text-gold', Icon: ShieldAlert }
  return { grade: 'D', label: 'Fragile', color: 'text-against-400', Icon: ShieldOff }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function VulnerabilityBar({ score }: { score: number }) {
  const { color } = vulnerabilityLabel(score)
  return (
    <div className="relative h-1.5 w-full rounded-full bg-surface-300/60 overflow-hidden">
      <motion.div
        className={cn('h-full rounded-full', {
          'bg-emerald': score <= 3,
          'bg-gold': score > 3 && score <= 6,
          'bg-against-500': score > 6,
        })}
        initial={{ width: 0 }}
        animate={{ width: `${score * 10}%` }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />
    </div>
  )
}

function ScoreDial({ score }: { score: number }) {
  const { grade, label, color, Icon } = overallGrade(score)
  const circumference = 2 * Math.PI * 36
  const strokeDashoffset = circumference - (circumference * score) / 10

  return (
    <div className="flex flex-col items-center gap-2">
      <div className="relative w-24 h-24">
        <svg className="w-full h-full -rotate-90" viewBox="0 0 80 80">
          <circle cx="40" cy="40" r="36" fill="none" stroke="#2a2a3a" strokeWidth="6" />
          <motion.circle
            cx="40"
            cy="40"
            r="36"
            fill="none"
            strokeWidth="6"
            strokeLinecap="round"
            strokeDasharray={circumference}
            initial={{ strokeDashoffset: circumference }}
            animate={{ strokeDashoffset }}
            transition={{ duration: 0.8, ease: 'easeOut' }}
            className={cn({
              'stroke-emerald': score <= 3,
              'stroke-for-400': score > 3 && score <= 5,
              'stroke-gold': score > 5 && score <= 7,
              'stroke-against-500': score > 7,
            })}
          />
        </svg>
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn('text-2xl font-bold font-mono', color)}>{grade}</span>
          <span className="text-[10px] font-mono text-surface-500">{score}/10</span>
        </div>
      </div>
      <div className="flex items-center gap-1.5">
        <Icon className={cn('h-3.5 w-3.5', color)} />
        <span className={cn('text-xs font-mono font-semibold', color)}>{label}</span>
      </div>
    </div>
  )
}

function VectorCard({ vector, index }: { vector: StressVector; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const { label, color, bg } = vulnerabilityLabel(vector.vulnerability)

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className="rounded-xl border border-surface-300/60 bg-surface-100 overflow-hidden"
    >
      {/* Header */}
      <button
        onClick={() => setExpanded(!expanded)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-surface-200/50 transition-colors"
      >
        <span className="text-xl leading-none mt-0.5">{vector.icon}</span>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1.5">
            <span className="text-sm font-mono font-semibold text-white">{vector.label}</span>
            <span className={cn('text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border', bg, color)}>
              {label} · {vector.vulnerability}/10
            </span>
          </div>
          <VulnerabilityBar score={vector.vulnerability} />
        </div>
        {expanded ? (
          <ChevronUp className="h-4 w-4 text-surface-500 flex-shrink-0 mt-0.5" />
        ) : (
          <ChevronDown className="h-4 w-4 text-surface-500 flex-shrink-0 mt-0.5" />
        )}
      </button>

      {/* Expanded detail */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-3 border-t border-surface-300/60 pt-3">
              <div>
                <p className="text-[10px] font-mono font-semibold text-surface-500 uppercase tracking-wider mb-1.5">
                  Counter-Argument
                </p>
                <p className="text-sm text-surface-700 leading-relaxed">{vector.counter}</p>
              </div>
              <div className="rounded-lg bg-surface-200/60 border border-surface-300/40 p-3">
                <p className="text-[10px] font-mono font-semibold text-emerald uppercase tracking-wider mb-1">
                  💪 Defense Tip
                </p>
                <p className="text-xs text-surface-600 leading-relaxed">{vector.defense_tip}</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function StressTestClient() {
  const [step, setStep] = useState<'input' | 'testing' | 'results'>('input')
  const [argument, setArgument] = useState('')
  const [topicContext, setTopicContext] = useState('')
  const [topicSearch, setTopicSearch] = useState('')
  const [topics, setTopics] = useState<TopicOption[]>([])
  const [topicsLoading, setTopicsLoading] = useState(false)
  const [selectedTopic, setSelectedTopic] = useState<TopicOption | null>(null)
  const [result, setResult] = useState<StressTestResponse | null>(null)
  const [error, setError] = useState<string | null>(null)
  const searchTimeout = useRef<ReturnType<typeof setTimeout> | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    const el = textareaRef.current
    if (!el) return
    el.style.height = 'auto'
    el.style.height = `${el.scrollHeight}px`
  }, [argument])

  // Topic search with debounce
  useEffect(() => {
    if (topicSearch.trim().length < 2) {
      setTopics([])
      return
    }
    if (searchTimeout.current) clearTimeout(searchTimeout.current)
    setTopicsLoading(true)
    searchTimeout.current = setTimeout(async () => {
      try {
        const supabase = createClient()
        const { data } = await supabase
          .from('topics')
          .select('id, statement, category, blue_pct')
          .or(`statement.ilike.%${topicSearch}%,category.ilike.%${topicSearch}%`)
          .in('status', ['active', 'voting'])
          .order('total_votes', { ascending: false })
          .limit(6)
        setTopics((data ?? []) as TopicOption[])
      } catch {
        setTopics([])
      } finally {
        setTopicsLoading(false)
      }
    }, 300)
    return () => {
      if (searchTimeout.current) clearTimeout(searchTimeout.current)
    }
  }, [topicSearch])

  const runTest = useCallback(async () => {
    if (!argument.trim() || argument.trim().length < 20) return
    setStep('testing')
    setError(null)

    try {
      const res = await fetch('/api/stress-test', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          argument: argument.trim(),
          topic_context: topicContext || undefined,
        }),
      })

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: 'Unknown error' }))
        throw new Error((err as { error?: string }).error ?? 'Request failed')
      }

      const data = (await res.json()) as StressTestResponse
      setResult(data)
      setStep('results')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong. Please try again.')
      setStep('input')
    }
  }, [argument, topicContext])

  const reset = useCallback(() => {
    setStep('input')
    setResult(null)
    setError(null)
    setArgument('')
    setTopicContext('')
    setTopicSearch('')
    setSelectedTopic(null)
    setTopics([])
  }, [])

  const charCount = argument.trim().length
  const canRun = charCount >= 20 && charCount <= 2000

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-8 pb-28 md:pb-12">

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="mb-8">
          <Link
            href="/explore"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-700 transition-colors mb-5"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Explore Features
          </Link>
          <div className="flex items-start gap-4">
            <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-against-500/10 border border-against-500/30 flex-shrink-0">
              <ShieldAlert className="h-6 w-6 text-against-400" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Argument Stress Test</h1>
              <p className="text-sm text-surface-500 font-mono mt-1">
                Attack your argument from 5 angles — before your opponents do.
              </p>
            </div>
          </div>
        </div>

        {/* ── Input step ───────────────────────────────────────────────── */}
        {step === 'input' && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} className="space-y-5">

            {/* Argument input */}
            <div>
              <div className="flex items-center justify-between mb-2">
                <label className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider">
                  Your Argument
                </label>
                <span className={cn('text-[10px] font-mono', charCount > 2000 ? 'text-against-400' : charCount >= 20 ? 'text-emerald' : 'text-surface-500')}>
                  {charCount}/2000
                </span>
              </div>
              <div className="relative">
                <textarea
                  ref={textareaRef}
                  value={argument}
                  onChange={(e) => setArgument(e.target.value)}
                  placeholder="Paste or type the argument you want to stress test. It can be one of your own arguments, something you read, or a position you're considering..."
                  className="w-full min-h-[140px] px-4 py-3 rounded-xl bg-surface-200/60 border border-surface-300/60 text-sm text-white placeholder:text-surface-500 resize-none focus:outline-none focus:border-against-500/50 focus:ring-1 focus:ring-against-500/20 transition-colors leading-relaxed"
                  rows={5}
                />
                {argument && (
                  <button
                    onClick={() => setArgument('')}
                    className="absolute top-3 right-3 text-surface-500 hover:text-surface-700 transition-colors"
                  >
                    <X className="h-4 w-4" />
                  </button>
                )}
              </div>
              {error && (
                <p className="mt-2 text-xs text-against-400 font-mono">{error}</p>
              )}
            </div>

            {/* Optional topic context */}
            <div>
              <label className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider mb-2 block">
                Civic Topic (optional)
              </label>
              <p className="text-xs text-surface-500 font-mono mb-3">
                Link to an active debate for more relevant stress testing.
              </p>
              {selectedTopic ? (
                <div className="flex items-start gap-2 p-3 rounded-xl bg-surface-200/60 border border-surface-300/60">
                  <CheckCircle2 className="h-4 w-4 text-emerald flex-shrink-0 mt-0.5" />
                  <div className="flex-1 min-w-0">
                    <p className="text-xs text-white font-mono line-clamp-2">{selectedTopic.statement}</p>
                    <p className="text-[10px] text-surface-500 font-mono mt-0.5">
                      {selectedTopic.category} · {Math.round(selectedTopic.blue_pct ?? 50)}% FOR
                    </p>
                  </div>
                  <button
                    onClick={() => {
                      setSelectedTopic(null)
                      setTopicContext('')
                      setTopicSearch('')
                    }}
                    className="text-surface-500 hover:text-surface-700 transition-colors flex-shrink-0"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 pointer-events-none" />
                  <input
                    value={topicSearch}
                    onChange={(e) => setTopicSearch(e.target.value)}
                    placeholder="Search debates…"
                    className="w-full pl-9 pr-4 py-2.5 rounded-xl bg-surface-200/60 border border-surface-300/60 text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-surface-400 focus:ring-1 focus:ring-surface-400/20 transition-colors"
                  />
                  {topicsLoading && (
                    <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 animate-spin" />
                  )}
                  {topics.length > 0 && (
                    <div className="absolute top-full mt-1 left-0 right-0 z-10 rounded-xl bg-surface-200 border border-surface-300/60 shadow-xl overflow-hidden">
                      {topics.map((t) => (
                        <button
                          key={t.id}
                          onClick={() => {
                            setSelectedTopic(t)
                            setTopicContext(`Civic debate: "${t.statement}" — ${Math.round(t.blue_pct ?? 50)}% FOR on the platform.`)
                            setTopics([])
                            setTopicSearch('')
                          }}
                          className="w-full flex items-start gap-2.5 px-3 py-2.5 text-left hover:bg-surface-300/50 transition-colors border-b border-surface-300/40 last:border-0"
                        >
                          <span className="text-xs text-white font-mono line-clamp-2 flex-1">{t.statement}</span>
                          <span className="text-[10px] text-surface-500 font-mono flex-shrink-0 mt-0.5">{t.category}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* What this does */}
            <div className="rounded-xl border border-surface-300/40 bg-surface-200/30 p-4 space-y-2">
              <p className="text-[10px] font-mono font-semibold text-surface-500 uppercase tracking-wider">5 Attack Vectors</p>
              <div className="grid grid-cols-1 gap-1.5">
                {[
                  { icon: '🔬', label: 'Empirical', desc: 'Are the facts actually right?' },
                  { icon: '⚖️', label: 'Logical', desc: 'Does the reasoning hold up?' },
                  { icon: '🔧', label: 'Practical', desc: 'Can this actually work?' },
                  { icon: '🌐', label: 'Systemic', desc: 'What are the knock-on effects?' },
                  { icon: '💡', label: 'Alternatives', desc: 'Is there a better solution?' },
                ].map(({ icon, label, desc }) => (
                  <div key={label} className="flex items-center gap-2">
                    <span className="text-base">{icon}</span>
                    <span className="text-xs font-mono font-semibold text-surface-600">{label}</span>
                    <span className="text-xs text-surface-500 font-mono">— {desc}</span>
                  </div>
                ))}
              </div>
            </div>

            {/* Run button */}
            <button
              onClick={runTest}
              disabled={!canRun}
              className={cn(
                'w-full flex items-center justify-center gap-2 py-3.5 rounded-xl font-mono font-semibold text-sm transition-all',
                canRun
                  ? 'bg-against-500 hover:bg-against-600 text-white shadow-lg shadow-against-500/20'
                  : 'bg-surface-200 text-surface-500 cursor-not-allowed',
              )}
            >
              <Zap className="h-4 w-4" />
              Run Stress Test
            </button>

            <p className="text-center text-[10px] font-mono text-surface-500">
              20–2000 characters · Results in ~5 seconds
            </p>
          </motion.div>
        )}

        {/* ── Testing step ─────────────────────────────────────────────── */}
        {step === 'testing' && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center justify-center py-20 gap-6"
          >
            <div className="relative">
              <div className="h-16 w-16 rounded-full border-2 border-surface-300/60 flex items-center justify-center">
                <ShieldAlert className="h-7 w-7 text-against-400" />
              </div>
              <div className="absolute inset-0 rounded-full border-2 border-against-500/40 animate-ping" />
            </div>
            <div className="text-center space-y-2">
              <p className="text-white font-mono font-semibold">Running stress test…</p>
              <div className="space-y-1">
                {['Empirical', 'Logical', 'Practical', 'Systemic', 'Alternatives'].map((v, i) => (
                  <motion.div
                    key={v}
                    initial={{ opacity: 0, x: -10 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ delay: i * 0.4 + 0.3 }}
                    className="flex items-center gap-2 justify-center"
                  >
                    <Loader2 className="h-3 w-3 text-against-400 animate-spin" />
                    <span className="text-xs font-mono text-surface-500">{v} analysis…</span>
                  </motion.div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── Results step ─────────────────────────────────────────────── */}
        {step === 'results' && result && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-6">

            {/* Overall verdict */}
            <div className="rounded-xl border border-surface-300/60 bg-surface-100 p-5">
              <div className="flex items-start gap-4">
                <ScoreDial score={result.overall_score} />
                <div className="flex-1 min-w-0 pt-1">
                  <p className="text-[10px] font-mono font-semibold text-surface-500 uppercase tracking-wider mb-2">
                    Stress Test Verdict
                  </p>
                  <p className="text-sm text-surface-700 leading-relaxed">{result.summary}</p>
                  {result.weakest_point && (
                    <div className="mt-3 flex items-start gap-2 p-2.5 rounded-lg bg-against-500/10 border border-against-500/20">
                      <AlertTriangle className="h-3.5 w-3.5 text-against-400 flex-shrink-0 mt-0.5" />
                      <p className="text-xs text-surface-600 font-mono leading-relaxed">{result.weakest_point}</p>
                    </div>
                  )}
                </div>
              </div>
            </div>

            {/* Vector cards */}
            <div>
              <p className="text-[10px] font-mono font-semibold text-surface-500 uppercase tracking-wider mb-3">
                Attack Vectors
              </p>
              <div className="space-y-2">
                {result.vectors.map((v, i) => (
                  <VectorCard key={v.type} vector={v} index={i} />
                ))}
              </div>
            </div>

            {/* CTA strip */}
            <div className="grid grid-cols-2 gap-3">
              <Link
                href="/workshop"
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-surface-200 hover:bg-surface-300 transition-colors text-xs font-mono text-surface-600 hover:text-white border border-surface-300/60"
              >
                <Sparkles className="h-3.5 w-3.5" />
                Rebuild in Workshop
              </Link>
              <Link
                href="/steelman"
                className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl bg-surface-200 hover:bg-surface-300 transition-colors text-xs font-mono text-surface-600 hover:text-white border border-surface-300/60"
              >
                <ArrowRight className="h-3.5 w-3.5" />
                Try Steelman Engine
              </Link>
            </div>

            {/* Reset */}
            <button
              onClick={reset}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-xl border border-surface-300/60 text-xs font-mono text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Test Another Argument
            </button>
          </motion.div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
