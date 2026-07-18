'use client'

/**
 * /exchange/[id]/ideas — Per-Market Prediction Theses
 *
 * Shows all community market ideas for a specific civic debate topic.
 * Users can upvote/downvote ideas and submit their own thesis.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  ChevronDown,
  ChevronUp,
  Clock,
  Flame,
  Gavel,
  Lightbulb,
  Loader2,
  PenLine,
  RefreshCw,
  Sparkles,
  Target,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { MarketIdea, IdeasResponse } from '@/app/api/exchange/ideas/route'

// ─── Types ────────────────────────────────────────────────────────────────────

interface TopicStub {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number | null
  blue_votes: number | null
  red_votes: number | null
  total_votes: number | null
  ends_at: string | null
}

// ─── Constants ────────────────────────────────────────────────────────────────

const DIRECTION_CONFIG = {
  for: {
    label: 'For',
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
  },
  against: {
    label: 'Against',
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
  },
  neutral: {
    label: 'Neutral',
    color: 'text-surface-400',
    bg: 'bg-surface-300/10',
    border: 'border-surface-300/30',
  },
}

const CONFIDENCE_LABELS = ['', 'Exploratory', 'Low', 'Moderate', 'High', 'Conviction']
const CONFIDENCE_COLORS = ['', 'text-surface-500', 'text-surface-400', 'text-gold', 'text-for-400', 'text-emerald']

const SORT_TABS = [
  { id: 'top', label: 'Top', icon: Flame },
  { id: 'new', label: 'New', icon: Clock },
] as const
type SortMode = (typeof SORT_TABS)[number]['id']

const DIRECTION_FILTERS = [
  { id: null,       label: 'All'     },
  { id: 'for',      label: 'For'     },
  { id: 'against',  label: 'Against' },
  { id: 'neutral',  label: 'Neutral' },
] as const
type DirectionFilter = 'for' | 'against' | 'neutral' | null

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function priceColor(price: number, status?: string): string {
  if (status === 'law') return 'text-gold'
  if (status === 'failed') return 'text-against-400'
  if (price >= 67) return 'text-gold'
  if (price >= 55) return 'text-for-400'
  if (price <= 33) return 'text-against-400'
  if (price <= 45) return 'text-against-300'
  return 'text-surface-400'
}

// ─── Idea Card ─────────────────────────────────────────────────────────────────

function IdeaCard({ idea, onVote }: {
  idea: MarketIdea
  onVote: (id: string, dir: 'up' | 'down' | null) => void
}) {
  const [localVote, setLocalVote]  = useState<'up' | 'down' | null>(idea.viewer_vote)
  const [localUp,   setLocalUp]    = useState(idea.upvotes)
  const [localDown, setLocalDown]  = useState(idea.downvotes)
  const [voting,    setVoting]     = useState(false)
  const [expanded,  setExpanded]   = useState(false)

  const dirCfg   = DIRECTION_CONFIG[idea.direction]
  const score    = localUp - localDown
  const truncated = idea.body.length > 180 && !expanded

  async function handleVote(dir: 'up' | 'down') {
    if (voting) return
    const newDir = localVote === dir ? null : dir
    setVoting(true)
    const prevVote = localVote
    const prevUp   = localUp
    const prevDown = localDown

    setLocalVote(newDir)
    if (prevVote === 'up')   setLocalUp(u => Math.max(0, u - 1))
    if (prevVote === 'down') setLocalDown(d => Math.max(0, d - 1))
    if (newDir === 'up')   setLocalUp(u => u + 1)
    if (newDir === 'down') setLocalDown(d => d + 1)

    try {
      const res = await fetch('/api/exchange/ideas/vote', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ idea_id: idea.id, direction: newDir }),
      })
      if (!res.ok) throw new Error('vote failed')
      const data = await res.json()
      setLocalUp(data.upvotes)
      setLocalDown(data.downvotes)
      setLocalVote(data.viewer_vote)
      onVote(idea.id, data.viewer_vote)
    } catch {
      setLocalVote(prevVote)
      setLocalUp(prevUp)
      setLocalDown(prevDown)
    } finally {
      setVoting(false)
    }
  }

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-surface-100 border border-surface-300/60 rounded-xl overflow-hidden"
    >
      <div className="flex gap-3 p-4">
        {/* Vote column */}
        <div className="flex flex-col items-center gap-1 flex-shrink-0 pt-0.5">
          <button
            onClick={() => handleVote('up')}
            disabled={voting}
            className={cn(
              'flex items-center justify-center w-7 h-7 rounded-md border transition-colors',
              localVote === 'up'
                ? 'bg-for-500/20 border-for-500/40 text-for-400'
                : 'border-surface-300/60 text-surface-500 hover:border-for-500/40 hover:text-for-400'
            )}
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <span className={cn(
            'text-xs font-mono font-bold tabular-nums',
            score > 0 ? 'text-for-400' : score < 0 ? 'text-against-400' : 'text-surface-500'
          )}>
            {score > 0 ? '+' : ''}{score}
          </span>
          <button
            onClick={() => handleVote('down')}
            disabled={voting}
            className={cn(
              'flex items-center justify-center w-7 h-7 rounded-md border transition-colors',
              localVote === 'down'
                ? 'bg-against-500/20 border-against-500/40 text-against-400'
                : 'border-surface-300/60 text-surface-500 hover:border-against-500/40 hover:text-against-400'
            )}
          >
            <ChevronDown className="h-4 w-4" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap mb-2">
            <span className={cn(
              'text-xs font-mono font-bold px-2 py-0.5 rounded-md border',
              dirCfg.color, dirCfg.bg, dirCfg.border
            )}>
              {dirCfg.label}
            </span>
            {idea.target_price !== null && (
              <span className={cn('flex items-center gap-1 text-xs font-mono', priceColor(idea.target_price))}>
                <Target className="h-3 w-3" />
                {idea.target_price}¢ target
              </span>
            )}
            {idea.confidence >= 4 && (
              <span className={cn('flex items-center gap-1 text-xs font-mono', CONFIDENCE_COLORS[idea.confidence])}>
                <Zap className="h-3 w-3" />
                {CONFIDENCE_LABELS[idea.confidence]}
              </span>
            )}
            {idea.is_featured && (
              <span className="flex items-center gap-1 text-xs font-mono text-gold">
                <Sparkles className="h-3 w-3" />
                Featured
              </span>
            )}
          </div>

          <p className="font-semibold text-white text-sm leading-snug mb-2">{idea.title}</p>

          <p className={cn('text-sm text-surface-400 leading-relaxed', truncated && 'line-clamp-3')}>
            {idea.body}
          </p>
          {idea.body.length > 180 && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="text-xs text-for-400 hover:text-for-300 mt-1 font-mono"
            >
              {expanded ? 'Show less' : 'Read more'}
            </button>
          )}
        </div>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 border-t border-surface-300/40">
        <Link href={`/profile/${idea.author?.username}`} className="flex items-center gap-2 group">
          <Avatar
            src={idea.author?.avatar_url}
            fallback={idea.author?.display_name || idea.author?.username || '?'}
            size="xs"
          />
          <span className="text-xs text-surface-400 group-hover:text-white transition-colors font-mono">
            {idea.author?.display_name || idea.author?.username}
          </span>
        </Link>
        <div className="flex items-center gap-3">
          <span className="text-xs text-surface-600 font-mono">{relTime(idea.created_at)}</span>
          <Link
            href={`/exchange/ideas/${idea.id}`}
            className="text-xs text-surface-500 hover:text-for-400 font-mono transition-colors"
          >
            View →
          </Link>
        </div>
      </div>
    </motion.div>
  )
}

// ─── Compose Modal ─────────────────────────────────────────────────────────────

function ComposeModal({
  topic,
  onClose,
  onSubmit,
}: {
  topic: TopicStub
  onClose: () => void
  onSubmit: (idea: MarketIdea) => void
}) {
  const [title,       setTitle]       = useState('')
  const [body,        setBody]        = useState('')
  const [direction,   setDirection]   = useState<'for' | 'against' | 'neutral'>('for')
  const [targetPrice, setTargetPrice] = useState('')
  const [confidence,  setConfidence]  = useState(3)
  const [submitting,  setSubmitting]  = useState(false)
  const [error,       setError]       = useState<string | null>(null)

  const titleLen = title.trim().length
  const bodyLen  = body.trim().length
  const valid    = titleLen >= 5 && titleLen <= 120 && bodyLen >= 20 && bodyLen <= 500

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!valid || submitting) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/exchange/ideas', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          title:        title.trim(),
          body:         body.trim(),
          direction,
          target_price: targetPrice ? parseInt(targetPrice, 10) : null,
          confidence,
          topic_id:     topic.id,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to post idea')

      const newIdea: MarketIdea = {
        id:           data.id,
        user_id:      '',
        topic_id:     topic.id,
        title:        title.trim(),
        body:         body.trim(),
        direction,
        target_price: targetPrice ? parseInt(targetPrice, 10) : null,
        confidence,
        upvotes:      0,
        downvotes:    0,
        is_featured:  false,
        created_at:   new Date().toISOString(),
        score:        0,
        author: { id: '', username: 'you', display_name: 'You', avatar_url: null, role: 'citizen', clout: 0 },
        topic: {
          id: topic.id,
          statement: topic.statement,
          category: topic.category,
          status: topic.status,
          blue_pct: topic.blue_pct,
        },
        viewer_vote: null,
      }
      onSubmit(newIdea)
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to post idea')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <AnimatePresence>
      <motion.div
        className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/60 backdrop-blur-sm"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        onClick={e => { if (e.target === e.currentTarget) onClose() }}
      >
        <motion.div
          className="bg-surface-100 border border-surface-300/60 rounded-t-2xl sm:rounded-2xl w-full sm:max-w-lg max-h-[90vh] overflow-y-auto"
          initial={{ y: 80, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 80, opacity: 0 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-5 pt-5 pb-4 border-b border-surface-300/40">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-gold" />
              <span className="font-semibold text-white text-sm">Share Your Thesis</span>
            </div>
            <button onClick={onClose} className="text-surface-500 hover:text-white">
              <X className="h-5 w-5" />
            </button>
          </div>

          {/* Topic reference */}
          <div className="mx-5 mt-4 p-3 bg-surface-200 rounded-lg border border-surface-300/40">
            <div className="flex items-center gap-2">
              <BarChart2 className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" />
              <p className="text-xs text-surface-300 line-clamp-2 leading-snug">{topic.statement}</p>
              {topic.blue_pct !== null && (
                <span className={cn('text-xs font-mono font-bold flex-shrink-0', priceColor(Math.round(topic.blue_pct), topic.status))}>
                  {Math.round(topic.blue_pct)}¢
                </span>
              )}
            </div>
          </div>

          <form onSubmit={handleSubmit} className="p-5 space-y-4">
            {/* Direction */}
            <div>
              <label className="text-xs font-mono text-surface-400 uppercase tracking-wider block mb-2">
                Your Call
              </label>
              <div className="flex gap-2">
                {(['for', 'against', 'neutral'] as const).map(d => {
                  const cfg = DIRECTION_CONFIG[d]
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDirection(d)}
                      className={cn(
                        'flex-1 py-2 rounded-lg text-xs font-mono font-semibold border transition-colors',
                        direction === d
                          ? cn(cfg.color, cfg.bg, cfg.border)
                          : 'border-surface-300/40 text-surface-500 hover:border-surface-300/80'
                      )}
                    >
                      {cfg.label}
                    </button>
                  )
                })}
              </div>
            </div>

            {/* Title */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-mono text-surface-400 uppercase tracking-wider">Title</label>
                <span className={cn('text-xs font-mono', titleLen > 100 ? 'text-against-400' : 'text-surface-600')}>
                  {titleLen}/120
                </span>
              </div>
              <input
                type="text"
                value={title}
                onChange={e => setTitle(e.target.value)}
                placeholder="Your prediction headline…"
                maxLength={120}
                className="w-full bg-surface-200 border border-surface-300/60 rounded-lg px-3 py-2.5 text-sm text-white placeholder-surface-600 focus:outline-none focus:border-for-500/50"
              />
            </div>

            {/* Body */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-mono text-surface-400 uppercase tracking-wider">Reasoning</label>
                <span className={cn('text-xs font-mono', bodyLen > 450 ? 'text-against-400' : 'text-surface-600')}>
                  {bodyLen}/500
                </span>
              </div>
              <textarea
                value={body}
                onChange={e => setBody(e.target.value)}
                placeholder="Explain your thesis — what factors drive your prediction?"
                maxLength={500}
                rows={4}
                className="w-full bg-surface-200 border border-surface-300/60 rounded-lg px-3 py-2.5 text-sm text-white placeholder-surface-600 focus:outline-none focus:border-for-500/50 resize-none"
              />
            </div>

            {/* Target price + confidence */}
            <div className="flex gap-3">
              <div className="flex-1">
                <label className="text-xs font-mono text-surface-400 uppercase tracking-wider block mb-1.5">
                  Target (¢)
                </label>
                <input
                  type="number"
                  value={targetPrice}
                  onChange={e => setTargetPrice(e.target.value)}
                  placeholder="e.g. 72"
                  min={1}
                  max={99}
                  className="w-full bg-surface-200 border border-surface-300/60 rounded-lg px-3 py-2.5 text-sm text-white placeholder-surface-600 focus:outline-none focus:border-for-500/50"
                />
              </div>
              <div className="flex-1">
                <label className="text-xs font-mono text-surface-400 uppercase tracking-wider block mb-1.5">
                  Confidence
                </label>
                <select
                  value={confidence}
                  onChange={e => setConfidence(parseInt(e.target.value, 10))}
                  className="w-full bg-surface-200 border border-surface-300/60 rounded-lg px-3 py-2.5 text-sm text-white focus:outline-none focus:border-for-500/50"
                >
                  {CONFIDENCE_LABELS.slice(1).map((label, i) => (
                    <option key={i + 1} value={i + 1}>{label}</option>
                  ))}
                </select>
              </div>
            </div>

            {error && (
              <p className="text-xs text-against-400 font-mono">{error}</p>
            )}

            <Button
              type="submit"
              disabled={!valid || submitting}
              className="w-full"
            >
              {submitting ? (
                <><Loader2 className="h-4 w-4 animate-spin" /> Posting…</>
              ) : (
                <><PenLine className="h-4 w-4" /> Post Thesis</>
              )}
            </Button>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ─── Main Component ────────────────────────────────────────────────────────────

export function MarketIdeasClient({ topic }: { topic: TopicStub }) {
  const [ideas,      setIdeas]      = useState<MarketIdea[]>([])
  const [total,      setTotal]      = useState(0)
  const [hasMore,    setHasMore]    = useState(false)
  const [loading,    setLoading]    = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error,      setError]      = useState<string | null>(null)
  const [sort,       setSort]       = useState<SortMode>('top')
  const [dirFilter,  setDirFilter]  = useState<DirectionFilter>(null)
  const [composing,  setComposing]  = useState(false)
  const offsetRef = useRef(0)

  const price    = topic.blue_pct !== null ? Math.round(topic.blue_pct) : null
  const forPct   = topic.blue_pct !== null ? Math.round(topic.blue_pct) : null
  const againstPct = forPct !== null ? 100 - forPct : null

  const fetchIdeas = useCallback(async (opts: { reset?: boolean } = {}) => {
    if (opts.reset) {
      setLoading(true)
      offsetRef.current = 0
    } else {
      setLoadingMore(true)
    }
    setError(null)

    try {
      const params = new URLSearchParams({
        topic_id: topic.id,
        sort,
        limit: '20',
        offset: String(offsetRef.current),
      })
      if (dirFilter) params.set('direction', dirFilter)

      const res = await fetch(`/api/exchange/ideas?${params}`)
      if (!res.ok) throw new Error('Failed to load ideas')
      const data: IdeasResponse = await res.json()

      setIdeas(prev => opts.reset ? data.ideas : [...prev, ...data.ideas])
      setTotal(data.total)
      setHasMore(data.has_more)
      offsetRef.current += data.ideas.length
    } catch {
      setError('Failed to load ideas')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [topic.id, sort, dirFilter])

  useEffect(() => { fetchIdeas({ reset: true }) }, [fetchIdeas])

  function handleVote(id: string, dir: 'up' | 'down' | null) {
    setIdeas(prev => prev.map(idea =>
      idea.id === id ? { ...idea, viewer_vote: dir } : idea
    ))
  }

  function handleNewIdea(idea: MarketIdea) {
    setIdeas(prev => [idea, ...prev])
    setTotal(t => t + 1)
    setComposing(false)
  }

  const statusLabel = topic.status === 'law' ? 'Law' : topic.status === 'failed' ? 'Failed' : topic.status === 'voting' ? 'Voting' : 'Live'

  return (
    <>
      <TopBar />
      <main className="min-h-screen bg-surface-50 pb-24 pt-14">
        {/* Market header */}
        <div className="border-b border-surface-300/40 bg-surface-100/60 backdrop-blur-sm sticky top-14 z-10">
          <div className="max-w-2xl mx-auto px-4 py-3">
            <div className="flex items-center gap-2 mb-2">
              <Link
                href={`/exchange/${topic.id}`}
                className="flex items-center gap-1.5 text-surface-500 hover:text-white transition-colors group"
              >
                <ArrowLeft className="h-4 w-4 group-hover:-translate-x-0.5 transition-transform" />
                <span className="text-xs font-mono">Market</span>
              </Link>
              {topic.category && (
                <span className="text-surface-700 text-xs font-mono">·</span>
              )}
              {topic.category && (
                <span className="text-xs font-mono text-surface-500">{topic.category}</span>
              )}
            </div>
            <p className="text-sm text-white font-medium leading-snug line-clamp-2 mb-3">
              {topic.statement}
            </p>
            <div className="flex items-center gap-4">
              {price !== null && (
                <div className="flex items-center gap-2">
                  <span className={cn('text-lg font-mono font-bold', priceColor(price, topic.status))}>
                    {price}¢
                  </span>
                  {forPct !== null && againstPct !== null && (
                    <div className="flex items-center gap-1 text-xs font-mono">
                      <span className="text-for-400">{forPct}% for</span>
                      <span className="text-surface-600">·</span>
                      <span className="text-against-400">{againstPct}% against</span>
                    </div>
                  )}
                </div>
              )}
              <span className={cn(
                'text-xs font-mono px-2 py-0.5 rounded-full border',
                topic.status === 'law'    ? 'text-gold border-gold/30 bg-gold/10' :
                topic.status === 'failed' ? 'text-against-400 border-against-400/30 bg-against-500/10' :
                topic.status === 'voting' ? 'text-emerald border-emerald/30 bg-emerald/10' :
                                            'text-for-400 border-for-400/30 bg-for-500/10'
              )}>
                {statusLabel}
              </span>
              <span className="text-xs font-mono text-surface-500 ml-auto">
                {total} {total === 1 ? 'thesis' : 'theses'}
              </span>
            </div>
          </div>
        </div>

        <div className="max-w-2xl mx-auto px-4 pt-4 space-y-4">
          {/* Controls */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            {/* Sort tabs */}
            <div className="flex bg-surface-200/80 rounded-lg p-0.5 gap-0.5">
              {SORT_TABS.map(tab => {
                const Icon = tab.icon
                return (
                  <button
                    key={tab.id}
                    onClick={() => setSort(tab.id)}
                    className={cn(
                      'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono transition-colors',
                      sort === tab.id
                        ? 'bg-surface-100 text-white'
                        : 'text-surface-500 hover:text-surface-300'
                    )}
                  >
                    <Icon className="h-3 w-3" />
                    {tab.label}
                  </button>
                )
              })}
            </div>

            {/* Direction filter */}
            <div className="flex gap-1">
              {DIRECTION_FILTERS.map(f => (
                <button
                  key={String(f.id)}
                  onClick={() => setDirFilter(f.id as DirectionFilter)}
                  className={cn(
                    'px-2.5 py-1.5 rounded-lg text-xs font-mono transition-colors border',
                    dirFilter === f.id
                      ? 'bg-for-500/20 border-for-500/40 text-for-400'
                      : 'border-surface-300/40 text-surface-500 hover:border-surface-300/80'
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>

            {/* Refresh */}
            <button
              onClick={() => fetchIdeas({ reset: true })}
              className="text-surface-500 hover:text-white transition-colors"
              title="Refresh"
            >
              <RefreshCw className="h-4 w-4" />
            </button>
          </div>

          {/* Post thesis CTA */}
          <button
            onClick={() => setComposing(true)}
            className="w-full flex items-center gap-3 px-4 py-3 bg-surface-200/60 border border-surface-300/40 border-dashed rounded-xl text-surface-500 hover:border-for-500/40 hover:text-for-400 transition-colors group"
          >
            <PenLine className="h-4 w-4 group-hover:text-for-400" />
            <span className="text-sm font-mono">Share your prediction thesis…</span>
          </button>

          {/* Ideas list */}
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 3 }).map((_, i) => (
                <Skeleton key={i} className="h-40 rounded-xl" />
              ))}
            </div>
          ) : error ? (
            <EmptyState
              icon={<Gavel className="h-8 w-8 text-against-400" />}
              title="Failed to load"
              description={error}
              action={{ label: 'Retry', onClick: () => fetchIdeas({ reset: true }) }}
            />
          ) : ideas.length === 0 ? (
            <EmptyState
              icon={<Lightbulb className="h-8 w-8 text-gold" />}
              title="No theses yet"
              description="Be the first to share a prediction thesis for this market."
              action={{ label: 'Share Thesis', onClick: () => setComposing(true) }}
            />
          ) : (
            <div className="space-y-3">
              {ideas.map(idea => (
                <IdeaCard key={idea.id} idea={idea} onVote={handleVote} />
              ))}

              {hasMore && (
                <button
                  onClick={() => fetchIdeas()}
                  disabled={loadingMore}
                  className="w-full py-3 text-sm font-mono text-surface-400 hover:text-white border border-surface-300/40 rounded-xl transition-colors"
                >
                  {loadingMore ? (
                    <><Loader2 className="h-4 w-4 inline animate-spin mr-2" />Loading…</>
                  ) : (
                    'Load more'
                  )}
                </button>
              )}
            </div>
          )}

          {/* Link to all market ideas */}
          <div className="pt-2 pb-4 text-center">
            <Link
              href="/exchange/ideas"
              className="text-xs font-mono text-surface-500 hover:text-for-400 transition-colors"
            >
              Browse all market ideas →
            </Link>
          </div>
        </div>
      </main>

      {composing && (
        <ComposeModal
          topic={topic}
          onClose={() => setComposing(false)}
          onSubmit={handleNewIdea}
        />
      )}

      <BottomNav />
    </>
  )
}
