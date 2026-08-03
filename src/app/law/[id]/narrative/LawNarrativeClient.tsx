'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BookOpen,
  ChevronRight,
  Copy,
  ExternalLink,
  Gavel,
  Loader2,
  RefreshCw,
  Scale,
  Scroll,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { LawNarrativeResponse, LawNarrativeChapter } from '@/app/api/laws/[id]/narrative/route'

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

// ─── Chapter config ───────────────────────────────────────────────────────────

const CHAPTER_ICON: Record<string, typeof Scale> = {
  'The Original Question': Scale,
  'The Debate':           ThumbsUp,
  'How Consensus Formed': ThumbsDown,
  'What This Law Means':  Gavel,
}

const CHAPTER_ACCENT: Record<string, string> = {
  'The Original Question': 'border-surface-400/50 text-surface-300',
  'The Debate':            'border-for-500/50 text-for-300',
  'How Consensus Formed':  'border-emerald/50 text-emerald',
  'What This Law Means':   'border-gold/50 text-gold',
}

const CHAPTER_BG: Record<string, string> = {
  'The Original Question': 'bg-surface-300/10',
  'The Debate':            'bg-for-500/5',
  'How Consensus Formed':  'bg-emerald/5',
  'What This Law Means':   'bg-gold/5',
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function NarrativeSkeleton() {
  return (
    <div className="space-y-6 animate-pulse">
      <Skeleton className="h-5 w-3/4" />
      <Skeleton className="h-4 w-full" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
          <Skeleton className="h-4 w-1/3" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-full" />
          <Skeleton className="h-3 w-4/5" />
        </div>
      ))}
      <Skeleton className="h-4 w-2/3 mx-auto" />
    </div>
  )
}

// ─── Chapter card ─────────────────────────────────────────────────────────────

function ChapterCard({ chapter, index }: { chapter: LawNarrativeChapter; index: number }) {
  const Icon = CHAPTER_ICON[chapter.title] ?? BookOpen
  const accent = CHAPTER_ACCENT[chapter.title] ?? 'border-surface-400/50 text-surface-300'
  const bg = CHAPTER_BG[chapter.title] ?? 'bg-surface-300/10'

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.08, duration: 0.35 }}
      className={cn(
        'rounded-2xl border p-5 space-y-3',
        'bg-surface-100',
        accent.split(' ')[0]
      )}
    >
      <div className="flex items-center gap-2.5">
        <div className={cn('flex items-center justify-center h-7 w-7 rounded-lg border', bg, accent)}>
          <Icon className="h-3.5 w-3.5" />
        </div>
        <h3 className={cn('font-mono text-xs font-bold uppercase tracking-wider', accent.split(' ')[1])}>
          {chapter.title}
        </h3>
      </div>
      <p className="text-sm leading-relaxed text-surface-200 font-sans">
        {chapter.body}
      </p>
    </motion.div>
  )
}

// ─── Vote bar ─────────────────────────────────────────────────────────────────

function VoteBar({ forPct }: { forPct: number }) {
  const againstPct = 100 - forPct
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-for-400 font-semibold">{forPct}% For</span>
        <span className="text-against-400 font-semibold">{againstPct}% Against</span>
      </div>
      <div className="h-2 rounded-full bg-surface-300 overflow-hidden">
        <div
          className="h-full rounded-full bg-gradient-to-r from-for-500 to-for-400 transition-all duration-700"
          style={{ width: `${forPct}%` }}
        />
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function LawNarrativeClient({
  lawId,
  topicId,
  statement,
  category,
  bluePct,
  totalVotes,
  establishedAt,
}: Props) {
  const [data, setData] = useState<LawNarrativeResponse | null>(null)
  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [copied, setCopied] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const [insufficientData, setInsufficientData] = useState(false)

  const generate = useCallback(async () => {
    if (generating) return
    setGenerating(true)
    setError(null)

    try {
      const res = await fetch(`/api/laws/${lawId}/narrative`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      })

      if (res.status === 422) {
        setInsufficientData(true)
        return
      }

      if (!res.ok) {
        throw new Error('Generation failed')
      }

      const json = await res.json() as LawNarrativeResponse & { unavailable?: boolean; insufficient_data?: boolean }

      if (json.unavailable) {
        setUnavailable(true)
        return
      }
      if (json.insufficient_data) {
        setInsufficientData(true)
        return
      }

      setData(json)
    } catch {
      setError('Failed to generate the narrative. Please try again.')
    } finally {
      setGenerating(false)
    }
  }, [lawId, generating])

  useEffect(() => {
    generate()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const copyNarrative = useCallback(() => {
    if (!data) return
    const text = [
      `"${data.statement}"`,
      `Established Law · ${new Date(data.established_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })}`,
      '',
      data.lede,
      '',
      ...data.chapters.flatMap((ch) => [ch.title, ch.body, '']),
      `— ${data.legacy}`,
      '',
      `${Math.round(data.blue_pct)}% For · ${100 - Math.round(data.blue_pct)}% Against · ${data.total_votes.toLocaleString()} votes`,
      `Via Lobby Market — lobby.market/law/${lawId}/narrative`,
    ].join('\n')

    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }, [data, lawId])

  const forPct = Math.round(bluePct)
  const establishedDisplay = new Date(establishedAt).toLocaleDateString('en-GB', {
    day: 'numeric', month: 'long', year: 'numeric',
  })

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-8 pb-28 md:pb-12">

        {/* Back + breadcrumb */}
        <div className="flex items-center gap-2 mb-6 text-xs font-mono text-surface-500">
          <Link
            href={`/law/${lawId}`}
            className="flex items-center gap-1 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Law
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-surface-400">Narrative Arc</span>
        </div>

        {/* Header */}
        <div className="mb-6 space-y-4">
          <div className="flex items-start gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-emerald/10 border border-emerald/30 flex-shrink-0 mt-0.5">
              <Scroll className="h-5 w-5 text-emerald" />
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                <Badge variant="law">
                  <Gavel className="h-3 w-3 mr-1" />
                  Established Law
                </Badge>
                {category && (
                  <span className="text-xs font-mono text-surface-500">{category}</span>
                )}
                <span className="text-xs font-mono text-surface-500">
                  {totalVotes.toLocaleString()} votes
                </span>
              </div>
              <h1 className="font-mono text-base font-bold text-white leading-snug">
                {statement}
              </h1>
              <p className="text-xs font-mono text-emerald mt-1">
                Established {establishedDisplay}
              </p>
            </div>
          </div>

          <VoteBar forPct={forPct} />

          {/* Page title */}
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-emerald flex-shrink-0" />
            <p className="font-mono text-xs text-emerald font-semibold uppercase tracking-wider">
              Narrative Arc · How this became law
            </p>
          </div>
        </div>

        {/* Content states */}
        <AnimatePresence mode="wait">
          {generating && !data && (
            <motion.div
              key="loading"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="flex items-center gap-2 p-4 rounded-xl bg-emerald/5 border border-emerald/20">
                <Loader2 className="h-4 w-4 text-emerald animate-spin flex-shrink-0" />
                <p className="text-sm font-mono text-emerald">
                  Writing the story of this law…
                </p>
              </div>
              <NarrativeSkeleton />
            </motion.div>
          )}

          {!generating && unavailable && (
            <motion.div
              key="unavailable"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-16 space-y-3"
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-200 border border-surface-300">
                <Scroll className="h-6 w-6 text-surface-500" />
              </div>
              <p className="font-mono text-sm font-semibold text-surface-300">
                Narrative generation not configured
              </p>
              <p className="text-xs font-mono text-surface-500 max-w-xs mx-auto">
                AI features require an Anthropic API key. The narrative arc will be available
                once the deployment is configured.
              </p>
            </motion.div>
          )}

          {!generating && insufficientData && (
            <motion.div
              key="insufficient"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-16 space-y-3"
            >
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-surface-200 border border-surface-300">
                <BookOpen className="h-6 w-6 text-surface-500" />
              </div>
              <p className="font-mono text-sm font-semibold text-surface-300">
                Not enough debate content
              </p>
              <p className="text-xs font-mono text-surface-500 max-w-xs mx-auto">
                A narrative requires at least 3 arguments from the original debate.
              </p>
            </motion.div>
          )}

          {!generating && error && !data && (
            <motion.div
              key="error"
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-center py-12 space-y-3"
            >
              <p className="text-sm font-mono text-against-400">{error}</p>
              <button
                onClick={() => generate()}
                className="flex items-center gap-1.5 mx-auto text-xs font-mono text-surface-500 hover:text-white transition-colors"
              >
                <RefreshCw className="h-3 w-3" />
                Try again
              </button>
            </motion.div>
          )}

          {data && (
            <motion.div
              key="content"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-5"
            >
              {/* Lede */}
              <motion.blockquote
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                className="border-l-2 border-emerald/60 pl-4 py-1"
              >
                <p className="text-base font-semibold text-white leading-snug italic">
                  {data.lede}
                </p>
              </motion.blockquote>

              {/* Chapters */}
              <div className="space-y-3">
                {data.chapters.map((ch, i) => (
                  <ChapterCard key={ch.title} chapter={ch} index={i} />
                ))}
              </div>

              {/* Legacy */}
              <motion.div
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.4 }}
                className="rounded-2xl bg-surface-100 border border-emerald/30 p-4 text-center"
              >
                <p className="text-xs font-mono text-emerald uppercase tracking-wider mb-1.5">
                  Legacy
                </p>
                <p className="text-sm text-surface-200 italic leading-relaxed">
                  &ldquo;{data.legacy}&rdquo;
                </p>
              </motion.div>

              {/* Meta + actions */}
              <motion.div
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: 0.5 }}
                className="flex items-center justify-between pt-2"
              >
                <p className="text-[11px] font-mono text-surface-600">
                  AI-generated · {data.argument_count} argument{data.argument_count !== 1 ? 's' : ''} analysed
                </p>
                <div className="flex items-center gap-2">
                  <button
                    onClick={() => generate()}
                    disabled={generating}
                    className="flex items-center gap-1 text-xs font-mono text-surface-500 hover:text-white transition-colors disabled:opacity-40"
                    title="Regenerate narrative"
                  >
                    <RefreshCw className={cn('h-3.5 w-3.5', generating && 'animate-spin')} />
                    <span className="sr-only sm:not-sr-only">Regenerate</span>
                  </button>
                  <button
                    onClick={copyNarrative}
                    className="flex items-center gap-1 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                  >
                    <Copy className="h-3.5 w-3.5" />
                    {copied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </motion.div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Related links */}
        <div className="mt-10 pt-6 border-t border-surface-300">
          <p className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-3">
            Also on this law
          </p>
          <div className="grid grid-cols-2 gap-2">
            {[
              { href: `/law/${lawId}/primer`,      label: 'Primer',      desc: 'Plain-language explainer' },
              { href: `/law/${lawId}/fault-lines`,  label: 'Fault Lines', desc: 'Debate flashpoints' },
              { href: `/law/${lawId}/steelman`,     label: 'Steelman',    desc: 'Strongest cases' },
              { href: `/topic/${topicId}`,           label: 'Original Debate', desc: 'Where it all started' },
            ].map(({ href, label, desc }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center justify-between p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors group"
              >
                <div>
                  <p className="text-xs font-mono font-semibold text-white group-hover:text-emerald transition-colors">
                    {label}
                  </p>
                  <p className="text-[11px] font-mono text-surface-500">{desc}</p>
                </div>
                <ExternalLink className="h-3.5 w-3.5 text-surface-600 group-hover:text-surface-400 transition-colors flex-shrink-0" />
              </Link>
            ))}
          </div>
        </div>

      </main>
      <BottomNav />
    </div>
  )
}
