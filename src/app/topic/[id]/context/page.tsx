'use client'

/**
 * /topic/[id]/context — What's at Stake
 *
 * Full-screen, SEO-indexable context brief for a single topic. Uses Claude's
 * real-world knowledge (not platform argument data) to explain:
 *   • Background — what the issue is and why it's contested
 *   • If FOR wins — real-world implications
 *   • If AGAINST wins — real-world implications
 *   • Core tension — the fundamental value trade-off
 *   • Real-world examples (when available)
 *
 * Distinct from:
 *   /topic/[id]/synthesis  — AI common-ground from platform debates
 *   /topic/[id]/evidence   — community-sourced citations
 *   /topic/[id]/quality    — argument quality analysis
 *   /topic/[id]/brief      — community argument summary (AI)
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BookOpen,
  ExternalLink,
  Gavel,
  GitMerge,
  Globe,
  Loader2,
  MessageSquare,
  RefreshCw,
  Scale,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
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

interface ParsedContext {
  background: string
  if_for: string
  if_against: string
  key_tension: string
  examples?: string
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
  if (status === 'active' || status === 'voting') return <Zap className={cn(cls, 'text-for-400')} />
  if (status === 'law') return <Gavel className={cn(cls, 'text-gold')} />
  return <Scale className={cn(cls, 'text-surface-500')} />
}

const BADGE_VARIANT: Record<string, 'proposed' | 'active' | 'law' | 'failed' | 'default'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

function parseContext(raw: string): ParsedContext | null {
  try {
    const clean = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()
    const parsed = JSON.parse(clean)
    if (typeof parsed.background === 'string' && typeof parsed.if_for === 'string') {
      return parsed as ParsedContext
    }
    return null
  } catch {
    return null
  }
}

// ─── Section card ─────────────────────────────────────────────────────────────

function ContextSection({
  icon: Icon,
  label,
  labelColor,
  bgColor,
  borderColor,
  body,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  labelColor: string
  bgColor: string
  borderColor: string
  body: string
}) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('rounded-2xl border p-5', bgColor, borderColor)}
    >
      <div className="flex items-center gap-2 mb-3">
        <Icon className={cn('h-4 w-4 flex-shrink-0', labelColor)} />
        <span className={cn('text-[11px] font-mono font-bold uppercase tracking-widest', labelColor)}>
          {label}
        </span>
      </div>
      <p className="text-sm font-mono text-surface-300 leading-relaxed">{body}</p>
    </motion.div>
  )
}

// ─── Skeleton ─────────────────────────────────────────────────────────────────

function ContextSkeleton() {
  return (
    <div className="space-y-4">
      {[1, 2, 3, 4].map((i) => (
        <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-3">
          <Skeleton className="h-3 w-28 rounded" />
          <Skeleton className="h-4 w-full rounded" />
          <Skeleton className="h-4 w-11/12 rounded" />
          {i === 1 && <Skeleton className="h-4 w-5/6 rounded" />}
        </div>
      ))}
    </div>
  )
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default function TopicContextPage() {
  const params = useParams()
  const id = typeof params?.id === 'string' ? params.id : Array.isArray(params?.id) ? params.id[0] : null

  const [topic, setTopic] = useState<TopicMeta | null>(null)
  const [topicLoading, setTopicLoading] = useState(true)
  const [topicError, setTopicError] = useState<string | null>(null)

  const [context, setContext] = useState<ParsedContext | null>(null)
  const [contextLoading, setContextLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [contextError, setContextError] = useState<string | null>(null)

  // ── Load topic metadata ───────────────────────────────────────────────────
  const loadTopic = useCallback(async () => {
    if (!id) return
    try {
      const res = await fetch(`/api/topics/${id}`)
      if (!res.ok) throw new Error('Topic not found')
      const data = await res.json() as { topic: TopicMeta }
      setTopic(data.topic)
    } catch {
      setTopicError('Could not load topic')
    } finally {
      setTopicLoading(false)
    }
  }, [id])

  // ── Load cached context ───────────────────────────────────────────────────
  const loadContext = useCallback(async () => {
    if (!id) return
    setContextLoading(true)
    try {
      const res = await fetch(`/api/topics/${id}/context`)
      const data = await res.json() as { context: string | null; generated_at: string | null; unavailable?: boolean }
      if (data.unavailable) { setUnavailable(true); return }
      if (data.context) {
        setContext(parseContext(data.context))
        setGeneratedAt(data.generated_at)
      }
    } catch {
      setContextError('Could not load context')
    } finally {
      setContextLoading(false)
    }
  }, [id])

  useEffect(() => { loadTopic() }, [loadTopic])
  useEffect(() => { loadContext() }, [loadContext])

  // ── Generate ──────────────────────────────────────────────────────────────
  async function generate() {
    if (!id || generating) return
    setGenerating(true)
    setContextError(null)
    try {
      const res = await fetch(`/api/topics/${id}/context`, { method: 'POST' })
      const data = await res.json() as { context: string | null; generated_at: string | null; error?: string }
      if (!res.ok) throw new Error(data.error ?? 'Generation failed')
      if (data.context) {
        setContext(parseContext(data.context))
        setGeneratedAt(data.generated_at)
      }
    } catch (err) {
      setContextError(err instanceof Error ? err.message : 'Generation failed')
    } finally {
      setGenerating(false)
    }
  }

  const forPct = Math.round(topic?.blue_pct ?? 50)
  const againstPct = 100 - forPct

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pb-28 pt-4">

        {/* Back + sibling nav */}
        <div className="flex items-center justify-between mb-5 flex-wrap gap-2">
          <Link
            href={topic ? `/topic/${topic.id}` : '/'}
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to topic
          </Link>
          <div className="flex items-center gap-2 flex-wrap">
            <Link
              href={topic ? `/topic/${topic.id}/arguments` : '#'}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-200 border border-surface-300 text-[11px] font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
            >
              <MessageSquare className="h-3 w-3" />
              Arguments
            </Link>
            <Link
              href={topic ? `/topic/${topic.id}/synthesis` : '#'}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-200 border border-surface-300 text-[11px] font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
            >
              <GitMerge className="h-3 w-3" />
              Synthesis
            </Link>
            <Link
              href={topic ? `/topic/${topic.id}/evidence` : '#'}
              className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-surface-200 border border-surface-300 text-[11px] font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
            >
              <BookOpen className="h-3 w-3" />
              Evidence
            </Link>
          </div>
        </div>

        {/* Topic header */}
        <div className="mb-8">
          {topicLoading ? (
            <div className="space-y-3">
              <div className="flex gap-2">
                <Skeleton className="h-5 w-16 rounded-full" />
                <Skeleton className="h-5 w-24 rounded-full" />
              </div>
              <Skeleton className="h-6 w-full rounded" />
              <Skeleton className="h-5 w-4/5 rounded" />
              <Skeleton className="h-2.5 w-full rounded-full" />
            </div>
          ) : topicError ? (
            <p className="text-sm font-mono text-against-400">{topicError}</p>
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
        <div className="flex items-center gap-3 mb-6">
          <div className="flex items-center justify-center h-9 w-9 rounded-xl bg-purple/10 border border-purple/20 flex-shrink-0">
            <Globe className="h-5 w-5 text-purple" />
          </div>
          <div>
            <p className="text-sm font-mono font-bold text-white">What&apos;s at Stake</p>
            <p className="text-[11px] font-mono text-surface-500">
              Real-world context — background, stakes, and the core value tension
            </p>
          </div>
          <div className="ml-auto flex items-center gap-1.5 text-[10px] font-mono text-surface-600">
            <Sparkles className="h-3 w-3" />
            Claude
          </div>
        </div>

        {/* Context content */}
        <AnimatePresence mode="wait">
          {contextLoading ? (
            <motion.div key="skeleton" exit={{ opacity: 0 }}>
              <ContextSkeleton />
            </motion.div>
          ) : unavailable ? (
            <motion.div key="unavailable" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <EmptyState
                icon={Sparkles}
                title="AI context unavailable"
                description="The AI context feature requires server-side configuration. Contact the site admin."
              />
            </motion.div>
          ) : context ? (
            <motion.div key="context" initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="space-y-4">

              {/* Background */}
              <ContextSection
                icon={BookOpen}
                label="Background"
                labelColor="text-surface-400"
                bgColor="bg-surface-100"
                borderColor="border-surface-300"
                body={context.background}
              />

              {/* FOR / AGAINST stakes */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <ContextSection
                  icon={ThumbsUp}
                  label="If FOR wins"
                  labelColor="text-for-400"
                  bgColor="bg-for-500/8"
                  borderColor="border-for-500/25"
                  body={context.if_for}
                />
                <ContextSection
                  icon={ThumbsDown}
                  label="If AGAINST wins"
                  labelColor="text-against-400"
                  bgColor="bg-against-500/8"
                  borderColor="border-against-500/25"
                  body={context.if_against}
                />
              </div>

              {/* Core tension */}
              <ContextSection
                icon={Sparkles}
                label="Core tension"
                labelColor="text-gold"
                bgColor="bg-gold/8"
                borderColor="border-gold/25"
                body={context.key_tension}
              />

              {/* Real-world examples */}
              {context.examples && (
                <ContextSection
                  icon={Globe}
                  label="Real-world examples"
                  labelColor="text-purple"
                  bgColor="bg-purple/8"
                  borderColor="border-purple/25"
                  body={context.examples}
                />
              )}

              {/* Footer */}
              <div className="flex items-center justify-between pt-2">
                <p className="text-[10px] font-mono text-surface-600 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Generated by Claude · world knowledge, not platform data
                  {generatedAt && (
                    <span className="text-surface-700 ml-1">
                      · {new Date(generatedAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                    </span>
                  )}
                </p>
                <button
                  onClick={generate}
                  disabled={generating}
                  className="text-[10px] font-mono text-surface-600 hover:text-white transition-colors flex items-center gap-1 disabled:opacity-50"
                  aria-label="Regenerate context"
                >
                  <RefreshCw className={cn('h-3 w-3', generating && 'animate-spin')} />
                  Refresh
                </button>
              </div>
            </motion.div>
          ) : (
            /* No context yet */
            <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="rounded-2xl border border-surface-300 bg-surface-100 p-8 text-center space-y-4">
                <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-purple/10 border border-purple/20 mx-auto">
                  <Sparkles className="h-6 w-6 text-purple" />
                </div>
                <div>
                  <p className="text-sm font-mono font-semibold text-white mb-1.5">
                    No context generated yet
                  </p>
                  <p className="text-xs font-mono text-surface-500 max-w-xs mx-auto leading-relaxed">
                    Generate an AI-powered &quot;What&apos;s at stake&quot; brief for this topic using Claude&apos;s real-world knowledge.
                  </p>
                </div>
                <button
                  onClick={generate}
                  disabled={generating}
                  className={cn(
                    'inline-flex items-center gap-2 px-5 py-2.5 rounded-xl font-mono text-sm font-semibold transition-all',
                    'bg-purple/20 border border-purple/30 text-purple hover:bg-purple/30',
                    'disabled:opacity-50 disabled:cursor-not-allowed'
                  )}
                >
                  {generating ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Generating&hellip;
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-4 w-4" />
                      Generate context
                    </>
                  )}
                </button>
                {contextError && (
                  <p className="text-xs font-mono text-against-400">{contextError}</p>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Explainer footer */}
        {context && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.4 }}
            className="mt-8 rounded-2xl border border-surface-300 bg-surface-100 p-5 space-y-3"
          >
            <p className="text-[11px] font-mono font-semibold text-surface-400 uppercase tracking-wider">
              About this feature
            </p>
            <p className="text-xs font-mono text-surface-500 leading-relaxed">
              This context brief is generated by Claude using its training knowledge of the real world — not from platform user arguments. It&apos;s designed to help you understand the issue before diving into the community debate. For community-synthesized common ground and tensions, see the{' '}
              <Link
                href={topic ? `/topic/${topic.id}/synthesis` : '#'}
                className="text-purple hover:text-purple/80 underline decoration-purple/40 transition-colors"
              >
                Synthesis page
              </Link>
              .
            </p>
            <div className="flex items-center gap-3 flex-wrap">
              <Link
                href={topic ? `/topic/${topic.id}` : '/'}
                className="inline-flex items-center gap-1.5 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
              >
                <ExternalLink className="h-3 w-3" />
                Full debate
              </Link>
              <Link
                href={topic ? `/topic/${topic.id}/synthesis` : '#'}
                className="inline-flex items-center gap-1.5 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
              >
                <GitMerge className="h-3 w-3" />
                Community synthesis
              </Link>
              <Link
                href={topic ? `/topic/${topic.id}/evidence` : '#'}
                className="inline-flex items-center gap-1.5 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
              >
                <BookOpen className="h-3 w-3" />
                Evidence board
              </Link>
            </div>
          </motion.div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
