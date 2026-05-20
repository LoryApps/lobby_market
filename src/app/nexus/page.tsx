'use client'

/**
 * /nexus — The Civic Topic Nexus
 *
 * A platform-wide force-directed knowledge graph showing how civic debates
 * interconnect through wiki links and shared keyword tags.
 *
 * Edges represent real structural relationships between topics:
 *   • Wiki links  — one topic's description explicitly links to another (thicker)
 *   • Shared tags — both topics carry the same civic keyword tag (thinner)
 *
 * Distinct from:
 *   /topic/graph          — keyword-similarity edges (no explicit links)
 *   /mindmap              — your personal engagement graph
 *   /topic/[id]/connections — single-topic backlink hub
 *   /laws/atlas           — laws by scope/category heatmap
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  GitMerge,
  Hash,
  Info,
  Loader2,
  Network,
  RefreshCw,
  Search,
  Sparkles,
  Tag,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Skeleton } from '@/components/ui/Skeleton'
import { GRAPH_CATEGORY_COLORS } from '@/lib/utils/graph-colors'
import { cn } from '@/lib/utils/cn'
import type { TopicNode } from '@/components/topic/TopicGraph'
import type { NexusEdge, NexusResponse, NexusStats } from '@/app/api/nexus/route'

// ─── Lazy-load D3 graph ───────────────────────────────────────────────────────

const TopicGraph = dynamic(
  () => import('@/components/topic/TopicGraph').then((m) => m.TopicGraph),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center min-h-0 text-surface-500 text-sm font-mono">
        Rendering graph…
      </div>
    ),
  }
)

// ─── Category legend ──────────────────────────────────────────────────────────

const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

type EdgeMode = 'all' | 'wiki' | 'tag'

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  color,
}: {
  label: string
  value: string | number
  sub?: string
  color?: string
}) {
  return (
    <div className="rounded-xl border border-surface-300 bg-surface-100 px-4 py-3">
      <div className={cn('font-mono text-xl font-bold', color ?? 'text-white')}>{value}</div>
      <div className="text-[11px] font-mono text-surface-500 mt-0.5">{label}</div>
      {sub && <div className="text-[10px] font-mono text-surface-600 mt-0.5 truncate">{sub}</div>}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export default function NexusPage() {
  const [nodes, setNodes] = useState<TopicNode[]>([])
  const [allEdges, setAllEdges] = useState<NexusEdge[]>([])
  const [stats, setStats] = useState<NexusStats | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState('')
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set())
  const [edgeMode, setEdgeMode] = useState<EdgeMode>('all')
  const [showInfo, setShowInfo] = useState(false)
  const [showLegend, setShowLegend] = useState(false)

  const searchInputRef = useRef<HTMLInputElement>(null)

  // ── Fetch ──────────────────────────────────────────────────────────────────

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/nexus', { cache: 'no-store' })
      if (!res.ok) throw new Error('Failed to load')
      const data: NexusResponse = await res.json()
      setNodes(data.nodes)
      setAllEdges(data.edges)
      setStats(data.stats)
    } catch {
      setError('Could not load the nexus graph.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  // ── Edge filter ────────────────────────────────────────────────────────────

  const filteredEdges = allEdges.filter((e) => {
    if (edgeMode === 'wiki') return e.type === 'wiki'
    if (edgeMode === 'tag') return e.type === 'tag'
    return true
  })

  // ── Category toggle ────────────────────────────────────────────────────────

  function toggleCategory(cat: string) {
    setHiddenCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat.toLowerCase())) next.delete(cat.toLowerCase())
      else next.add(cat.toLowerCase())
      return next
    })
  }

  // ── Keyboard shortcut: / to focus search ──────────────────────────────────

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === '/' && document.activeElement?.tagName !== 'INPUT') {
        e.preventDefault()
        searchInputRef.current?.focus()
      }
      if (e.key === 'Escape') {
        setSearchQuery('')
        searchInputRef.current?.blur()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  // ─────────────────────────────────────────────────────────────────────────

  return (
    <div className="h-screen bg-surface-50 flex flex-col overflow-hidden">
      <TopBar />

      {/* ── Header bar ─────────────────────────────────────────────────────── */}
      <div className="flex-shrink-0 bg-surface-100 border-b border-surface-300 z-30">
        <div className="max-w-[1600px] mx-auto flex items-center h-14 px-3 md:px-5 gap-3">
          {/* Back */}
          <Link
            href="/topic/graph"
            aria-label="Back to Topic Network"
            className="flex items-center justify-center h-9 w-9 rounded-lg flex-shrink-0 bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>

          {/* Title */}
          <div className="flex items-center gap-2 min-w-0">
            <Network className="h-4 w-4 text-purple flex-shrink-0" aria-hidden="true" />
            <span className="text-sm font-mono font-semibold text-white truncate">
              Civic Nexus
            </span>
            <span className="hidden sm:block text-[11px] font-mono text-surface-500 truncate">
              — topic knowledge graph
            </span>
          </div>

          {/* Search */}
          <div className="flex-1 max-w-xs relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-500 pointer-events-none" aria-hidden="true" />
            <input
              ref={searchInputRef}
              type="search"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search topics… (/)"
              aria-label="Search topics in graph"
              className="w-full pl-8 pr-3 h-9 rounded-lg bg-surface-200 border border-surface-300 text-sm font-mono text-white placeholder:text-surface-500 focus:outline-none focus:ring-1 focus:ring-purple/50 focus:border-purple/50"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
                className="absolute right-2 top-1/2 -translate-y-1/2 text-surface-500 hover:text-white transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Edge mode tabs */}
          <div className="hidden md:flex items-center gap-1 rounded-lg bg-surface-200 border border-surface-300 p-1 flex-shrink-0">
            {([
              { id: 'all',  label: 'All',       icon: Network },
              { id: 'wiki', label: 'Wiki links', icon: GitMerge },
              { id: 'tag',  label: 'Tag links',  icon: Hash },
            ] as const).map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setEdgeMode(id)}
                aria-pressed={edgeMode === id}
                className={cn(
                  'flex items-center gap-1.5 px-2.5 py-1 rounded-md text-[11px] font-mono font-semibold transition-all',
                  edgeMode === id
                    ? 'bg-purple/20 text-purple border border-purple/40'
                    : 'text-surface-500 hover:text-white hover:bg-surface-300'
                )}
              >
                <Icon className="h-3 w-3" aria-hidden="true" />
                {label}
              </button>
            ))}
          </div>

          {/* Counters */}
          {stats && (
            <div className="hidden lg:flex items-center gap-3 text-[11px] font-mono text-surface-500 flex-shrink-0">
              <span className="text-white">{stats.topicCount} topics</span>
              <span className="text-surface-600">·</span>
              <span>{filteredEdges.length} connections</span>
              {stats.wikiEdgeCount > 0 && (
                <>
                  <span className="text-surface-600">·</span>
                  <span className="text-for-400">{stats.wikiEdgeCount} wiki</span>
                </>
              )}
              {stats.tagEdgeCount > 0 && (
                <>
                  <span className="text-surface-600">·</span>
                  <span className="text-gold">{stats.tagEdgeCount} tag</span>
                </>
              )}
            </div>
          )}

          {/* Info + refresh */}
          <div className="ml-auto flex items-center gap-1 flex-shrink-0">
            <button
              onClick={() => setShowLegend((v) => !v)}
              aria-label="Toggle category legend"
              aria-pressed={showLegend}
              className="flex items-center gap-1 px-2.5 h-9 rounded-lg text-[11px] font-mono text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
            >
              <Tag className="h-3.5 w-3.5" aria-hidden="true" />
              <span className="hidden sm:block">Legend</span>
            </button>
            <button
              onClick={() => setShowInfo((v) => !v)}
              aria-label="Toggle info panel"
              aria-pressed={showInfo}
              className={cn(
                'flex items-center justify-center h-9 w-9 rounded-lg transition-colors',
                showInfo
                  ? 'bg-purple/20 text-purple border border-purple/40'
                  : 'text-surface-500 hover:text-white hover:bg-surface-200'
              )}
            >
              <Info className="h-4 w-4" aria-hidden="true" />
            </button>
            <button
              onClick={load}
              disabled={loading}
              aria-label="Refresh graph"
              className="flex items-center justify-center h-9 w-9 rounded-lg text-surface-500 hover:text-white hover:bg-surface-200 transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('h-4 w-4', loading && 'animate-spin')} aria-hidden="true" />
            </button>
          </div>
        </div>

        {/* ── Legend row ──────────────────────────────────────────────────── */}
        <AnimatePresence initial={false}>
          {showLegend && (
            <motion.div
              key="legend"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-surface-300"
            >
              <div className="px-3 md:px-5 py-2 flex flex-wrap gap-2 items-center">
                {CATEGORIES.map((cat) => {
                  const hex = GRAPH_CATEGORY_COLORS[cat.toLowerCase()] ?? '#71717a'
                  const hidden = hiddenCategories.has(cat.toLowerCase())
                  return (
                    <button
                      key={cat}
                      onClick={() => toggleCategory(cat)}
                      aria-pressed={hidden}
                      style={{ '--dot-color': hex } as React.CSSProperties}
                      className={cn(
                        'flex items-center gap-1.5 px-2 py-1 rounded-md text-[11px] font-mono transition-all border',
                        hidden
                          ? 'opacity-40 bg-surface-200 border-surface-300 text-surface-500'
                          : 'bg-surface-200 border-surface-300 text-white hover:border-surface-400'
                      )}
                    >
                      <span
                        className="h-2 w-2 rounded-full flex-shrink-0"
                        style={{ background: hex }}
                        aria-hidden="true"
                      />
                      {cat}
                    </button>
                  )
                })}
                <span className="text-[10px] font-mono text-surface-600 ml-1">click to hide/show</span>
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Info panel ──────────────────────────────────────────────────── */}
        <AnimatePresence initial={false}>
          {showInfo && (
            <motion.div
              key="info"
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.2 }}
              className="overflow-hidden border-t border-surface-300"
            >
              <div className="max-w-[1600px] mx-auto px-3 md:px-5 py-3">
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
                  {stats ? (
                    <>
                      <StatCard
                        label="topics in graph"
                        value={stats.topicCount}
                        color="text-white"
                      />
                      <StatCard
                        label="wiki link connections"
                        value={stats.wikiEdgeCount}
                        sub="from [[wikilinks]] in descriptions"
                        color="text-for-400"
                      />
                      <StatCard
                        label="tag connections"
                        value={stats.tagEdgeCount}
                        sub={stats.topSharedTag ? `most common: #${stats.topSharedTag.tag} (${stats.topSharedTag.count} topics)` : undefined}
                        color="text-gold"
                      />
                      <StatCard
                        label="most connected topic"
                        value={stats.mostConnectedTopic?.connections ?? 0}
                        sub={stats.mostConnectedTopic?.statement.slice(0, 50) ?? '—'}
                        color="text-purple"
                      />
                    </>
                  ) : (
                    Array.from({ length: 4 }, (_, i) => (
                      <Skeleton key={i} className="h-16 rounded-xl" />
                    ))
                  )}
                </div>
                <p className="text-xs font-mono text-surface-500 leading-relaxed max-w-2xl">
                  <span className="text-for-400 font-semibold">Wiki links</span>{' '}
                  appear when a topic&apos;s description contains a{' '}
                  <code className="text-surface-400 bg-surface-200 px-1 rounded">[[wikilink]]</code>{' '}
                  pointing to another debate.{' '}
                  <span className="text-gold font-semibold">Tag links</span>{' '}
                  connect topics sharing the same civic keyword (e.g., #climate, #taxation).
                  Node size = vote count. Color = category.
                  Drag to pan · scroll to zoom · click a node to open its debate.
                </p>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* ── Mobile edge mode strip ────────────────────────────────────────── */}
      <div className="md:hidden flex-shrink-0 flex items-center gap-1 px-3 py-2 bg-surface-100 border-b border-surface-300 overflow-x-auto">
        {([
          { id: 'all',  label: 'All connections', icon: Network },
          { id: 'wiki', label: 'Wiki links only',  icon: GitMerge },
          { id: 'tag',  label: 'Tag links only',   icon: Hash },
        ] as const).map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setEdgeMode(id)}
            aria-pressed={edgeMode === id}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold whitespace-nowrap transition-all flex-shrink-0',
              edgeMode === id
                ? 'bg-purple/20 text-purple border border-purple/40'
                : 'bg-surface-200 text-surface-500 border border-surface-300'
            )}
          >
            <Icon className="h-3 w-3" aria-hidden="true" />
            {label}
          </button>
        ))}
      </div>

      {/* ── Graph area ───────────────────────────────────────────────────── */}
      <main className="flex-1 min-h-0 overflow-hidden relative">
        {loading && nodes.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4">
            <Loader2 className="h-8 w-8 animate-spin text-purple" aria-label="Loading graph" />
            <p className="text-sm font-mono text-surface-500">Building the civic nexus…</p>
          </div>
        ) : error ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-4">
            <Network className="h-10 w-10 text-surface-500" aria-hidden="true" />
            <p className="text-sm font-mono text-surface-500">{error}</p>
            <button
              onClick={load}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-surface-200 border border-surface-300 text-sm font-mono text-white hover:bg-surface-300 transition-colors"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              Try again
            </button>
          </div>
        ) : nodes.length === 0 ? (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-center px-4">
            <Sparkles className="h-10 w-10 text-surface-500" aria-hidden="true" />
            <p className="text-sm font-mono text-surface-500">
              No connected topics yet. Start by adding{' '}
              <code className="text-for-400">[[wikilinks]]</code> in topic descriptions.
            </p>
            <Link
              href="/topic/wiki/recent"
              className="text-xs font-mono text-for-400 hover:text-for-300 underline underline-offset-2"
            >
              Recently edited wiki pages →
            </Link>
          </div>
        ) : (
          <TopicGraph
            topics={nodes}
            edges={filteredEdges}
            searchQuery={searchQuery}
            hiddenCategories={hiddenCategories}
            className="h-full w-full"
          />
        )}

        {/* Floating edge count badge */}
        {!loading && filteredEdges.length > 0 && (
          <div className="absolute bottom-20 md:bottom-4 left-1/2 -translate-x-1/2 pointer-events-none">
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-surface-100/80 border border-surface-300 backdrop-blur-sm text-[11px] font-mono text-surface-400">
              {edgeMode === 'wiki' ? (
                <>
                  <GitMerge className="h-3 w-3 text-for-400" aria-hidden="true" />
                  <span>{filteredEdges.length} wiki connections</span>
                </>
              ) : edgeMode === 'tag' ? (
                <>
                  <Hash className="h-3 w-3 text-gold" aria-hidden="true" />
                  <span>{filteredEdges.length} tag connections</span>
                </>
              ) : (
                <>
                  <Network className="h-3 w-3 text-purple" aria-hidden="true" />
                  <span>{filteredEdges.length} connections · {nodes.length} topics</span>
                </>
              )}
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
