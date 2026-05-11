'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowUpRight,
  GitMerge,
  Handshake,
  MessageSquare,
  Scale,
  Swords,
  ThumbsDown,
  ThumbsUp,
  Gavel,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { TopicSynthesisPanel } from '@/components/topic/TopicSynthesisPanel'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TopicMeta {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number | null
  total_votes: number | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'Law',
  failed: 'Failed',
}

function StatusIcon({ status }: { status: string }) {
  if (status === 'active' || status === 'voting') return <Zap className="h-3 w-3" />
  if (status === 'law') return <Gavel className="h-3 w-3" />
  return <Scale className="h-3 w-3" />
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TopicSynthesisPage() {
  const params = useParams()
  const id = params?.id as string
  const [topic, setTopic] = useState<TopicMeta | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadTopic = useCallback(async () => {
    if (!id) return
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${id}`)
      if (!res.ok) throw new Error('Topic not found')
      const data = await res.json() as { topic: TopicMeta }
      setTopic(data.topic)
    } catch {
      setError('Could not load topic')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => {
    loadTopic()
  }, [loadTopic])

  const forPct = Math.round(topic?.blue_pct ?? 50)
  const againstPct = 100 - forPct

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pb-24 pt-4">

        {/* Back nav */}
        <div className="flex items-center justify-between mb-4">
          <Link
            href={topic ? `/topic/${topic.id}` : '/'}
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to topic
          </Link>
          <div className="flex items-center gap-2">
            <Link
              href={topic ? `/topic/${topic.id}/arguments` : '#'}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-200 border border-surface-300 text-[11px] font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
            >
              <MessageSquare className="h-3 w-3" />
              Arguments
            </Link>
            <Link
              href={topic ? `/topic/${topic.id}/evidence` : '#'}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-200 border border-surface-300 text-[11px] font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
            >
              <ArrowUpRight className="h-3 w-3" />
              Evidence
            </Link>
          </div>
        </div>

        {/* Topic header */}
        <div className="mb-8">
          {loading ? (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-24 rounded-full" />
              </div>
              <Skeleton className="h-6 w-full rounded" />
              <Skeleton className="h-5 w-4/5 rounded" />
              <Skeleton className="h-3 w-full rounded-full" />
            </div>
          ) : error ? (
            <p className="text-sm font-mono text-against-400">{error}</p>
          ) : topic ? (
            <motion.div
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.25 }}
              className="space-y-3"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <Badge
                  variant={
                    topic.status === 'law' ? 'law'
                    : topic.status === 'voting' ? 'voting'
                    : topic.status === 'active' ? 'active'
                    : 'default'
                  }
                  className="inline-flex items-center gap-1 text-[11px]"
                >
                  <StatusIcon status={topic.status} />
                  {STATUS_LABEL[topic.status] ?? topic.status}
                </Badge>
                {topic.category && (
                  <span className="text-[11px] font-mono text-surface-500 px-2 py-0.5 rounded-full bg-surface-200 border border-surface-300">
                    {topic.category}
                  </span>
                )}
              </div>

              <h1 className="text-lg font-mono font-bold text-white leading-snug">
                {topic.statement}
              </h1>

              {/* Vote split bar */}
              <div className="space-y-1.5">
                <div className="flex justify-between text-[10px] font-mono">
                  <span className="flex items-center gap-1 text-for-400">
                    <ThumbsUp className="h-3 w-3" />
                    FOR {forPct}%
                  </span>
                  <span className="text-surface-500">
                    {(topic.total_votes ?? 0).toLocaleString()} votes
                  </span>
                  <span className="flex items-center gap-1 text-against-400">
                    AGAINST {againstPct}%
                    <ThumbsDown className="h-3 w-3" />
                  </span>
                </div>
                <div className="h-2 rounded-full bg-surface-300 overflow-hidden">
                  <motion.div
                    className="h-full bg-gradient-to-r from-for-500 to-for-400 rounded-full"
                    initial={{ width: 0 }}
                    animate={{ width: `${forPct}%` }}
                    transition={{ duration: 0.6, ease: 'easeOut' }}
                  />
                </div>
              </div>
            </motion.div>
          ) : null}
        </div>

        {/* Section header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-purple/10 border border-purple/20 flex-shrink-0">
            <GitMerge className="h-4 w-4 text-purple" />
          </div>
          <div>
            <p className="text-sm font-mono font-bold text-white">Argument Synthesis</p>
            <p className="text-[11px] font-mono text-surface-500">
              AI-identified common ground, core tensions, and nuanced position
            </p>
          </div>
        </div>

        {/* Synthesis panel */}
        {id && <TopicSynthesisPanel topicId={id} />}

        {/* What each section means */}
        <div className="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-emerald/20 bg-emerald/5 p-4 space-y-2">
            <div className="flex items-center gap-1.5">
              <Handshake className="h-3.5 w-3.5 text-emerald" />
              <span className="text-[10px] font-mono font-bold text-emerald uppercase tracking-wider">
                Common Ground
              </span>
            </div>
            <p className="text-[11px] font-mono text-surface-500 leading-relaxed">
              Values or goals both sides actually share, even when they disagree on approach.
            </p>
          </div>
          <div className="rounded-xl border border-against-500/20 bg-against-500/5 p-4 space-y-2">
            <div className="flex items-center gap-1.5">
              <Swords className="h-3.5 w-3.5 text-against-400" />
              <span className="text-[10px] font-mono font-bold text-against-400 uppercase tracking-wider">
                Core Tensions
              </span>
            </div>
            <p className="text-[11px] font-mono text-surface-500 leading-relaxed">
              The fundamental value conflict making this debate hard to resolve.
            </p>
          </div>
          <div className="rounded-xl border border-purple/20 bg-purple/5 p-4 space-y-2">
            <div className="flex items-center gap-1.5">
              <Scale className="h-3.5 w-3.5 text-purple" />
              <span className="text-[10px] font-mono font-bold text-purple uppercase tracking-wider">
                Synthesis
              </span>
            </div>
            <p className="text-[11px] font-mono text-surface-500 leading-relaxed">
              A nuanced position acknowledging the strongest concerns from both sides.
            </p>
          </div>
        </div>

        {/* Footer nav */}
        <div className="mt-8 flex items-center gap-3 flex-wrap">
          <Link
            href={topic ? `/topic/${topic.id}` : '/'}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to topic
          </Link>
          <Link
            href={topic ? `/topic/${topic.id}/arguments` : '#'}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
          >
            <MessageSquare className="h-3.5 w-3.5" />
            Browse arguments
          </Link>
          <Link
            href={topic ? `/topic/${topic.id}/evidence` : '#'}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
          >
            <ArrowUpRight className="h-3.5 w-3.5" />
            Evidence board
          </Link>
        </div>

      </main>
      <BottomNav />
    </div>
  )
}
