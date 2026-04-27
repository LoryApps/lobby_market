'use client'

import { useCallback, useEffect, useMemo, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { ArrowLeft, ExternalLink, Filter, RefreshCw, RotateCcw, ThumbsDown, ThumbsUp, X } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import type {
  ArgumentGraphNode,
  ArgumentGraphResponse,
  ArgumentGraphTopic,
} from '@/app/api/topics/[id]/argument-graph/route'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'

// Lazy-load the D3 canvas — d3-force only loads when this page is visited.
const ArgumentGraph = dynamic(
  () => import('@/components/topic/ArgumentGraph').then((m) => m.ArgumentGraph),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center text-surface-500 font-mono text-sm">
        Loading graph…
      </div>
    ),
  },
)

// ─── Types ────────────────────────────────────────────────────────────────────

type SideFilter = 'all' | 'for' | 'against'
type SortBy = 'upvotes' | 'replies' | 'recent'

interface ArgumentGraphViewProps {
  topicId: string
  initialTopic?: ArgumentGraphTopic | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

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

// ─── Selected argument panel ──────────────────────────────────────────────────

function ArgumentPanel({
  node,
  topicId,
  onClose,
}: {
  node: ArgumentGraphNode
  topicId: string
  onClose: () => void
}) {
  const isFor = node.side === 'blue'
  return (
    <motion.div
      key={node.id}
      initial={{ opacity: 0, x: 24 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 24 }}
      transition={{ duration: 0.2, ease: 'easeOut' }}
      className={cn(
        'flex flex-col gap-4 p-5 rounded-2xl border bg-surface-100',
        isFor
          ? 'border-for-500/30 shadow-[0_0_32px_rgba(59,130,246,0.08)]'
          : 'border-against-500/30 shadow-[0_0_32px_rgba(239,68,68,0.08)]',
      )}
      aria-label="Selected argument"
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-2">
          <div
            className={cn(
              'flex items-center justify-center h-7 w-7 rounded-lg flex-shrink-0',
              isFor ? 'bg-for-500/15' : 'bg-against-500/15',
            )}
          >
            {isFor
              ? <ThumbsUp className="h-3.5 w-3.5 text-for-400" aria-hidden="true" />
              : <ThumbsDown className="h-3.5 w-3.5 text-against-400" aria-hidden="true" />
            }
          </div>
          <span
            className={cn(
              'text-xs font-mono font-bold uppercase tracking-wider',
              isFor ? 'text-for-400' : 'text-against-400',
            )}
          >
            {isFor ? 'For' : 'Against'}
          </span>
        </div>
        <button
          onClick={onClose}
          className="flex items-center justify-center h-7 w-7 rounded-lg bg-surface-200 hover:bg-surface-300 text-surface-500 hover:text-white transition-colors flex-shrink-0"
          aria-label="Close panel"
        >
          <X className="h-3.5 w-3.5" />
        </button>
      </div>

      {/* Argument text */}
      <p className="text-sm text-white leading-relaxed font-mono">{node.content}</p>

      {/* Citation */}
      {node.source_url && (
        <a
          href={node.source_url as string}
          target="_blank"
          rel="noopener noreferrer"
          className="flex items-center gap-1.5 text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors truncate"
        >
          <ExternalLink className="h-3 w-3 flex-shrink-0" aria-hidden="true" />
          {new URL(node.source_url as string).hostname}
        </a>
      )}

      {/* Stats row */}
      <div className="flex items-center gap-4 text-xs font-mono text-surface-500">
        <span
          className={cn(
            'font-bold',
            isFor ? 'text-for-400' : 'text-against-400',
          )}
        >
          {node.upvotes} {node.upvotes === 1 ? 'upvote' : 'upvotes'}
        </span>
        {node.reply_count > 0 && (
          <span>{node.reply_count} {node.reply_count === 1 ? 'reply' : 'replies'}</span>
        )}
        <span>{relativeTime(node.created_at)}</span>
      </div>

      {/* Author + link */}
      <div className="flex items-center justify-between gap-3 pt-1 border-t border-surface-300">
        {node.author_username ? (
          <Link
            href={`/profile/${node.author_username}`}
            className="text-xs font-mono text-surface-500 hover:text-white transition-colors truncate"
          >
            @{node.author_username}
          </Link>
        ) : (
          <span className="text-xs font-mono text-surface-600">Anonymous</span>
        )}
        <Link
          href={`/topic/${topicId}#argument-${node.id}`}
          className={cn(
            'flex items-center gap-1 text-xs font-mono flex-shrink-0',
            'text-surface-500 hover:text-white transition-colors',
          )}
        >
          Full thread
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </Link>
      </div>
    </motion.div>
  )
}

// ─── Main view ────────────────────────────────────────────────────────────────

export function ArgumentGraphView({ topicId, initialTopic }: ArgumentGraphViewProps) {
  const [data, setData]           = useState<ArgumentGraphResponse | null>(null)
  const [loading, setLoading]     = useState(true)
  const [error, setError]         = useState(false)
  const [sideFilter, setSide]     = useState<SideFilter>('all')
  const [sortBy, setSort]         = useState<SortBy>('upvotes')
  const [selectedNode, setSelected] = useState<ArgumentGraphNode | null>(null)
  const [showFilters, setShowFilters] = useState(false)

  const topic = data?.topic ?? initialTopic ?? null

  const loadData = useCallback(async () => {
    setLoading(true)
    setError(false)
    try {
      const res = await fetch(`/api/topics/${topicId}/argument-graph`)
      if (!res.ok) throw new Error('fetch failed')
      const json: ArgumentGraphResponse = await res.json()
      setData(json)
    } catch {
      setError(true)
    } finally {
      setLoading(false)
    }
  }, [topicId])

  useEffect(() => { loadData() }, [loadData])

  const filteredNodes = useMemo(() => {
    if (!data) return []
    let ns = data.nodes
    if (sideFilter === 'for') ns = ns.filter((n) => n.side === 'blue')
    if (sideFilter === 'against') ns = ns.filter((n) => n.side === 'red')
    if (sortBy === 'upvotes') ns = [...ns].sort((a, b) => b.upvotes - a.upvotes)
    if (sortBy === 'replies') ns = [...ns].sort((a, b) => b.reply_count - a.reply_count)
    if (sortBy === 'recent') ns = [...ns].sort((a, b) => b.created_at.localeCompare(a.created_at))
    return ns
  }, [data, sideFilter, sortBy])

  const forCount  = data?.nodes.filter((n) => n.side === 'blue').length ?? 0
  const agnCount  = data?.nodes.filter((n) => n.side === 'red').length ?? 0
  const topNode   = data?.nodes.reduce<ArgumentGraphNode | null>((best, n) => (!best || n.upvotes > best.upvotes ? n : best), null)

  return (
    <div className="flex flex-col h-full">

      {/* ── Top bar ──────────────────────────────────────────────────────── */}
      <div className="sticky top-0 z-40 bg-surface-100 border-b border-surface-300 flex-shrink-0">
        <div className="max-w-[1400px] mx-auto flex items-center h-14 px-4 gap-3">
          <Link
            href={`/topic/${topicId}`}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Back to topic"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          <div className="flex-1 min-w-0">
            {topic ? (
              <p className="text-xs font-mono text-surface-400 truncate">{topic.statement}</p>
            ) : (
              <Skeleton className="h-3.5 w-56" />
            )}
          </div>

          {/* Stats pills */}
          {!loading && data && (
            <div className="hidden sm:flex items-center gap-2">
              <span className="text-xs font-mono px-2 py-1 rounded-full bg-for-500/10 border border-for-500/20 text-for-400">
                {forCount} For
              </span>
              <span className="text-xs font-mono px-2 py-1 rounded-full bg-against-500/10 border border-against-500/20 text-against-400">
                {agnCount} Against
              </span>
              <span className="text-xs font-mono text-surface-500">
                {data.nodes.length} total
              </span>
            </div>
          )}

          {/* Filter toggle */}
          <button
            onClick={() => setShowFilters((v) => !v)}
            className={cn(
              'flex items-center gap-1.5 h-9 px-3 rounded-lg text-xs font-mono transition-colors',
              showFilters
                ? 'bg-for-500/15 border border-for-500/30 text-for-400'
                : 'bg-surface-200 border border-surface-300 text-surface-500 hover:text-white',
            )}
            aria-label="Toggle filters"
          >
            <Filter className="h-3.5 w-3.5" />
            <span className="hidden sm:inline">Filter</span>
          </button>

          {/* Refresh */}
          <button
            onClick={loadData}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white transition-colors"
            aria-label="Refresh"
          >
            <RefreshCw className="h-3.5 w-3.5" />
          </button>
        </div>

        {/* Filter bar */}
        <AnimatePresence>
          {showFilters && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.18 }}
              className="overflow-hidden border-t border-surface-300"
            >
              <div className="flex items-center gap-4 px-4 py-2.5 flex-wrap">
                {/* Side filter */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">Side:</span>
                  {([ ['all', 'All'], ['for', 'For'], ['against', 'Against'] ] as [SideFilter, string][]).map(([id, label]) => (
                    <button
                      key={id}
                      onClick={() => setSide(id)}
                      className={cn(
                        'px-2.5 py-1 rounded-full text-[11px] font-mono transition-colors',
                        sideFilter === id
                          ? id === 'for'
                            ? 'bg-for-500/20 text-for-300 border border-for-500/30'
                            : id === 'against'
                              ? 'bg-against-500/20 text-against-300 border border-against-500/30'
                              : 'bg-surface-300 text-white border border-surface-400'
                          : 'bg-surface-200 text-surface-500 hover:text-white border border-transparent',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                <div className="w-px h-4 bg-surface-300" aria-hidden="true" />

                {/* Sort */}
                <div className="flex items-center gap-1.5">
                  <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">Sort:</span>
                  {([ ['upvotes', 'Upvotes'], ['replies', 'Replies'], ['recent', 'Recent'] ] as [SortBy, string][]).map(([id, label]) => (
                    <button
                      key={id}
                      onClick={() => setSort(id)}
                      className={cn(
                        'px-2.5 py-1 rounded-full text-[11px] font-mono transition-colors',
                        sortBy === id
                          ? 'bg-surface-300 text-white border border-surface-400'
                          : 'bg-surface-200 text-surface-500 hover:text-white border border-transparent',
                      )}
                    >
                      {label}
                    </button>
                  ))}
                </div>

                {(sideFilter !== 'all' || sortBy !== 'upvotes') && (
                  <button
                    onClick={() => { setSide('all'); setSort('upvotes') }}
                    className="flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-white transition-colors ml-auto"
                  >
                    <RotateCcw className="h-3 w-3" />
                    Reset
                  </button>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Body ─────────────────────────────────────────────────────────── */}
      <div className="flex-1 flex overflow-hidden">

        {/* Graph canvas */}
        <div className="flex-1 relative p-3 sm:p-4">
          {loading ? (
            <div className="h-full flex items-center justify-center">
              <p className="text-surface-500 font-mono text-sm">Loading argument graph…</p>
            </div>
          ) : error ? (
            <div className="h-full flex flex-col items-center justify-center gap-3">
              <p className="text-surface-500 font-mono text-sm">Failed to load graph.</p>
              <button
                onClick={loadData}
                className="flex items-center gap-1.5 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Try again
              </button>
            </div>
          ) : (
            <ArgumentGraph
              nodes={filteredNodes}
              selectedId={selectedNode?.id ?? null}
              onSelect={(n) => setSelected(n as ArgumentGraphNode | null)}
              className="h-full"
            />
          )}

          {/* Legend */}
          {!loading && !error && data && (
            <div className="absolute bottom-5 left-5 pointer-events-none">
              <div className="flex flex-col gap-1.5 text-[10px] font-mono text-surface-500">
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full bg-for-500 opacity-75" />
                  <span>Larger = more upvotes</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="h-2.5 w-2.5 rounded-full border border-for-500 bg-transparent" />
                  <span>Glow = more replies</span>
                </div>
                <div className="flex items-center gap-1.5 text-surface-600">
                  <span>Scroll to zoom · Drag to pan</span>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* ── Right panel (selected argument) ────────────────────────────── */}
        <AnimatePresence>
          {selectedNode && (
            <motion.aside
              initial={{ width: 0, opacity: 0 }}
              animate={{ width: 320, opacity: 1 }}
              exit={{ width: 0, opacity: 0 }}
              transition={{ duration: 0.22, ease: 'easeOut' }}
              className="hidden md:flex flex-col gap-4 border-l border-surface-300 p-4 overflow-y-auto flex-shrink-0"
              aria-label="Argument detail"
            >
              {/* Top argument spotlight */}
              {topNode && topNode.id !== selectedNode.id && (
                <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">
                  Selected argument
                </div>
              )}
              <ArgumentPanel
                node={selectedNode}
                topicId={topicId}
                onClose={() => setSelected(null)}
              />
            </motion.aside>
          )}
        </AnimatePresence>
      </div>

      {/* ── Mobile bottom sheet for selected argument ────────────────────── */}
      <AnimatePresence>
        {selectedNode && (
          <motion.div
            initial={{ y: '100%' }}
            animate={{ y: 0 }}
            exit={{ y: '100%' }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="md:hidden fixed bottom-0 left-0 right-0 z-50 p-4 pb-24 bg-surface-50 border-t border-surface-300 shadow-2xl max-h-[60vh] overflow-y-auto"
            aria-label="Argument detail"
          >
            <ArgumentPanel
              node={selectedNode}
              topicId={topicId}
              onClose={() => setSelected(null)}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
