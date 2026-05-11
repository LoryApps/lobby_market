'use client'

/**
 * /topic/[id]/evidence — Topic Evidence Board (full-screen)
 *
 * Dedicated page for browsing, submitting, and analyzing all community
 * evidence for a single topic. Mirrors the Evidence tab in TopicDetail
 * but gives it a proper URL, SEO-indexable surface, and richer context
 * header showing the debate's vote split alongside evidence balance.
 *
 * Features:
 *  - Topic header: statement, status badge, FOR/AGAINST vote split
 *  - Evidence balance bar: share of FOR / AGAINST / NEUTRAL evidence
 *  - Full TopicEvidencePanel (filtering, voting, submission, AI analysis)
 *  - Navigation links: back to topic, arguments, platform evidence library
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowUpRight,
  BookOpen,
  Gavel,
  MessageSquare,
  Scale,
  ThumbsDown,
  ThumbsUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { TopicEvidencePanel } from '@/components/topic/TopicEvidencePanel'
import { cn } from '@/lib/utils/cn'

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

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

function StatusIcon({ status }: { status: string }) {
  const cls = 'h-3.5 w-3.5 flex-shrink-0'
  switch (status) {
    case 'active':
    case 'voting':
      return <Zap className={cn(cls, 'text-for-400')} />
    case 'law':
      return <Gavel className={cn(cls, 'text-gold')} />
    default:
      return <Scale className={cn(cls, 'text-surface-500')} />
  }
}

// ─── Topic header skeleton ─────────────────────────────────────────────────────

function TopicHeaderSkeleton() {
  return (
    <div className="space-y-3 mb-8">
      <Skeleton className="h-3 w-24 rounded" />
      <Skeleton className="h-6 w-full rounded" />
      <Skeleton className="h-5 w-4/5 rounded" />
      <div className="flex gap-2 mt-2">
        <Skeleton className="h-5 w-16 rounded-full" />
        <Skeleton className="h-5 w-20 rounded-full" />
      </div>
      <Skeleton className="h-3 w-full rounded-full mt-2" />
    </div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function TopicEvidencePage() {
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
  const votes = topic?.total_votes ?? 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pb-24 pt-4">

        {/* ── Back nav ────────────────────────────────────────────────────── */}
        <div className="flex items-center justify-between mb-4">
          <Link
            href={id ? `/topic/${id}` : '/'}
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to topic
          </Link>

          <div className="flex items-center gap-2">
            {id && (
              <>
                <Link
                  href={`/topic/${id}/arguments`}
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-200 border border-surface-300 text-[11px] font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors flex-shrink-0"
                >
                  <MessageSquare className="h-3 w-3" />
                  Arguments
                </Link>
                <Link
                  href="/evidence"
                  className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-emerald/10 border border-emerald/30 text-[11px] font-mono text-emerald hover:bg-emerald/20 transition-colors flex-shrink-0"
                >
                  <BookOpen className="h-3 w-3" />
                  Library
                  <ArrowUpRight className="h-2.5 w-2.5" />
                </Link>
              </>
            )}
          </div>
        </div>

        {/* ── Topic context header ─────────────────────────────────────────── */}
        {loading ? (
          <TopicHeaderSkeleton />
        ) : error || !topic ? (
          <div className="mb-8 p-4 rounded-xl bg-against-500/10 border border-against-500/20 text-sm font-mono text-against-400">
            {error ?? 'Topic not found'}
          </div>
        ) : (
          <div className="mb-8 space-y-3">
            {/* Category + status row */}
            <div className="flex items-center gap-2 flex-wrap">
              <div className="flex items-center gap-1.5">
                <StatusIcon status={topic.status} />
                <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'} size="sm">
                  {STATUS_LABEL[topic.status] ?? topic.status}
                </Badge>
              </div>
              {topic.category && (
                <span className="text-[11px] font-mono text-surface-500 px-2 py-0.5 rounded-full bg-surface-200 border border-surface-300">
                  {topic.category}
                </span>
              )}
            </div>

            {/* Topic statement */}
            <h1 className="text-base font-mono font-bold text-white leading-snug">
              {topic.statement}
            </h1>

            {/* Vote split */}
            <div className="space-y-1.5">
              <div className="flex items-center justify-between text-[10px] font-mono">
                <span className="flex items-center gap-1 text-for-400 font-semibold">
                  <ThumbsUp className="h-3 w-3" />
                  FOR {forPct}%
                </span>
                <span className="text-surface-600">
                  {votes > 0 ? `${votes.toLocaleString()} votes` : 'No votes yet'}
                </span>
                <span className="flex items-center gap-1 text-against-400 font-semibold">
                  {againstPct}% AGAINST
                  <ThumbsDown className="h-3 w-3" />
                </span>
              </div>
              <div className="h-1.5 rounded-full bg-against-600/50 overflow-hidden">
                <motion.div
                  className="h-full rounded-full bg-for-500"
                  initial={{ width: 0 }}
                  animate={{ width: `${forPct}%` }}
                  transition={{ duration: 0.5, ease: 'easeOut', delay: 0.1 }}
                />
              </div>
            </div>
          </div>
        )}

        {/* ── Section header ────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2 mb-4">
          <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-purple/10 border border-purple/30 flex-shrink-0">
            <BookOpen className="h-3.5 w-3.5 text-purple" />
          </div>
          <div>
            <h2 className="text-sm font-mono font-bold text-white">Evidence Board</h2>
            <p className="text-[10px] font-mono text-surface-500">
              Community-sourced citations ranked by upvotes
            </p>
          </div>
        </div>

        {/* ── Evidence panel ────────────────────────────────────────────────── */}
        {id && (
          <TopicEvidencePanel topicId={id} />
        )}

        {/* ── Footer links ──────────────────────────────────────────────────── */}
        <div className="mt-10 pt-6 border-t border-surface-300/50 flex flex-wrap items-center gap-3">
          {id && (
            <Link
              href={`/topic/${id}`}
              className="flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-3 w-3" />
              Back to topic
            </Link>
          )}
          <span className="text-surface-700 text-[11px]">·</span>
          <Link
            href="/evidence"
            className="flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-emerald transition-colors"
          >
            <BookOpen className="h-3 w-3" />
            Platform evidence library
          </Link>
          <span className="text-surface-700 text-[11px]">·</span>
          {id && (
            <Link
              href={`/topic/${id}/arguments`}
              className="flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-for-400 transition-colors"
            >
              <MessageSquare className="h-3 w-3" />
              Browse arguments
            </Link>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
