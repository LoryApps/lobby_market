'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { motion } from 'framer-motion'
import {
  ArrowLeft,
  Check,
  Copy,
  Filter,
  Loader2,
  Network,
  RefreshCw,
  RotateCcw,
  Search,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { GRAPH_CATEGORY_COLORS } from '@/lib/utils/graph-colors'
import { cn } from '@/lib/utils/cn'
import type { ThesisNetworkResponse } from '@/app/api/thesis/network/route'

const ThesisGraph = dynamic(
  () => import('@/components/thesis/ThesisGraph').then((m) => m.ThesisGraph),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-6 w-6 text-surface-500 animate-spin" />
      </div>
    ),
  }
)

type EdgeFilter = 'all' | 'topic' | 'author' | 'category'

const EDGE_FILTERS: { id: EdgeFilter; label: string; color: string }[] = [
  { id: 'all',      label: 'All Links',      color: 'text-white' },
  { id: 'topic',    label: 'Same Topic',     color: 'text-for-400' },
  { id: 'author',   label: 'Same Author',    color: 'text-emerald' },
  { id: 'category', label: 'Same Category',  color: 'text-surface-400' },
]

const CATEGORY_KEYS = Object.keys(GRAPH_CATEGORY_COLORS)

export function ThesisNetworkView() {
  const [data, setData] = useState<ThesisNetworkResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [hiddenCategories, setHiddenCategories] = useState<Set<string>>(new Set())
  const [edgeFilter, setEdgeFilter] = useState<EdgeFilter>('all')
  const [graphKey, setGraphKey] = useState(0)
  const [copied, setCopied] = useState(false)
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'vindicated' | 'refuted'>('all')

  const fetchData = useCallback(async (status: string) => {
    setLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (status !== 'all') params.set('status', status)
      const res = await fetch(`/api/thesis/network?${params}`)
      if (!res.ok) throw new Error('Failed to load network data')
      const json: ThesisNetworkResponse = await res.json()
      setData(json)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => { fetchData(statusFilter) }, [statusFilter, fetchData])

  const toggleCategory = (cat: string) => {
    setHiddenCategories((prev) => {
      const next = new Set(prev)
      if (next.has(cat)) next.delete(cat)
      else next.add(cat)
      return next
    })
  }

  const copyLink = async () => {
    await navigator.clipboard.writeText(window.location.href)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const handleStatusChange = (s: typeof statusFilter) => {
    setStatusFilter(s)
    // useEffect will automatically re-fetch when statusFilter changes
  }

  const refresh = useCallback(() => { fetchData(statusFilter) }, [fetchData, statusFilter])

  // Only filter nodes by hidden categories — edge-type filtering is handled inside
  // ThesisGraph via edgeFilterRef so the D3 simulation doesn't restart on filter changes.
  const allNodes = data?.nodes ?? []
  const allEdges = data?.edges ?? []
  const visibleNodes = allNodes.filter((n) => !hiddenCategories.has(n.category))
  const nodeIds = new Set(visibleNodes.map((n) => n.id))
  const visibleEdges = allEdges.filter((e) => nodeIds.has(e.source) && nodeIds.has(e.target))

  return (
    <div className="flex flex-col h-screen bg-surface-50">
      <TopBar />

      {/* Header */}
      <div className="sticky top-14 z-40 bg-surface-100 border-b border-surface-300 flex-shrink-0">
        <div className="max-w-[1400px] mx-auto flex items-center px-4 gap-3 py-2.5 min-h-[3rem]">
          <Link
            href="/thesis"
            className={cn(
              'flex items-center justify-center h-8 w-8 rounded-lg flex-shrink-0',
              'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors',
            )}
            aria-label="Back to Thesis"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2">
            <Network className="h-4 w-4 text-purple" />
            <span className="text-sm font-mono text-surface-700">Thesis · Network Graph</span>
          </div>
          {data && (
            <div className="text-xs font-mono text-surface-500 ml-1 hidden sm:block">
              {data.total_nodes} theses · {data.total_edges} links
            </div>
          )}

          {/* Status filter */}
          <div className="flex items-center gap-1 ml-2 hidden sm:flex">
            {(['all', 'active', 'vindicated', 'refuted'] as const).map((s) => (
              <button
                key={s}
                onClick={() => handleStatusChange(s)}
                className={cn(
                  'px-2 py-1 rounded text-[11px] font-mono transition-colors',
                  statusFilter === s
                    ? s === 'vindicated' ? 'bg-gold/20 text-gold border border-gold/40'
                      : s === 'refuted' ? 'bg-against-500/20 text-against-400 border border-against-500/40'
                      : s === 'active' ? 'bg-for-500/20 text-for-400 border border-for-500/40'
                      : 'bg-surface-300 text-white border border-surface-400'
                    : 'text-surface-500 hover:text-white border border-transparent',
                )}
              >
                {s}
              </button>
            ))}
          </div>

          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => setGraphKey((k) => k + 1)}
              title="Reset view"
              className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            >
              <RotateCcw className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => load()}
              title="Refresh"
              className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            </button>
            <button
              onClick={copyLink}
              title="Copy link"
              className={cn(
                'flex items-center justify-center h-8 w-8 rounded-lg transition-colors',
                copied
                  ? 'bg-emerald/20 text-emerald'
                  : 'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white',
              )}
            >
              {copied ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
            </button>
          </div>
        </div>

        {/* Controls row */}
        <div className="max-w-[1400px] mx-auto px-4 pb-2 flex flex-wrap items-center gap-2">
          {/* Search */}
          <div className="relative flex-shrink-0">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-500" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search theses…"
              className={cn(
                'pl-8 pr-8 py-1.5 w-48 rounded-lg bg-surface-200 border border-surface-400',
                'text-xs font-mono text-white placeholder-surface-500',
                'focus:outline-none focus:border-surface-500 transition-colors',
              )}
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery('')}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-surface-500 hover:text-white"
              >
                <X className="h-3 w-3" />
              </button>
            )}
          </div>

          {/* Edge filter */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <Filter className="h-3 w-3 text-surface-500" />
            {EDGE_FILTERS.map((f) => (
              <button
                key={f.id}
                onClick={() => setEdgeFilter(f.id)}
                className={cn(
                  'px-2 py-1 rounded text-[11px] font-mono transition-colors border',
                  edgeFilter === f.id
                    ? 'bg-surface-300 border-surface-400 text-white'
                    : 'border-transparent text-surface-500 hover:text-white',
                )}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Category pills */}
          <div className="flex items-center gap-1 flex-wrap">
            {CATEGORY_KEYS.map((cat) => {
              const color = GRAPH_CATEGORY_COLORS[cat] ?? '#71717a'
              const isHidden = hiddenCategories.has(cat)
              return (
                <button
                  key={cat}
                  onClick={() => toggleCategory(cat)}
                  className={cn(
                    'px-2 py-0.5 rounded-full text-[10px] font-mono transition-all border capitalize',
                    isHidden
                      ? 'opacity-30 border-surface-600 text-surface-600'
                      : 'border-opacity-50 text-white',
                  )}
                  style={
                    isHidden
                      ? {}
                      : { borderColor: color + '70', backgroundColor: color + '18', color }
                  }
                >
                  {cat}
                </button>
              )
            })}
            {hiddenCategories.size > 0 && (
              <button
                onClick={() => setHiddenCategories(new Set())}
                className="px-2 py-0.5 rounded-full text-[10px] font-mono text-surface-500 hover:text-white border border-surface-500 transition-colors"
              >
                show all
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Main graph */}
      <main className="flex-1 overflow-hidden p-3 sm:p-4">
        {error ? (
          <div className="flex-1 flex items-center justify-center text-sm text-against-400 font-mono">
            {error}
          </div>
        ) : loading && !data ? (
          <div className="flex-1 flex items-center justify-center gap-3 text-sm text-surface-500 font-mono">
            <Loader2 className="h-5 w-5 animate-spin" />
            Building network…
          </div>
        ) : data ? (
          <motion.div
            key={graphKey}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.4 }}
            className="h-full"
          >
            <ThesisGraph
              nodes={visibleNodes}
              edges={visibleEdges}
              searchQuery={searchQuery}
              hiddenCategories={hiddenCategories}
              edgeFilter={edgeFilter}
              className="h-full"
            />
          </motion.div>
        ) : null}
      </main>

      <BottomNav />
    </div>
  )
}
