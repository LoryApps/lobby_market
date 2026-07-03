'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowUpRight,
  Check,
  ChevronDown,
  ChevronUp,
  HelpCircle,
  Loader2,
  MessageSquare,
  Plus,
  ThumbsUp,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { TopicQuestion, QuestionsResponse } from '@/app/api/topics/[id]/questions/route'

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

interface QuestionRowProps {
  question: TopicQuestion
  topicId: string
  currentUserId: string | null
  onVote: (qid: string, voted: boolean, newCount: number) => void
}

function QuestionRow({ question, topicId, currentUserId, onVote }: QuestionRowProps) {
  const [upvotes, setUpvotes] = useState(question.upvotes)
  const [voted, setVoted] = useState(question.user_voted)
  const [voting, setVoting] = useState(false)

  async function handleVote(e: React.MouseEvent) {
    e.preventDefault()
    if (voting || !currentUserId || question.author_id === currentUserId) return
    setVoting(true)
    const wasVoted = voted
    setVoted(!wasVoted)
    setUpvotes((n) => n + (wasVoted ? -1 : 1))
    try {
      const res = await fetch(`/api/topics/${topicId}/questions/${question.id}/vote`, {
        method: 'POST',
      })
      if (res.ok) {
        const data = await res.json()
        const newVoted: boolean = data.voted
        const newCount = upvotes + (newVoted ? 1 : -1)
        setVoted(newVoted)
        setUpvotes(newCount)
        onVote(question.id, newVoted, newCount)
      } else {
        setVoted(wasVoted)
        setUpvotes((n) => n + (wasVoted ? 1 : -1))
      }
    } catch {
      setVoted(wasVoted)
      setUpvotes((n) => n + (wasVoted ? 1 : -1))
    } finally {
      setVoting(false)
    }
  }

  return (
    <Link
      href={`/questions/${question.id}`}
      className="group flex items-start gap-3 py-3 px-1 hover:bg-surface-200/30 rounded-lg transition-colors"
    >
      {/* Upvote */}
      <button
        onClick={handleVote}
        className={cn(
          'flex flex-col items-center gap-0.5 min-w-[32px] shrink-0 mt-0.5',
          'transition-colors',
          voted ? 'text-for-400' : 'text-surface-500 hover:text-for-400',
          (!currentUserId || question.author_id === currentUserId) && 'pointer-events-none opacity-50',
        )}
        aria-label={voted ? 'Remove upvote' : 'Upvote question'}
      >
        {voting ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <ThumbsUp className="h-3.5 w-3.5" />
        )}
        <span className="text-[10px] font-mono font-semibold leading-none">{upvotes}</span>
      </button>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-[13px] text-white/90 leading-snug line-clamp-2 group-hover:text-white transition-colors">
          {question.content}
        </p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {question.is_answered && (
            <span className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald bg-emerald/10 border border-emerald/30 px-1.5 py-0.5 rounded-full">
              <Check className="h-2.5 w-2.5" />
              Answered
            </span>
          )}
          <span className="inline-flex items-center gap-0.5 text-[10px] text-surface-500">
            <MessageSquare className="h-3 w-3" />
            {question.answer_count}
          </span>
          {question.author && (
            <>
              <span className="text-surface-600">·</span>
              <span className="text-[10px] text-surface-500">
                {question.author.display_name ?? question.author.username}
              </span>
            </>
          )}
          <span className="text-surface-600">·</span>
          <span className="text-[10px] text-surface-500">{relativeTime(question.created_at)}</span>
        </div>
      </div>

      <ArrowUpRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-surface-400 shrink-0 mt-0.5 transition-colors" />
    </Link>
  )
}

interface TopicQAPanelProps {
  topicId: string
  topicStatement: string
  className?: string
}

type PanelState = 'loading' | 'empty' | 'ready' | 'error'

export function TopicQAPanel({ topicId, className }: Omit<TopicQAPanelProps, 'topicStatement'> & { topicStatement?: string }) {
  const [state, setState] = useState<PanelState>('loading')
  const [questions, setQuestions] = useState<TopicQuestion[]>([])
  const [total, setTotal] = useState(0)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setCurrentUserId(user?.id ?? null)
    })
  }, [])

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/topics/${topicId}/questions?sort=top`, {
        cache: 'no-store',
      })
      if (!res.ok) {
        setState('error')
        return
      }
      const data: QuestionsResponse = await res.json()
      setQuestions(data.questions ?? [])
      setTotal(data.total ?? 0)
      setState(data.questions.length === 0 ? 'empty' : 'ready')
    } catch {
      setState('error')
    }
  }, [topicId])

  useEffect(() => {
    load()
  }, [load])

  function handleVote(qid: string, voted: boolean, newCount: number) {
    setQuestions((prev) =>
      prev.map((q) =>
        q.id === qid ? { ...q, user_voted: voted, upvotes: newCount } : q
      )
    )
  }

  const visible = expanded ? questions : questions.slice(0, 3)

  return (
    <div className={cn('rounded-2xl bg-surface-100 border border-surface-300', className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-surface-300/60">
        <div className="flex items-center gap-2">
          <HelpCircle className="h-4 w-4 text-purple" />
          <h3 className="text-sm font-semibold text-white/90">
            Community Q&amp;A
          </h3>
          {total > 0 && (
            <span className="text-[10px] font-mono font-semibold text-purple bg-purple/10 border border-purple/30 px-1.5 py-0.5 rounded-full">
              {total}
            </span>
          )}
        </div>
        <Link
          href={`/topic/${topicId}/ask`}
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-purple hover:text-purple/80 transition-colors"
        >
          <Plus className="h-3 w-3" />
          Ask
        </Link>
      </div>

      {/* Body */}
      <div className="px-4 py-1">
        {state === 'loading' && (
          <div className="space-y-3 py-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="flex items-start gap-3">
                <Skeleton className="h-8 w-8 rounded-lg shrink-0" />
                <div className="flex-1 space-y-1.5">
                  <Skeleton className="h-3.5 w-full" />
                  <Skeleton className="h-3 w-3/4" />
                </div>
              </div>
            ))}
          </div>
        )}

        {state === 'error' && (
          <p className="text-[12px] text-surface-500 py-4 text-center">
            Couldn&apos;t load questions.
          </p>
        )}

        {state === 'empty' && (
          <div className="py-6 text-center space-y-2">
            <HelpCircle className="h-8 w-8 text-surface-600 mx-auto" />
            <p className="text-[12px] text-surface-400">No questions yet.</p>
            <Link
              href={`/topic/${topicId}/ask`}
              className="inline-flex items-center gap-1 text-[12px] font-semibold text-purple hover:text-purple/80 transition-colors"
            >
              <Plus className="h-3.5 w-3.5" />
              Be the first to ask
            </Link>
          </div>
        )}

        {state === 'ready' && (
          <AnimatePresence initial={false}>
            <div className="divide-y divide-surface-300/40">
              {visible.map((q) => (
                <motion.div
                  key={q.id}
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                >
                  <QuestionRow
                    question={q}
                    topicId={topicId}
                    currentUserId={currentUserId}
                    onVote={handleVote}
                  />
                </motion.div>
              ))}
            </div>

            {questions.length > 3 && (
              <button
                onClick={() => setExpanded((e) => !e)}
                className="flex items-center gap-1 text-[11px] text-surface-500 hover:text-white transition-colors py-2 w-full justify-center"
              >
                {expanded ? (
                  <>
                    <ChevronUp className="h-3.5 w-3.5" />
                    Show less
                  </>
                ) : (
                  <>
                    <ChevronDown className="h-3.5 w-3.5" />
                    {questions.length - 3} more question{questions.length - 3 !== 1 ? 's' : ''}
                  </>
                )}
              </button>
            )}

            {total > 0 && (
              <div className="pb-2 pt-1 border-t border-surface-300/40 flex justify-end">
                <Link
                  href={`/topic/${topicId}/ask`}
                  className="inline-flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-purple transition-colors"
                >
                  See all {total} question{total !== 1 ? 's' : ''} &rarr;
                </Link>
              </div>
            )}
          </AnimatePresence>
        )}
      </div>
    </div>
  )
}
