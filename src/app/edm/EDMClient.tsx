'use client'

/**
 * /edm — Early Day Motions
 *
 * A parliamentary notice board where citizens file formal short statements
 * (EDMs) on any civic matter. Others can "second" an EDM to show support.
 * EDMs that gather enough seconds are elevated to the Order Paper.
 *
 * Westminster EDMs are purely expressive — they don't create votes or laws
 * directly, but they build civic record and signal community priorities.
 */

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  AlertCircle,
  ArrowLeft,
  BookOpen,
  Check,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Cpu,
  ExternalLink,
  FileText,
  Filter,
  FlaskConical,
  GraduationCap,
  Globe,
  Heart,
  Landmark,
  Leaf,
  Loader2,
  Music2,
  PenLine,
  RefreshCw,
  Scale,
  ScrollText,
  Star,
  ThumbsUp,
  TrendingUp,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Button } from '@/components/ui/Button'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'
import type { EDM, EDMListResponse } from '@/app/api/edm/route'

// ── Constants ──────────────────────────────────────────────────────────────────

const GROUNDS_CONFIG: Record<string, { label: string; icon: typeof Star; color: string; bg: string; description: string }> = {
  commendation: {
    label: 'Commendation',
    icon: Star,
    color: 'text-gold',
    bg: 'bg-gold/10 border-gold/20',
    description: 'Formally praising a citizen, coalition, or civic achievement',
  },
  concern: {
    label: 'Concern',
    icon: AlertCircle,
    color: 'text-against-400',
    bg: 'bg-against-500/10 border-against-500/20',
    description: 'Raising formal concern about an issue or proposed law',
  },
  opposition: {
    label: 'Opposition',
    icon: Scale,
    color: 'text-against-500',
    bg: 'bg-against-600/10 border-against-600/20',
    description: 'Formally opposing a policy, law, or civic action',
  },
  call_to_action: {
    label: 'Call to Action',
    icon: Zap,
    color: 'text-for-400',
    bg: 'bg-for-500/10 border-for-500/20',
    description: 'Urging the civic community to act on an issue',
  },
  information: {
    label: 'Information',
    icon: FileText,
    color: 'text-surface-500',
    bg: 'bg-surface-300/20 border-surface-400/20',
    description: 'Informing the chamber of a civic matter',
  },
}

const CATEGORIES = [
  'Politics', 'Economics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health',
  'Education', 'Environment', 'Other',
]

const CATEGORY_ICONS: Record<string, typeof Globe> = {
  Politics: Landmark,
  Economics: TrendingUp,
  Technology: Cpu,
  Science: FlaskConical,
  Ethics: Scale,
  Philosophy: BookOpen,
  Culture: Music2,
  Health: Heart,
  Education: GraduationCap,
  Environment: Leaf,
  Other: Globe,
}

function formatRelativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d === 1) return 'yesterday'
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' })
}

function formatExpiresAt(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  const d = Math.ceil(diff / 86_400_000)
  if (d <= 0) return 'expired'
  if (d === 1) return '1 day left'
  return `${d} days left`
}

// ── EDM Card ───────────────────────────────────────────────────────────────────

interface EDMCardProps {
  edm: EDM
  onSecond: (id: string, currentlySeconded: boolean) => Promise<void>
  isAuthenticated: boolean
}

function EDMCard({ edm, onSecond, isAuthenticated }: EDMCardProps) {
  const [seconded, setSeconded] = useState(edm.user_seconded ?? false)
  const [secondCount, setSecondCount] = useState(edm.second_count)
  const [loading, setLoading] = useState(false)
  const [expanded, setExpanded] = useState(false)
  const grounds = GROUNDS_CONFIG[edm.grounds] ?? GROUNDS_CONFIG.information
  const GroundsIcon = grounds.icon
  const CategoryIcon = CATEGORY_ICONS[edm.category] ?? Globe

  const bodyIsLong = edm.body.length > 200

  async function handleSecond() {
    if (!isAuthenticated || loading) return
    setLoading(true)
    const wasSeconded = seconded
    setSeconded(!wasSeconded)
    setSecondCount((c) => wasSeconded ? c - 1 : c + 1)
    try {
      await onSecond(edm.id, wasSeconded)
    } catch {
      // Revert on error
      setSeconded(wasSeconded)
      setSecondCount((c) => wasSeconded ? c + 1 : c - 1)
    } finally {
      setLoading(false)
    }
  }

  return (
    <motion.article
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden"
    >
      {/* Grounds strip */}
      <div className={cn('flex items-center gap-2 px-5 py-2.5 border-b border-surface-300/60', grounds.bg)}>
        <GroundsIcon className={cn('h-3.5 w-3.5 flex-shrink-0', grounds.color)} />
        <span className={cn('text-xs font-semibold uppercase tracking-wider', grounds.color)}>
          {grounds.label}
        </span>
        <span className="text-surface-600 text-xs">·</span>
        <span className="text-surface-500 text-xs">{grounds.description}</span>
      </div>

      <div className="p-5 space-y-3">
        {/* Title */}
        <h3 className="font-semibold text-white leading-snug">{edm.title}</h3>

        {/* Body */}
        <div className="text-sm text-surface-500 leading-relaxed">
          {bodyIsLong && !expanded ? (
            <>
              {edm.body.slice(0, 200)}…{' '}
              <button
                onClick={() => setExpanded(true)}
                className="text-for-400 hover:text-for-300 text-xs font-medium"
              >
                read more
              </button>
            </>
          ) : (
            <>
              {edm.body}
              {bodyIsLong && expanded && (
                <button
                  onClick={() => setExpanded(false)}
                  className="ml-1 text-surface-600 hover:text-surface-500 text-xs"
                >
                  show less
                </button>
              )}
            </>
          )}
        </div>

        {/* Meta row */}
        <div className="flex items-center gap-2 flex-wrap">
          <Badge variant="category" size="sm" className="flex items-center gap-1">
            <CategoryIcon className="h-3 w-3" />
            {edm.category}
          </Badge>
          <span className="text-surface-600 text-xs">{formatExpiresAt(edm.expires_at)}</span>
          {edm.topic_id && (
            <Link
              href={`/topic/${edm.topic_id}`}
              className="flex items-center gap-1 text-xs text-for-400 hover:text-for-300"
            >
              <ExternalLink className="h-3 w-3" />
              view topic
            </Link>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between pt-1">
          {/* Author */}
          <div className="flex items-center gap-2">
            {edm.author ? (
              <>
                <Avatar
                  src={edm.author.avatar_url}
                  username={edm.author.username}
                  size="xs"
                />
                <Link
                  href={`/profile/${edm.author.username}`}
                  className="text-xs text-surface-500 hover:text-white transition-colors"
                >
                  {edm.author.display_name ?? edm.author.username}
                </Link>
              </>
            ) : (
              <span className="text-xs text-surface-600">Anonymous</span>
            )}
            <span className="text-surface-700 text-xs">·</span>
            <span className="text-xs text-surface-600">{formatRelativeTime(edm.created_at)}</span>
          </div>

          {/* Second button */}
          <button
            onClick={handleSecond}
            disabled={!isAuthenticated || loading}
            className={cn(
              'flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-medium transition-all',
              seconded
                ? 'bg-for-600/20 text-for-400 border border-for-500/30 hover:bg-for-600/30'
                : 'bg-surface-200 text-surface-500 border border-surface-400/30 hover:bg-surface-300 hover:text-white',
              (!isAuthenticated || loading) && 'opacity-50 cursor-not-allowed',
            )}
            title={!isAuthenticated ? 'Sign in to second this motion' : undefined}
          >
            {loading ? (
              <Loader2 className="h-3 w-3 animate-spin" />
            ) : seconded ? (
              <Check className="h-3 w-3" />
            ) : (
              <ThumbsUp className="h-3 w-3" />
            )}
            <span>{secondCount} {secondCount === 1 ? 'second' : 'seconds'}</span>
          </button>
        </div>
      </div>
    </motion.article>
  )
}

// ── File EDM Form ──────────────────────────────────────────────────────────────

interface FilingFormProps {
  onSuccess: (edm: EDM) => void
  onClose: () => void
}

function FilingForm({ onSuccess, onClose }: FilingFormProps) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [category, setCategory] = useState('Politics')
  const [grounds, setGrounds] = useState('concern')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const titleChars = title.length
  const bodyChars = body.length

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (submitting) return
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch('/api/edm', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, body, category, grounds }),
      })
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Failed to file EDM')
        return
      }
      onSuccess(json.edm)
    } catch {
      setError('Network error — please try again')
    } finally {
      setSubmitting(false)
    }
  }


  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 12 }}
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-4 bg-black/60 backdrop-blur-sm"
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
    >
      <div className="w-full max-w-xl bg-surface-100 border border-surface-300 rounded-3xl p-6 space-y-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <ScrollText className="h-5 w-5 text-for-400" />
            <h2 className="font-semibold text-white">File an Early Day Motion</h2>
          </div>
          <button
            onClick={onClose}
            className="h-8 w-8 flex items-center justify-center rounded-lg text-surface-500 hover:bg-surface-200 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <p className="text-sm text-surface-500">
          An EDM is a formal parliamentary notice — a short written statement on any civic matter.
          Other citizens can second it to build support.
        </p>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* Grounds */}
          <div>
            <label className="text-xs font-medium text-surface-400 mb-2 block">Type of Motion</label>
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
              {Object.entries(GROUNDS_CONFIG).map(([key, cfg]) => {
                const Icon = cfg.icon
                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => setGrounds(key)}
                    className={cn(
                      'flex items-center gap-2 p-2.5 rounded-xl border text-xs font-medium transition-all text-left',
                      grounds === key
                        ? cn('border', cfg.bg, cfg.color)
                        : 'border-surface-300 bg-surface-200 text-surface-500 hover:bg-surface-300',
                    )}
                  >
                    <Icon className={cn('h-3.5 w-3.5 flex-shrink-0', grounds === key ? cfg.color : '')} />
                    {cfg.label}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Category */}
          <div>
            <label className="text-xs font-medium text-surface-400 mb-2 block">Category</label>
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-1.5">
              {CATEGORIES.map((cat) => {
                const Icon = CATEGORY_ICONS[cat] ?? Globe
                return (
                  <button
                    key={cat}
                    type="button"
                    onClick={() => setCategory(cat)}
                    className={cn(
                      'flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border text-xs transition-all',
                      category === cat
                        ? 'border-for-500/50 bg-for-600/10 text-for-400'
                        : 'border-surface-300 bg-surface-200 text-surface-500 hover:bg-surface-300',
                    )}
                  >
                    <Icon className="h-3 w-3 flex-shrink-0" />
                    {cat}
                  </button>
                )
              })}
            </div>
          </div>

          {/* Title */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-surface-400">Motion Title</label>
              <span className={cn('text-xs', titleChars > 110 ? 'text-against-400' : 'text-surface-600')}>
                {titleChars}/120
              </span>
            </div>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              maxLength={120}
              placeholder="A short, formal title for this motion…"
              className="w-full bg-surface-200 border border-surface-300 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-surface-600 focus:outline-none focus:border-for-500/60 transition-colors"
              required
            />
          </div>

          {/* Body */}
          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label className="text-xs font-medium text-surface-400">Motion Body</label>
              <span className={cn('text-xs', bodyChars > 950 ? 'text-against-400' : 'text-surface-600')}>
                {bodyChars}/1000
              </span>
            </div>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              maxLength={1000}
              rows={4}
              placeholder={`This chamber formally ${grounds === 'commendation' ? 'commends' : grounds === 'concern' ? 'expresses concern about' : grounds === 'opposition' ? 'opposes' : grounds === 'call_to_action' ? 'calls upon' : 'notes'}…`}
              className="w-full bg-surface-200 border border-surface-300 rounded-xl px-3 py-2.5 text-sm text-white placeholder:text-surface-600 focus:outline-none focus:border-for-500/60 transition-colors resize-none"
              required
            />
          </div>

          {error && (
            <div className="flex items-center gap-2 text-against-400 text-sm bg-against-500/10 rounded-xl p-3">
              <AlertCircle className="h-4 w-4 flex-shrink-0" />
              {error}
            </div>
          )}

          <div className="flex items-center gap-3 pt-1">
            <Button
              type="button"
              variant="ghost"
              size="md"
              onClick={onClose}
              className="flex-1"
            >
              Cancel
            </Button>
            <Button
              type="submit"
              variant="for"
              size="md"
              disabled={submitting || titleChars < 10 || bodyChars < 30}
              className="flex-1"
            >
              {submitting ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <>
                  <PenLine className="h-4 w-4" />
                  Table Motion
                </>
              )}
            </Button>
          </div>
        </form>
      </div>
    </motion.div>
  )
}

// ── Main Page ──────────────────────────────────────────────────────────────────

type SortOption = 'recent' | 'popular'
type GroundsFilter = 'all' | string

export function EDMClient() {
  const [edms, setEdms] = useState<EDM[]>([])
  const [total, setTotal] = useState(0)
  const [loading, setLoading] = useState(true)
  const [loadingMore, setLoadingMore] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [sort, setSort] = useState<SortOption>('recent')
  const [groundsFilter, setGroundsFilter] = useState<GroundsFilter>('all')
  const [categoryFilter, setCategoryFilter] = useState<string>('all')
  const [showForm, setShowForm] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [showFilters, setShowFilters] = useState(false)
  const abortRef = useRef<AbortController | null>(null)

  // Check auth
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data }) => {
      setIsAuthenticated(!!data.user)
    })
  }, [])

  const load = useCallback(async (offset = 0) => {
    if (abortRef.current) abortRef.current.abort()
    abortRef.current = new AbortController()

    if (offset === 0) setLoading(true)
    else setLoadingMore(true)
    setError(null)

    try {
      const params = new URLSearchParams({
        sort,
        status: 'open',
        limit: '20',
        offset: String(offset),
      })
      if (groundsFilter !== 'all') params.set('grounds', groundsFilter)
      if (categoryFilter !== 'all') params.set('category', categoryFilter)

      const res = await fetch(`/api/edm?${params}`, {
        signal: abortRef.current.signal,
      })
      if (!res.ok) throw new Error('Failed to load motions')
      const json: EDMListResponse = await res.json()

      if (offset === 0) {
        setEdms(json.edms)
      } else {
        setEdms((prev) => [...prev, ...json.edms])
      }
      setTotal(json.total)
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return
      setError('Could not load motions')
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [sort, groundsFilter, categoryFilter])

  useEffect(() => {
    load(0)
  }, [load])

  async function handleSecond(id: string, currentlySeconded: boolean) {
    const method = currentlySeconded ? 'DELETE' : 'POST'
    const res = await fetch(`/api/edm/${id}/second`, { method })
    if (!res.ok) throw new Error('Failed')
  }

  function handleNewEDM(edm: EDM) {
    setEdms((prev) => [edm, ...prev])
    setTotal((t) => t + 1)
    setShowForm(false)
  }

  const hasMore = edms.length < total

  return (
    <>
      <div className="min-h-screen bg-surface-50">
        <TopBar />

        <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
          {/* Header */}
          <div className="mb-6">
            <div className="flex items-center gap-3 mb-1">
              <Link
                href="/parliament"
                className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
                aria-label="Back to Parliament"
              >
                <ArrowLeft className="h-4 w-4" />
              </Link>
              <div className="flex items-center gap-2">
                <ScrollText className="h-5 w-5 text-for-400" />
                <h1 className="text-xl font-bold text-white tracking-tight">
                  Early Day Motions
                </h1>
              </div>
            </div>
            <p className="text-sm text-surface-500 ml-11">
              Formal notices tabled by citizens — concern, commendation, opposition, or calls to action.
              Second a motion to show support. {total > 0 && <span className="text-surface-400">{total} active</span>}
            </p>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2 mb-4">
            {/* Sort tabs */}
            <div className="flex rounded-xl bg-surface-200 border border-surface-300 p-0.5 flex-1">
              {(['recent', 'popular'] as SortOption[]).map((s) => (
                <button
                  key={s}
                  onClick={() => setSort(s)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 h-7 rounded-lg text-xs font-medium transition-all',
                    sort === s
                      ? 'bg-surface-100 text-white shadow-sm'
                      : 'text-surface-500 hover:text-white',
                  )}
                >
                  {s === 'popular' ? <ThumbsUp className="h-3 w-3" /> : <ClipboardList className="h-3 w-3" />}
                  {s.charAt(0).toUpperCase() + s.slice(1)}
                </button>
              ))}
            </div>

            {/* Filters toggle */}
            <button
              onClick={() => setShowFilters(!showFilters)}
              className={cn(
                'flex items-center gap-1.5 h-9 px-3 rounded-xl border text-xs font-medium transition-all',
                showFilters || groundsFilter !== 'all' || categoryFilter !== 'all'
                  ? 'border-for-500/40 bg-for-600/10 text-for-400'
                  : 'border-surface-300 bg-surface-200 text-surface-500 hover:text-white',
              )}
            >
              <Filter className="h-3.5 w-3.5" />
              Filter
              {showFilters ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
            </button>

            {/* File EDM */}
            <Button
              onClick={() => {
                if (!isAuthenticated) return
                setShowForm(true)
              }}
              variant={isAuthenticated ? 'for' : 'secondary'}
              size="sm"
              title={!isAuthenticated ? 'Sign in to table a motion' : undefined}
            >
              <PenLine className="h-3.5 w-3.5" />
              Table
            </Button>
          </div>

          {/* Filter panel */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="overflow-hidden mb-4"
              >
                <div className="bg-surface-100 border border-surface-300 rounded-2xl p-4 space-y-3">
                  {/* Grounds filter */}
                  <div>
                    <p className="text-xs font-medium text-surface-400 mb-2">Type</p>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() => setGroundsFilter('all')}
                        className={cn(
                          'px-2.5 py-1 rounded-lg text-xs font-medium border transition-all',
                          groundsFilter === 'all'
                            ? 'border-for-500/40 bg-for-600/10 text-for-400'
                            : 'border-surface-300 bg-surface-200 text-surface-500 hover:text-white',
                        )}
                      >
                        All
                      </button>
                      {Object.entries(GROUNDS_CONFIG).map(([key, cfg]) => {
                        const Icon = cfg.icon
                        return (
                          <button
                            key={key}
                            onClick={() => setGroundsFilter(key)}
                            className={cn(
                              'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all',
                              groundsFilter === key
                                ? cn('border', cfg.bg, cfg.color)
                                : 'border-surface-300 bg-surface-200 text-surface-500 hover:text-white',
                            )}
                          >
                            <Icon className="h-3 w-3" />
                            {cfg.label}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {/* Category filter */}
                  <div>
                    <p className="text-xs font-medium text-surface-400 mb-2">Category</p>
                    <div className="flex flex-wrap gap-1.5">
                      <button
                        onClick={() => setCategoryFilter('all')}
                        className={cn(
                          'px-2.5 py-1 rounded-lg text-xs font-medium border transition-all',
                          categoryFilter === 'all'
                            ? 'border-for-500/40 bg-for-600/10 text-for-400'
                            : 'border-surface-300 bg-surface-200 text-surface-500 hover:text-white',
                        )}
                      >
                        All
                      </button>
                      {CATEGORIES.map((cat) => {
                        const Icon = CATEGORY_ICONS[cat] ?? Globe
                        return (
                          <button
                            key={cat}
                            onClick={() => setCategoryFilter(cat)}
                            className={cn(
                              'flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-medium border transition-all',
                              categoryFilter === cat
                                ? 'border-for-500/40 bg-for-600/10 text-for-400'
                                : 'border-surface-300 bg-surface-200 text-surface-500 hover:text-white',
                            )}
                          >
                            <Icon className="h-3 w-3" />
                            {cat}
                          </button>
                        )
                      })}
                    </div>
                  </div>

                  {(groundsFilter !== 'all' || categoryFilter !== 'all') && (
                    <button
                      onClick={() => { setGroundsFilter('all'); setCategoryFilter('all') }}
                      className="text-xs text-surface-500 hover:text-white flex items-center gap-1"
                    >
                      <X className="h-3 w-3" />
                      Clear filters
                    </button>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Content */}
          {loading ? (
            <div className="space-y-3">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
                  <div className="h-9 bg-surface-200/60 border-b border-surface-300/60 px-5 flex items-center gap-2">
                    <Skeleton className="h-3.5 w-3.5 rounded" />
                    <Skeleton className="h-3 w-24" />
                  </div>
                  <div className="p-5 space-y-3">
                    <Skeleton className="h-5 w-full" />
                    <Skeleton className="h-5 w-4/5" />
                    <div className="space-y-1.5">
                      <Skeleton className="h-4 w-full" />
                      <Skeleton className="h-4 w-5/6" />
                      <Skeleton className="h-4 w-3/4" />
                    </div>
                    <div className="flex items-center justify-between pt-1">
                      <div className="flex items-center gap-2">
                        <Skeleton className="h-6 w-6 rounded-full" />
                        <Skeleton className="h-3 w-20" />
                      </div>
                      <Skeleton className="h-8 w-28 rounded-lg" />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : error ? (
            <div className="rounded-2xl bg-against-500/10 border border-against-500/20 p-6 text-center">
              <AlertCircle className="h-8 w-8 text-against-400 mx-auto mb-2" />
              <p className="text-sm text-against-400">{error}</p>
              <button
                onClick={() => load(0)}
                className="mt-3 text-xs text-surface-500 hover:text-white flex items-center gap-1 mx-auto"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                Retry
              </button>
            </div>
          ) : edms.length === 0 ? (
            <EmptyState
              icon={ScrollText}
              iconColor="text-for-400"
              iconBg="bg-for-500/10"
              iconBorder="border-for-500/20"
              title="No motions tabled"
              description={
                groundsFilter !== 'all' || categoryFilter !== 'all'
                  ? 'No motions match the current filters. Try removing a filter.'
                  : 'Be the first to table a formal motion on any civic matter.'
              }
              action={isAuthenticated ? {
                label: 'Table a Motion',
                onClick: () => setShowForm(true),
              } : undefined}
            />
          ) : (
            <div className="space-y-3">
              <AnimatePresence mode="popLayout">
                {edms.map((edm) => (
                  <EDMCard
                    key={edm.id}
                    edm={edm}
                    onSecond={handleSecond}
                    isAuthenticated={isAuthenticated}
                  />
                ))}
              </AnimatePresence>

              {hasMore && (
                <div className="pt-2 text-center">
                  <Button
                    onClick={() => load(edms.length)}
                    variant="secondary"
                    size="md"
                    disabled={loadingMore}
                  >
                    {loadingMore ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      'Load more'
                    )}
                  </Button>
                </div>
              )}
            </div>
          )}

          {/* Info callout */}
          <div className="mt-8 rounded-2xl bg-surface-100 border border-surface-300 p-5">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-for-500/10 flex items-center justify-center">
                <BookOpen className="h-4 w-4 text-for-400" />
              </div>
              <div>
                <h4 className="text-sm font-semibold text-white mb-1">What are Early Day Motions?</h4>
                <p className="text-xs text-surface-500 leading-relaxed">
                  EDMs are formal parliamentary notices. They don&apos;t create laws or force votes — but they
                  build civic record and signal community priorities. EDMs with enough seconds may be elevated
                  to the Order Paper for formal debate. Table a motion on any civic matter: concerns,
                  commendations, calls to action, or simply informing the chamber.
                </p>
                <div className="flex items-center gap-3 mt-3">
                  <Link href="/order-paper" className="text-xs text-for-400 hover:text-for-300 flex items-center gap-1">
                    <ExternalLink className="h-3 w-3" />
                    Order Paper
                  </Link>
                  <Link href="/parliament" className="text-xs text-for-400 hover:text-for-300 flex items-center gap-1">
                    <Landmark className="h-3 w-3" />
                    Parliament
                  </Link>
                </div>
              </div>
            </div>
          </div>
        </main>

        <BottomNav />
      </div>

      <AnimatePresence>
        {showForm && (
          <FilingForm
            onSuccess={handleNewEDM}
            onClose={() => setShowForm(false)}
          />
        )}
      </AnimatePresence>
    </>
  )
}
