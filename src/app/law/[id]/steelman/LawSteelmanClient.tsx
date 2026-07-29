'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Brain,
  Calendar,
  Check,
  ChevronDown,
  ChevronRight,
  ChevronUp,
  Copy,
  Gavel,
  GitMerge,
  Loader2,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'
import type { SteelmanResult, SteelmanArgument } from '@/app/api/steelman/route'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  lawId: string
  topicId: string
  statement: string
  category: string | null
  bluePct: number
  totalVotes: number
  establishedAt: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

// ─── Argument Section ─────────────────────────────────────────────────────────

function ArgSection({ side, arg }: { side: 'for' | 'against'; arg: SteelmanArgument }) {
  const [expanded, setExpanded] = useState(false)
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

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'rounded-2xl border p-5 transition-all',
        isFor ? 'border-for-500/40 bg-for-500/5' : 'border-against-500/40 bg-against-500/5',
      )}
    >
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <div className={cn('flex items-center justify-center h-7 w-7 rounded-lg', isFor ? 'bg-for-500/20' : 'bg-against-500/20')}>
            {isFor ? <ThumbsUp className="h-3.5 w-3.5 text-for-400" /> : <ThumbsDown className="h-3.5 w-3.5 text-against-400" />}
          </div>
          <span className={cn('font-mono text-xs font-bold uppercase tracking-widest', isFor ? 'text-for-400' : 'text-against-400')}>
            {isFor ? 'The Case For' : 'The Case Against'}
          </span>
        </div>
        <div className="flex items-center gap-1.5">
          <button
            onClick={() => {
              navigator.clipboard.writeText(fullText).then(() => {
                setCopied(true)
                setTimeout(() => setCopied(false), 1800)
              })
            }}
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

      <p className={cn('font-mono text-sm font-semibold leading-relaxed', isFor ? 'text-for-300' : 'text-against-300')}>
        {arg.thesis}
      </p>

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
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-surface-500 mb-2">Core Claims</p>
                <ul className="space-y-1.5">
                  {arg.core_claims.map((claim, i) => (
                    <li key={i} className="flex items-start gap-2">
                      <span className={cn('mt-1.5 flex-shrink-0 h-1.5 w-1.5 rounded-full', isFor ? 'bg-for-500' : 'bg-against-500')} />
                      <span className="font-mono text-xs text-surface-200 leading-relaxed">{claim}</span>
                    </li>
                  ))}
                </ul>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-surface-500 mb-1.5">Strongest Evidence</p>
                <p className="font-mono text-xs text-surface-200 leading-relaxed">{arg.strongest_evidence}</p>
              </div>
              <div>
                <p className="font-mono text-[10px] uppercase tracking-widest text-surface-500 mb-1.5">Moral Foundation</p>
                <p className="font-mono text-xs text-surface-200 leading-relaxed">{arg.moral_foundation}</p>
              </div>
              <div className={cn('rounded-xl p-3 border', isFor ? 'border-for-500/20 bg-for-500/5' : 'border-against-500/20 bg-against-500/5')}>
                <p className="font-mono text-[10px] uppercase tracking-widest text-surface-500 mb-1.5">Rebuttal to Opposition</p>
                <p className="font-mono text-xs text-surface-200 leading-relaxed italic">&ldquo;{arg.rebuttal_to_opposition}&rdquo;</p>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {!expanded && (
        <button
          onClick={() => setExpanded(true)}
          className={cn('mt-3 flex items-center gap-1 font-mono text-xs transition-colors', isFor ? 'text-for-500 hover:text-for-400' : 'text-against-500 hover:text-against-400')}
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
        <span className="text-for-400 font-semibold">{forPct}% For</span>
        <span className="text-surface-500">{totalVotes.toLocaleString()} votes cast</span>
        <span className="text-against-400 font-semibold">{againstPct}% Against</span>
      </div>
    </div>
  )
}

// ─── Main Client ──────────────────────────────────────────────────────────────

export function LawSteelmanClient({ lawId, topicId, statement, category, bluePct, totalVotes, establishedAt }: Props) {
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
        if (res.status === 401) { setError('Sign in to generate steelman arguments.'); return }
        setError('Failed to generate steelman. Please try again.')
        return
      }
      const data = (await res.json()) as SteelmanResult
      if (data.unavailable) { setError('AI generation is currently unavailable.'); return }
      setResult(data)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [topicId, statement, category])

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-6 pb-24 md:pb-12">
        {/* Back + breadcrumb */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href={`/law/${lawId}`}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            aria-label="Back to law"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div className="flex items-center gap-2 text-sm font-mono text-surface-500 min-w-0">
            <Link href="/law" className="hover:text-white transition-colors">Codex</Link>
            <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
            <Link href={`/law/${lawId}`} className="hover:text-white transition-colors truncate">
              {statement.slice(0, 45)}{statement.length > 45 ? '…' : ''}
            </Link>
            <ChevronRight className="h-3.5 w-3.5 flex-shrink-0" />
            <span className="text-white font-semibold">Steelman</span>
          </div>
        </div>

        {/* Page header */}
        <div className="mb-6 flex items-start gap-4">
          <div className="flex items-center justify-center h-12 w-12 rounded-xl bg-purple/10 border border-purple/30 flex-shrink-0 mt-0.5">
            <Brain className="h-6 w-6 text-purple" />
          </div>
          <div>
            <h1 className="font-mono text-2xl font-bold text-white leading-tight">Law Steelman</h1>
            <p className="text-sm font-mono text-surface-500 mt-1">
              The strongest possible case for and against this established law
            </p>
          </div>
        </div>

        {/* Law context card */}
        <div className="mb-6 rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center h-9 w-9 rounded-lg bg-gold/10 border border-gold/30 flex-shrink-0 mt-0.5">
              <Gavel className="h-4 w-4 text-gold" />
            </div>
            <div className="min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-gold/15 border border-gold/30 text-gold text-[10px] font-mono font-bold uppercase tracking-wider">
                  <Gavel className="h-2.5 w-2.5" />
                  Established Law
                </span>
                {category && (
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-surface-200 border border-surface-300 text-surface-400 text-[10px] font-mono uppercase tracking-wider">
                    {category}
                  </span>
                )}
              </div>
              <p className="font-mono text-sm font-semibold text-white leading-relaxed">{statement}</p>
            </div>
          </div>

          <div className="flex items-center gap-4 text-xs font-mono text-surface-500 flex-wrap">
            <span className="flex items-center gap-1.5">
              <Calendar className="h-3.5 w-3.5" />
              Established {formatDate(establishedAt)}
            </span>
            <span className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5" />
              {totalVotes.toLocaleString()} votes
            </span>
          </div>

          <VoteBar bluePct={bluePct} totalVotes={totalVotes} />
        </div>

        {/* Generate state */}
        {!result && !loading && (
          <div className="rounded-2xl border border-dashed border-purple/30 bg-purple/5 p-8 text-center space-y-4">
            <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-purple/10 border border-purple/30 mx-auto">
              <Brain className="h-7 w-7 text-purple" />
            </div>
            <div>
              <h2 className="font-mono text-base font-bold text-white mb-1">Generate Law Steelman</h2>
              <p className="text-sm font-mono text-surface-400 max-w-md mx-auto leading-relaxed">
                AI constructs the most rigorous, charitable case both for and against this law — showing each position at its intellectual peak.
              </p>
            </div>
            {error && (
              <p className="text-sm font-mono text-against-400 bg-against-600/10 border border-against-500/20 rounded-xl px-4 py-2">
                {error}
              </p>
            )}
            <button
              onClick={generate}
              disabled={loading}
              className="inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-purple/20 border border-purple/40 text-purple font-mono text-sm font-semibold hover:bg-purple/30 hover:border-purple/60 transition-colors disabled:opacity-50"
            >
              <Sparkles className="h-4 w-4" />
              Generate Steelman
            </button>
          </div>
        )}

        {/* Loading state */}
        {loading && (
          <div className="rounded-2xl border border-purple/20 bg-purple/5 p-8 text-center space-y-3">
            <Loader2 className="h-8 w-8 text-purple animate-spin mx-auto" />
            <p className="font-mono text-sm text-surface-400">
              Constructing the strongest cases…
            </p>
          </div>
        )}

        {/* Result */}
        {result && !loading && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-5">
            {/* FOR steelman */}
            <ArgSection side="for" arg={result.for_steelman} />

            {/* AGAINST steelman */}
            <ArgSection side="against" arg={result.against_steelman} />

            {/* Synthesis */}
            {result.synthesis && (
              <div className="rounded-2xl border border-emerald/30 bg-emerald/5 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <GitMerge className="h-4 w-4 text-emerald" />
                  <span className="font-mono text-xs font-bold uppercase tracking-widest text-emerald">
                    Common Ground
                  </span>
                </div>
                <p className="font-mono text-sm text-surface-200 leading-relaxed">{result.synthesis}</p>
              </div>
            )}

            {/* Philosophical tension */}
            {result.philosophical_tension && (
              <div className="rounded-2xl border border-surface-300 bg-surface-200 p-5">
                <div className="flex items-center gap-2 mb-3">
                  <Scale className="h-4 w-4 text-surface-400" />
                  <span className="font-mono text-xs font-bold uppercase tracking-widest text-surface-400">
                    Core Tension
                  </span>
                </div>
                <p className="font-mono text-sm text-surface-300 leading-relaxed italic">
                  &ldquo;{result.philosophical_tension}&rdquo;
                </p>
              </div>
            )}

            {/* Regenerate */}
            <div className="flex justify-center pt-2">
              <button
                onClick={generate}
                className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors px-4 py-2 rounded-lg hover:bg-surface-200"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Regenerate
              </button>
            </div>
          </motion.div>
        )}

        {/* Related law pages */}
        <div className="mt-8 pt-6 border-t border-surface-300">
          <p className="font-mono text-[10px] uppercase tracking-widest text-surface-500 mb-3">Explore this law</p>
          <div className="flex flex-wrap gap-2">
            {[
              { href: `/law/${lawId}/synthesis`, icon: GitMerge, label: 'AI Synthesis', color: 'text-emerald border-emerald/30 bg-emerald/10 hover:bg-emerald/20' },
              { href: `/law/${lawId}/debate`, icon: Scale, label: 'Founding Debate', color: 'text-for-300 border-for-500/20 bg-for-500/10 hover:bg-for-500/20' },
              { href: `/law/${lawId}/counsel`, icon: Sparkles, label: 'Ask Counsel', color: 'text-gold border-gold/30 bg-gold/10 hover:bg-gold/20' },
              { href: `/law/${lawId}/reviews`, icon: Scale, label: 'Reviews', color: 'text-gold border-gold/30 bg-gold/10 hover:bg-gold/20' },
              { href: `/law/${lawId}/frames`, icon: Brain, label: 'Frames', color: 'text-purple border-purple/30 bg-purple/10 hover:bg-purple/20' },
            ].map(({ href, icon: Icon, label, color }) => (
              <Link
                key={href}
                href={href}
                className={cn('inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium border transition-colors', color)}
              >
                <Icon className="h-3.5 w-3.5" />
                {label}
              </Link>
            ))}
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
