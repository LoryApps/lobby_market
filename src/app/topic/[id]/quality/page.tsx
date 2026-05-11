'use client'

/**
 * /topic/[id]/quality — Discourse Quality Report
 *
 * Full-screen, dedicated quality analysis for a single topic's debate.
 * Surfaces the AI grade distribution, per-side argument quality, and the
 * top-graded argument from each side — giving citizens and moderators a
 * clear picture of the intellectual rigour of the conversation.
 *
 * Distinct from:
 *   /topic/[id]/arguments  — browse all arguments
 *   /topic/[id]/synthesis  — AI common-ground / tensions
 *   /topic/[id]/evidence   — source citations
 *   /arguments/top-scored  — platform-wide quality leaderboard
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  BarChart2,
  BookOpen,
  CheckCircle2,
  ExternalLink,
  Gavel,
  GitMerge,
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
import { ArgumentQualityPanel } from '@/components/topic/ArgumentQualityPanel'
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

const BADGE_VARIANT: Record<string, 'proposed' | 'active' | 'law' | 'failed' | 'default'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TopicQualityPage() {
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

        {/* Back + sibling nav */}
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
              <BookOpen className="h-3 w-3" />
              Evidence
            </Link>
            <Link
              href={topic ? `/topic/${topic.id}/synthesis` : '#'}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-200 border border-surface-300 text-[11px] font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
            >
              <GitMerge className="h-3 w-3" />
              Synthesis
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
                  variant={BADGE_VARIANT[topic.status] ?? 'default'}
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
          <div className="flex items-center justify-center h-8 w-8 rounded-xl bg-emerald/10 border border-emerald/20 flex-shrink-0">
            <Award className="h-4 w-4 text-emerald" />
          </div>
          <div>
            <p className="text-sm font-mono font-bold text-white">Discourse Quality Report</p>
            <p className="text-[11px] font-mono text-surface-500">
              AI-graded argument quality — grade distribution, per-side rigour, and standout arguments
            </p>
          </div>
        </div>

        {/* Quality panel — pulls its own data from /api/topics/[id]/argument-quality */}
        {id && <ArgumentQualityPanel topicId={id} />}

        {/* Legend — what each grade means */}
        <div className="mt-8 space-y-3">
          <p className="text-[11px] font-mono font-semibold text-surface-400 uppercase tracking-wider">
            Grade rubric
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
            {[
              {
                grade: 'A',
                label: 'Exceptional',
                desc: 'Evidence-backed, logically sound, addresses counter-arguments, concise and compelling.',
                text: 'text-emerald',
                bg: 'bg-emerald/10',
                border: 'border-emerald/25',
              },
              {
                grade: 'B',
                label: 'Strong',
                desc: 'Well-reasoned with relevant support. Minor gaps in evidence or counterargument handling.',
                text: 'text-for-300',
                bg: 'bg-for-500/10',
                border: 'border-for-500/25',
              },
              {
                grade: 'C',
                label: 'Adequate',
                desc: 'Makes a valid point but lacks depth, evidence, or engages imprecisely with the topic.',
                text: 'text-gold',
                bg: 'bg-gold/10',
                border: 'border-gold/25',
              },
              {
                grade: 'D',
                label: 'Weak',
                desc: 'Vague or underdeveloped. Opinion without reasoning or misses the core debate.',
                text: 'text-against-300',
                bg: 'bg-against-500/10',
                border: 'border-against-500/25',
              },
              {
                grade: 'F',
                label: 'Poor',
                desc: 'No substantive contribution — off-topic, incoherent, or purely emotional without logic.',
                text: 'text-against-400',
                bg: 'bg-against-600/10',
                border: 'border-against-600/25',
              },
            ].map(({ grade, label, desc, text, bg, border }) => (
              <div
                key={grade}
                className={cn(
                  'flex items-start gap-3 rounded-xl border p-3.5',
                  bg,
                  border
                )}
              >
                <span
                  className={cn(
                    'flex-shrink-0 text-sm font-mono font-bold w-5 text-center',
                    text
                  )}
                >
                  {grade}
                </span>
                <div>
                  <p className={cn('text-xs font-mono font-semibold', text)}>{label}</p>
                  <p className="text-[11px] font-mono text-surface-500 leading-relaxed mt-0.5">
                    {desc}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Quality context callouts */}
        <div className="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-emerald/20 bg-emerald/5 p-4 space-y-2">
            <div className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald" />
              <span className="text-[10px] font-mono font-bold text-emerald uppercase tracking-wider">
                Graded %
              </span>
            </div>
            <p className="text-[11px] font-mono text-surface-500 leading-relaxed">
              The share of arguments that received an AI quality review. Higher is better —
              it means more arguments have been assessed for rigour.
            </p>
          </div>
          <div className="rounded-xl border border-for-500/20 bg-for-500/5 p-4 space-y-2">
            <div className="flex items-center gap-1.5">
              <BarChart2 className="h-3.5 w-3.5 text-for-400" />
              <span className="text-[10px] font-mono font-bold text-for-400 uppercase tracking-wider">
                Avg Score
              </span>
            </div>
            <p className="text-[11px] font-mono text-surface-500 leading-relaxed">
              Mean AI quality score across all graded arguments (1–10 scale). Scores ≥ 8
              indicate an excellent debate; 6–8 is good; below 4 is poor.
            </p>
          </div>
          <div className="rounded-xl border border-purple/20 bg-purple/5 p-4 space-y-2">
            <div className="flex items-center gap-1.5">
              <Scale className="h-3.5 w-3.5 text-purple" />
              <span className="text-[10px] font-mono font-bold text-purple uppercase tracking-wider">
                Balance
              </span>
            </div>
            <p className="text-[11px] font-mono text-surface-500 leading-relaxed">
              Whether the FOR and AGAINST sides are making equally strong cases. Balanced
              debates produce more credible outcomes.
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
            <BookOpen className="h-3.5 w-3.5" />
            Evidence board
          </Link>
          <Link
            href={topic ? `/topic/${topic.id}/synthesis` : '#'}
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
          >
            <GitMerge className="h-3.5 w-3.5" />
            Synthesis
          </Link>
          <Link
            href="/arguments/top-scored"
            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
          >
            <ExternalLink className="h-3.5 w-3.5" />
            Platform quality board
          </Link>
        </div>

      </main>
      <BottomNav />
    </div>
  )
}
