'use client'

/**
 * /mindmap — Civic Mind Map
 *
 * A personal Obsidian-style knowledge graph that visualises every debate,
 * argument, law, and journal entry the current user has engaged with — and
 * the connections between them.
 *
 * Node types:
 *   • Topic  — debates the user has voted on (blue = for, red = against)
 *   • Law    — topics that reached consensus (golden ring)
 *   • Argument — arguments the user has authored (purple)
 *   • Journal  — journal entries linked to topics (gold)
 *
 * Edges connect arguments/journal entries to their parent topics. Topics in
 * the same category are pulled together by a cluster force.
 *
 * Interactions: drag nodes, pan, zoom (scroll), click to navigate.
 */

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BookOpen,
  FileText,
  Gavel,
  Info,
  Loader2,
  MessageSquare,
  RefreshCw,
  Search,
  X,
  ZoomIn,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'
import { createClient } from '@/lib/supabase/client'
import type { MindMapData, MindMapNodeType } from '@/app/api/me/mindmap/route'

// Lazy-load the D3-powered canvas (keeps main bundle lighter)
const MindMapGraph = dynamic(
  () => import('@/components/mindmap/MindMapGraph').then((m) => m.MindMapGraph),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center">
        <Loader2 className="h-6 w-6 text-surface-500 animate-spin" />
      </div>
    ),
  }
)

// ─── Node type config ──────────────────────────────────────────────────────────

interface TypeConfig {
  label: string
  icon: typeof FileText
  color: string
  bg: string
  border: string
}

const TYPE_CONFIG: Record<MindMapNodeType, TypeConfig> = {
  topic: {
    label: 'Topics',
    icon: FileText,
    color: 'text-for-300',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
  },
  law: {
    label: 'Laws',
    icon: Gavel,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
  },
  argument: {
    label: 'Arguments',
    icon: MessageSquare,
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
  },
  journal: {
    label: 'Journal',
    icon: BookOpen,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/20',
  },
}

const ALL_TYPES: MindMapNodeType[] = ['topic', 'law', 'argument', 'journal']

// ─── Component ─────────────────────────────────────────────────────────────────

export default function MindMapPage() {
  const [data, setData] = useState<MindMapData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [authed, setAuthed] = useState<boolean | null>(null)
  const [searchQuery, setSearchQuery] = useState('')
  const [hiddenTypes, setHiddenTypes] = useState<Set<MindMapNodeType>>(new Set())
  const [showLegend, setShowLegend] = useState(false)

  // Auth check
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      setAuthed(!!user)
      if (!user) setLoading(false)
    })
  }, [])

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch('/api/me/mindmap', { cache: 'no-store' })
      if (!res.ok) {
        if (res.status === 401) {
          setAuthed(false)
          return
        }
        throw new Error(`HTTP ${res.status}`)
      }
      const json = (await res.json()) as MindMapData
      setData(json)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load mind map')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (authed) load()
  }, [authed, load])

  function toggleType(type: MindMapNodeType) {
    setHiddenTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }

  const totalNodes = data?.nodes.length ?? 0
  const totalEdges = data?.edges.length ?? 0

  // ── Not logged in ────────────────────────────────────────────────────────
  if (authed === false) {
    return (
      <div className="min-h-screen bg-surface-50 flex flex-col">
        <TopBar />
        <div className="flex-1 flex flex-col items-center justify-center gap-4 p-8">
          <div className="flex items-center justify-center h-14 w-14 rounded-2xl bg-purple/10 border border-purple/30">
            <BookOpen className="h-6 w-6 text-purple" />
          </div>
          <div className="text-center">
            <h2 className="font-mono text-xl font-bold text-white mb-2">Civic Mind Map</h2>
            <p className="text-surface-400 text-sm max-w-xs">
              Sign in to see your personal knowledge graph — every debate, argument, and journal entry you&apos;ve made.
            </p>
          </div>
          <Link href="/login" className="px-6 py-2.5 rounded-xl bg-purple/80 hover:bg-purple text-white text-sm font-mono font-semibold transition-colors">
            Sign in
          </Link>
        </div>
        <BottomNav />
      </div>
    )
  }

  // ── Main render ──────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      <main className="flex-1 flex flex-col overflow-hidden pb-16 md:pb-0">
        {/* ── Header strip ──────────────────────────────────────────────── */}
        <div className="flex-shrink-0 border-b border-surface-300/50 bg-surface-100/80 backdrop-blur-sm">
          <div className="max-w-[1400px] mx-auto px-4 h-14 flex items-center gap-3">
            {/* Back */}
            <Link
              href="/analytics"
              className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 text-surface-500 hover:text-white hover:bg-surface-300 transition-colors flex-shrink-0"
              aria-label="Back"
            >
              <ArrowLeft className="h-4 w-4" />
            </Link>

            {/* Title */}
            <div className="flex items-center gap-2 flex-1 min-w-0">
              <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-purple/10 border border-purple/20 flex-shrink-0">
                <BookOpen className="h-3.5 w-3.5 text-purple" />
              </div>
              <span className="font-mono text-sm font-semibold text-white hidden sm:block">Civic Mind Map</span>
              {data && (
                <span className="text-xs font-mono text-surface-500 hidden md:block">
                  {totalNodes} nodes · {totalEdges} connections
                </span>
              )}
            </div>

            {/* Search */}
            <div className="relative flex-1 max-w-xs">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-500 pointer-events-none" />
              <input
                type="text"
                placeholder="Search nodes…"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="w-full pl-8 pr-8 py-1.5 rounded-lg bg-surface-200 border border-surface-300/60 text-sm font-mono text-white placeholder-surface-500 focus:outline-none focus:border-purple/40 focus:bg-surface-300/50 transition-colors"
              />
              {searchQuery && (
                <button
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-surface-500 hover:text-white"
                  aria-label="Clear search"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              )}
            </div>

            {/* Type filters */}
            <div className="hidden sm:flex items-center gap-1.5">
              {ALL_TYPES.map((type) => {
                const cfg = TYPE_CONFIG[type]
                const Icon = cfg.icon
                const count = data?.stats[`${type}Count` as keyof typeof data.stats] ?? 0
                const hidden = hiddenTypes.has(type)
                return (
                  <button
                    key={type}
                    onClick={() => toggleType(type)}
                    aria-pressed={!hidden}
                    title={`${hidden ? 'Show' : 'Hide'} ${cfg.label}`}
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border transition-all',
                      hidden
                        ? 'bg-surface-200/40 border-surface-300/40 text-surface-600 opacity-50'
                        : cn(cfg.bg, cfg.border, cfg.color)
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    <span>{count}</span>
                  </button>
                )
              })}
            </div>

            {/* Refresh + Info */}
            <div className="flex items-center gap-1 flex-shrink-0">
              <button
                onClick={load}
                disabled={loading}
                className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 text-surface-500 hover:text-white hover:bg-surface-300 transition-colors disabled:opacity-50"
                aria-label="Refresh"
              >
                <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
              </button>
              <button
                onClick={() => setShowLegend((v) => !v)}
                className={cn(
                  'flex items-center justify-center h-8 w-8 rounded-lg border transition-colors',
                  showLegend
                    ? 'bg-purple/20 border-purple/30 text-purple'
                    : 'bg-surface-200 border-transparent text-surface-500 hover:text-white hover:bg-surface-300'
                )}
                aria-label="Toggle legend"
              >
                <Info className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>

        {/* ── Mobile type filters ────────────────────────────────────────── */}
        <div className="sm:hidden flex-shrink-0 px-4 py-2 flex gap-2 overflow-x-auto border-b border-surface-300/30">
          {ALL_TYPES.map((type) => {
            const cfg = TYPE_CONFIG[type]
            const Icon = cfg.icon
            const count = data?.stats[`${type}Count` as keyof typeof data.stats] ?? 0
            const hidden = hiddenTypes.has(type)
            return (
              <button
                key={type}
                onClick={() => toggleType(type)}
                className={cn(
                  'flex-shrink-0 flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-mono font-semibold border transition-all',
                  hidden
                    ? 'bg-surface-200/40 border-surface-300/40 text-surface-600 opacity-50'
                    : cn(cfg.bg, cfg.border, cfg.color)
                )}
              >
                <Icon className="h-3 w-3" />
                {cfg.label} ({count})
              </button>
            )
          })}
        </div>

        {/* ── Canvas area ────────────────────────────────────────────────── */}
        <div className="flex-1 relative min-h-0">
          {loading ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3">
                <Loader2 className="h-6 w-6 text-purple animate-spin" />
                <p className="text-sm font-mono text-surface-500">Building your mind map…</p>
              </div>
            </div>
          ) : error ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-3 text-center px-4">
                <p className="text-against-400 text-sm font-mono">{error}</p>
                <button
                  onClick={load}
                  className="px-4 py-2 rounded-lg bg-surface-200 hover:bg-surface-300 text-white text-xs font-mono transition-colors"
                >
                  Try again
                </button>
              </div>
            </div>
          ) : !data || totalNodes === 0 ? (
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="flex flex-col items-center gap-4 text-center px-4 max-w-sm">
                <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-purple/10 border border-purple/20">
                  <BookOpen className="h-7 w-7 text-purple" />
                </div>
                <div>
                  <h3 className="font-mono text-lg font-bold text-white mb-2">Your map is empty</h3>
                  <p className="text-sm text-surface-400">
                    Start voting on topics, writing arguments, or keeping a journal — your civic knowledge graph will grow with every action.
                  </p>
                </div>
                <Link
                  href="/"
                  className="px-5 py-2 rounded-xl bg-for-600/80 hover:bg-for-600 text-white text-sm font-mono font-semibold transition-colors"
                >
                  Explore topics
                </Link>
              </div>
            </div>
          ) : (
            <MindMapGraph
              nodes={data.nodes}
              edges={data.edges}
              searchQuery={searchQuery}
              hiddenTypes={hiddenTypes}
              className="absolute inset-0"
            />
          )}

          {/* Legend overlay */}
          <AnimatePresence>
            {showLegend && (
              <motion.div
                initial={{ opacity: 0, x: 16 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 16 }}
                transition={{ duration: 0.2 }}
                className="absolute top-4 right-4 z-20 w-52 rounded-2xl bg-surface-100/90 backdrop-blur-md border border-surface-300/60 shadow-2xl p-4"
              >
                <p className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-wider mb-3">Legend</p>
                <div className="space-y-2.5">
                  {ALL_TYPES.map((type) => {
                    const cfg = TYPE_CONFIG[type]
                    const Icon = cfg.icon
                    return (
                      <div key={type} className="flex items-start gap-2.5">
                        <div className={cn('flex items-center justify-center h-5 w-5 rounded flex-shrink-0 mt-0.5', cfg.bg)}>
                          <Icon className={cn('h-3 w-3', cfg.color)} />
                        </div>
                        <div>
                          <p className={cn('text-xs font-mono font-semibold', cfg.color)}>{cfg.label}</p>
                          <p className="text-[10px] text-surface-500 leading-snug mt-0.5">
                            {type === 'topic' && 'Topics you voted on (blue = for, red = against)'}
                            {type === 'law' && 'Topics that reached consensus (golden ring)'}
                            {type === 'argument' && 'Arguments you authored'}
                            {type === 'journal' && 'Journal entries linked to debates'}
                          </p>
                        </div>
                      </div>
                    )
                  })}
                </div>
                <div className="mt-3 pt-3 border-t border-surface-300/40 space-y-1 text-[10px] font-mono text-surface-500">
                  <p>Drag nodes to rearrange</p>
                  <p>Scroll to zoom · Click to open</p>
                  <p>Purple lines = argued · Gold dashes = journal</p>
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Zoom hint (shown only when data loaded and no error) */}
          {!loading && !error && totalNodes > 0 && (
            <div className="absolute bottom-4 left-4 flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-surface-100/80 backdrop-blur-sm border border-surface-300/40 text-[10px] font-mono text-surface-500">
              <ZoomIn className="h-3 w-3" />
              <span>Scroll to zoom · Drag to pan</span>
            </div>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
