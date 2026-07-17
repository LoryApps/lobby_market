'use client'

/**
 * /exchange/ideas — Market Ideas Feed
 *
 * Community prediction theses: users share a market call (for/against/neutral),
 * reasoning, target price, and confidence. Other users upvote/downvote.
 *
 * Sort: Top (score) | New (created_at)
 * Filter: All | For | Against | Neutral
 * Compose: inline modal
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
  ExternalLink,
  Flame,
  Lightbulb,
  Loader2,
  PenLine,
  RefreshCw,
  Search,
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

// ─── Constants ────────────────────────────────────────────────────────────────

const DIRECTION_CONFIG = {
  for: {
    label: 'For',
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    badgeVariant: 'for' as const,
  },
  against: {
    label: 'Against',
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    badgeVariant: 'against' as const,
  },
  neutral: {
    label: 'Neutral',
    color: 'text-surface-400',
    bg: 'bg-surface-300/10',
    border: 'border-surface-300/30',
    badgeVariant: 'proposed' as const,
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
  { id: null, label: 'All' },
  { id: 'for', label: 'For' },
  { id: 'against', label: 'Against' },
  { id: 'neutral', label: 'Neutral' },
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

function priceColor(price: number): string {
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
  const [localVote,  setLocalVote]  = useState<'up' | 'down' | null>(idea.viewer_vote)
  const [localUp,    setLocalUp]    = useState(idea.upvotes)
  const [localDown,  setLocalDown]  = useState(idea.downvotes)
  const [voting,     setVoting]     = useState(false)
  const [expanded,   setExpanded]   = useState(false)

  const dirCfg  = DIRECTION_CONFIG[idea.direction]
  const score   = localUp - localDown
  const truncated = idea.body.length > 200 && !expanded

  async function handleVote(dir: 'up' | 'down') {
    if (voting) return
    const newDir = localVote === dir ? null : dir
    setVoting(true)
    const prevVote = localVote
    const prevUp   = localUp
    const prevDown = localDown

    // Optimistic update
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
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.2 }}
      className="bg-surface-100 border border-surface-300/60 rounded-xl overflow-hidden hover:border-surface-400/60 transition-colors"
    >
      {/* Header */}
      <div className="flex items-start gap-3 p-4 pb-0">
        {/* Vote column */}
        <div className="flex flex-col items-center gap-1 pt-0.5 flex-shrink-0">
          <button
            onClick={() => handleVote('up')}
            disabled={voting}
            aria-label="Upvote idea"
            className={cn(
              'flex items-center justify-center h-7 w-7 rounded-lg border transition-all disabled:opacity-50',
              localVote === 'up'
                ? 'bg-for-500/20 border-for-500/40 text-for-400'
                : 'border-surface-300/60 text-surface-500 hover:border-for-500/40 hover:text-for-400'
            )}
          >
            <ChevronUp className="h-4 w-4" />
          </button>
          <span className={cn(
            'text-xs font-mono font-bold min-w-[1.5rem] text-center',
            score > 0 ? 'text-for-400' : score < 0 ? 'text-against-400' : 'text-surface-500'
          )}>
            {score > 0 ? `+${score}` : score}
          </span>
          <button
            onClick={() => handleVote('down')}
            disabled={voting}
            aria-label="Downvote idea"
            className={cn(
              'flex items-center justify-center h-7 w-7 rounded-lg border transition-all disabled:opacity-50',
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
            <span className={cn('text-xs font-mono font-bold px-2 py-0.5 rounded-md border', dirCfg.color, dirCfg.bg, dirCfg.border)}>
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
          {idea.body.length > 200 && (
            <button
              onClick={() => setExpanded(e => !e)}
              className="text-xs text-for-400 hover:text-for-300 mt-1 font-mono"
            >
              {expanded ? 'Show less' : 'Read more'}
            </button>
          )}
        </div>
      </div>

      {/* Topic link */}
      {idea.topic && (
        <div className="mx-4 mt-3 p-2.5 rounded-lg bg-surface-200/60 border border-surface-300/40">
          <Link href={`/exchange/${idea.topic.id}`} className="flex items-center justify-between gap-2 group">
            <div className="flex items-center gap-2 min-w-0">
              <BarChart2 className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" />
              <span className="text-xs text-surface-300 truncate group-hover:text-white transition-colors">
                {idea.topic.statement}
              </span>
            </div>
            <div className="flex items-center gap-2 flex-shrink-0">
              {idea.topic.blue_pct !== null && (
                <span className={cn('text-xs font-mono font-bold', priceColor(Math.round(idea.topic.blue_pct)))}>
                  {Math.round(idea.topic.blue_pct)}¢
                </span>
              )}
              <ExternalLink className="h-3 w-3 text-surface-500 group-hover:text-for-400 transition-colors" />
            </div>
          </Link>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between px-4 py-3 mt-2">
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
        <span className="text-xs text-surface-600 font-mono">{relTime(idea.created_at)}</span>
      </div>
    </motion.div>
  )
}

// ─── Compose Modal ─────────────────────────────────────────────────────────────

interface ComposeModalProps {
  onClose: () => void
  onSubmit: (idea: MarketIdea) => void
}

function ComposeModal({ onClose, onSubmit }: ComposeModalProps) {
  const [title,       setTitle]       = useState('')
  const [body,        setBody]        = useState('')
  const [direction,   setDirection]   = useState<'for' | 'against' | 'neutral'>('for')
  const [targetPrice, setTargetPrice] = useState('')
  const [confidence,  setConfidence]  = useState(3)
  const [topicQuery,  setTopicQuery]  = useState('')
  const [topicId,     setTopicId]     = useState<string | null>(null)
  const [topicLabel,  setTopicLabel]  = useState<string | null>(null)
  const [topicResults, setTopicResults] = useState<Array<{ id: string; statement: string; blue_pct: number | null }>>([])
  const [loadingTopic, setLoadingTopic] = useState(false)
  const [submitting,  setSubmitting]  = useState(false)
  const [error,       setError]       = useState<string | null>(null)
  const searchTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const titleLen = title.trim().length
  const bodyLen  = body.trim().length
  const valid    = titleLen >= 5 && titleLen <= 120 && bodyLen >= 20 && bodyLen <= 500

  // Topic search
  useEffect(() => {
    if (searchTimer.current) clearTimeout(searchTimer.current)
    if (topicQuery.length < 2) { setTopicResults([]); return }
    setLoadingTopic(true)
    searchTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/topics/wikilinks?q=${encodeURIComponent(topicQuery)}`)
        if (res.ok) {
          const data = await res.json()
          setTopicResults(
            (data.results ?? []).map((t: { id: string; statement: string; blue_pct?: number | null }) => ({
              id: t.id,
              statement: t.statement,
              blue_pct: t.blue_pct ?? null,
            }))
          )
        }
      } catch { /* best-effort */ }
      finally { setLoadingTopic(false) }
    }, 300)
    return () => { if (searchTimer.current) clearTimeout(searchTimer.current) }
  }, [topicQuery])

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
          title: title.trim(),
          body: body.trim(),
          direction,
          target_price: targetPrice ? parseInt(targetPrice, 10) : null,
          confidence,
          topic_id: topicId,
        }),
      })
      const data = await res.json()
      if (!res.ok) throw new Error(data.error ?? 'Failed to post idea')

      // Optimistically add the new idea to the list
      const newIdea: MarketIdea = {
        id:           data.id,
        user_id:      '',
        topic_id:     topicId,
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
        author:       { id: '', username: 'you', display_name: 'You', avatar_url: null, role: 'citizen', clout: 0 },
        topic:        topicId ? { id: topicId, statement: topicLabel ?? '', category: null, status: 'active', blue_pct: null } : null,
        viewer_vote:  null,
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
        onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      >
        <motion.div
          className="w-full sm:max-w-lg bg-surface-100 border border-surface-300/60 rounded-t-2xl sm:rounded-2xl shadow-2xl"
          initial={{ y: 60, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 60, opacity: 0 }}
          transition={{ type: 'spring', damping: 22, stiffness: 220 }}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3.5 border-b border-surface-300/40">
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4.5 w-4.5 text-gold" />
              <h2 className="font-mono font-bold text-white text-sm">New Market Idea</h2>
            </div>
            <button onClick={onClose} aria-label="Close" className="text-surface-500 hover:text-white transition-colors">
              <X className="h-4 w-4" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-4 space-y-4">
            {/* Direction */}
            <div>
              <label className="block text-xs font-mono text-surface-500 mb-1.5">Your call</label>
              <div className="grid grid-cols-3 gap-2">
                {(['for', 'against', 'neutral'] as const).map((d) => {
                  const cfg = DIRECTION_CONFIG[d]
                  return (
                    <button
                      key={d}
                      type="button"
                      onClick={() => setDirection(d)}
                      className={cn(
                        'py-2 rounded-lg text-xs font-mono font-bold border transition-all',
                        direction === d
                          ? `${cfg.color} ${cfg.bg} ${cfg.border}`
                          : 'text-surface-500 border-surface-300/60 hover:border-surface-400/60'
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
                <label className="text-xs font-mono text-surface-500">Thesis title</label>
                <span className={cn('text-xs font-mono', titleLen > 100 ? 'text-against-400' : 'text-surface-600')}>
                  {titleLen}/120
                </span>
              </div>
              <input
                type="text"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                placeholder="e.g. 'Consensus building faster than market prices'"
                maxLength={120}
                className="w-full bg-surface-200 border border-surface-300/60 rounded-lg px-3 py-2 text-sm text-white placeholder:text-surface-600 focus:outline-none focus:border-for-500/50"
              />
            </div>

            {/* Body */}
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-xs font-mono text-surface-500">Reasoning</label>
                <span className={cn('text-xs font-mono', bodyLen > 450 ? 'text-against-400' : 'text-surface-600')}>
                  {bodyLen}/500
                </span>
              </div>
              <textarea
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Explain your thesis, key evidence, and what you think will happen..."
                maxLength={500}
                rows={4}
                className="w-full bg-surface-200 border border-surface-300/60 rounded-lg px-3 py-2 text-sm text-white placeholder:text-surface-600 focus:outline-none focus:border-for-500/50 resize-none"
              />
            </div>

            {/* Market + Target + Confidence row */}
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-mono text-surface-500 mb-1.5">Target price (¢)</label>
                <input
                  type="number"
                  value={targetPrice}
                  onChange={(e) => setTargetPrice(e.target.value)}
                  placeholder="e.g. 75"
                  min={1}
                  max={99}
                  className="w-full bg-surface-200 border border-surface-300/60 rounded-lg px-3 py-2 text-sm text-white placeholder:text-surface-600 focus:outline-none focus:border-for-500/50"
                />
              </div>
              <div>
                <label className="block text-xs font-mono text-surface-500 mb-1.5">
                  Confidence: <span className={CONFIDENCE_COLORS[confidence]}>{CONFIDENCE_LABELS[confidence]}</span>
                </label>
                <input
                  type="range"
                  min={1}
                  max={5}
                  value={confidence}
                  onChange={(e) => setConfidence(parseInt(e.target.value, 10))}
                  className="w-full mt-1 accent-for-500 cursor-pointer"
                />
              </div>
            </div>

            {/* Topic search */}
            <div>
              <label className="block text-xs font-mono text-surface-500 mb-1.5">Link a market (optional)</label>
              {topicId ? (
                <div className="flex items-center gap-2 p-2 bg-surface-200 border border-for-500/30 rounded-lg">
                  <BarChart2 className="h-3.5 w-3.5 text-for-400 flex-shrink-0" />
                  <span className="text-xs text-white flex-1 truncate">{topicLabel}</span>
                  <button type="button" onClick={() => { setTopicId(null); setTopicLabel(null); setTopicQuery('') }}>
                    <X className="h-3.5 w-3.5 text-surface-500 hover:text-white" />
                  </button>
                </div>
              ) : (
                <div className="relative">
                  <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-500" />
                  <input
                    type="text"
                    value={topicQuery}
                    onChange={(e) => setTopicQuery(e.target.value)}
                    placeholder="Search topics..."
                    className="w-full bg-surface-200 border border-surface-300/60 rounded-lg pl-8 pr-3 py-2 text-sm text-white placeholder:text-surface-600 focus:outline-none focus:border-for-500/50"
                  />
                  {loadingTopic && (
                    <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-500 animate-spin" />
                  )}
                  {topicResults.length > 0 && (
                    <div className="absolute z-10 w-full mt-1 bg-surface-200 border border-surface-300/60 rounded-lg shadow-xl overflow-hidden">
                      {topicResults.map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => {
                            setTopicId(t.id)
                            setTopicLabel(t.statement)
                            setTopicResults([])
                            setTopicQuery('')
                          }}
                          className="w-full flex items-center gap-2 px-3 py-2 hover:bg-surface-300/40 text-left transition-colors"
                        >
                          <span className="text-xs text-white truncate flex-1">{t.statement}</span>
                          {t.blue_pct !== null && (
                            <span className={cn('text-xs font-mono flex-shrink-0', priceColor(Math.round(t.blue_pct)))}>
                              {Math.round(t.blue_pct)}¢
                            </span>
                          )}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            {error && <p className="text-xs text-against-400 font-mono">{error}</p>}

            <div className="flex items-center gap-3 pt-1">
              <Button
                type="submit"
                disabled={!valid || submitting}
                variant="for"
                size="sm"
                className="flex-1"
              >
                {submitting ? (
                  <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Posting…</>
                ) : (
                  <><PenLine className="h-3.5 w-3.5" /> Post Idea</>
                )}
              </Button>
              <Button type="button" variant="ghost" size="sm" onClick={onClose}>
                Cancel
              </Button>
            </div>
          </form>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  )
}

// ─── Main Client ───────────────────────────────────────────────────────────────

export function IdeasClient() {
  const [ideas,         setIdeas]         = useState<MarketIdea[]>([])
  const [total,         setTotal]         = useState(0)
  const [hasMore,       setHasMore]       = useState(false)
  const [loading,       setLoading]       = useState(true)
  const [loadingMore,   setLoadingMore]   = useState(false)
  const [error,         setError]         = useState<string | null>(null)
  const [sort,          setSort]          = useState<SortMode>('top')
  const [direction,     setDirection]     = useState<DirectionFilter>(null)
  const [composing,     setComposing]     = useState(false)
  const offsetRef = useRef(0)

  const fetchIdeas = useCallback(async (
    sortMode: SortMode,
    dir: DirectionFilter,
    offset: number,
    append = false
  ) => {
    if (offset === 0) setLoading(true); else setLoadingMore(true)
    setError(null)
    try {
      const params = new URLSearchParams({ sort: sortMode, limit: '20', offset: String(offset) })
      if (dir) params.set('direction', dir)
      const res = await fetch(`/api/exchange/ideas?${params}`)
      if (!res.ok) throw new Error('Failed to load ideas')
      const data: IdeasResponse = await res.json()
      setIdeas((prev) => append ? [...prev, ...data.ideas] : data.ideas)
      setTotal(data.total)
      setHasMore(data.has_more)
      offsetRef.current = offset + data.ideas.length
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load ideas')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [])

  useEffect(() => {
    offsetRef.current = 0
    fetchIdeas(sort, direction, 0)
  }, [sort, direction, fetchIdeas])

  function handleVote(id: string, newDir: 'up' | 'down' | null) {
    setIdeas((prev) =>
      prev.map((idea) => idea.id === id ? { ...idea, viewer_vote: newDir } : idea)
    )
  }

  function handleNewIdea(idea: MarketIdea) {
    setIdeas((prev) => [idea, ...prev])
    setTotal((t) => t + 1)
    setComposing(false)
  }

  return (
    <>
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
          {/* Page header */}
          <div className="flex items-start justify-between gap-4 mb-6">
            <div className="flex items-center gap-3">
              <Link href="/exchange" className="text-surface-500 hover:text-white transition-colors">
                <ArrowLeft className="h-5 w-5" />
              </Link>
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/30 flex-shrink-0">
                <Lightbulb className="h-5 w-5 text-gold" />
              </div>
              <div>
                <h1 className="font-mono text-2xl font-bold text-white">Market Ideas</h1>
                <p className="text-sm font-mono text-surface-500 mt-0.5">
                  Community prediction theses
                  {total > 0 && <> · <span className="text-surface-400">{total.toLocaleString()} ideas</span></>}
                </p>
              </div>
            </div>
            <Button
              variant="for"
              size="sm"
              onClick={() => setComposing(true)}
              className="flex-shrink-0 flex items-center gap-1.5"
            >
              <PenLine className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">New Idea</span>
            </Button>
          </div>

          {/* Filters row */}
          <div className="flex items-center gap-3 mb-5 flex-wrap">
            {/* Sort */}
            <div className="flex items-center gap-1 p-1 bg-surface-100 border border-surface-300/60 rounded-lg">
              {SORT_TABS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setSort(id)}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-all',
                    sort === id
                      ? 'bg-surface-300/80 text-white'
                      : 'text-surface-500 hover:text-surface-300'
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {label}
                </button>
              ))}
            </div>

            {/* Direction filter */}
            <div className="flex items-center gap-1 p-1 bg-surface-100 border border-surface-300/60 rounded-lg">
              {DIRECTION_FILTERS.map(({ id, label }) => (
                <button
                  key={String(id)}
                  onClick={() => setDirection(id as DirectionFilter)}
                  className={cn(
                    'px-3 py-1.5 rounded-md text-xs font-mono font-medium transition-all',
                    direction === id
                      ? id === 'for'
                        ? 'bg-for-500/20 text-for-400 border border-for-500/30'
                        : id === 'against'
                          ? 'bg-against-500/20 text-against-400 border border-against-500/30'
                          : 'bg-surface-300/80 text-white'
                      : 'text-surface-500 hover:text-surface-300'
                  )}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Ideas list */}
          {loading ? (
            <div className="space-y-4">
              {Array.from({ length: 5 }).map((_, i) => (
                <Skeleton key={i} className="h-40 rounded-xl" />
              ))}
            </div>
          ) : error ? (
            <div className="text-center py-16">
              <p className="text-against-400 text-sm font-mono mb-4">{error}</p>
              <Button variant="ghost" size="sm" onClick={() => fetchIdeas(sort, direction, 0)}>
                <RefreshCw className="h-4 w-4 mr-2" /> Retry
              </Button>
            </div>
          ) : ideas.length === 0 ? (
            <EmptyState
              icon={Lightbulb}
              title="No ideas yet"
              description={direction
                ? `No ${direction} ideas found. Be the first to share a prediction thesis.`
                : 'No market ideas yet. Share your prediction thesis to get the conversation started.'}
              action={{
                label: 'Post the first idea',
                onClick: () => setComposing(true),
              }}
            />
          ) : (
            <div className="space-y-4">
              <AnimatePresence mode="popLayout">
                {ideas.map((idea) => (
                  <IdeaCard key={idea.id} idea={idea} onVote={handleVote} />
                ))}
              </AnimatePresence>

              {hasMore && (
                <div className="pt-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={loadingMore}
                    onClick={() => fetchIdeas(sort, direction, offsetRef.current, true)}
                    className="w-full"
                  >
                    {loadingMore ? (
                      <><Loader2 className="h-4 w-4 animate-spin mr-2" /> Loading…</>
                    ) : (
                      'Load more ideas'
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}
        </main>
        <BottomNav />
      </div>

      {composing && (
        <ComposeModal onClose={() => setComposing(false)} onSubmit={handleNewIdea} />
      )}
    </>
  )
}
