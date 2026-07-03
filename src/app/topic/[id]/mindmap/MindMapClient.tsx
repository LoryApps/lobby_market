'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BookOpen,
  Gavel,
  Info,
  Loader2,
  MessageSquare,
  Network,
  RefreshCw,
  Scale,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'
import type { MindMapNodeType } from '@/app/api/me/mindmap/route'
import type { TopicMindMapResponse, TopicMindMapStats } from '@/app/api/topics/[id]/mindmap/route'

// ─── D3 canvas is heavy — lazy load it ───────────────────────────────────────

const MindMapGraph = dynamic(
  () => import('@/components/mindmap/MindMapGraph').then((m) => m.MindMapGraph),
  {
    ssr: false,
    loading: () => (
      <div className="flex flex-col items-center justify-center h-full gap-3 text-surface-500">
        <Loader2 className="h-8 w-8 animate-spin" />
        <p className="text-sm font-mono">Loading graph…</p>
      </div>
    ),
  }
)

// ─── Types ────────────────────────────────────────────────────────────────────

interface Props {
  topicId: string
  topicStatement: string
  topicCategory: string | null
}

// ─── Legend item ──────────────────────────────────────────────────────────────

function LegendItem({ color, label }: { color: string; label: string }) {
  return (
    <div className="flex items-center gap-1.5">
      <span className={cn('h-2.5 w-2.5 rounded-full flex-shrink-0', color)} />
      <span className="text-[11px] font-mono text-surface-500">{label}</span>
    </div>
  )
}

// ─── Stats pill ───────────────────────────────────────────────────────────────

function StatPill({ icon: Icon, value, label, color }: {
  icon: typeof Network
  value: number
  label: string
  color: string
}) {
  return (
    <div className={cn(
      'flex items-center gap-2 px-3 py-1.5 rounded-xl border text-xs font-mono',
      'bg-surface-100 border-surface-300',
    )}>
      <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', color)} />
      <span className="font-semibold text-white">{value}</span>
      <span className="text-surface-500">{label}</span>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function TopicMindMapClient({ topicId, topicStatement, topicCategory }: Props) {
  const [data, setData] = useState<TopicMindMapResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [refreshing, setRefreshing] = useState(false)
  const [hiddenTypes, setHiddenTypes] = useState<Set<MindMapNodeType>>(new Set())
  const [showLegend, setShowLegend] = useState(true)

  const load = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true)
    try {
      const res = await fetch(`/api/topics/${topicId}/mindmap`)
      if (!res.ok) throw new Error('Failed to load map')
      const json = await res.json() as TopicMindMapResponse
      setData(json)
      setError(null)
    } catch {
      setError('Could not load the topic mind map.')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [topicId])

  useEffect(() => { load() }, [load])

  function toggleType(type: MindMapNodeType) {
    setHiddenTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  const stats: TopicMindMapStats = data?.stats ?? { argumentCount: 0, relatedTopics: 0, lawCount: 0 }

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 flex flex-col max-w-6xl mx-auto w-full px-4 py-6 pb-24 md:pb-8">

        {/* Header */}
        <div className="flex items-start gap-3 mb-5">
          <Link
            href={`/topic/${topicId}`}
            className="mt-0.5 p-1.5 rounded-lg hover:bg-surface-200 text-surface-500 hover:text-white transition-colors"
            aria-label="Back to topic"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 mb-1">
              <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-purple/10 border border-purple/30">
                <Network className="h-4 w-4 text-purple" />
              </div>
              <h1 className="font-mono text-xl font-bold text-white">Topic Mind Map</h1>
            </div>
            <p className="text-sm font-mono text-surface-500 truncate">
              {topicStatement}
              {topicCategory && (
                <span className="ml-2 text-purple/80">{topicCategory}</span>
              )}
            </p>
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            <button
              onClick={() => setShowLegend((v) => !v)}
              className="p-1.5 rounded-lg hover:bg-surface-200 text-surface-500 hover:text-white transition-colors"
              aria-label="Toggle legend"
            >
              <Info className="h-4 w-4" />
            </button>
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="p-1.5 rounded-lg hover:bg-surface-200 text-surface-500 hover:text-white transition-colors disabled:opacity-50"
              aria-label="Refresh"
            >
              <RefreshCw className={cn('h-4 w-4', refreshing && 'animate-spin')} />
            </button>
          </div>
        </div>

        {/* Stats row */}
        {!loading && data && (
          <div className="flex flex-wrap items-center gap-2 mb-4">
            <StatPill
              icon={MessageSquare}
              value={stats.argumentCount}
              label="arguments"
              color="text-purple"
            />
            <StatPill
              icon={Network}
              value={stats.relatedTopics}
              label="linked topics"
              color="text-for-400"
            />
            {stats.lawCount > 0 && (
              <StatPill
                icon={Gavel}
                value={stats.lawCount}
                label="law"
                color="text-gold"
              />
            )}
            <Link
              href={`/topic/${topicId}/argument-graph`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-surface-300 text-xs font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors bg-surface-100 ml-auto"
            >
              <Scale className="h-3.5 w-3.5" />
              Argument Graph
            </Link>
          </div>
        )}

        {/* Filter chips */}
        {!loading && data && (
          <div className="flex flex-wrap gap-2 mb-4">
            {([
              { type: 'topic' as MindMapNodeType, label: 'Topics', dotClass: 'bg-for-400' },
              { type: 'argument' as MindMapNodeType, label: 'Arguments', dotClass: 'bg-purple' },
              { type: 'law' as MindMapNodeType, label: 'Laws', dotClass: 'bg-gold' },
            ]).map(({ type, label, dotClass }) => {
              const hidden = hiddenTypes.has(type)
              return (
                <button
                  key={type}
                  onClick={() => toggleType(type)}
                  className={cn(
                    'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono border transition-all',
                    hidden
                      ? 'bg-surface-100 border-surface-300 text-surface-500 opacity-50'
                      : 'bg-surface-200 border-surface-400 text-white',
                  )}
                >
                  <span className={cn('h-2 w-2 rounded-full flex-shrink-0', hidden ? 'bg-surface-500' : dotClass)} />
                  {label}
                  {hidden && <X className="h-3 w-3 ml-0.5 text-surface-500" />}
                </button>
              )
            })}
            <p className="ml-auto text-xs font-mono text-surface-600 self-center hidden sm:block">
              Drag to pan · Scroll to zoom · Click to navigate
            </p>
          </div>
        )}

        {/* Graph canvas */}
        <div className="relative flex-1 rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden"
          style={{ minHeight: '520px' }}>

          {loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-surface-500">
              <Loader2 className="h-8 w-8 animate-spin" />
              <p className="text-sm font-mono">Building topic graph…</p>
            </div>
          )}

          {error && !loading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3">
              <p className="text-sm font-mono text-against-400">{error}</p>
              <button
                onClick={() => load()}
                className="px-4 py-2 rounded-lg bg-surface-200 text-white text-sm font-mono hover:bg-surface-300 transition-colors"
              >
                Retry
              </button>
            </div>
          )}

          {!loading && !error && data && (
            <MindMapGraph
              nodes={data.nodes}
              edges={data.edges}
              hiddenTypes={hiddenTypes}
              className="h-full w-full"
            />
          )}

          {/* Legend overlay */}
          <AnimatePresence>
            {showLegend && !loading && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -8 }}
                transition={{ duration: 0.18 }}
                className={cn(
                  'absolute top-3 right-3 p-3 rounded-xl',
                  'bg-surface-100/90 backdrop-blur-sm border border-surface-300',
                  'flex flex-col gap-2',
                )}
              >
                <div className="flex items-center justify-between gap-4 mb-0.5">
                  <p className="text-[11px] font-mono font-semibold text-surface-400 uppercase tracking-wider">Legend</p>
                  <button
                    onClick={() => setShowLegend(false)}
                    className="text-surface-600 hover:text-surface-400 transition-colors"
                  >
                    <X className="h-3.5 w-3.5" />
                  </button>
                </div>
                <LegendItem color="bg-for-400" label="This topic (central)" />
                <LegendItem color="bg-for-300/70" label="Related topics" />
                <LegendItem color="bg-purple" label="Arguments" />
                <LegendItem color="bg-gold" label="Established law" />
                <div className="border-t border-surface-300 pt-2 mt-0.5 flex flex-col gap-2">
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-6 rounded bg-for-500 flex-shrink-0" />
                    <span className="text-[11px] font-mono text-surface-500">FOR argument</span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    <div className="h-1.5 w-6 rounded bg-against-500 flex-shrink-0" />
                    <span className="text-[11px] font-mono text-surface-500">AGAINST argument</span>
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Mobile hint */}
          {!loading && (
            <div className="absolute bottom-3 left-1/2 -translate-x-1/2 md:hidden">
              <p className="text-[10px] font-mono text-surface-600 text-center">
                Pinch to zoom · Drag to pan · Tap node to navigate
              </p>
            </div>
          )}
        </div>

        {/* Empty state */}
        {!loading && !error && data && data.nodes.length <= 1 && (
          <div className="mt-4 p-6 rounded-2xl border border-surface-300 bg-surface-100 text-center">
            <Network className="h-8 w-8 text-surface-500 mx-auto mb-3" />
            <p className="text-sm font-mono text-surface-400">
              No connections found yet. As arguments and linked topics are added, they&apos;ll appear here.
            </p>
            <Link
              href={`/topic/${topicId}/argue`}
              className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-for-600/20 border border-for-600/40 text-for-400 text-sm font-mono hover:bg-for-600/30 transition-colors"
            >
              <MessageSquare className="h-3.5 w-3.5" />
              Add an argument
            </Link>
          </div>
        )}

        {/* Related links */}
        {!loading && data && (
          <div className="mt-4 flex flex-wrap gap-2">
            <Link
              href={`/topic/${topicId}/connections`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-surface-300 text-xs font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors bg-surface-100"
            >
              <Network className="h-3.5 w-3.5" />
              Topic Connections
            </Link>
            <Link
              href={`/topic/${topicId}/correlations`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-surface-300 text-xs font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors bg-surface-100"
            >
              <Scale className="h-3.5 w-3.5" />
              Vote Correlations
            </Link>
            <Link
              href={`/topic/${topicId}/arguments`}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-xl border border-surface-300 text-xs font-mono text-surface-500 hover:text-white hover:border-surface-400 transition-colors bg-surface-100"
            >
              <BookOpen className="h-3.5 w-3.5" />
              All Arguments
            </Link>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
