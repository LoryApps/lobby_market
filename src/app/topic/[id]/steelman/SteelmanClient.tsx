'use client'

/**
 * /topic/[id]/steelman — Per-Topic Steelman Engine
 *
 * Generates the strongest possible case FOR and AGAINST a specific
 * civic debate — using the actual community vote as context.
 *
 * Distinct from:
 *   /steelman       — general steelman for any user-entered statement
 *   /topic/[id]/argue — quick argument starter bullets
 *   /topic/[id]/synthesis — AI-generated common ground (different lens)
 *   /topic/[id]/brief — debate dossier with research context
 *
 * This page represents each side at its most rigorous and charitable,
 * showing what a thoughtful proponent would actually argue.
 */

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  Brain,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Copy,
  ExternalLink,
  GitMerge,
  Loader2,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'
import type { SteelmanResult, SteelmanArgument } from '@/app/api/steelman/route'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SteelmanClientProps {
  topicId: string
  statement: string
  category: string | null
  status: string
  bluePct: number
  totalVotes: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

// ─── Argument Section ─────────────────────────────────────────────────────────

interface ArgSectionProps {
  side: 'for' | 'against'
  arg: SteelmanArgument
  defaultExpanded?: boolean
}

function ArgSection({ side, arg, defaultExpanded = false }: ArgSectionProps) {
  const [expanded, setExpanded] = useState(defaultExpanded)
  const [copied, setCopied] = useState(false)

  const isFor = side === 'for'

  const fullText = [
    arg.thesis,
    '',
    'Core claims:',
    ...arg.core_claims.map((c) => `• ${c}`),
    '',
    `Strongest evidence: ${arg.strongest_evidence}`,
    '',
    `Moral foundation: ${arg.moral_foundation}`,
    '',
    `Rebuttal to opposition: ${arg.rebuttal_to_opposition}`,
  ].join('\n')

  function handleCopy() {
    navigator.clipboard.writeText(fullText).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border p-5 transition-all',
        isFor
          ? 'border-for-500/40 bg-for-500/5'
          : 'border-against-500/40 bg-against-500/5',
      )}
    >
      {/* Side header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'flex items-center justify-center h-7 w-7 rounded-lg',
              isFor ? 'bg-for-500/20' : 'bg-against-500/20',
            )}
          >
            {isFor ? (
              <ThumbsUp className={cn('h-3.5 w-3.5', 'text-for-400')} />
            ) : (
              <ThumbsDown className={cn('h-3.5 w-3.5', 'text-against-400')} />
            )}
          </div>
          <span
            className={cn(
              'font-mono text-xs font-bold uppercase tracking-widest',
              isFor ? 'text-for-400' : 'text-against-400',
            )}
          >
            {isFor ? 'The Case For' : 'The Case Against'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1 text-xs font-mono text-surface-500 hover:text-white transition-colors px-2 py-1 rounded-lg hover:bg-surface-200"
          >
            {copied ? <Check className="h-3 w-3 text-emerald" /> : <Copy className="h-3 w-3" />}
            {copied ? 'Copied' : 'Copy'}
          </button>
          <button
            onClick={() => setExpanded((p) => !p)}
            className="text-surface-500 hover:text-white transition-colors p-1 rounded-lg hover:bg-surface-200"
          >
            {expanded ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Thesis — always visible */}
      <p
        className={cn(
          'font-mono text-sm font-semibold leading-relaxed',
          isFor ? 'text-for-300' : 'text-against-300',
        )}
      >
        {arg.thesis}
      </p>

      {/* Expanded detail */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="detail"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.25 }}
            className="overflow-hidden"
          >
            <div className="mt-4 space-y-4">
              {/* Core claims */}
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-surface-500 mb-2">
                  Core Claims
                </p>
                <ul className="space-y-1.5">
                  {arg.core_claims.map((claim, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span
                        className={cn(
                          'mt-0.5 flex-shrink-0 h-1.5 w-1.5 rounded-full',
                          isFor ? 'bg-for-500' : 'bg-against-500',
                        )}
                      />
                      <span className="font-mono text-xs text-surface-200 leading-relaxed">
                        {claim}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>

              {/* Evidence */}
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-surface-500 mb-1.5">
                  Strongest Evidence
                </p>
                <p className="font-mono text-xs text-surface-200 leading-relaxed">
                  {arg.strongest_evidence}
                </p>
              </div>

              {/* Moral foundation */}
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-surface-500 mb-1.5">
                  Moral Foundation
                </p>
                <p className="font-mono text-xs text-surface-200 leading-relaxed">
                  {arg.moral_foundation}
                </p>
              </div>

              {/* Rebuttal */}
              <div
                className={cn(
                  'rounded-xl p-3 border',
                  isFor
                    ? 'border-for-500/20 bg-for-500/5'
                    : 'border-against-500/20 bg-against-500/5',
                )}
              >
                <p className="font-mono text-[10px] uppercase tracking-widest text-surface-500 mb-1.5">
                  Rebuttal to Opposition
                </p>
                <p className="font-mono text-xs text-surface-200 leading-relaxed italic">
                  &ldquo;{arg.rebuttal_to_opposition}&rdquo;
                </p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Expand hint */}
      {!expanded && (
        <button
          onClick={() => setExpanded(true)}
          className={cn(
            'mt-3 flex items-center gap-1 font-mono text-xs transition-colors',
            isFor
              ? 'text-for-500 hover:text-for-400'
              : 'text-against-500 hover:text-against-400',
          )}
        >
          <ChevronRight className="h-3 w-3" />
          Expand full case
        </button>
      )}
    </motion.div>
  )
}

// ─── Vote Bar ─────────────────────────────────────────────────────────────────

function VoteBar({ bluePct, totalVotes }: { bluePct: number; totalVotes: number }) {
  const forPct = Math.round(bluePct)
  const againstPct = 100 - forPct
  return (
    <div className="space-y-2">
      <div className="relative h-2.5 rounded-full overflow-hidden bg-surface-300">
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${forPct}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="absolute inset-y-0 left-0 bg-gradient-to-r from-for-700 to-for-500 rounded-l-full"
        />
        <motion.div
          initial={{ width: 0 }}
          animate={{ width: `${againstPct}%` }}
          transition={{ duration: 0.7, ease: 'easeOut' }}
          className="absolute inset-y-0 right-0 bg-against-600 rounded-r-full"
        />
      </div>
      <div className="flex items-center justify-between font-mono text-xs">
        <span className="text-for-400 font-semibold">{forPct}% FOR</span>
        <span className="text-surface-500">{totalVotes.toLocaleString()} votes</span>
        <span className="text-against-400 font-semibold">{againstPct}% AGAINST</span>
      </div>
    </div>
  )
}

// ─── Main Component ───────────────────────────────────────────────────────────

export function SteelmanClient({
  topicId,
  statement,
  category,
  status,
  bluePct,
  totalVotes,
}: SteelmanClientProps) {
  const [result, setResult] = useState<SteelmanResult | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const generate = useCallback(async () => {
    setLoading(true)
    setError(null)

    try {
      const res = await fetch('/api/steelman', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic_id: topicId, statement, category }),
      })

      if (!res.ok) {
        if (res.status === 401) {
          setError('Sign in to generate steelman arguments.')
          return
        }
        setError('Failed to generate steelman. Please try again.')
        return
      }

      const data = (await res.json()) as SteelmanResult
      if (data.unavailable) {
        setError('AI generation is currently unavailable. Please try again later.')
        return
      }
      setResult(data)
    } catch {
      setError('Network error. Please check your connection and try again.')
    } finally {
      setLoading(false)
    }
  }, [topicId, statement, category])

  const statusLabel = STATUS_LABEL[status] ?? status
  const badgeVariant = STATUS_BADGE[status] ?? 'proposed'

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pb-24 pt-4 space-y-4">
        {/* Back link + breadcrumbs */}
        <div className="flex items-center gap-2 text-xs font-mono text-surface-500">
          <Link
            href={`/topic/${topicId}`}
            className="flex items-center gap-1 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to debate
          </Link>
          <span>/</span>
          <span className="text-surface-400">Steelman</span>
        </div>

        {/* Header */}
        <div className="space-y-3">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant={badgeVariant}>{statusLabel}</Badge>
            {category && (
              <Badge variant="proposed" className="text-surface-400 border-surface-500/40 bg-surface-200/40">
                {category}
              </Badge>
            )}
          </div>

          <h1 className="font-mono text-lg font-bold text-white leading-snug">
            {statement}
          </h1>

          {/* Community vote context */}
          {totalVotes > 0 && (
            <div className="rounded-xl bg-surface-100 border border-surface-300 p-3">
              <p className="font-mono text-[10px] uppercase tracking-widest text-surface-500 mb-2">
                Community Verdict · {totalVotes.toLocaleString()} votes
              </p>
              <VoteBar bluePct={bluePct} totalVotes={totalVotes} />
            </div>
          )}
        </div>

        {/* Hero description */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-purple/10 border border-purple/30 flex-shrink-0 mt-0.5">
              <Brain className="h-4.5 w-4.5 text-purple" />
            </div>
            <div>
              <p className="font-mono text-sm font-semibold text-white mb-1">
                Steel-Man Both Sides
              </p>
              <p className="font-mono text-xs text-surface-400 leading-relaxed">
                A steelman is the{' '}
                <span className="text-surface-200">opposite of a strawman</span> — the strongest,
                most charitable version of each position. This analysis represents what a
                thoughtful, well-informed proponent of each side would actually argue.
              </p>
            </div>
          </div>
        </div>

        {/* Generate button / results */}
        <AnimatePresence mode="wait">
          {!result && !loading && (
            <motion.div key="cta" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
              {error && (
                <div className="rounded-xl bg-against-500/10 border border-against-500/30 p-3 mb-3">
                  <p className="font-mono text-xs text-against-300">{error}</p>
                </div>
              )}
              <button
                onClick={generate}
                disabled={loading}
                className={cn(
                  'w-full flex items-center justify-center gap-2',
                  'py-3.5 px-5 rounded-xl font-mono text-sm font-semibold transition-all',
                  'bg-purple/90 hover:bg-purple text-white border border-purple/50',
                  'shadow-lg shadow-purple/20',
                  loading && 'opacity-60 cursor-not-allowed',
                )}
              >
                <Sparkles className="h-4 w-4" />
                Generate Steelman Arguments
              </button>
            </motion.div>
          )}

          {loading && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center justify-center py-16 gap-4"
            >
              <div className="relative">
                <div className="h-14 w-14 rounded-2xl bg-purple/10 border border-purple/30 flex items-center justify-center">
                  <Brain className="h-6 w-6 text-purple animate-pulse" />
                </div>
                <div className="absolute -bottom-1 -right-1 h-5 w-5 rounded-full bg-surface-100 border border-surface-300 flex items-center justify-center">
                  <Loader2 className="h-3 w-3 text-surface-400 animate-spin" />
                </div>
              </div>
              <div className="text-center">
                <p className="font-mono text-sm font-semibold text-white">Constructing steelman cases…</p>
                <p className="font-mono text-xs text-surface-500 mt-1">
                  Representing both sides at their most rigorous
                </p>
              </div>
            </motion.div>
          )}

          {result && !loading && (
            <motion.div
              key="result"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="space-y-4"
            >
              {/* FOR steelman */}
              <ArgSection side="for" arg={result.for_steelman} defaultExpanded />

              {/* AGAINST steelman */}
              <ArgSection side="against" arg={result.against_steelman} defaultExpanded />

              {/* Philosophical tension */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.1 }}
                className="flex items-center gap-2 px-1"
              >
                <Scale className="h-4 w-4 text-gold flex-shrink-0" />
                <p className="font-mono text-xs text-surface-400">
                  Core tension:{' '}
                  <span className="text-gold font-semibold">{result.philosophical_tension}</span>
                </p>
              </motion.div>

              {/* Synthesis */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.15 }}
                className="rounded-2xl border border-surface-300 bg-surface-100 p-5"
              >
                <div className="flex items-center gap-2 mb-3">
                  <GitMerge className="h-4 w-4 text-emerald flex-shrink-0" />
                  <span className="font-mono text-xs font-bold uppercase tracking-widest text-emerald">
                    Common Ground
                  </span>
                </div>
                <p className="font-mono text-sm text-surface-200 leading-relaxed">
                  {result.synthesis}
                </p>
              </motion.div>

              {/* Community vote context if available */}
              {result.community_vote && (
                <motion.div
                  initial={{ opacity: 0, y: 8 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: 0.2 }}
                  className="rounded-xl border border-surface-300 bg-surface-100 p-4"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <BarChart2 className="h-3.5 w-3.5 text-surface-400" />
                    <span className="font-mono text-[10px] uppercase tracking-widest text-surface-500">
                      Despite this steelman, the community has voted
                    </span>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-lg font-bold text-for-400">
                      {Math.round(result.community_vote.blue_pct)}% FOR
                    </span>
                    <span className="text-surface-500 font-mono text-xs">·</span>
                    <span className="font-mono text-lg font-bold text-against-400">
                      {100 - Math.round(result.community_vote.blue_pct)}% AGAINST
                    </span>
                    <span className="ml-auto font-mono text-xs text-surface-500">
                      {result.community_vote.total_votes.toLocaleString()} votes
                    </span>
                  </div>
                </motion.div>
              )}

              {/* Regenerate */}
              <motion.button
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.25 }}
                onClick={generate}
                disabled={loading}
                className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors mx-auto"
              >
                <RefreshCw className="h-3 w-3" />
                Regenerate
              </motion.button>

              {/* CTAs */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.3 }}
                className="flex flex-col sm:flex-row items-stretch gap-3 pt-2"
              >
                <Link
                  href={`/topic/${topicId}#arguments`}
                  className="flex items-center justify-center gap-2 py-3 px-5 rounded-xl font-mono text-sm font-semibold bg-for-500 hover:bg-for-600 text-white transition-all flex-1"
                >
                  <ExternalLink className="h-4 w-4" />
                  Read real arguments
                </Link>
                <Link
                  href={`/topic/${topicId}/argue`}
                  className="flex items-center justify-center gap-2 py-3 px-5 rounded-xl font-mono text-sm font-semibold border border-surface-400 text-surface-300 hover:text-white hover:border-surface-300 transition-all"
                >
                  Write your argument
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </motion.div>

              {/* Explore more tools */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.35 }}
                className="grid grid-cols-2 gap-2 pt-1"
              >
                {[
                  { href: `/topic/${topicId}/synthesis`, icon: GitMerge, label: 'AI Synthesis', desc: 'Common ground' },
                  { href: `/topic/${topicId}/brief`, icon: Sparkles, label: 'Debate Brief', desc: 'Full dossier' },
                  { href: `/steelman`, icon: Brain, label: 'General Steelman', desc: 'Any statement' },
                  { href: `/topic/${topicId}`, icon: Zap, label: 'Full Debate', desc: 'Vote & argue' },
                ].map(({ href, icon: Icon, label, desc }) => (
                  <Link
                    key={href}
                    href={href}
                    className="flex items-center gap-2 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 hover:bg-surface-200 transition-all"
                  >
                    <Icon className="h-4 w-4 text-surface-400 flex-shrink-0" />
                    <div>
                      <p className="font-mono text-xs font-semibold text-surface-200">{label}</p>
                      <p className="font-mono text-[10px] text-surface-500">{desc}</p>
                    </div>
                    <ChevronRight className="h-3 w-3 text-surface-600 ml-auto flex-shrink-0" />
                  </Link>
                ))}
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}
