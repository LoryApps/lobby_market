'use client'

/**
 * /topic/[id]/connections — Topic Connections Hub
 *
 * A dedicated, SEO-indexable page that surfaces all the relationships a
 * topic has within the Lobby ecosystem:
 *   • Related debates — topics sharing tags or category
 *   • Civic links     — topics that link TO or FROM this one in their wikis
 *   • Coalition positions — how organised groups have declared on this debate
 *
 * Distinct from:
 *   /topic/[id]          — main debate view with inline panels
 *   /topic/[id]/evidence — community-sourced citations
 *   /topic/[id]/synthesis — AI common-ground / tensions analysis
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  BookOpen,
  Compass,
  ExternalLink,
  Gavel,
  GitMerge,
  MessageSquare,
  Network,
  Scale,
  Shield,
  ThumbsDown,
  ThumbsUp,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { RelatedTopics } from '@/components/topic/RelatedTopics'
import { TopicBacklinks } from '@/components/topic/TopicBacklinks'
import { CoalitionStancePanel } from '@/components/topic/CoalitionStancePanel'
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
  if (status === 'active' || status === 'voting') return <Zap className="h-3 w-3" />
  if (status === 'law') return <Gavel className="h-3 w-3" />
  return <Scale className="h-3 w-3" />
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  label,
  description,
  color,
}: {
  icon: typeof Network
  label: string
  description: string
  color: string
}) {
  return (
    <div className="mb-4">
      <div className="flex items-center gap-2 mb-1">
        <Icon className={cn('h-4 w-4', color)} />
        <h2 className="text-sm font-mono font-bold text-white uppercase tracking-wider">
          {label}
        </h2>
      </div>
      <p className="text-xs font-mono text-surface-500 leading-relaxed">{description}</p>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function TopicConnectionsPage() {
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

        {/* Page title */}
        <div className="flex items-center gap-3 mb-8 pb-4 border-b border-surface-300">
          <div className="p-2 rounded-xl bg-purple/10 border border-purple/20">
            <Network className="h-5 w-5 text-purple" />
          </div>
          <div>
            <h2 className="text-base font-mono font-bold text-white">Topic Connections</h2>
            <p className="text-xs font-mono text-surface-500">
              Related debates, civic links, and coalition positions
            </p>
          </div>
        </div>

        {/* ── Section 1: Related Debates ───────────────────────────────────── */}
        <section className="mb-10">
          <SectionHeader
            icon={Compass}
            label="Related Debates"
            description="Topics sharing tags or category — debates that explore similar civic terrain."
            color="text-purple"
          />
          {id && <RelatedTopics topicId={id} />}
        </section>

        {/* ── Section 2: Civic Links ───────────────────────────────────────── */}
        <section className="mb-10">
          <SectionHeader
            icon={ExternalLink}
            label="Civic Links"
            description="Topics that reference this debate in their wiki, and topics this debate points to."
            color="text-for-400"
          />
          {id && <TopicBacklinks topicId={id} />}
        </section>

        {/* ── Section 3: Coalition Positions ──────────────────────────────── */}
        <section className="mb-10">
          <SectionHeader
            icon={Shield}
            label="Coalition Positions"
            description="How organised coalitions have officially declared on this debate."
            color="text-emerald"
          />
          {id && (
            <CoalitionStancePanel topicId={id} />
          )}
        </section>

        {/* Footer CTA */}
        <div className="mt-8 pt-6 border-t border-surface-300">
          <div className="flex flex-wrap gap-3 justify-center">
            <Link
              href={topic ? `/topic/${topic.id}` : '/'}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Back to debate
            </Link>
            <Link
              href="/discover"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-purple/10 border border-purple/30 text-xs font-mono text-purple hover:bg-purple/20 transition-colors"
            >
              <Compass className="h-3.5 w-3.5" />
              Discover more debates
            </Link>
            <Link
              href="/coalitions"
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-emerald/10 border border-emerald/30 text-xs font-mono text-emerald hover:bg-emerald/20 transition-colors"
            >
              <Shield className="h-3.5 w-3.5" />
              Browse coalitions
            </Link>
          </div>
        </div>

      </main>
      <BottomNav />
    </div>
  )
}
