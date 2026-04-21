'use client'

import { useCallback, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  CheckCircle2,
  Share2,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  XCircle,
  Zap,
  BarChart2,
  Scale,
  ChevronRight,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

export interface QuizTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
}

type QuizStep =
  | { phase: 'intro' }
  | { phase: 'question'; index: number }
  | { phase: 'reveal'; index: number; choice: 'for' | 'against' }
  | { phase: 'results' }

interface Answer {
  topicId: string
  choice: 'for' | 'against'
  communityPct: number
  aligned: boolean
}

// ─── Category accent colors ───────────────────────────────────────────────────

const CATEGORY_ACCENT: Record<string, { text: string; bg: string; border: string }> = {
  Politics:    { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
  Economics:   { text: 'text-gold',         bg: 'bg-gold/10',         border: 'border-gold/30' },
  Technology:  { text: 'text-purple',       bg: 'bg-purple/10',       border: 'border-purple/30' },
  Science:     { text: 'text-emerald',      bg: 'bg-emerald/10',      border: 'border-emerald/30' },
  Ethics:      { text: 'text-against-400',  bg: 'bg-against-500/10',  border: 'border-against-500/30' },
  Philosophy:  { text: 'text-purple',       bg: 'bg-purple/10',       border: 'border-purple/20' },
  Culture:     { text: 'text-gold',         bg: 'bg-gold/10',         border: 'border-gold/20' },
  Health:      { text: 'text-emerald',      bg: 'bg-emerald/10',      border: 'border-emerald/30' },
  Environment: { text: 'text-emerald',      bg: 'bg-emerald/10',      border: 'border-emerald/30' },
  Education:   { text: 'text-for-300',      bg: 'bg-for-400/10',      border: 'border-for-400/30' },
}

function getCategoryAccent(cat: string | null) {
  return CATEGORY_ACCENT[cat ?? ''] ?? { text: 'text-surface-500', bg: 'bg-surface-300/10', border: 'border-surface-300/20' }
}

function getAlignmentLabel(pct: number): { label: string; sub: string; color: string } {
  if (pct >= 90) return { label: 'Perfect Alignment', sub: 'You think just like the community', color: 'text-emerald' }
  if (pct >= 75) return { label: 'Strong Agreement', sub: 'Your views closely match the majority', color: 'text-for-300' }
  if (pct >= 60) return { label: 'Moderate Agreement', sub: 'You share most perspectives with the Lobby', color: 'text-for-400' }
  if (pct >= 45) return { label: 'Mixed Views', sub: 'Your positions span both sides of many debates', color: 'text-gold' }
  if (pct >= 30) return { label: 'Independent Thinker', sub: 'You often hold the minority view', color: 'text-purple' }
  return { label: 'Contrarian', sub: 'You consistently challenge majority opinion', color: 'text-against-400' }
}

// ─── Animated vote bar ────────────────────────────────────────────────────────

function VoteBar({ forPct, animate }: { forPct: number; animate: boolean }) {
  return (
    <div className="w-full h-2 rounded-full bg-surface-300 overflow-hidden">
      <motion.div
        className="h-full bg-for-500 rounded-full"
        initial={{ width: '50%' }}
        animate={animate ? { width: `${forPct}%` } : { width: '50%' }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
      />
    </div>
  )
}

// ─── Donut progress ring ──────────────────────────────────────────────────────

function ProgressRing({ current, total }: { current: number; total: number }) {
  const r = 20
  const circumference = 2 * Math.PI * r
  const filled = circumference - (circumference * current) / total

  return (
    <svg width="56" height="56" viewBox="0 0 56 56" className="rotate-[-90deg]">
      <circle cx="28" cy="28" r={r} fill="none" stroke="#1e2029" strokeWidth="4" />
      <motion.circle
        cx="28"
        cy="28"
        r={r}
        fill="none"
        stroke="#3b82f6"
        strokeWidth="4"
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: filled }}
        transition={{ duration: 0.5, ease: 'easeOut' }}
        strokeLinecap="round"
      />
    </svg>
  )
}

// ─── Category result row ──────────────────────────────────────────────────────

function CategoryResultRow({
  category,
  aligned,
  total,
}: {
  category: string
  aligned: number
  total: number
}) {
  const accent = getCategoryAccent(category)
  const pct = total > 0 ? Math.round((aligned / total) * 100) : 0

  return (
    <div className="flex items-center gap-3">
      <span className={cn('font-mono text-[11px] font-semibold w-24 flex-shrink-0', accent.text)}>
        {category}
      </span>
      <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden">
        <motion.div
          className="h-full bg-for-500 rounded-full"
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 0.6, ease: 'easeOut', delay: 0.2 }}
        />
      </div>
      <span className="font-mono text-[11px] text-surface-500 w-12 text-right flex-shrink-0">
        {aligned}/{total}
      </span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function QuizClient({ topics }: { topics: QuizTopic[] }) {
  const [step, setStep] = useState<QuizStep>({ phase: 'intro' })
  const [answers, setAnswers] = useState<Answer[]>([])
  const [copied, setCopied] = useState(false)

  const currentIndex =
    step.phase === 'question' || step.phase === 'reveal' ? step.index : 0

  const currentTopic = topics[currentIndex]

  function handleStart() {
    setStep({ phase: 'question', index: 0 })
  }

  const handleChoice = useCallback(
    (choice: 'for' | 'against') => {
      if (step.phase !== 'question') return
      const topic = topics[step.index]
      const communityForPct = Math.round(topic.blue_pct)
      const aligned =
        choice === 'for' ? communityForPct >= 50 : communityForPct < 50

      setAnswers((prev) => [
        ...prev,
        {
          topicId: topic.id,
          choice,
          communityPct: communityForPct,
          aligned,
        },
      ])
      setStep({ phase: 'reveal', index: step.index, choice })
    },
    [step, topics]
  )

  function handleNext() {
    if (step.phase !== 'reveal') return
    if (step.index + 1 >= topics.length) {
      setStep({ phase: 'results' })
    } else {
      setStep({ phase: 'question', index: step.index + 1 })
    }
  }

  function handleShare() {
    const aligned = answers.filter((a) => a.aligned).length
    const pct = Math.round((aligned / answers.length) * 100)
    const text = `I scored ${pct}% alignment with the Lobby Market community on ${answers.length} civic debates. Where do you stand? #LobbyMarket #CivicQuiz`
    if (navigator.share) {
      navigator.share({ title: 'My Civic Quiz Result', text, url: window.location.href }).catch(() => {})
    } else {
      navigator.clipboard.writeText(text).then(() => {
        setCopied(true)
        setTimeout(() => setCopied(false), 2000)
      })
    }
  }

  // ── Intro ──────────────────────────────────────────────────────────────────

  if (step.phase === 'intro') {
    return (
      <div className="min-h-screen bg-surface-50 flex flex-col items-center justify-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md text-center"
        >
          {/* Wordmark */}
          <Link href="/" className="inline-flex flex-col items-center mb-8">
            <span className="text-white font-bold text-xl tracking-wider">LOBBY</span>
            <div className="flex h-0.5 w-full mt-0.5">
              <div className="flex-1 bg-for-500 rounded-l-full" />
              <div className="flex-1 bg-against-500 rounded-r-full" />
            </div>
          </Link>

          {/* Hero icon */}
          <div className="flex items-center justify-center mb-6">
            <div className="flex items-center justify-center h-20 w-20 rounded-2xl bg-for-500/10 border border-for-500/30">
              <Scale className="h-10 w-10 text-for-400" />
            </div>
          </div>

          <h1 className="font-mono text-3xl font-bold text-white mb-3">Civic Quiz</h1>
          <p className="font-mono text-sm text-surface-500 leading-relaxed mb-2">
            Take a position on {topics.length} real debates from the Lobby.
          </p>
          <p className="font-mono text-sm text-surface-500 leading-relaxed mb-8">
            After each answer, see how the community voted — and find out how
            aligned your views are with the collective consensus.
          </p>

          {/* Stats */}
          <div className="grid grid-cols-3 gap-3 mb-8">
            {[
              { label: 'Topics', value: topics.length },
              { label: 'No login needed', value: '100%' },
              { label: 'Anonymous', value: 'Yes' },
            ].map(({ label, value }) => (
              <div
                key={label}
                className="flex flex-col gap-1 p-3 rounded-xl bg-surface-100 border border-surface-300"
              >
                <span className="font-mono text-lg font-bold text-white">{value}</span>
                <span className="font-mono text-[10px] text-surface-500">{label}</span>
              </div>
            ))}
          </div>

          <button
            onClick={handleStart}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-4 px-6 rounded-xl',
              'bg-for-600 hover:bg-for-500 border border-for-500/50',
              'font-mono font-semibold text-white transition-all',
              'shadow-lg shadow-for-900/30'
            )}
          >
            Begin the Quiz
            <ArrowRight className="h-4 w-4" />
          </button>

          <p className="mt-4 font-mono text-[11px] text-surface-600">
            Your answers don&rsquo;t count as real votes.
          </p>
        </motion.div>
      </div>
    )
  }

  // ── Results ────────────────────────────────────────────────────────────────

  if (step.phase === 'results') {
    const aligned = answers.filter((a) => a.aligned).length
    const alignmentPct = Math.round((aligned / answers.length) * 100)
    const { label, sub, color } = getAlignmentLabel(alignmentPct)

    // Category breakdown
    const catMap: Record<string, { aligned: number; total: number }> = {}
    for (let i = 0; i < answers.length; i++) {
      const cat = topics[i]?.category ?? 'Other'
      if (!catMap[cat]) catMap[cat] = { aligned: 0, total: 0 }
      catMap[cat].total++
      if (answers[i].aligned) catMap[cat].aligned++
    }

    return (
      <div className="min-h-screen bg-surface-50 flex flex-col items-center px-4 py-12">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="w-full max-w-md"
        >
          {/* Header */}
          <div className="text-center mb-8">
            <Link href="/" className="inline-flex flex-col items-center mb-6">
              <span className="text-white font-bold text-lg tracking-wider">LOBBY</span>
              <div className="flex h-0.5 w-full mt-0.5">
                <div className="flex-1 bg-for-500 rounded-l-full" />
                <div className="flex-1 bg-against-500 rounded-r-full" />
              </div>
            </Link>

            <div className="flex items-center justify-center mb-4">
              <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-gold/10 border border-gold/30">
                <Trophy className="h-8 w-8 text-gold" />
              </div>
            </div>

            <h2 className="font-mono text-2xl font-bold text-white mb-1">Your Results</h2>
            <p className="font-mono text-sm text-surface-500">
              {aligned} of {answers.length} answers matched the community
            </p>
          </div>

          {/* Score card */}
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 mb-5 text-center">
            <div className="font-mono text-6xl font-bold text-white mb-2 tabular-nums">
              {alignmentPct}%
            </div>
            <div className={cn('font-mono text-base font-semibold mb-1', color)}>
              {label}
            </div>
            <div className="font-mono text-sm text-surface-500">{sub}</div>

            {/* Alignment bar */}
            <div className="mt-5 w-full h-3 rounded-full bg-surface-300 overflow-hidden">
              <motion.div
                className="h-full bg-for-500 rounded-full"
                initial={{ width: 0 }}
                animate={{ width: `${alignmentPct}%` }}
                transition={{ duration: 1.0, ease: 'easeOut', delay: 0.3 }}
              />
            </div>
            <div className="flex justify-between mt-1">
              <span className="font-mono text-[10px] text-against-400">Contrarian</span>
              <span className="font-mono text-[10px] text-emerald">Consensus</span>
            </div>
          </div>

          {/* Category breakdown */}
          {Object.keys(catMap).length > 1 && (
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-5">
              <div className="flex items-center gap-2 mb-4">
                <BarChart2 className="h-4 w-4 text-surface-500" />
                <span className="font-mono text-[11px] font-semibold uppercase tracking-widest text-surface-500">
                  By Category
                </span>
              </div>
              <div className="space-y-3">
                {Object.entries(catMap).map(([cat, { aligned: a, total: t }]) => (
                  <CategoryResultRow
                    key={cat}
                    category={cat}
                    aligned={a}
                    total={t}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Answer review */}
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-6">
            <div className="flex items-center gap-2 mb-4">
              <Scale className="h-4 w-4 text-surface-500" />
              <span className="font-mono text-[11px] font-semibold uppercase tracking-widest text-surface-500">
                Your Answers
              </span>
            </div>
            <div className="space-y-2">
              {answers.map((ans, i) => {
                const topic = topics[i]
                return (
                  <div
                    key={ans.topicId}
                    className="flex items-start gap-2.5"
                  >
                    {ans.aligned ? (
                      <CheckCircle2 className="h-4 w-4 text-emerald flex-shrink-0 mt-0.5" />
                    ) : (
                      <XCircle className="h-4 w-4 text-against-400 flex-shrink-0 mt-0.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <p className="font-mono text-[11px] text-white leading-snug line-clamp-2">
                        {topic?.statement}
                      </p>
                      <div className="flex items-center gap-2 mt-1">
                        <span
                          className={cn(
                            'font-mono text-[10px] font-semibold',
                            ans.choice === 'for' ? 'text-for-400' : 'text-against-400'
                          )}
                        >
                          You: {ans.choice === 'for' ? 'FOR' : 'AGAINST'}
                        </span>
                        <span className="font-mono text-[10px] text-surface-600">·</span>
                        <span className="font-mono text-[10px] text-surface-500">
                          Community: {ans.communityPct}% FOR
                        </span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          </div>

          {/* CTAs */}
          <div className="space-y-3">
            <button
              onClick={handleShare}
              className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-surface-200 border border-surface-400 font-mono font-semibold text-white text-sm hover:bg-surface-300 transition-colors"
            >
              <Share2 className="h-4 w-4" />
              {copied ? 'Copied to clipboard!' : 'Share your result'}
            </button>

            <Link
              href="/onboarding"
              className={cn(
                'w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl',
                'bg-for-600 hover:bg-for-500 border border-for-500/50',
                'font-mono font-semibold text-white text-sm transition-all'
              )}
            >
              <Zap className="h-4 w-4" />
              Join the Lobby — your votes count for real
              <ChevronRight className="h-4 w-4" />
            </Link>

            <Link
              href="/"
              className="w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl bg-transparent border border-surface-300 font-mono text-sm text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
            >
              Explore the feed
            </Link>
          </div>
        </motion.div>
      </div>
    )
  }

  // ── Question / Reveal ──────────────────────────────────────────────────────

  const isReveal = step.phase === 'reveal'
  const chosenSide = isReveal ? step.choice : null
  const accent = getCategoryAccent(currentTopic?.category ?? null)
  const forPct = Math.round(currentTopic?.blue_pct ?? 50)
  const againstPct = 100 - forPct
  const communityAgreesFor = forPct >= 50

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col items-center px-4 py-8">
      {/* Header bar */}
      <div className="w-full max-w-lg flex items-center justify-between mb-6">
        <Link href="/" className="flex flex-col items-center">
          <span className="text-white font-bold text-base tracking-wider">LOBBY</span>
          <div className="flex h-0.5 w-full mt-0.5">
            <div className="flex-1 bg-for-500 rounded-l-full" />
            <div className="flex-1 bg-against-500 rounded-r-full" />
          </div>
        </Link>

        {/* Progress */}
        <div className="relative flex items-center justify-center">
          <ProgressRing current={currentIndex} total={topics.length} />
          <span className="absolute font-mono text-[11px] font-semibold text-white">
            {currentIndex + 1}/{topics.length}
          </span>
        </div>
      </div>

      {/* Question card */}
      <div className="w-full max-w-lg flex-1 flex flex-col">
        <AnimatePresence mode="wait">
          <motion.div
            key={`q-${currentIndex}`}
            initial={{ opacity: 0, x: 30 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -30 }}
            transition={{ duration: 0.3 }}
            className="flex flex-col gap-5"
          >
            {/* Category pill */}
            {currentTopic?.category && (
              <div
                className={cn(
                  'self-start inline-flex items-center gap-1.5 px-3 py-1 rounded-full',
                  'border font-mono text-[11px] font-semibold uppercase tracking-wide',
                  accent.text, accent.bg, accent.border
                )}
              >
                {currentTopic.category}
              </div>
            )}

            {/* Statement */}
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6">
              <p className="font-mono text-[11px] uppercase tracking-widest text-surface-500 mb-3">
                Where do you stand?
              </p>
              <h2 className="font-mono text-lg font-bold text-white leading-snug">
                {currentTopic?.statement}
              </h2>

              {/* Community vote count hint */}
              <p className="font-mono text-[11px] text-surface-600 mt-3">
                {(currentTopic?.total_votes ?? 0).toLocaleString()} people have voted on this
              </p>
            </div>

            {/* Vote buttons */}
            {!isReveal ? (
              <div className="grid grid-cols-2 gap-3">
                <button
                  onClick={() => handleChoice('for')}
                  className={cn(
                    'flex flex-col items-center gap-2 py-6 px-4 rounded-2xl',
                    'bg-for-600/20 border-2 border-for-500/40',
                    'hover:bg-for-600/30 hover:border-for-500/70',
                    'transition-all active:scale-95'
                  )}
                >
                  <ThumbsUp className="h-7 w-7 text-for-400" />
                  <span className="font-mono font-bold text-for-400 text-sm tracking-wide">FOR</span>
                </button>

                <button
                  onClick={() => handleChoice('against')}
                  className={cn(
                    'flex flex-col items-center gap-2 py-6 px-4 rounded-2xl',
                    'bg-against-500/20 border-2 border-against-500/40',
                    'hover:bg-against-500/30 hover:border-against-500/70',
                    'transition-all active:scale-95'
                  )}
                >
                  <ThumbsDown className="h-7 w-7 text-against-400" />
                  <span className="font-mono font-bold text-against-400 text-sm tracking-wide">AGAINST</span>
                </button>
              </div>
            ) : (
              /* Reveal panel */
              <motion.div
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.4 }}
                className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4"
              >
                {/* Alignment banner */}
                <div
                  className={cn(
                    'flex items-center gap-2 p-3 rounded-xl',
                    answers[answers.length - 1]?.aligned
                      ? 'bg-emerald/10 border border-emerald/30'
                      : 'bg-against-500/10 border border-against-500/30'
                  )}
                >
                  {answers[answers.length - 1]?.aligned ? (
                    <CheckCircle2 className="h-5 w-5 text-emerald flex-shrink-0" />
                  ) : (
                    <XCircle className="h-5 w-5 text-against-400 flex-shrink-0" />
                  )}
                  <div>
                    <p
                      className={cn(
                        'font-mono text-sm font-semibold',
                        answers[answers.length - 1]?.aligned ? 'text-emerald' : 'text-against-400'
                      )}
                    >
                      {answers[answers.length - 1]?.aligned
                        ? 'You agree with the majority'
                        : 'You hold the minority view'}
                    </p>
                    <p className="font-mono text-[11px] text-surface-500 mt-0.5">
                      You voted {chosenSide === 'for' ? 'FOR' : 'AGAINST'} ·{' '}
                      Community is {communityAgreesFor ? 'FOR' : 'AGAINST'} ({communityAgreesFor ? forPct : againstPct}%)
                    </p>
                  </div>
                </div>

                {/* Community split */}
                <div>
                  <p className="font-mono text-[10px] uppercase tracking-widest text-surface-500 mb-2">
                    Community vote split
                  </p>
                  <VoteBar forPct={forPct} animate />
                  <div className="flex justify-between mt-1.5">
                    <span className="font-mono text-[11px] text-for-400 font-semibold">
                      {forPct}% For
                    </span>
                    <span className="font-mono text-[11px] text-against-400 font-semibold">
                      {againstPct}% Against
                    </span>
                  </div>
                </div>

                {/* Next button */}
                <button
                  onClick={handleNext}
                  className={cn(
                    'w-full flex items-center justify-center gap-2 py-3 px-5 rounded-xl',
                    'bg-for-600 hover:bg-for-500 border border-for-500/50',
                    'font-mono font-semibold text-white text-sm transition-all'
                  )}
                >
                  {currentIndex + 1 >= topics.length ? (
                    <>
                      <Trophy className="h-4 w-4" />
                      See my results
                    </>
                  ) : (
                    <>
                      Next topic
                      <ArrowRight className="h-4 w-4" />
                    </>
                  )}
                </button>
              </motion.div>
            )}

            {/* Running score */}
            {answers.length > 0 && (
              <div className="flex items-center justify-center gap-3">
                {answers.map((a, i) => (
                  <div
                    key={i}
                    className={cn(
                      'h-2 w-2 rounded-full',
                      a.aligned ? 'bg-emerald' : 'bg-against-500'
                    )}
                  />
                ))}
                {Array.from({ length: topics.length - answers.length }).map((_, i) => (
                  <div key={`empty-${i}`} className="h-2 w-2 rounded-full bg-surface-400" />
                ))}
              </div>
            )}
          </motion.div>
        </AnimatePresence>
      </div>
    </div>
  )
}
