'use client'

/**
 * /checker — Civic Claim Checker
 *
 * AI-powered tool that checks any claim against the established laws
 * in the Lobby Market Codex. Returns a verdict:
 *
 *   SUPPORTED    — Multiple laws back this claim
 *   CONTRADICTED — Laws conflict with this claim
 *   MIXED        — The Codex has laws on both sides
 *   NOT_COVERED  — No relevant laws exist yet
 *
 * Distinct from /simulate (policy outcome analysis) and /coach
 * (argument writing help). This is pure fact-vs-consensus checking.
 */

import { useCallback, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  ExternalLink,
  Gavel,
  Loader2,
  Scale,
  Search,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  XCircle,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'
import type { CheckerResult, Verdict, RelevantLaw } from '@/app/api/checker/route'

// ─── Constants ────────────────────────────────────────────────────────────────

const CATEGORIES = [
  'All',
  'Economics',
  'Politics',
  'Technology',
  'Science',
  'Ethics',
  'Philosophy',
  'Culture',
  'Health',
  'Environment',
  'Education',
]

const VERDICT_CONFIG: Record<
  Verdict,
  {
    icon: typeof CheckCircle2
    label: string
    color: string
    bg: string
    border: string
    ring: string
    description: string
  }
> = {
  SUPPORTED: {
    icon: CheckCircle2,
    label: 'Supported by the Codex',
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/40',
    ring: 'ring-emerald/20',
    description: 'Established community laws align with this claim.',
  },
  CONTRADICTED: {
    icon: XCircle,
    label: 'Contradicted by the Codex',
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/40',
    ring: 'ring-against-500/20',
    description: 'This claim conflicts with established community laws.',
  },
  MIXED: {
    icon: Scale,
    label: 'Mixed — Codex is divided',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/40',
    ring: 'ring-gold/20',
    description: 'Some laws support this, others contradict it.',
  },
  NOT_COVERED: {
    icon: AlertTriangle,
    label: 'Not covered by the Codex',
    color: 'text-surface-500',
    bg: 'bg-surface-200',
    border: 'border-surface-400',
    ring: 'ring-surface-400/20',
    description: 'The community hasn\'t yet established laws on this topic.',
  },
}

const RELATION_CONFIG: Record<
  RelevantLaw['relation'],
  { icon: typeof ThumbsUp; color: string; bg: string; label: string }
> = {
  supports:    { icon: ThumbsUp,    color: 'text-emerald',     bg: 'bg-emerald/10',     label: 'Supports' },
  contradicts: { icon: ThumbsDown,  color: 'text-against-400', bg: 'bg-against-500/10', label: 'Contradicts' },
  neutral:     { icon: Scale,       color: 'text-surface-500', bg: 'bg-surface-300/40', label: 'Related' },
}

const CATEGORY_COLORS: Record<string, string> = {
  Economics: 'text-gold',
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-300',
  Philosophy: 'text-for-300',
  Culture: 'text-gold',
  Health: 'text-against-300',
  Environment: 'text-emerald',
  Education: 'text-purple',
}

const EXAMPLE_CLAIMS = [
  'The government should prioritize economic growth over environmental protection.',
  'Privacy is more important than national security.',
  'Technology companies should be regulated like public utilities.',
  'Universal basic income would reduce poverty effectively.',
  'Free speech should have limits to protect public safety.',
]

// ─── Sub-components ───────────────────────────────────────────────────────────

function ConfidenceBar({ confidence, color }: { confidence: number; color: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-mono text-surface-500 uppercase tracking-widest">Confidence</span>
        <span className={cn('text-sm font-mono font-bold', color)}>{confidence}%</span>
      </div>
      <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', {
            'bg-emerald': confidence >= 70,
            'bg-gold': confidence >= 40 && confidence < 70,
            'bg-against-500': confidence < 40,
          })}
          initial={{ width: 0 }}
          animate={{ width: `${confidence}%` }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
        />
      </div>
    </div>
  )
}

function LawRow({ law, index }: { law: RelevantLaw; index: number }) {
  const [expanded, setExpanded] = useState(false)
  const rel = RELATION_CONFIG[law.relation]
  const RelIcon = rel.icon
  const catColor = CATEGORY_COLORS[law.category ?? ''] ?? 'text-surface-500'

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.05 * index }}
      className="rounded-xl bg-surface-200 border border-surface-300 overflow-hidden"
    >
      <button
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-start gap-3 p-4 text-left hover:bg-surface-300/50 transition-colors"
      >
        {/* Relation badge */}
        <div className={cn('flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-lg mt-0.5', rel.bg)}>
          <RelIcon className={cn('h-3.5 w-3.5', rel.color)} />
        </div>

        <div className="flex-1 min-w-0">
          <div className="flex items-start gap-2 mb-1">
            <span className={cn('text-[10px] font-mono font-semibold uppercase tracking-widest flex-shrink-0 mt-0.5', rel.color)}>
              {rel.label}
            </span>
            {law.category && (
              <span className={cn('text-[10px] font-mono uppercase tracking-widest', catColor)}>
                · {law.category}
              </span>
            )}
          </div>
          <p className="text-sm text-white font-medium leading-snug line-clamp-2">
            {law.statement}
          </p>
          <div className="flex items-center gap-3 mt-1.5">
            <span className="text-[11px] text-for-400 font-mono">{law.blue_pct}% For</span>
            <span className="text-[11px] text-surface-500">{law.total_votes.toLocaleString()} votes</span>
          </div>
        </div>

        <div className="flex-shrink-0 flex items-center gap-2 ml-2">
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-surface-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-surface-500" />
          )}
        </div>
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
            <div className="px-4 pb-4 pt-0 border-t border-surface-300 space-y-3">
              {law.explanation && (
                <p className="text-sm text-surface-600 leading-relaxed mt-3">
                  {law.explanation}
                </p>
              )}
              <Link
                href={`/topic/${law.id}`}
                className="inline-flex items-center gap-1.5 text-xs text-for-400 hover:text-for-300 font-mono transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                View topic
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── Main Page ────────────────────────────────────────────────────────────────

export default function CheckerPage() {
  const [claim, setClaim] = useState('')
  const [category, setCategory] = useState('All')
  const [loading, setLoading] = useState(false)
  const [result, setResult] = useState<CheckerResult | null>(null)
  const [error, setError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const resultsRef = useRef<HTMLDivElement>(null)

  const runCheck = useCallback(async (claimText: string, cat: string) => {
    const trimmed = claimText.trim()
    if (!trimmed || trimmed.length < 10) return

    setLoading(true)
    setResult(null)
    setError(null)

    try {
      const res = await fetch('/api/checker', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ claim: trimmed, category: cat }),
      })

      if (res.status === 401) {
        setError('Sign in to use the Civic Claim Checker.')
        return
      }

      const data: CheckerResult = await res.json()

      if (data.unavailable) {
        setError('AI service is currently unavailable. Try again shortly.')
        return
      }
      if (data.error) {
        setError(data.error)
        return
      }

      setResult(data)
      setTimeout(() => resultsRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  const handleSubmit = useCallback(
    (e: React.FormEvent) => {
      e.preventDefault()
      runCheck(claim, category)
    },
    [claim, category, runCheck]
  )

  const handleExample = useCallback(
    (example: string) => {
      setClaim(example)
      textareaRef.current?.focus()
    },
    []
  )

  const verdictCfg = result ? VERDICT_CONFIG[result.verdict] : null
  const VerdictIcon = verdictCfg?.icon

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => window.history.back()}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h1 className="text-xl font-bold text-white font-mono">Civic Claim Checker</h1>
            <p className="text-xs text-surface-500 mt-0.5">
              Check any claim against the Codex — the community&apos;s established consensus laws
            </p>
          </div>
        </div>

        {/* ── Explainer strip ─────────────────────────────────────────────── */}
        <div className="flex items-start gap-3 rounded-xl bg-surface-100 border border-surface-300 p-4 mb-6">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-for-500/10 border border-for-500/20 flex-shrink-0">
            <Scale className="h-4 w-4 text-for-400" />
          </div>
          <div>
            <p className="text-xs text-surface-600 leading-relaxed">
              Enter any claim or policy position. Claude will compare it against the laws that Lobby Market citizens have democratically established and return a verdict with supporting evidence from the Codex.
            </p>
          </div>
        </div>

        {/* ── Input form ──────────────────────────────────────────────────── */}
        <form onSubmit={handleSubmit} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-4">

          {/* Category filter */}
          <div className="mb-4">
            <label className="block text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest mb-2">
              Focus Category (optional)
            </label>
            <div className="flex flex-wrap gap-1.5">
              {CATEGORIES.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setCategory(cat)}
                  className={cn(
                    'px-2.5 py-1 rounded-lg text-xs font-mono transition-colors',
                    category === cat
                      ? 'bg-for-600 text-white'
                      : 'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white'
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          {/* Claim textarea */}
          <div className="mb-4">
            <label htmlFor="claim" className="block text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest mb-2">
              Your Claim
            </label>
            <textarea
              id="claim"
              ref={textareaRef}
              value={claim}
              onChange={(e) => setClaim(e.target.value)}
              placeholder="e.g. The government should prioritize economic growth over environmental protection."
              rows={3}
              maxLength={500}
              className="w-full rounded-xl bg-surface-200 border border-surface-300 text-white placeholder-surface-500 text-sm px-4 py-3 resize-none focus:outline-none focus:ring-2 focus:ring-for-500/40 focus:border-for-500/50 transition-colors"
            />
            <div className="flex items-center justify-between mt-1.5">
              <span className="text-[11px] text-surface-500">{claim.length}/500</span>
              {claim.length < 10 && claim.length > 0 && (
                <span className="text-[11px] text-against-400">Minimum 10 characters</span>
              )}
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading || claim.trim().length < 10}
            className={cn(
              'w-full flex items-center justify-center gap-2 px-4 py-3 rounded-xl font-mono font-semibold text-sm transition-all',
              loading || claim.trim().length < 10
                ? 'bg-surface-300 text-surface-500 cursor-not-allowed'
                : 'bg-for-600 hover:bg-for-500 text-white focus:outline-none focus:ring-2 focus:ring-for-500/50'
            )}
          >
            {loading ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Checking against {category === 'All' ? 'the Codex' : category + ' laws'}…
              </>
            ) : (
              <>
                <Sparkles className="h-4 w-4" />
                Check this Claim
              </>
            )}
          </button>
        </form>

        {/* ── Example claims ──────────────────────────────────────────────── */}
        {!result && !loading && (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-6">
            <h3 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest mb-3">
              Try an example
            </h3>
            <div className="space-y-2">
              {EXAMPLE_CLAIMS.map((example, i) => (
                <button
                  key={i}
                  type="button"
                  onClick={() => handleExample(example)}
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-xl bg-surface-200 hover:bg-surface-300 text-left transition-colors group"
                >
                  <Search className="h-3.5 w-3.5 text-surface-500 group-hover:text-for-400 flex-shrink-0 transition-colors" />
                  <span className="text-sm text-surface-600 group-hover:text-white transition-colors">{example}</span>
                  <ArrowRight className="h-3.5 w-3.5 text-surface-500 group-hover:text-for-400 flex-shrink-0 ml-auto transition-colors" />
                </button>
              ))}
            </div>
          </div>
        )}

        {/* ── Error state ─────────────────────────────────────────────────── */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 8 }}
              className="rounded-xl bg-against-500/10 border border-against-500/30 p-4 mb-4 flex items-start gap-3"
            >
              <AlertTriangle className="h-4 w-4 text-against-400 flex-shrink-0 mt-0.5" />
              <p className="text-sm text-against-300">{error}</p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Results ─────────────────────────────────────────────────────── */}
        <AnimatePresence>
          {result && verdictCfg && VerdictIcon && (
            <div ref={resultsRef} className="space-y-4">

              {/* Verdict card */}
              <motion.div
                initial={{ opacity: 0, y: 16 }}
                animate={{ opacity: 1, y: 0 }}
                className={cn(
                  'rounded-2xl border p-5 ring-1',
                  verdictCfg.bg,
                  verdictCfg.border,
                  verdictCfg.ring
                )}
              >
                <div className="flex items-start gap-4">
                  <div className={cn('flex items-center justify-center h-12 w-12 rounded-xl flex-shrink-0', verdictCfg.bg, 'border', verdictCfg.border)}>
                    <VerdictIcon className={cn('h-6 w-6', verdictCfg.color)} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className={cn('text-xs font-mono font-semibold uppercase tracking-widest mb-1', verdictCfg.color)}>
                      Verdict
                    </p>
                    <h2 className="text-lg font-bold text-white font-mono mb-0.5">{verdictCfg.label}</h2>
                    <p className="text-xs text-surface-500">{verdictCfg.description}</p>
                  </div>
                </div>

                {/* Confidence bar */}
                <div className="mt-5 pt-4 border-t border-surface-300/40">
                  <ConfidenceBar confidence={result.confidence} color={verdictCfg.color} />
                </div>

                {/* Summary */}
                {result.summary && (
                  <div className="mt-4 pt-4 border-t border-surface-300/40">
                    <p className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest mb-2">
                      AI Analysis
                    </p>
                    <p className="text-sm text-surface-600 leading-relaxed">{result.summary}</p>
                  </div>
                )}

                {/* Stats row */}
                <div className="mt-4 pt-4 border-t border-surface-300/40 flex items-center gap-4">
                  <div className="flex items-center gap-1.5">
                    <BookOpen className="h-3.5 w-3.5 text-surface-500" />
                    <span className="text-xs text-surface-500">
                      <span className="text-white font-mono font-semibold">{result.laws_checked}</span> laws checked
                    </span>
                  </div>
                  {result.relevant_laws.length > 0 && (
                    <div className="flex items-center gap-1.5">
                      <Gavel className="h-3.5 w-3.5 text-surface-500" />
                      <span className="text-xs text-surface-500">
                        <span className="text-white font-mono font-semibold">{result.relevant_laws.length}</span> relevant laws found
                      </span>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Claimed text recap */}
              <div className="rounded-xl bg-surface-100 border border-surface-300 px-4 py-3">
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-1">Claim checked</p>
                <p className="text-sm text-surface-700 italic leading-relaxed">&ldquo;{result.claim}&rdquo;</p>
              </div>

              {/* Relevant laws */}
              {result.relevant_laws.length > 0 && (
                <div>
                  <h3 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest mb-3 flex items-center gap-2">
                    <Gavel className="h-3.5 w-3.5" />
                    Relevant Codex Laws
                  </h3>
                  <div className="space-y-2">
                    {result.relevant_laws.map((law, i) => (
                      <LawRow key={law.id} law={law} index={i} />
                    ))}
                  </div>
                </div>
              )}

              {/* NOT_COVERED CTA */}
              {result.verdict === 'NOT_COVERED' && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.3 }}
                  className="rounded-2xl bg-surface-100 border border-surface-300 p-5 text-center"
                >
                  <Zap className="h-8 w-8 text-for-400 mx-auto mb-3" />
                  <h3 className="font-mono font-bold text-white mb-2">This topic isn&apos;t covered yet</h3>
                  <p className="text-sm text-surface-500 mb-4 max-w-xs mx-auto">
                    Be the first to propose a topic on this issue and let the community decide.
                  </p>
                  <Link
                    href="/topic/create"
                    className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-for-600 hover:bg-for-500 text-white text-sm font-mono font-semibold transition-colors"
                  >
                    Propose a Topic
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </motion.div>
              )}

              {/* Reset */}
              <button
                onClick={() => {
                  setResult(null)
                  setClaim('')
                  textareaRef.current?.focus()
                  window.scrollTo({ top: 0, behavior: 'smooth' })
                }}
                className="w-full text-center text-sm text-surface-500 hover:text-white py-3 transition-colors font-mono"
              >
                ← Check another claim
              </button>

            </div>
          )}
        </AnimatePresence>

        {/* ── How it works ─────────────────────────────────────────────────── */}
        {!result && !loading && (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mt-6">
            <h3 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest mb-4 flex items-center gap-2">
              <Sparkles className="h-3.5 w-3.5" />
              How it works
            </h3>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {[
                {
                  icon: Search,
                  color: 'text-for-400',
                  bg: 'bg-for-500/10',
                  title: 'You submit a claim',
                  desc: 'Any statement, position, or policy idea you want to fact-check against community consensus.',
                },
                {
                  icon: BookOpen,
                  color: 'text-purple',
                  bg: 'bg-purple/10',
                  title: 'We check the Codex',
                  desc: 'Claude analyzes your claim against all laws democratically established by Lobby Market citizens.',
                },
                {
                  icon: Gavel,
                  color: 'text-gold',
                  bg: 'bg-gold/10',
                  title: 'Get a verdict',
                  desc: 'Supported, Contradicted, Mixed, or Not Covered — with the specific laws that led to that verdict.',
                },
              ].map((step, i) => {
                const StepIcon = step.icon
                return (
                  <div key={i} className="flex flex-col items-start gap-2">
                    <div className={cn('flex items-center justify-center h-8 w-8 rounded-lg', step.bg)}>
                      <StepIcon className={cn('h-4 w-4', step.color)} />
                    </div>
                    <p className="text-xs font-mono font-semibold text-white">{step.title}</p>
                    <p className="text-xs text-surface-500 leading-relaxed">{step.desc}</p>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Nav links ────────────────────────────────────────────────────── */}
        <div className="mt-6 flex items-center justify-center gap-4 text-xs text-surface-500">
          <Link href="/simulate" className="hover:text-for-400 transition-colors font-mono">
            Policy Simulator →
          </Link>
          <Link href="/law" className="hover:text-gold transition-colors font-mono">
            Browse the Codex →
          </Link>
          <Link href="/coach" className="hover:text-purple transition-colors font-mono">
            Argument Coach →
          </Link>
        </div>

      </main>
      <BottomNav />
    </div>
  )
}
