'use client'

/**
 * /topic/[id]/backlinks — Topic Link Graph
 *
 * Shows the bidirectional topic link graph for this topic:
 *   "Cites" — topics this topic's description links TO (outgoing)
 *   "Cited by" — topics whose descriptions link TO this topic (incoming)
 *
 * Built on the topic_links table populated when wiki descriptions contain
 * [[wikilink]] syntax referencing other topics.
 *
 * Distinct from:
 *   /topic/[id]/similar      — algorithmically similar topics (not explicitly linked)
 *   /topic/[id]/connections  — social connection between voters
 *   /topic/[id]/parallels    — topics with correlated vote patterns
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  ExternalLink,
  GitMerge,
  Link2,
  ThumbsDown,
  ThumbsUp,
  Users,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { TopicLinkEntry, TopicBacklinksResponse } from '@/app/api/topics/[id]/backlinks/route'

// ─── Props ────────────────────────────────────────────────────────────────────

interface Props {
  topicId: string
  statement: string
  category: string | null
  status: string
  bluePct: number
  totalVotes: number
}

// ─── Status/badge helpers ─────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
  continued: 'Continued',
  archived: 'Archived',
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
  continued: 'proposed',
  archived: 'proposed',
}

// ─── Linked topic card ────────────────────────────────────────────────────────

function LinkedTopicCard({
  topic,
  direction,
  index,
}: {
  topic: TopicLinkEntry
  direction: 'cites' | 'cited_by'
  index: number
}) {
  const forPct = Math.round(topic.blue_pct ?? 50)
  const againstPct = 100 - forPct
  const badgeVariant = STATUS_BADGE[topic.status] ?? 'proposed'
  const statusLabel = STATUS_LABEL[topic.status] ?? topic.status

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
    >
      <Link
        href={`/topic/${topic.id}`}
        className="group block p-4 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-all"
      >
        {/* Direction indicator */}
        <div className="flex items-center gap-1.5 mb-2">
          {direction === 'cites' ? (
            <>
              <ArrowRight className="h-3 w-3 text-for-400" />
              <span className="text-[10px] font-mono text-for-400 uppercase tracking-wider">
                This topic references
              </span>
            </>
          ) : (
            <>
              <ArrowLeft className="h-3 w-3 text-purple" />
              <span className="text-[10px] font-mono text-purple uppercase tracking-wider">
                Referenced by
              </span>
            </>
          )}
        </div>

        {/* Statement */}
        <p className="text-sm font-medium text-white leading-snug mb-3 group-hover:text-white/90 transition-colors">
          {topic.statement}
        </p>

        {/* Meta row */}
        <div className="flex items-center gap-2 flex-wrap mb-3">
          <Badge variant={badgeVariant} size="sm">
            {statusLabel}
          </Badge>
          {topic.category && (
            <span className="text-[11px] font-mono text-surface-500">{topic.category}</span>
          )}
          <span className="text-[11px] font-mono text-surface-600 flex items-center gap-1 ml-auto">
            <Users className="h-3 w-3" />
            {topic.total_votes.toLocaleString()}
          </span>
        </div>

        {/* Vote bar */}
        <div className="space-y-1">
          <div className="relative h-1.5 rounded-full overflow-hidden bg-against-900/40">
            <div
              className="absolute inset-y-0 left-0 bg-gradient-to-r from-for-600 to-for-400 rounded-full"
              style={{ width: `${forPct}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-mono">
            <span className="text-for-500 flex items-center gap-0.5">
              <ThumbsUp className="h-2.5 w-2.5" /> {forPct}%
            </span>
            <span className="text-against-500 flex items-center gap-0.5">
              {againstPct}% <ThumbsDown className="h-2.5 w-2.5" />
            </span>
          </div>
        </div>

        {/* External link hint */}
        <div className="mt-3 flex items-center justify-end">
          <ExternalLink className="h-3 w-3 text-surface-600 group-hover:text-surface-400 transition-colors" />
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Section ──────────────────────────────────────────────────────────────────

function LinkSection({
  title,
  subtitle,
  icon: Icon,
  iconColor,
  topics,
  direction,
  loading,
}: {
  title: string
  subtitle: string
  icon: typeof Link2
  iconColor: string
  topics: TopicLinkEntry[]
  direction: 'cites' | 'cited_by'
  loading: boolean
}) {
  return (
    <div>
      <div className="flex items-center gap-2 mb-4">
        <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-surface-200 border border-surface-300">
          <Icon className={cn('h-3.5 w-3.5', iconColor)} />
        </div>
        <div>
          <h2 className="text-sm font-mono font-semibold text-white">{title}</h2>
          <p className="text-[11px] font-mono text-surface-500">{subtitle}</p>
        </div>
        {!loading && (
          <span className="ml-auto text-xs font-mono text-surface-500 bg-surface-200 border border-surface-300 rounded-full px-2 py-0.5">
            {topics.length}
          </span>
        )}
      </div>

      {loading ? (
        <div className="space-y-3">
          {[0, 1].map((i) => (
            <div
              key={i}
              className="p-4 rounded-xl bg-surface-100 border border-surface-300 space-y-3"
            >
              <Skeleton className="h-4 w-3/4" />
              <Skeleton className="h-3 w-1/2" />
              <Skeleton className="h-1.5 w-full rounded-full" />
            </div>
          ))}
        </div>
      ) : topics.length === 0 ? (
        <div className="py-10 text-center">
          <p className="text-sm text-surface-500 font-mono">
            {direction === 'cites'
              ? 'This topic doesn\'t reference any others yet.'
              : 'No other topics reference this one yet.'}
          </p>
          <p className="text-xs text-surface-600 font-mono mt-1">
            Add [[wikilinks]] in the topic description to connect debates.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {topics.map((t, i) => (
            <LinkedTopicCard key={t.id} topic={t} direction={direction} index={i} />
          ))}
        </div>
      )}
    </div>
  )
}

// ─── Main client ──────────────────────────────────────────────────────────────

export function BacklinksClient({
  topicId,
  statement,
  category,
  status,
  bluePct,
  totalVotes,
}: Props) {
  const router = useRouter()
  const [data, setData] = useState<TopicBacklinksResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch(`/api/topics/${topicId}/backlinks`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d: TopicBacklinksResponse | null) => setData(d))
      .catch(() => setData(null))
      .finally(() => setLoading(false))
  }, [topicId])

  const forPct = Math.round(bluePct)
  const statusText = STATUS_LABEL[status] ?? status
  const citedBy = data?.cited_by ?? []
  const cites = data?.cites ?? []
  const totalLinks = citedBy.length + cites.length

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-6 pb-24">
        {/* Back link */}
        <button
          onClick={() => router.back()}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors mb-5"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to topic
        </button>

        {/* Topic card */}
        <div className="bg-surface-100 border border-surface-300 rounded-2xl p-5 mb-6">
          {category && (
            <span className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-2 block">
              {category} · {statusText}
            </span>
          )}
          <h1 className="text-base font-medium text-white leading-snug mb-4">{statement}</h1>
          <div className="flex items-center gap-3">
            <div className="flex-1 relative h-1.5 rounded-full overflow-hidden bg-against-900/40">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-for-600 to-for-400 rounded-full"
                style={{ width: `${forPct}%` }}
              />
            </div>
            <span className="text-xs font-mono text-surface-500 flex items-center gap-1 flex-shrink-0">
              <Users className="h-3 w-3" />
              {totalVotes.toLocaleString()}
            </span>
          </div>
        </div>

        {/* Summary stat */}
        {!loading && (
          <div className="grid grid-cols-2 gap-3 mb-8">
            <div className="bg-surface-100 border border-surface-300 rounded-xl p-4 text-center">
              <p className="text-2xl font-mono font-bold text-for-400">{cites.length}</p>
              <p className="text-xs font-mono text-surface-500 mt-1">Outgoing links</p>
            </div>
            <div className="bg-surface-100 border border-surface-300 rounded-xl p-4 text-center">
              <p className="text-2xl font-mono font-bold text-purple">{citedBy.length}</p>
              <p className="text-xs font-mono text-surface-500 mt-1">Incoming links</p>
            </div>
          </div>
        )}

        {!loading && totalLinks === 0 ? (
          <EmptyState
            icon={GitMerge}
            iconColor="text-surface-500"
            iconBg="bg-surface-200"
            iconBorder="border-surface-300"
            title="No topic links yet"
            description="This topic hasn't been connected to others via wiki descriptions. Add [[wikilinks]] to build the civic knowledge graph."
            action={{ label: 'Edit wiki', href: `/topic/${topicId}/wiki` }}
          />
        ) : (
          <div className="space-y-10">
            {/* Cites (outgoing) */}
            <LinkSection
              title="This topic cites"
              subtitle="Topics referenced in this topic's description"
              icon={ArrowRight}
              iconColor="text-for-400"
              topics={cites}
              direction="cites"
              loading={loading}
            />

            {/* Divider */}
            {!loading && cites.length > 0 && citedBy.length > 0 && (
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-surface-300" />
                </div>
                <div className="relative flex justify-center">
                  <span className="bg-surface-50 px-3 text-xs font-mono text-surface-500">
                    ↕
                  </span>
                </div>
              </div>
            )}

            {/* Cited by (incoming) */}
            <LinkSection
              title="Referenced by"
              subtitle="Topics whose descriptions link to this one"
              icon={ArrowLeft}
              iconColor="text-purple"
              topics={citedBy}
              direction="cited_by"
              loading={loading}
            />
          </div>
        )}

        {/* Footer note */}
        {!loading && totalLinks > 0 && (
          <div className="mt-10 text-center">
            <p className="text-xs font-mono text-surface-600">
              Links are created via [[wikilink]] syntax in topic descriptions.
            </p>
            <Link
              href={`/topic/${topicId}/wiki`}
              className="inline-flex items-center gap-1.5 mt-2 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
            >
              <Link2 className="h-3.5 w-3.5" />
              Edit wiki to add more links →
            </Link>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
