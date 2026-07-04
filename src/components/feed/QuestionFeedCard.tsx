'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { MessageCircleQuestion, ArrowRight, ChevronUp, Loader2 } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { cn } from '@/lib/utils/cn'
import type { FeaturedQuestion } from '@/app/api/questions/featured/route'

// ─── Single question row ───────────────────────────────────────────────────────

function QuestionRow({ q, index }: { q: FeaturedQuestion; index: number }) {
  const topicHref = `/topic/${q.topic_id}?tab=qa`

  return (
    <motion.div
      initial={{ opacity: 0, x: -6 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: index * 0.06, duration: 0.22 }}
    >
      <Link
        href={topicHref}
        className={cn(
          'group flex items-start gap-3 px-4 py-3 rounded-xl',
          'bg-surface-200/40 hover:bg-surface-200/80 border border-surface-300/40 hover:border-surface-400/60',
          'transition-colors duration-150'
        )}
      >
        {/* Upvote count */}
        <div className="flex flex-col items-center gap-0.5 pt-0.5 flex-shrink-0">
          <ChevronUp className="h-3 w-3 text-for-400" aria-hidden="true" />
          <span className="text-[11px] font-mono font-bold text-for-400 leading-none">
            {q.upvotes}
          </span>
        </div>

        {/* Question text */}
        <div className="flex-1 min-w-0">
          <p className="text-sm text-white leading-snug line-clamp-2 group-hover:text-for-200 transition-colors">
            {q.content}
          </p>
          {q.topic && (
            <p className="mt-1 text-[11px] font-mono text-surface-500 line-clamp-1">
              re: {q.topic.statement}
            </p>
          )}
        </div>

        {/* Arrow */}
        <ArrowRight className="h-3.5 w-3.5 text-surface-500 group-hover:text-for-400 flex-shrink-0 mt-0.5 transition-colors" aria-hidden="true" />
      </Link>
    </motion.div>
  )
}

// ─── Card ─────────────────────────────────────────────────────────────────────

interface Props {
  /** Which injection slot this card occupies (1-based); used to pick a stable subset */
  slotIndex: number
}

export function QuestionFeedCard({ slotIndex }: Props) {
  const [questions, setQuestions] = useState<FeaturedQuestion[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/questions/featured')
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d?.questions) return
        const all: FeaturedQuestion[] = d.questions
        // Rotate the shown subset by slot so adjacent cards don't show the same question
        const offset = ((slotIndex - 1) * 2) % Math.max(all.length, 1)
        const rotated = [...all.slice(offset), ...all.slice(0, offset)]
        setQuestions(rotated.slice(0, 3))
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [slotIndex])

  // Don't render if there's nothing to show
  if (!loading && questions.length === 0) return null

  return (
    <div className="mx-4 my-3">
      <div
        className={cn(
          'rounded-2xl border border-surface-300/60 bg-surface-100/80 overflow-hidden',
          'shadow-[0_2px_16px_rgba(0,0,0,0.25)]'
        )}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-for-600/20 border border-for-500/30">
              <MessageCircleQuestion className="h-4 w-4 text-for-400" aria-hidden="true" />
            </span>
            <span className="text-xs font-mono font-semibold text-surface-600 uppercase tracking-wider">
              Open Questions
            </span>
          </div>
          <Link
            href="/questions"
            className="text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors"
          >
            See all
          </Link>
        </div>

        {/* Body */}
        <div className="px-3 pb-3 space-y-1.5">
          <AnimatePresence mode="wait">
            {loading ? (
              <motion.div
                key="skeleton"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="flex items-center justify-center py-6"
              >
                <Loader2 className="h-5 w-5 text-surface-500 animate-spin" />
              </motion.div>
            ) : (
              <motion.div key="content" className="space-y-1.5">
                {questions.map((q, i) => (
                  <QuestionRow key={q.id} q={q} index={i} />
                ))}
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Footer CTA */}
        {!loading && questions.length > 0 && (
          <div className="border-t border-surface-300/40 px-4 py-2.5">
            <Link
              href="/questions"
              className={cn(
                'flex items-center justify-center gap-1.5 w-full py-2 rounded-lg',
                'text-xs font-mono font-semibold text-for-400 hover:text-for-300',
                'bg-for-600/10 hover:bg-for-600/20 border border-for-600/20 hover:border-for-500/30',
                'transition-colors duration-150'
              )}
            >
              <MessageCircleQuestion className="h-3.5 w-3.5" aria-hidden="true" />
              Answer a question
            </Link>
          </div>
        )}
      </div>
    </div>
  )
}
