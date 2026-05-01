'use client'

/**
 * /flashcards — Civic Law Flashcards
 *
 * Self-paced spaced-repetition study tool for established laws in the Codex.
 * Front face: law statement + category badge.
 * Back face: vote split bar, established date, body excerpt, related laws count.
 *
 * Keyboard shortcuts:
 *   Space / Enter  → flip card
 *   →  / L        → next card (mark reviewed)
 *   ←  / H        → previous card
 *   1              → mark "learned"
 *   2              → mark "study again"
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronLeft,
  ChevronRight,
  ExternalLink,
  Gavel,
  Keyboard,
  RefreshCw,
  RotateCcw,
  Scale,
  ThumbsDown,
  ThumbsUp,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { Flashcard, FlashcardsResponse } from '@/app/api/flashcards/route'

// ─── Category color map ───────────────────────────────────────────────────────

const CATEGORY_COLOR: Record<string, { badge: string; accent: string }> = {
  Politics:    { badge: 'bg-for-500/15 text-for-300 border-for-500/30',      accent: 'text-for-400' },
  Economics:   { badge: 'bg-gold/15 text-gold border-gold/30',               accent: 'text-gold' },
  Technology:  { badge: 'bg-purple/15 text-purple border-purple/30',         accent: 'text-purple' },
  Science:     { badge: 'bg-emerald/15 text-emerald border-emerald/30',      accent: 'text-emerald' },
  Ethics:      { badge: 'bg-for-300/15 text-for-300 border-for-300/30',      accent: 'text-for-300' },
  Philosophy:  { badge: 'bg-purple/15 text-purple border-purple/30',         accent: 'text-purple' },
  Culture:     { badge: 'bg-against-400/15 text-against-300 border-against-400/30', accent: 'text-against-300' },
  Health:      { badge: 'bg-emerald/15 text-emerald border-emerald/30',      accent: 'text-emerald' },
  Education:   { badge: 'bg-gold/15 text-gold border-gold/30',               accent: 'text-gold' },
  Environment: { badge: 'bg-emerald/15 text-emerald border-emerald/30',      accent: 'text-emerald' },
}

function getCategoryStyle(cat: string | null) {
  return cat ? (CATEGORY_COLOR[cat] ?? { badge: 'bg-surface-300/30 text-surface-500 border-surface-400', accent: 'text-surface-500' }) : { badge: 'bg-surface-300/30 text-surface-500 border-surface-400', accent: 'text-surface-500' }
}

// ─── Keyboard shortcuts modal ─────────────────────────────────────────────────

function ShortcutsModal({ onClose }: { onClose: () => void }) {
  const shortcuts = [
    { key: 'Space', action: 'Flip card' },
    { key: '→', action: 'Next card' },
    { key: '←', action: 'Previous card' },
    { key: '1', action: 'Mark Learned' },
    { key: '2', action: 'Study again later' },
    { key: 'R', action: 'Restart session' },
    { key: 'Esc', action: 'Close shortcut guide' },
  ]

  useEffect(() => {
    function handleKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', handleKey)
    return () => window.removeEventListener('keydown', handleKey)
  }, [onClose])

  return (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
      onClick={onClose}
    >
      <motion.div
        initial={{ scale: 0.9, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        exit={{ scale: 0.9, opacity: 0 }}
        transition={{ type: 'spring', duration: 0.25 }}
        className="bg-surface-100 border border-surface-300 rounded-2xl p-6 w-full max-w-sm shadow-2xl"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between mb-5">
          <h3 className="font-mono font-bold text-white text-sm tracking-wide flex items-center gap-2">
            <Keyboard className="h-4 w-4 text-surface-500" />
            Keyboard Shortcuts
          </h3>
          <button onClick={onClose} className="text-surface-500 hover:text-white transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>
        <div className="space-y-2">
          {shortcuts.map(({ key, action }) => (
            <div key={key} className="flex items-center justify-between">
              <span className="text-sm text-surface-400">{action}</span>
              <kbd className="px-2 py-0.5 bg-surface-200 border border-surface-400 rounded text-xs font-mono text-surface-300">
                {key}
              </kbd>
            </div>
          ))}
        </div>
      </motion.div>
    </motion.div>
  )
}

// ─── Card face ────────────────────────────────────────────────────────────────

function CardFront({ card }: { card: Flashcard }) {
  const style = getCategoryStyle(card.category)
  const fontSize =
    card.statement.length > 140 ? 'text-xl' : card.statement.length > 90 ? 'text-2xl' : 'text-3xl'

  return (
    <div className="flex flex-col h-full p-8 select-none">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <div className="h-2 w-2 rounded-full bg-gold" />
          <span className="text-xs font-mono font-bold text-gold tracking-widest uppercase">
            Established Law
          </span>
        </div>
        {card.category && (
          <span className={cn('text-xs font-mono font-semibold px-2 py-0.5 rounded border', style.badge)}>
            {card.category}
          </span>
        )}
      </div>

      {/* Statement */}
      <div className="flex-1 flex items-center">
        <p className={cn('font-bold text-white leading-snug', fontSize)}>
          {card.statement}
        </p>
      </div>

      {/* Footer hint */}
      <div className="mt-6 flex items-center justify-center gap-1.5 text-surface-500">
        <RotateCcw className="h-3.5 w-3.5" />
        <span className="text-xs font-mono">Click or press Space to reveal details</span>
      </div>
    </div>
  )
}

function CardBack({ card }: { card: Flashcard }) {
  const style = getCategoryStyle(card.category)
  const forPct = Math.round(card.blue_pct)
  const againstPct = 100 - forPct

  const establishedDate = new Date(card.established_at).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  })

  // Trim body_markdown for display
  const excerpt = card.body_markdown
    ? card.body_markdown.replace(/[#*`[\]()]/g, '').trim().slice(0, 280)
    : card.full_statement.slice(0, 280)

  return (
    <div className="flex flex-col h-full p-8 select-none" style={{ transform: 'rotateY(180deg)' }}>
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-xs font-mono text-surface-500 tracking-wide uppercase">Vote Result</span>
        {card.category && (
          <span className={cn('text-xs font-mono font-semibold px-2 py-0.5 rounded border', style.badge)}>
            {card.category}
          </span>
        )}
      </div>

      {/* Vote bar */}
      <div className="mb-5">
        <div className="flex justify-between items-baseline mb-1.5">
          <div className="flex items-center gap-1.5">
            <ThumbsUp className="h-3.5 w-3.5 text-for-400" />
            <span className="text-xl font-bold text-for-400">{forPct}%</span>
            <span className="text-xs text-surface-500 font-mono uppercase tracking-wide">For</span>
          </div>
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-surface-500 font-mono uppercase tracking-wide">Against</span>
            <span className="text-xl font-bold text-against-400">{againstPct}%</span>
            <ThumbsDown className="h-3.5 w-3.5 text-against-400" />
          </div>
        </div>
        <div className="h-2.5 rounded-full overflow-hidden bg-surface-200 flex">
          <div
            className="h-full bg-gradient-to-r from-for-600 to-for-400 rounded-l-full transition-all"
            style={{ width: `${forPct}%` }}
          />
          <div
            className="h-full bg-gradient-to-l from-against-600 to-against-400 rounded-r-full transition-all"
            style={{ width: `${againstPct}%` }}
          />
        </div>
        <div className="mt-1 flex justify-between text-xs text-surface-500 font-mono">
          <span>{card.total_votes.toLocaleString()} votes cast</span>
          <span>Established {establishedDate}</span>
        </div>
      </div>

      {/* Excerpt */}
      {excerpt && (
        <div className="flex-1 overflow-hidden">
          <p className="text-sm text-surface-400 leading-relaxed line-clamp-5">
            {excerpt}{excerpt.length >= 280 ? '…' : ''}
          </p>
        </div>
      )}

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between">
        {card.link_count > 0 && (
          <span className="text-xs font-mono text-surface-500">
            {card.link_count} related law{card.link_count !== 1 ? 's' : ''}
          </span>
        )}
        <Link
          href={`/law/${card.id}`}
          className="ml-auto flex items-center gap-1 text-xs font-mono text-gold hover:text-gold/80 transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          View full law <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </div>
  )
}

// ─── The flipping card ────────────────────────────────────────────────────────

function FlipCard({
  card,
  isFlipped,
  onFlip,
}: {
  card: Flashcard
  isFlipped: boolean
  onFlip: () => void
}) {
  return (
    <div
      className="relative w-full cursor-pointer"
      style={{ perspective: '1200px', height: '420px' }}
      onClick={onFlip}
      role="button"
      tabIndex={0}
      aria-label={isFlipped ? 'Card back — click to flip' : 'Card front — click to reveal'}
      onKeyDown={(e) => { if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); onFlip() } }}
    >
      <motion.div
        className="absolute inset-0"
        style={{ transformStyle: 'preserve-3d' }}
        animate={{ rotateY: isFlipped ? 180 : 0 }}
        transition={{ type: 'spring', stiffness: 260, damping: 28 }}
      >
        {/* Front */}
        <div
          className="absolute inset-0 bg-surface-100 border border-surface-300 rounded-2xl shadow-2xl overflow-hidden"
          style={{ backfaceVisibility: 'hidden' }}
        >
          {/* Top edge accent — gold for established laws */}
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-gold to-transparent opacity-70" />
          <CardFront card={card} />
        </div>

        {/* Back */}
        <div
          className="absolute inset-0 bg-surface-100 border border-surface-300 rounded-2xl shadow-2xl overflow-hidden"
          style={{ backfaceVisibility: 'hidden', transform: 'rotateY(180deg)' }}
        >
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-gradient-to-r from-transparent via-emerald to-transparent opacity-60" />
          <CardBack card={card} />
        </div>
      </motion.div>
    </div>
  )
}

// ─── Session complete screen ──────────────────────────────────────────────────

function SessionComplete({
  learned,
  total,
  onRestart,
  onStudyAgain,
  studyAgainCount,
}: {
  learned: number
  total: number
  onRestart: () => void
  onStudyAgain: () => void
  studyAgainCount: number
}) {
  const pct = total > 0 ? Math.round((learned / total) * 100) : 0

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="flex flex-col items-center text-center py-12 px-4"
    >
      <div className="flex items-center justify-center h-20 w-20 rounded-full bg-gold/10 border border-gold/30 mb-6">
        <Gavel className="h-9 w-9 text-gold" />
      </div>
      <h2 className="text-2xl font-bold font-mono text-white mb-2">Session Complete</h2>
      <p className="text-surface-400 font-mono text-sm mb-8">
        You reviewed {total} law{total !== 1 ? 's' : ''} this session.
      </p>

      {/* Score ring */}
      <div className="relative flex items-center justify-center h-32 w-32 mb-8">
        <svg className="absolute inset-0" viewBox="0 0 120 120">
          <circle cx="60" cy="60" r="54" fill="none" stroke="#1e2030" strokeWidth="10" />
          <circle
            cx="60" cy="60" r="54"
            fill="none"
            stroke={pct >= 80 ? '#10b981' : pct >= 50 ? '#c9a84c' : '#3b82f6'}
            strokeWidth="10"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 54}`}
            strokeDashoffset={`${2 * Math.PI * 54 * (1 - pct / 100)}`}
            transform="rotate(-90 60 60)"
            style={{ transition: 'stroke-dashoffset 1s ease' }}
          />
        </svg>
        <div className="text-center">
          <div className="text-3xl font-bold text-white">{pct}%</div>
          <div className="text-xs text-surface-500 font-mono">learned</div>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 mb-8 w-full max-w-xs">
        <div className="bg-emerald/10 border border-emerald/30 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-emerald">{learned}</div>
          <div className="text-xs text-surface-400 font-mono mt-0.5">Learned</div>
        </div>
        <div className="bg-gold/10 border border-gold/30 rounded-xl p-3 text-center">
          <div className="text-2xl font-bold text-gold">{studyAgainCount}</div>
          <div className="text-xs text-surface-400 font-mono mt-0.5">To review</div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row gap-3 w-full max-w-xs">
        {studyAgainCount > 0 && (
          <button
            onClick={onStudyAgain}
            className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-gold/10 border border-gold/30 text-gold font-mono text-sm font-semibold hover:bg-gold/20 transition-colors"
          >
            <RefreshCw className="h-4 w-4" />
            Review {studyAgainCount}
          </button>
        )}
        <button
          onClick={onRestart}
          className="flex-1 flex items-center justify-center gap-2 h-11 rounded-xl bg-surface-200 border border-surface-400 text-surface-300 font-mono text-sm font-semibold hover:text-white hover:border-surface-500 transition-colors"
        >
          <RotateCcw className="h-4 w-4" />
          Restart
        </button>
      </div>

      <Link
        href="/law"
        className="mt-5 flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors"
      >
        <BookOpen className="h-3.5 w-3.5" />
        Browse the full Law Codex
      </Link>
    </motion.div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function FlashcardSkeleton() {
  return (
    <div className="w-full rounded-2xl border border-surface-300 bg-surface-100 p-8" style={{ height: '420px' }}>
      <div className="flex justify-between mb-8">
        <Skeleton className="h-4 w-28" />
        <Skeleton className="h-4 w-20" />
      </div>
      <div className="flex-1 space-y-3">
        <Skeleton className="h-6 w-full" />
        <Skeleton className="h-6 w-4/5" />
        <Skeleton className="h-6 w-3/5" />
      </div>
      <div className="mt-auto pt-8 flex justify-center">
        <Skeleton className="h-4 w-40" />
      </div>
    </div>
  )
}

// ─── Main page ────────────────────────────────────────────────────────────────

type CardStatus = 'unseen' | 'learned' | 'again'

export default function FlashcardsPage() {
  const [data, setData] = useState<FlashcardsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [activeCategory, setActiveCategory] = useState<string | null>(null)
  const [currentIndex, setCurrentIndex] = useState(0)
  const [isFlipped, setIsFlipped] = useState(false)
  const [statuses, setStatuses] = useState<Record<string, CardStatus>>({})
  const [sessionComplete, setSessionComplete] = useState(false)
  const [showShortcuts, setShowShortcuts] = useState(false)
  const [direction, setDirection] = useState<1 | -1>(1)

  // Deck is filtered by active category (already handled server-side) then
  // we split into "study again" cards that appear after the main run.
  const deck = useMemo(() => data?.cards ?? [], [data])

  const learnedCount = useMemo(
    () => Object.values(statuses).filter((s) => s === 'learned').length,
    [statuses]
  )
  const againCount = useMemo(
    () => Object.values(statuses).filter((s) => s === 'again').length,
    [statuses]
  )

  const currentCard = deck[currentIndex] ?? null

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const fetchCards = useCallback(async (category: string | null) => {
    setLoading(true)
    setSessionComplete(false)
    setCurrentIndex(0)
    setIsFlipped(false)
    setStatuses({})
    try {
      const params = new URLSearchParams({ limit: '80' })
      if (category) params.set('category', category)
      const res = await fetch(`/api/flashcards?${params}`)
      const json: FlashcardsResponse = await res.json()
      setData(json)
    } catch {
      setData({ cards: [], total: 0, categories: [] })
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchCards(activeCategory)
  }, [activeCategory, fetchCards])

  // ── Navigation helpers ─────────────────────────────────────────────────────

  const goNext = useCallback(() => {
    setDirection(1)
    setIsFlipped(false)
    if (currentIndex < deck.length - 1) {
      setCurrentIndex((i) => i + 1)
    } else {
      setSessionComplete(true)
    }
  }, [currentIndex, deck.length])

  const goPrev = useCallback(() => {
    if (currentIndex === 0) return
    setDirection(-1)
    setIsFlipped(false)
    setCurrentIndex((i) => i - 1)
  }, [currentIndex])

  const markLearned = useCallback(() => {
    if (!currentCard) return
    setStatuses((prev) => ({ ...prev, [currentCard.id]: 'learned' }))
    goNext()
  }, [currentCard, goNext])

  const markAgain = useCallback(() => {
    if (!currentCard) return
    setStatuses((prev) => ({ ...prev, [currentCard.id]: 'again' }))
    goNext()
  }, [currentCard, goNext])

  const handleStudyAgain = useCallback(() => {
    // Build a deck of only "again" cards, reset everything else
    if (!data) return
    const againIds = new Set(
      Object.entries(statuses)
        .filter(([, s]) => s === 'again')
        .map(([id]) => id)
    )
    const againCards = data.cards.filter((c) => againIds.has(c.id))
    setData({ ...data, cards: againCards })
    setStatuses({})
    setCurrentIndex(0)
    setIsFlipped(false)
    setSessionComplete(false)
  }, [data, statuses])

  const handleRestart = useCallback(() => {
    fetchCards(activeCategory)
  }, [activeCategory, fetchCards])

  // ── Keyboard shortcuts ─────────────────────────────────────────────────────

  useEffect(() => {
    function handle(e: KeyboardEvent) {
      if (showShortcuts) return
      const tag = (e.target as HTMLElement).tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return

      switch (e.key) {
        case ' ':
        case 'Enter':
          e.preventDefault()
          setIsFlipped((f) => !f)
          break
        case 'ArrowRight':
        case 'l':
        case 'L':
          e.preventDefault()
          goNext()
          break
        case 'ArrowLeft':
        case 'h':
        case 'H':
          e.preventDefault()
          goPrev()
          break
        case '1':
          markLearned()
          break
        case '2':
          markAgain()
          break
        case 'r':
        case 'R':
          handleRestart()
          break
      }
    }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [goNext, goPrev, markLearned, markAgain, handleRestart, showShortcuts])

  // ── Render ─────────────────────────────────────────────────────────────────

  const progress = deck.length > 0 ? ((currentIndex) / deck.length) * 100 : 0
  const currentStatus = currentCard ? (statuses[currentCard.id] ?? 'unseen') : 'unseen'

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-6 pb-28 md:pb-12">
        {/* Page header */}
        <div className="mb-6 flex items-center gap-3">
          <Link
            href="/law"
            className="flex items-center justify-center h-9 w-9 rounded-lg text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
            aria-label="Back to Law Codex"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex-1">
            <h1 className="font-mono text-xl font-bold text-white flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-gold" />
              Civic Flashcards
            </h1>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              Study established laws from the Codex
            </p>
          </div>
          <button
            onClick={() => setShowShortcuts(true)}
            className="hidden md:flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors"
            aria-label="Keyboard shortcuts"
          >
            <Keyboard className="h-3.5 w-3.5" />
            Shortcuts
          </button>
        </div>

        {/* Category filter */}
        {!loading && (data?.categories?.length ?? 0) > 0 && (
          <div className="flex gap-2 overflow-x-auto pb-2 mb-5 no-scrollbar">
            <button
              onClick={() => setActiveCategory(null)}
              className={cn(
                'flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-colors',
                activeCategory === null
                  ? 'bg-for-500/20 text-for-300 border-for-500/40'
                  : 'bg-surface-200 text-surface-400 border-surface-400 hover:text-white'
              )}
            >
              All Laws
            </button>
            {data?.categories.map((cat) => {
              const style = getCategoryStyle(cat)
              const isActive = activeCategory === cat
              return (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    'flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold border transition-colors',
                    isActive ? style.badge : 'bg-surface-200 text-surface-400 border-surface-400 hover:text-white'
                  )}
                >
                  {cat}
                </button>
              )
            })}
          </div>
        )}

        {/* Progress bar */}
        {!loading && deck.length > 0 && !sessionComplete && (
          <div className="mb-4">
            <div className="flex justify-between items-center mb-1.5">
              <span className="text-xs font-mono text-surface-500">
                {currentIndex + 1} / {deck.length}
              </span>
              <div className="flex items-center gap-3 text-xs font-mono">
                {learnedCount > 0 && (
                  <span className="text-emerald flex items-center gap-1">
                    <Check className="h-3 w-3" />
                    {learnedCount} learned
                  </span>
                )}
                {againCount > 0 && (
                  <span className="text-gold">
                    {againCount} to review
                  </span>
                )}
              </div>
            </div>
            <div className="h-1.5 bg-surface-200 rounded-full overflow-hidden">
              <motion.div
                className="h-full bg-gradient-to-r from-for-600 to-for-400 rounded-full"
                style={{ width: `${progress}%` }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.3 }}
              />
            </div>
          </div>
        )}

        {/* Main content area */}
        {loading ? (
          <FlashcardSkeleton />
        ) : deck.length === 0 ? (
          <EmptyState
            icon={<BookOpen className="h-10 w-10 text-surface-500" />}
            title="No laws yet"
            description="The Codex is still growing. Keep voting on topics to help them become laws."
          />
        ) : sessionComplete ? (
          <SessionComplete
            learned={learnedCount}
            total={deck.length}
            onRestart={handleRestart}
            onStudyAgain={handleStudyAgain}
            studyAgainCount={againCount}
          />
        ) : currentCard ? (
          <div>
            {/* Card with slide animation */}
            <AnimatePresence mode="wait" custom={direction}>
              <motion.div
                key={currentCard.id}
                custom={direction}
                initial={{ x: direction * 60, opacity: 0 }}
                animate={{ x: 0, opacity: 1 }}
                exit={{ x: direction * -60, opacity: 0 }}
                transition={{ duration: 0.18, ease: 'easeInOut' }}
              >
                <FlipCard
                  card={currentCard}
                  isFlipped={isFlipped}
                  onFlip={() => setIsFlipped((f) => !f)}
                />
              </motion.div>
            </AnimatePresence>

            {/* Action buttons */}
            <div className="mt-6 flex flex-col gap-3">
              {/* Flip prompt when not yet flipped */}
              {!isFlipped && (
                <button
                  onClick={() => setIsFlipped(true)}
                  className="w-full h-12 rounded-xl bg-surface-200 border border-surface-400 text-surface-300 font-mono text-sm font-semibold hover:text-white hover:border-surface-500 transition-colors flex items-center justify-center gap-2"
                >
                  <RotateCcw className="h-4 w-4" />
                  Reveal Details
                </button>
              )}

              {/* Mark buttons — show after flip */}
              {isFlipped && (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={markAgain}
                    className="h-12 rounded-xl bg-against-500/10 border border-against-500/30 text-against-300 font-mono text-sm font-semibold hover:bg-against-500/20 transition-colors flex items-center justify-center gap-2"
                    aria-label="Study again later (key: 2)"
                  >
                    <RefreshCw className="h-4 w-4" />
                    Study Again
                  </button>
                  <button
                    onClick={markLearned}
                    className="h-12 rounded-xl bg-emerald/10 border border-emerald/30 text-emerald font-mono text-sm font-semibold hover:bg-emerald/20 transition-colors flex items-center justify-center gap-2"
                    aria-label="Mark learned (key: 1)"
                  >
                    <Check className="h-4 w-4" />
                    Got It
                  </button>
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between">
                <button
                  onClick={goPrev}
                  disabled={currentIndex === 0}
                  className="flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-white disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
                  aria-label="Previous card"
                >
                  <ChevronLeft className="h-4 w-4" />
                  Previous
                </button>

                {/* Status indicator */}
                <div className="flex items-center gap-1.5">
                  {currentStatus === 'learned' && (
                    <span className="text-xs font-mono text-emerald flex items-center gap-1">
                      <Check className="h-3 w-3" /> Learned
                    </span>
                  )}
                  {currentStatus === 'again' && (
                    <span className="text-xs font-mono text-gold">Review later</span>
                  )}
                </div>

                <button
                  onClick={goNext}
                  className="flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-white transition-colors"
                  aria-label="Next card"
                >
                  {currentIndex < deck.length - 1 ? 'Next' : 'Finish'}
                  <ChevronRight className="h-4 w-4" />
                </button>
              </div>
            </div>

            {/* Quick stats strip */}
            <div className="mt-6 flex items-center justify-center gap-6 text-xs font-mono text-surface-500">
              <span className="flex items-center gap-1">
                <Scale className="h-3.5 w-3.5" />
                {deck.length} laws in deck
              </span>
              {activeCategory && (
                <span className={getCategoryStyle(activeCategory).accent}>
                  {activeCategory} category
                </span>
              )}
            </div>
          </div>
        ) : null}
      </main>

      <BottomNav />

      {/* Keyboard shortcuts modal */}
      <AnimatePresence>
        {showShortcuts && (
          <ShortcutsModal onClose={() => setShowShortcuts(false)} />
        )}
      </AnimatePresence>
    </div>
  )
}
