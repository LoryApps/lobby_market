'use client'

/**
 * /topic/[id]/argue — AI Argument Starter
 *
 * Helps citizens craft their first argument on a topic by generating
 * AI-powered argument starters for FOR or AGAINST positions.
 *
 * Distinct from:
 *   /prep       — full debate dossier (own + opposing arguments)
 *   /coach      — critiques a draft you've written
 *   /spar/[id]  — live AI debate opponent
 *
 * This is quick inspiration: pick a side, choose an argument format,
 * get 3 sharp opening angles, copy one, and go write your argument.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { useParams, useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  ExternalLink,
  Lightbulb,
  Loader2,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { ArgumentStartersResponse, ArgumentStarter } from '@/app/api/topics/[id]/argument-starters/route'

// ─── Types ────────────────────────────────────────────────────────────────────

type Side = 'for' | 'against' | null
type ArgFormat = 'free' | 'peel' | 'toulmin' | 'narrative'

interface FormatStep {
  label: string
  hint: string
}

interface FormatTemplate {
  id: ArgFormat
  label: string
  tagline: string
  steps: FormatStep[]
  colorClasses: string
  activeClasses: string
}

// ─── Format template definitions ─────────────────────────────────────────────

const FORMAT_TEMPLATES: FormatTemplate[] = [
  {
    id: 'free',
    label: 'Free-form',
    tagline: 'Write naturally',
    steps: [],
    colorClasses: 'text-surface-300 border-surface-500/40 bg-surface-500/5',
    activeClasses: 'border-surface-300 bg-surface-400/15 text-white',
  },
  {
    id: 'peel',
    label: 'PEEL',
    tagline: 'Point · Evidence · Explain · Link',
    steps: [
      { label: 'Point', hint: 'State your main argument clearly' },
      { label: 'Evidence', hint: 'Cite data, examples, or quotes' },
      { label: 'Explanation', hint: 'Show why the evidence proves your point' },
      { label: 'Link', hint: 'Tie it back to the topic statement' },
    ],
    colorClasses: 'text-gold border-gold/30 bg-gold/5',
    activeClasses: 'border-gold bg-gold/15 text-gold',
  },
  {
    id: 'toulmin',
    label: 'Toulmin',
    tagline: 'Claim · Data · Warrant',
    steps: [
      { label: 'Claim', hint: 'Your core position on the issue' },
      { label: 'Data', hint: 'Facts, statistics, or expert opinion' },
      { label: 'Warrant', hint: 'Why this data logically supports your claim' },
      { label: 'Rebuttal', hint: 'Acknowledge and counter the opposing view' },
    ],
    colorClasses: 'text-for-300 border-for-400/30 bg-for-400/5',
    activeClasses: 'border-for-400 bg-for-500/15 text-for-300',
  },
  {
    id: 'narrative',
    label: 'Narrative',
    tagline: 'Hook · Stakes · Case · Call',
    steps: [
      { label: 'Hook', hint: 'Open with a striking story or scenario' },
      { label: 'Stakes', hint: "Describe what's at risk if nothing changes" },
      { label: 'Case', hint: 'Make your core argument' },
      { label: 'Call to Action', hint: 'State what should happen next' },
    ],
    colorClasses: 'text-purple border-purple/30 bg-purple/5',
    activeClasses: 'border-purple bg-purple/15 text-purple',
  },
]

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ANGLE_COLORS: Record<string, string> = {
  Economic:     'text-gold border-gold/30 bg-gold/10',
  Economics:    'text-gold border-gold/30 bg-gold/10',
  'Rights-based': 'text-for-400 border-for-500/30 bg-for-500/10',
  Rights:       'text-for-400 border-for-500/30 bg-for-500/10',
  Practical:    'text-emerald border-emerald/30 bg-emerald/10',
  Moral:        'text-purple border-purple/30 bg-purple/10',
  Ethical:      'text-purple border-purple/30 bg-purple/10',
  Evidence:     'text-for-300 border-for-400/30 bg-for-400/10',
  'Evidence-based': 'text-for-300 border-for-400/30 bg-for-400/10',
  Historical:   'text-gold border-gold/30 bg-gold/10',
  Social:       'text-emerald border-emerald/30 bg-emerald/10',
  Environmental:'text-emerald border-emerald/30 bg-emerald/10',
  Scientific:   'text-for-300 border-for-400/30 bg-for-400/10',
}

function angleClass(angle: string): string {
  return ANGLE_COLORS[angle] ?? 'text-surface-400 border-surface-500/30 bg-surface-500/10'
}

// ─── FormatPicker ─────────────────────────────────────────────────────────────

function FormatPicker({
  value,
  onChange,
}: {
  value: ArgFormat
  onChange: (f: ArgFormat) => void
}) {
  return (
    <div className="mb-6">
      <p className="text-xs font-mono text-surface-500 uppercase tracking-widest mb-3">
        Argument format
      </p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {FORMAT_TEMPLATES.map((tpl) => (
          <button
            key={tpl.id}
            onClick={() => onChange(tpl.id)}
            className={cn(
              'flex flex-col gap-0.5 px-3 py-2.5 rounded-xl border text-left transition-all',
              value === tpl.id
                ? tpl.activeClasses
                : cn('hover:border-surface-400 hover:bg-surface-100', tpl.colorClasses)
            )}
          >
            <span className="text-xs font-mono font-bold leading-tight">{tpl.label}</span>
            <span className="text-[10px] font-mono text-surface-500 leading-snug">{tpl.tagline}</span>
          </button>
        ))}
      </div>
    </div>
  )
}

// ─── FormatGuide ──────────────────────────────────────────────────────────────

function FormatGuide({ format }: { format: ArgFormat }) {
  const [open, setOpen] = useState(false)

  const tpl = FORMAT_TEMPLATES.find((t) => t.id === format)
  if (!tpl || tpl.steps.length === 0) return null

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.35 }}
      className="mt-5 rounded-xl border border-surface-300 bg-surface-100 overflow-hidden"
    >
      <button
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 text-left hover:bg-surface-200 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className={cn('text-xs font-mono font-bold px-2 py-0.5 rounded-full border', tpl.colorClasses)}>
            {tpl.label}
          </span>
          <span className="text-xs font-mono text-surface-400">Format guide</span>
        </div>
        {open
          ? <ChevronUp className="h-3.5 w-3.5 text-surface-500" />
          : <ChevronDown className="h-3.5 w-3.5 text-surface-500" />
        }
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
            <div className="px-4 pb-4 space-y-2.5 border-t border-surface-300 pt-3">
              <p className="text-[11px] font-mono text-surface-500 mb-3">
                Expand your starter into a full argument using this structure:
              </p>
              {tpl.steps.map((step, i) => (
                <div key={step.label} className="flex gap-3 items-start">
                  <span
                    className={cn(
                      'flex-shrink-0 flex items-center justify-center h-5 w-5 rounded-full text-[10px] font-mono font-bold border',
                      tpl.colorClasses
                    )}
                  >
                    {i + 1}
                  </span>
                  <div>
                    <span className="text-xs font-mono font-semibold text-white">{step.label}</span>
                    <span className="text-[11px] font-mono text-surface-500 ml-1.5">{step.hint}</span>
                  </div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  )
}

// ─── StarterCard ──────────────────────────────────────────────────────────────

function StarterCard({
  starter,
  side,
  index,
  topicId,
}: {
  starter: ArgumentStarter
  side: 'for' | 'against'
  index: number
  topicId: string
}) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(starter.text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08 }}
      className={cn(
        'group relative rounded-2xl border p-5 transition-all',
        side === 'for'
          ? 'bg-for-500/5 border-for-500/20 hover:border-for-500/40'
          : 'bg-against-500/5 border-against-500/20 hover:border-against-500/40'
      )}
    >
      {/* Angle badge */}
      <span
        className={cn(
          'inline-block px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border mb-3',
          angleClass(starter.angle)
        )}
      >
        {starter.angle}
      </span>

      {/* Starter text */}
      <p className="text-sm leading-relaxed text-surface-100 mb-4">
        {starter.text}
      </p>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <button
          onClick={handleCopy}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all',
            copied
              ? 'bg-emerald/20 border-emerald/40 text-emerald'
              : 'bg-surface-200 border-surface-400 text-surface-300 hover:text-white hover:border-surface-300'
          )}
        >
          {copied ? (
            <><Check className="h-3 w-3" /> Copied</>
          ) : (
            <><Copy className="h-3 w-3" /> Copy</>
          )}
        </button>

        <Link
          href={`/topic/${topicId}#arguments`}
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-all',
            side === 'for'
              ? 'bg-for-500/20 border-for-500/40 text-for-300 hover:bg-for-500/30'
              : 'bg-against-500/20 border-against-500/40 text-against-300 hover:bg-against-500/30'
          )}
        >
          <ExternalLink className="h-3 w-3" />
          Argue this
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function StarterSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div
          key={i}
          className="rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-3"
        >
          <Skeleton className="h-4 w-20 rounded-full" />
          <Skeleton className="h-4 w-full" />
          <Skeleton className="h-4 w-5/6" />
          <div className="flex gap-2 pt-1">
            <Skeleton className="h-7 w-16 rounded-lg" />
            <Skeleton className="h-7 w-24 rounded-lg" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function ArguePage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()

  const [data, setData] = useState<ArgumentStartersResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [generating, setGenerating] = useState(false)
  const [side, setSide] = useState<Side>(null)
  const [format, setFormat] = useState<ArgFormat>('free')
  const [error, setError] = useState<string | null>(null)
  const generatedRef = useRef(false)

  // Load topic info (lightweight — just the statement and category)
  useEffect(() => {
    async function loadTopic() {
      setLoading(true)
      try {
        const res = await fetch(`/api/topics/${id}/preview`)
        if (!res.ok) return
        const t = await res.json()
        setData({
          topic_id: t.id,
          statement: t.statement,
          category: t.category,
          starters: { for: [], against: [] },
        })
      } catch {
        // best-effort
      } finally {
        setLoading(false)
      }
    }
    loadTopic()
  }, [id])

  const generate = useCallback(async (chosenSide: Side, chosenFormat?: ArgFormat) => {
    if (!chosenSide || generating) return
    setSide(chosenSide)
    setGenerating(true)
    setError(null)
    generatedRef.current = false

    try {
      const res = await fetch(`/api/topics/${id}/argument-starters`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ side: chosenSide, format: chosenFormat ?? format }),
      })

      if (res.status === 401) {
        router.push('/login')
        return
      }

      if (!res.ok) {
        setError('Generation failed. Please try again.')
        return
      }

      const json: ArgumentStartersResponse = await res.json()

      if (json.unavailable) {
        setError('AI generation is not available right now.')
        return
      }

      setData(json)
      generatedRef.current = true
    } catch {
      setError('Something went wrong. Please try again.')
    } finally {
      setGenerating(false)
    }
  }, [id, generating, router, format])

  function handleSideSelect(chosen: 'for' | 'against') {
    if (chosen === side && data?.starters[chosen].length) return
    generate(chosen)
  }

  function handleFormatChange(newFormat: ArgFormat) {
    setFormat(newFormat)
    // If we already have results, regenerate with new format
    if (side && data?.starters[side]?.length) {
      generate(side, newFormat)
    }
  }

  const activeStarters = side ? (data?.starters[side] ?? []) : []
  const hasStarters = activeStarters.length > 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">

        {/* Back link */}
        <div className="mb-5">
          <Link
            href={data?.topic_id ? `/topic/${data.topic_id}` : '/'}
            className="inline-flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            Back to debate
          </Link>
        </div>

        {/* Header */}
        <div className="flex items-start gap-3 mb-6">
          <div className="flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-xl bg-purple/10 border border-purple/30">
            <Lightbulb className="h-5 w-5 text-purple" />
          </div>
          <div>
            <h1 className="font-mono text-xl font-bold text-white">
              Argument Starter
            </h1>
            <p className="text-sm font-mono text-surface-500 mt-0.5">
              AI-powered opening angles for your argument
            </p>
          </div>
        </div>

        {/* Topic card */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-6">
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-5 w-full" />
              <Skeleton className="h-5 w-4/5" />
              <Skeleton className="h-4 w-20 rounded-full mt-3" />
            </div>
          ) : data ? (
            <>
              <p className="text-base font-semibold text-white leading-snug mb-3">
                {data.statement}
              </p>
              {data.category && (
                <Badge variant="proposed" className="text-[10px] font-mono">
                  {data.category}
                </Badge>
              )}
            </>
          ) : (
            <p className="text-sm text-surface-500 font-mono">Loading topic…</p>
          )}
        </div>

        {/* Side selector */}
        <div className="mb-6">
          <p className="text-xs font-mono text-surface-500 uppercase tracking-widest mb-3">
            Choose your position
          </p>
          <div className="grid grid-cols-2 gap-3">
            <button
              onClick={() => handleSideSelect('for')}
              disabled={generating}
              className={cn(
                'relative flex flex-col items-center gap-2 py-4 px-3 rounded-2xl border-2 transition-all font-mono text-sm font-semibold',
                'disabled:opacity-60 disabled:cursor-wait',
                side === 'for'
                  ? 'bg-for-500/20 border-for-500 text-for-300 shadow-[0_0_20px_rgba(59,130,246,0.15)]'
                  : 'bg-for-500/5 border-for-500/30 text-for-400 hover:border-for-500/60 hover:bg-for-500/10'
              )}
            >
              <ThumbsUp className="h-6 w-6" />
              <span>FOR</span>
              <span className="text-[10px] font-normal text-surface-500 text-center leading-tight">
                I support this
              </span>
              {side === 'for' && generating && (
                <span className="absolute top-2 right-2">
                  <Loader2 className="h-3 w-3 animate-spin text-for-400" />
                </span>
              )}
            </button>

            <button
              onClick={() => handleSideSelect('against')}
              disabled={generating}
              className={cn(
                'relative flex flex-col items-center gap-2 py-4 px-3 rounded-2xl border-2 transition-all font-mono text-sm font-semibold',
                'disabled:opacity-60 disabled:cursor-wait',
                side === 'against'
                  ? 'bg-against-500/20 border-against-500 text-against-300 shadow-[0_0_20px_rgba(239,68,68,0.15)]'
                  : 'bg-against-500/5 border-against-500/30 text-against-400 hover:border-against-500/60 hover:bg-against-500/10'
              )}
            >
              <ThumbsDown className="h-6 w-6" />
              <span>AGAINST</span>
              <span className="text-[10px] font-normal text-surface-500 text-center leading-tight">
                I oppose this
              </span>
              {side === 'against' && generating && (
                <span className="absolute top-2 right-2">
                  <Loader2 className="h-3 w-3 animate-spin text-against-400" />
                </span>
              )}
            </button>
          </div>
        </div>

        {/* Format picker */}
        <FormatPicker value={format} onChange={handleFormatChange} />

        {/* Results area */}
        <AnimatePresence mode="wait">
          {!side && !generating && (
            <motion.div
              key="prompt"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="flex flex-col items-center gap-3 py-12 text-center"
            >
              <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-purple/10 border border-purple/20">
                <Bot className="h-7 w-7 text-purple" />
              </div>
              <p className="text-sm font-mono text-surface-400 max-w-xs">
                Pick a side above and the AI will generate three distinct argument angles for you.
              </p>
              <div className="flex items-center gap-2 mt-1">
                <Sparkles className="h-3 w-3 text-purple" />
                <span className="text-xs font-mono text-surface-600">
                  Powered by Claude Haiku
                </span>
              </div>
            </motion.div>
          )}

          {(generating && side) && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-3"
            >
              <div className="flex items-center gap-2 mb-4">
                <Loader2 className="h-4 w-4 animate-spin text-purple" />
                <p className="text-sm font-mono text-surface-400">
                  Generating {side === 'for' ? 'FOR' : 'AGAINST'} argument starters…
                </p>
              </div>
              <StarterSkeleton />
            </motion.div>
          )}

          {!generating && hasStarters && side && (
            <motion.div
              key={`results-${side}`}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
            >
              {/* Results header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <div
                    className={cn(
                      'flex items-center justify-center h-6 w-6 rounded-full',
                      side === 'for'
                        ? 'bg-for-500/20 text-for-400'
                        : 'bg-against-500/20 text-against-400'
                    )}
                  >
                    {side === 'for'
                      ? <ThumbsUp className="h-3 w-3" />
                      : <ThumbsDown className="h-3 w-3" />
                    }
                  </div>
                  <span
                    className={cn(
                      'text-sm font-mono font-semibold',
                      side === 'for' ? 'text-for-400' : 'text-against-400'
                    )}
                  >
                    3 {side === 'for' ? 'FOR' : 'AGAINST'} starters
                  </span>
                  {format !== 'free' && (
                    <span className="text-[10px] font-mono text-surface-500 border border-surface-500/40 rounded-full px-2 py-0.5">
                      {FORMAT_TEMPLATES.find((t) => t.id === format)?.label} format
                    </span>
                  )}
                </div>

                <button
                  onClick={() => generate(side)}
                  className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                >
                  <RefreshCw className="h-3 w-3" />
                  Regenerate
                </button>
              </div>

              {/* Starters */}
              <div className="space-y-3">
                {activeStarters.map((starter, i) => (
                  <StarterCard
                    key={`${side}-${i}`}
                    starter={starter}
                    side={side}
                    index={i}
                    topicId={id}
                  />
                ))}
              </div>

              {/* Format guide */}
              <FormatGuide format={format} />

              {/* Switch side nudge */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="mt-6 rounded-xl bg-surface-100 border border-surface-300 p-4 flex items-center gap-3"
              >
                <Zap className="h-4 w-4 text-gold flex-shrink-0" />
                <p className="text-xs font-mono text-surface-400 flex-1">
                  Want to know what the other side might argue?
                </p>
                <button
                  onClick={() => handleSideSelect(side === 'for' ? 'against' : 'for')}
                  className="flex items-center gap-1 text-xs font-mono text-gold hover:text-gold/80 transition-colors flex-shrink-0"
                >
                  See {side === 'for' ? 'AGAINST' : 'FOR'}
                  <ArrowRight className="h-3 w-3" />
                </button>
              </motion.div>
            </motion.div>
          )}

          {!generating && error && (
            <motion.div
              key="error"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="rounded-xl bg-against-500/10 border border-against-500/30 p-4"
            >
              <p className="text-sm font-mono text-against-300">{error}</p>
              {side && (
                <button
                  onClick={() => generate(side)}
                  className="mt-3 text-xs font-mono text-surface-400 hover:text-white transition-colors flex items-center gap-1.5"
                >
                  <RefreshCw className="h-3 w-3" />
                  Try again
                </button>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Go argue CTA */}
        {hasStarters && !generating && data?.topic_id && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5 }}
            className="mt-8 flex flex-col sm:flex-row items-center gap-3"
          >
            <Link
              href={`/topic/${data.topic_id}#arguments`}
              className={cn(
                'w-full sm:flex-1 flex items-center justify-center gap-2',
                'py-3 px-5 rounded-xl font-mono text-sm font-semibold transition-all',
                side === 'for'
                  ? 'bg-for-500 hover:bg-for-600 text-white'
                  : 'bg-against-500 hover:bg-against-600 text-white'
              )}
            >
              <ExternalLink className="h-4 w-4" />
              Go write my argument
            </Link>
            <Link
              href={`/prep?topic=${data.topic_id}`}
              className="w-full sm:w-auto flex items-center justify-center gap-2 py-3 px-5 rounded-xl font-mono text-sm font-semibold border border-surface-400 text-surface-300 hover:text-white hover:border-surface-300 transition-all"
            >
              Full debate prep
              <ArrowRight className="h-4 w-4" />
            </Link>
          </motion.div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
