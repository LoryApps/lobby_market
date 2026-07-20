'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Activity,
  ArrowLeft,
  ArrowRight,
  BarChart2,
  Bell,
  Brain,
  ChevronDown,
  Clock,
  ExternalLink,
  FileSearch,
  FileText,
  Flame,
  Gavel,
  Heart,
  Layers,
  Lightbulb,
  MessageSquare,
  Radio,
  RefreshCw,
  Scale,
  Send,
  Target,
  ThumbsDown,
  ThumbsUp,
  TrendingDown,
  TrendingUp,
  Shield,
  Swords,
  Trophy,
  Users,
  Vote,
  Wallet,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { WatchButton } from '@/components/ui/WatchButton'
import { AddToGroupButton } from '@/components/exchange/AddToGroupButton'
import { cn } from '@/lib/utils/cn'
import type { MarketDetail, PriceSnapshot, MarketArgument } from '@/app/api/exchange/[id]/route'
import type { MarketCommentary } from '@/app/api/exchange/commentary/route'

// ─── Types ────────────────────────────────────────────────────────────────────

type TimeRange = '7d' | '30d' | 'all'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatVolume(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'Ended'
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (d > 0) return `${d}d ${h % 24}h`
  if (h > 0) return `${h}h ${m % 60}m`
  return `${m}m`
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  return `${d}d ago`
}

function priceColor(price: number, status: string): string {
  if (status === 'law') return 'text-gold'
  if (status === 'failed') return 'text-against-400'
  if (price >= 67) return 'text-gold'
  if (price >= 55) return 'text-for-400'
  if (price <= 33) return 'text-against-400'
  if (price <= 45) return 'text-against-300'
  return 'text-surface-400'
}

function changeColor(delta: number | null): string {
  if (delta === null) return 'text-surface-500'
  if (delta > 0) return 'text-emerald'
  if (delta < 0) return 'text-against-400'
  return 'text-surface-500'
}

function filterByRange(history: PriceSnapshot[], range: TimeRange): PriceSnapshot[] {
  if (range === 'all') return history
  const cutoff =
    range === '7d'
      ? Date.now() - 7 * 24 * 60 * 60 * 1000
      : Date.now() - 30 * 24 * 60 * 60 * 1000
  const filtered = history.filter((h) => new Date(h.recorded_at).getTime() >= cutoff)
  // Always include the first available point before the cutoff as the baseline
  if (filtered.length < history.length && filtered.length < history.length) {
    const before = [...history].reverse().find(
      (h) => new Date(h.recorded_at).getTime() < cutoff,
    )
    if (before) return [before, ...filtered]
  }
  return filtered.length > 0 ? filtered : history.slice(-10)
}

// ─── Interactive Price Chart ──────────────────────────────────────────────────

interface ChartPoint {
  x: number
  y: number
  price: number
  volume: number
  recorded_at: string
}

function PriceChart({
  ticks,
  status,
}: {
  ticks: PriceSnapshot[]
  status: string
}) {
  const [hovered, setHovered] = useState<ChartPoint | null>(null)

  const W = 600
  const H = 160
  const PAD_Y = 12
  const PAD_X = 0

  const points: ChartPoint[] = useMemo(() => {
    if (ticks.length === 0) return []
    const prices = ticks.map((t) => t.price)
    const min = Math.max(0, Math.min(...prices) - 5)
    const max = Math.min(100, Math.max(...prices) + 5)
    const range = max - min || 1
    return ticks.map((t, i) => ({
      x: PAD_X + (i / Math.max(ticks.length - 1, 1)) * (W - PAD_X * 2),
      y: PAD_Y + ((max - t.price) / range) * (H - PAD_Y * 2),
      price: t.price,
      volume: t.volume,
      recorded_at: t.recorded_at,
    }))
  }, [ticks])

  const polyline = points.map((p) => `${p.x},${p.y}`).join(' ')

  const areaPath = useMemo(() => {
    if (points.length === 0) return ''
    const last = points[points.length - 1]
    const first = points[0]
    return `M${first.x},${H} ${points.map((p) => `L${p.x},${p.y}`).join(' ')} L${last.x},${H} Z`
  }, [points, H])

  const first = ticks[0]?.price ?? 50
  const last = ticks[ticks.length - 1]?.price ?? 50
  const isUp = last >= first
  const strokeColor = isUp ? '#22c55e' : '#ef4444'
  const fillId = isUp ? 'areaGreen' : 'areaRed'

  // Volume bars (below chart, normalized)
  const maxVol = Math.max(...ticks.map((t) => t.volume), 1)
  const VOL_H = 24

  function handleMouseMove(e: React.MouseEvent<SVGSVGElement>) {
    const rect = e.currentTarget.getBoundingClientRect()
    const mx = ((e.clientX - rect.left) / rect.width) * W
    let closest: ChartPoint | null = null
    let minDist = Infinity
    for (const p of points) {
      const d = Math.abs(p.x - mx)
      if (d < minDist) {
        minDist = d
        closest = p
      }
    }
    setHovered(closest)
  }

  if (points.length < 2) {
    return (
      <div className="h-40 flex items-center justify-center text-surface-500 text-sm">
        Not enough data to display a chart yet
      </div>
    )
  }

  return (
    <div className="relative select-none">
      {/* Tooltip */}
      <AnimatePresence>
        {hovered && (
          <motion.div
            key="tooltip"
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0 }}
            className="absolute top-0 left-1/2 -translate-x-1/2 z-10 flex items-center gap-3 px-3 py-1.5 rounded-lg bg-surface-100 border border-surface-300/60 shadow-xl text-xs font-mono pointer-events-none"
          >
            <span className={cn('font-bold text-sm', priceColor(hovered.price, status))}>
              {Math.round(hovered.price)}¢
            </span>
            <span className="text-surface-500">
              Vol {formatVolume(hovered.volume)}
            </span>
            <span className="text-surface-500">
              {new Date(hovered.recorded_at).toLocaleDateString('en-US', {
                month: 'short',
                day: 'numeric',
                hour: '2-digit',
                minute: '2-digit',
              })}
            </span>
          </motion.div>
        )}
      </AnimatePresence>

      <svg
        viewBox={`0 0 ${W} ${H + VOL_H + 4}`}
        className="w-full"
        onMouseMove={handleMouseMove}
        onMouseLeave={() => setHovered(null)}
        style={{ touchAction: 'none' }}
        aria-label="Price history chart"
      >
        <defs>
          <linearGradient id="areaGreen" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#22c55e" stopOpacity="0.25" />
            <stop offset="100%" stopColor="#22c55e" stopOpacity="0" />
          </linearGradient>
          <linearGradient id="areaRed" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#ef4444" stopOpacity="0.2" />
            <stop offset="100%" stopColor="#ef4444" stopOpacity="0" />
          </linearGradient>
          {/* Horizontal gridlines */}
          {[25, 50, 75].map((pct) => {
            const prices = ticks.map((t) => t.price)
            const min = Math.max(0, Math.min(...prices) - 5)
            const max = Math.min(100, Math.max(...prices) + 5)
            const range = max - min || 1
            const yPos = PAD_Y + ((max - pct) / range) * (H - PAD_Y * 2)
            if (yPos < 0 || yPos > H) return null
            return (
              <g key={pct}>
                <line
                  x1={0}
                  y1={yPos}
                  x2={W}
                  y2={yPos}
                  stroke="#ffffff08"
                  strokeWidth="1"
                />
                <text x={4} y={yPos - 3} fill="#6b7280" fontSize="9" fontFamily="monospace">
                  {pct}¢
                </text>
              </g>
            )
          })}
        </defs>

        {/* Area fill */}
        <path d={areaPath} fill={`url(#${fillId})`} />

        {/* Price line */}
        <polyline
          points={polyline}
          fill="none"
          stroke={strokeColor}
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        />

        {/* Hover vertical line */}
        {hovered && (
          <line
            x1={hovered.x}
            y1={0}
            x2={hovered.x}
            y2={H}
            stroke="#ffffff30"
            strokeWidth="1"
            strokeDasharray="3 3"
          />
        )}

        {/* Hover dot */}
        {hovered && (
          <circle cx={hovered.x} cy={hovered.y} r={4} fill={strokeColor} stroke="#1a1a2e" strokeWidth="2" />
        )}

        {/* Volume bars */}
        {ticks.map((t, i) => {
          const x = PAD_X + (i / Math.max(ticks.length - 1, 1)) * (W - PAD_X * 2)
          const barH = (t.volume / maxVol) * VOL_H
          const barW = Math.max(2, (W / ticks.length) * 0.6)
          return (
            <rect
              key={i}
              x={x - barW / 2}
              y={H + 4 + (VOL_H - barH)}
              width={barW}
              height={barH}
              fill={strokeColor}
              opacity={hovered?.recorded_at === t.recorded_at ? 0.7 : 0.25}
              rx="1"
            />
          )
        })}
      </svg>
    </div>
  )
}

// ─── Argument Card ────────────────────────────────────────────────────────────

function ArgCard({ arg }: { arg: MarketArgument }) {
  const isFOR = arg.side === 'for'
  return (
    <div
      className={cn(
        'flex gap-2.5 p-3 rounded-xl border transition-colors',
        isFOR
          ? 'bg-for-500/5 border-for-500/15 hover:border-for-500/30'
          : 'bg-against-500/5 border-against-500/15 hover:border-against-500/30',
      )}
    >
      <div className="flex-shrink-0 mt-0.5">
        {isFOR ? (
          <ThumbsUp className="h-3.5 w-3.5 text-for-400" />
        ) : (
          <ThumbsDown className="h-3.5 w-3.5 text-against-400" />
        )}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs text-surface-100 leading-relaxed line-clamp-3">{arg.body}</p>
        <div className="flex items-center gap-2 mt-1.5">
          <Avatar
            src={arg.author_avatar_url}
            fallback={arg.author_display_name || arg.author_username}
            size="xs"
          />
          <span className="text-[11px] text-surface-500">
            {arg.author_display_name || arg.author_username}
          </span>
          <span className="ml-auto text-[11px] text-surface-600 font-mono">
            +{arg.upvote_count}
          </span>
        </div>
      </div>
    </div>
  )
}

// ─── Related Market Card ──────────────────────────────────────────────────────

function RelatedCard({
  market,
}: {
  market: MarketDetail['related'][number]
}) {
  return (
    <Link href={`/exchange/${market.id}`} className="group block">
      <div className="flex items-center gap-3 p-3 rounded-xl border border-surface-300/40 hover:border-surface-400/60 bg-surface-200/40 hover:bg-surface-200/70 transition-all">
        <div className="flex-1 min-w-0">
          <p className="text-xs text-surface-100 line-clamp-2 leading-snug group-hover:text-white transition-colors">
            {market.statement}
          </p>
        </div>
        <div className="flex-shrink-0 text-right">
          <p className={cn('text-sm font-mono font-bold', priceColor(market.price, market.status))}>
            {Math.round(market.price)}¢
          </p>
          <p className="text-[10px] text-surface-500 font-mono">
            {formatVolume(market.volume)}
          </p>
        </div>
      </div>
    </Link>
  )
}

// ─── Market Commentary ────────────────────────────────────────────────────────

const MAX_COMMENT_CHARS = 280
const DIRECTION_CFG = {
  for:     { label: 'For',     color: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30',     dot: 'bg-for-400' },
  against: { label: 'Against', color: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30', dot: 'bg-against-400' },
  neutral: { label: 'Neutral', color: 'text-surface-400', bg: 'bg-surface-300/20', border: 'border-surface-400/30', dot: 'bg-surface-500' },
} as const

function CommentaryNote({
  note,
  currentUserId,
  onLike,
}: {
  note: MarketCommentary
  currentUserId: string | null
  onLike: (id: string, liked: boolean) => void
}) {
  const [liked, setLiked] = useState(note.viewer_liked)
  const [likeCount, setLikeCount] = useState(note.likes)
  const [liking, setLiking] = useState(false)
  const dirCfg = note.direction ? DIRECTION_CFG[note.direction] : null

  async function handleLike() {
    if (!currentUserId || liking) return
    setLiking(true)
    const newLiked = !liked
    setLiked(newLiked)
    setLikeCount((c) => c + (newLiked ? 1 : -1))
    try {
      await fetch('/api/exchange/commentary/like', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ commentary_id: note.id }),
      })
      onLike(note.id, newLiked)
    } catch {
      setLiked(!newLiked)
      setLikeCount((c) => c + (newLiked ? -1 : 1))
    } finally {
      setLiking(false)
    }
  }

  const diff = Date.now() - new Date(note.created_at).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  const ts = m < 1 ? 'just now' : m < 60 ? `${m}m` : h < 24 ? `${h}h` : `${d}d`

  return (
    <div className="flex gap-2.5 py-3 border-b border-surface-300/30 last:border-0">
      <Avatar src={note.author.avatar_url} fallback={note.author.display_name || note.author.username} size="sm" />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 mb-0.5 flex-wrap">
          <span className="text-xs font-semibold text-white truncate">
            {note.author.display_name || note.author.username}
          </span>
          {dirCfg && (
            <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded-full border', dirCfg.color, dirCfg.bg, dirCfg.border)}>
              <span className={cn('inline-block w-1 h-1 rounded-full mr-0.5 align-middle', dirCfg.dot)} />
              {dirCfg.label}
            </span>
          )}
          <span className="ml-auto text-[10px] text-surface-600 font-mono flex-shrink-0">{ts}</span>
        </div>
        <p className="text-xs text-surface-200 leading-relaxed">{note.content}</p>
        <button
          onClick={handleLike}
          disabled={!currentUserId || liking}
          className={cn(
            'mt-1.5 flex items-center gap-1 text-[11px] transition-colors',
            liked ? 'text-against-400' : 'text-surface-600 hover:text-against-400',
            !currentUserId && 'opacity-40 cursor-not-allowed',
          )}
        >
          <Heart className={cn('h-3 w-3', liked && 'fill-current')} />
          {likeCount > 0 && <span>{likeCount}</span>}
        </button>
      </div>
    </div>
  )
}

function MarketCommentaryPanel({
  topicId,
  currentUserId,
}: {
  topicId: string
  currentUserId: string | null
}) {
  const [notes, setNotes] = useState<MarketCommentary[]>([])
  const [loading, setLoading] = useState(true)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [content, setContent] = useState('')
  const [direction, setDirection] = useState<'for' | 'against' | 'neutral' | null>(null)
  const [posting, setPosting] = useState(false)
  const [postError, setPostError] = useState<string | null>(null)
  const textareaRef = useRef<HTMLTextAreaElement>(null)

  const remaining = MAX_COMMENT_CHARS - content.length
  const canPost = content.trim().length > 0 && remaining >= 0 && !posting

  const load = useCallback(async (offset = 0, append = false) => {
    if (append) setLoadingMore(true)
    else setLoading(true)
    try {
      const res = await fetch(
        `/api/exchange/commentary?topic_id=${topicId}&sort=newest&limit=10&offset=${offset}`,
        { cache: 'no-store' },
      )
      if (!res.ok) return
      const data = await res.json()
      const newNotes: MarketCommentary[] = data.notes ?? []
      setNotes((prev) => append ? [...prev, ...newNotes] : newNotes)
      setHasMore(data.has_more ?? false)
    } finally {
      setLoading(false)
      setLoadingMore(false)
    }
  }, [topicId])

  useEffect(() => { load(0) }, [load])

  async function handlePost() {
    if (!canPost || !currentUserId) return
    setPosting(true)
    setPostError(null)
    try {
      const res = await fetch('/api/exchange/commentary', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content: content.trim(), direction, topic_id: topicId }),
      })
      if (!res.ok) {
        const d = await res.json()
        throw new Error(d.error ?? 'Failed to post')
      }
      const note = await res.json() as MarketCommentary
      setNotes((prev) => [note, ...prev])
      setContent('')
      setDirection(null)
      if (textareaRef.current) textareaRef.current.style.height = 'auto'
    } catch (err) {
      setPostError(err instanceof Error ? err.message : 'Something went wrong')
    } finally {
      setPosting(false)
    }
  }

  function handleLike(id: string, liked: boolean) {
    setNotes((prev) =>
      prev.map((n) =>
        n.id === id
          ? { ...n, viewer_liked: liked, likes: n.likes + (liked ? 1 : -1) }
          : n,
      ),
    )
  }

  return (
    <div className="space-y-3">
      <h2 className="text-xs font-semibold uppercase tracking-widest text-surface-500 flex items-center gap-2">
        <MessageSquare className="h-3.5 w-3.5" />
        Market Commentary
      </h2>

      {/* Compose box */}
      {currentUserId ? (
        <div className="rounded-xl bg-surface-200/50 border border-surface-300/60 p-3">
          <textarea
            ref={textareaRef}
            value={content}
            onChange={(e) => {
              setContent(e.target.value)
              const el = textareaRef.current
              if (el) { el.style.height = 'auto'; el.style.height = `${el.scrollHeight}px` }
            }}
            onKeyDown={(e) => { if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) handlePost() }}
            placeholder="Share your take on this market… (⌘+Enter to post)"
            rows={2}
            maxLength={MAX_COMMENT_CHARS + 1}
            className="w-full bg-transparent text-xs text-surface-100 placeholder:text-surface-600 resize-none outline-none leading-relaxed min-h-[48px]"
          />
          <div className="flex items-center gap-2 mt-2 pt-2 border-t border-surface-300/40 flex-wrap">
            <div className="flex gap-1 flex-shrink-0">
              {(['for', 'against', 'neutral'] as const).map((d) => {
                const cfg = DIRECTION_CFG[d]
                const active = direction === d
                return (
                  <button
                    key={d}
                    onClick={() => setDirection(active ? null : d)}
                    className={cn(
                      'text-[10px] font-mono px-2 py-0.5 rounded-full border transition-all',
                      active ? `${cfg.color} ${cfg.bg} ${cfg.border}` : 'text-surface-500 border-surface-400/30 hover:border-surface-400/60',
                    )}
                  >
                    {cfg.label}
                  </button>
                )
              })}
            </div>
            <span className={cn('text-[10px] font-mono ml-auto', remaining < 20 ? 'text-against-400' : 'text-surface-600')}>
              {remaining}
            </span>
            <button
              onClick={handlePost}
              disabled={!canPost}
              className={cn(
                'flex items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold transition-all',
                canPost
                  ? 'bg-for-600 hover:bg-for-500 text-white'
                  : 'bg-surface-300/40 text-surface-600 cursor-not-allowed',
              )}
            >
              <Send className="h-3 w-3" />
              Post
            </button>
          </div>
          {postError && <p className="text-[11px] text-against-400 mt-1.5">{postError}</p>}
        </div>
      ) : (
        <div className="rounded-xl bg-surface-200/50 border border-surface-300/60 p-3 text-center">
          <p className="text-xs text-surface-500">
            <Link href="/sign-in" className="text-for-400 hover:text-for-300">Sign in</Link>
            {' '}to share your market take
          </p>
        </div>
      )}

      {/* Notes list */}
      {loading ? (
        <div className="space-y-2">
          {[0, 1, 2].map((i) => (
            <div key={i} className="flex gap-2.5 py-3">
              <Skeleton className="h-7 w-7 rounded-full flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <Skeleton className="h-3 w-24 rounded" />
                <Skeleton className="h-8 w-full rounded" />
              </div>
            </div>
          ))}
        </div>
      ) : notes.length === 0 ? (
        <p className="text-xs text-surface-600 text-center py-4">
          No commentary yet. Be the first to share your take.
        </p>
      ) : (
        <div className="rounded-xl bg-surface-200/50 border border-surface-300/60 divide-y-0 px-3">
          {notes.map((n) => (
            <CommentaryNote
              key={n.id}
              note={n}
              currentUserId={currentUserId}
              onLike={handleLike}
            />
          ))}
        </div>
      )}

      {hasMore && (
        <button
          onClick={() => load(notes.length, true)}
          disabled={loadingMore}
          className="w-full flex items-center justify-center gap-1.5 py-2 text-xs text-surface-500 hover:text-white transition-colors"
        >
          {loadingMore ? (
            <RefreshCw className="h-3 w-3 animate-spin" />
          ) : (
            <>
              <ChevronDown className="h-3 w-3" />
              Load more
            </>
          )}
        </button>
      )}

      <div className="flex items-center gap-3 flex-wrap">
        <Link
          href={`/exchange/${id}/commentary`}
          className="flex items-center gap-1.5 text-xs text-for-400 hover:text-for-300 transition-colors font-mono font-semibold"
        >
          All notes on this market
          <ArrowRight className="h-3 w-3" />
        </Link>
        <Link
          href="/exchange/commentary"
          className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors"
        >
          Global feed
          <ArrowRight className="h-3 w-3" />
        </Link>
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function MarketDetailClient({ id }: { id: string }) {
  const router = useRouter()
  const [detail, setDetail] = useState<MarketDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [range, setRange] = useState<TimeRange>('all')
  const [refreshing, setRefreshing] = useState(false)
  const [currentUserId, setCurrentUserId] = useState<string | null>(null)

  useEffect(() => {
    import('@/lib/supabase/client').then(({ createClient }) => {
      const supabase = createClient()
      supabase.auth.getUser().then(({ data }) => {
        setCurrentUserId(data.user?.id ?? null)
      })
    })
  }, [])

  const load = useCallback(async (showRefresh = false) => {
    if (showRefresh) setRefreshing(true)
    try {
      const res = await fetch(`/api/exchange/${id}`, { cache: 'no-store' })
      if (!res.ok) throw new Error('Not found')
      const data: MarketDetail = await res.json()
      setDetail(data)
    } catch {
      setDetail(null)
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const filteredHistory = useMemo(() => {
    if (!detail) return []
    return filterByRange(detail.history, range)
  }, [detail, range])

  const currentPrice = detail?.price ?? 50
  const delta24h = detail?.price_change_24h ?? null
  const delta7d = detail?.price_change_7d ?? null

  // ── Loading skeleton ───────────────────────────────────────────────────────
  if (loading) {
    return (
      <div className="flex flex-col min-h-screen bg-surface-100">
        <TopBar />
        <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-4 pb-24 space-y-4">
          <Skeleton className="h-5 w-32 rounded" />
          <Skeleton className="h-8 w-full rounded-lg" />
          <Skeleton className="h-52 w-full rounded-xl" />
          <div className="grid grid-cols-4 gap-3">
            {[...Array(4)].map((_, i) => (
              <Skeleton key={i} className="h-14 rounded-lg" />
            ))}
          </div>
          <Skeleton className="h-40 w-full rounded-xl" />
        </main>
        <BottomNav />
      </div>
    )
  }

  // ── Not found ──────────────────────────────────────────────────────────────
  if (!detail) {
    return (
      <div className="flex flex-col min-h-screen bg-surface-100">
        <TopBar />
        <main className="flex-1 flex items-center justify-center px-4 pb-24">
          <EmptyState
            icon={<BarChart2 className="h-8 w-8" />}
            title="Market not found"
            description="This market may have been removed or doesn't exist."
            action={
              <button
                onClick={() => router.push('/exchange')}
                className="px-4 py-2 rounded-xl bg-surface-200 border border-surface-300/60 text-sm font-medium text-white hover:bg-surface-300 transition-colors"
              >
                Back to Exchange
              </button>
            }
          />
        </main>
        <BottomNav />
      </div>
    )
  }

  const isLaw = detail.status === 'law'
  const isFailed = detail.status === 'failed'
  const isSettled = isLaw || isFailed

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col min-h-screen bg-surface-100">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 py-4 pb-24 space-y-5">

        {/* Back breadcrumb */}
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button
              onClick={() => router.push('/exchange')}
              className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors"
            >
              <ArrowLeft className="h-3.5 w-3.5" />
              Exchange
            </button>
            {detail.category && (
              <>
                <span className="text-surface-600">/</span>
                <span className="text-xs text-surface-500">{detail.category}</span>
              </>
            )}
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <WatchButton topicId={id} iconOnly />
            <AddToGroupButton topicId={id} />
            <Link
              href={`/exchange/alerts?topic=${id}`}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-200 border border-surface-300 hover:border-for-500/40 text-xs text-surface-500 hover:text-for-300 transition-colors"
              title="Set price alert"
            >
              <Bell className="h-3 w-3" />
              Alert
            </Link>
            <Link
              href={`/exchange/compare?a=${id}`}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-purple/10 border border-purple/30 hover:border-purple/60 text-xs text-purple hover:text-purple/90 transition-colors"
              title="Compare with another market"
            >
              <Scale className="h-3 w-3" />
              Compare
            </Link>
            <Link
              href={`/exchange/${id}/orderbook`}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-200 border border-surface-300 hover:border-for-500/40 text-xs text-surface-500 hover:text-for-300 transition-colors"
              title="View order book depth chart"
            >
              <BarChart2 className="h-3 w-3" />
              Order Book
            </Link>
            <Link
              href={`/exchange/${id}/traders`}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-200 border border-surface-300 hover:border-emerald/40 text-xs text-surface-500 hover:text-emerald transition-colors"
              title="See who's long and short on this market"
            >
              <Users className="h-3 w-3" />
              Traders
            </Link>
            <Link
              href={`/exchange/${id}/ideas`}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-200 border border-surface-300 hover:border-gold/40 text-xs text-surface-500 hover:text-gold transition-colors"
              title="Community prediction theses for this market"
            >
              <Lightbulb className="h-3 w-3" />
              Theses
            </Link>
            <Link
              href={`/exchange/${id}/analysis`}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-200 border border-surface-300 hover:border-for-500/40 text-xs text-surface-500 hover:text-for-300 transition-colors"
              title="Deep statistical analysis of this market"
            >
              <Activity className="h-3 w-3" />
              Analysis
            </Link>
            <Link
              href={`/exchange/${id}/signal`}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-emerald/10 border border-emerald/30 hover:border-emerald/60 text-xs text-emerald hover:text-emerald/90 transition-colors"
              title="Multi-factor civic signal — momentum, arguments, coalitions, debate activity"
            >
              <Radio className="h-3 w-3" />
              Signal
            </Link>
            <Link
              href={`/exchange/${id}/catalysts`}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-200 border border-surface-300 hover:border-for-400/40 text-xs text-surface-500 hover:text-for-400 transition-colors"
              title="Arguments and events that moved this market's price"
            >
              <Zap className="h-3 w-3" />
              Catalysts
            </Link>
            <Link
              href={`/exchange/${id}/depth`}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-200 border border-surface-300 hover:border-purple/40 text-xs text-surface-500 hover:text-purple transition-colors"
              title="Voter conviction profiles, price sensitivity, and vote concentration"
            >
              <Layers className="h-3 w-3" />
              Depth
            </Link>
            <Link
              href={`/exchange/${id}/forecast`}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-200 border border-surface-300 hover:border-purple/40 text-xs text-surface-500 hover:text-purple transition-colors"
              title="Community price forecasts and targets"
            >
              <Target className="h-3 w-3" />
              Forecasts
            </Link>
            <Link
              href={`/exchange/${id}/research`}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-gold/10 border border-gold/30 hover:border-gold/60 text-xs text-gold hover:text-gold/90 transition-colors"
              title="Full market intelligence research report"
            >
              <FileSearch className="h-3 w-3" />
              Research
            </Link>
            <Link
              href={`/exchange/${id}/activity`}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-200 border border-surface-300 hover:border-for-500/40 text-xs text-surface-500 hover:text-for-300 transition-colors"
              title="Chronological activity log — price milestones, arguments, commentary"
            >
              <Clock className="h-3 w-3" />
              Activity
            </Link>
            <Link
              href={`/exchange/${id}/milestones`}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-200 border border-surface-300 hover:border-gold/40 text-xs text-surface-500 hover:text-gold transition-colors"
              title="Consensus journey — key price thresholds and milestones"
            >
              <Trophy className="h-3 w-3" />
              Milestones
            </Link>
            <Link
              href={`/exchange/${id}/debates`}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-200 border border-surface-300 hover:border-surface-400 text-xs text-surface-500 hover:text-white transition-colors"
              title="Debates linked to this market — live, scheduled, and completed"
            >
              <Swords className="h-3 w-3" />
              Debates
            </Link>
            <Link
              href={`/exchange/${id}/leaderboard`}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-200 border border-surface-300 hover:border-gold/40 text-xs text-surface-500 hover:text-gold transition-colors"
              title="Top forecasters on this market ranked by entry-price edge"
            >
              <Trophy className="h-3 w-3" />
              Leaderboard
            </Link>
            <Link
              href="/exchange/forecasts"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-200 border border-surface-300 hover:border-for-400/40 text-xs text-surface-500 hover:text-for-400 transition-colors"
              title="My forecast track record"
            >
              <Zap className="h-3 w-3" />
              My Forecasts
            </Link>
            <Link
              href="/exchange/portfolio"
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-200 border border-surface-300 hover:border-surface-400 text-xs text-surface-500 hover:text-white transition-colors"
            >
              <Wallet className="h-3 w-3" />
              Portfolio
            </Link>
            <Link
              href={`/exchange/${id}/consensus`}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-200 border border-surface-300 hover:border-purple/40 text-xs text-surface-500 hover:text-purple transition-colors"
              title="Deep consensus breakdown — expert vs crowd, voter tiers, turning points"
            >
              <Brain className="h-3 w-3" />
              Consensus
            </Link>
            <Link
              href={`/exchange/${id}/similar`}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-200 border border-surface-300 hover:border-for-400/40 text-xs text-surface-500 hover:text-for-400 transition-colors"
              title="Markets similar to this one — same category, consensus band, or scope"
            >
              <Layers className="h-3 w-3" />
              Similar
            </Link>
            <Link
              href={`/exchange/${id}/coalitions`}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-200 border border-surface-300 hover:border-emerald/40 text-xs text-surface-500 hover:text-emerald transition-colors"
              title="Coalition breakdown — which alliances are backing FOR vs AGAINST"
            >
              <Shield className="h-3 w-3" />
              Coalitions
            </Link>
            <Link
              href={`/exchange/${id}/brief`}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-200 border border-surface-300 hover:border-for-400/40 text-xs text-surface-500 hover:text-for-400 transition-colors"
              title="One-page market brief — consensus, top arguments, and resolution outlook"
            >
              <FileText className="h-3 w-3" />
              Brief
            </Link>
            <Link
              href={`/exchange/${id}/commentary`}
              className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-200 border border-surface-300 hover:border-for-400/40 text-xs text-surface-500 hover:text-for-400 transition-colors"
              title="Trader commentary and quick takes on this market"
            >
              <MessageSquare className="h-3 w-3" />
              Commentary
            </Link>
          </div>
        </div>

        {/* Header */}
        <div>
          <div className="flex items-start justify-between gap-3 mb-3">
            <h1 className="text-base font-semibold text-white leading-snug flex-1">
              {detail.statement}
            </h1>
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              aria-label="Refresh market"
              className="flex-shrink-0 p-1.5 rounded-lg text-surface-500 hover:text-white hover:bg-surface-300/60 transition-colors disabled:opacity-40"
            >
              <RefreshCw className={cn('h-3.5 w-3.5', refreshing && 'animate-spin')} />
            </button>
          </div>

          {/* Status badges */}
          <div className="flex items-center gap-2 flex-wrap">
            {isLaw && (
              <Badge variant="gold" size="sm" className="flex items-center gap-1">
                <Gavel className="h-3 w-3" />
                Law
              </Badge>
            )}
            {isFailed && (
              <Badge variant="against" size="sm">Failed</Badge>
            )}
            {detail.status === 'voting' && (
              <Badge variant="purple" size="sm" className="flex items-center gap-1">
                <Vote className="h-3 w-3" />
                Voting
              </Badge>
            )}
            {detail.status === 'active' && !isSettled && (
              <Badge variant="for" size="sm" className="flex items-center gap-1">
                <Zap className="h-3 w-3" />
                Live
              </Badge>
            )}
            {detail.is_hot && (
              <Badge variant="surface" size="sm" className="flex items-center gap-1 text-orange-400 border-orange-400/20">
                <Flame className="h-3 w-3" />
                Hot
              </Badge>
            )}
            {detail.is_deadlocked && (
              <Badge variant="surface" size="sm" className="flex items-center gap-1 text-surface-400 border-surface-400/20">
                <Scale className="h-3 w-3" />
                Deadlocked
              </Badge>
            )}
            {detail.is_closing_soon && detail.voting_ends_at && (
              <Badge variant="surface" size="sm" className="flex items-center gap-1 text-yellow-400 border-yellow-400/20">
                <Clock className="h-3 w-3" />
                Closes {timeUntil(detail.voting_ends_at)}
              </Badge>
            )}
            {detail.category && (
              <Badge variant="surface" size="sm">{detail.category}</Badge>
            )}
          </div>
        </div>

        {/* Price hero */}
        <div className="flex items-end gap-6">
          <div>
            <p className="text-[10px] font-mono uppercase tracking-widest text-surface-500 mb-0.5">
              Current Price
            </p>
            <p className={cn('text-4xl font-mono font-black leading-none', priceColor(currentPrice, detail.status))}>
              {Math.round(currentPrice)}¢
            </p>
          </div>
          <div className="flex gap-4 pb-1">
            {delta24h !== null && (
              <div>
                <p className="text-[9px] uppercase tracking-widest text-surface-500 mb-0.5">24h</p>
                <p className={cn('text-sm font-mono font-semibold flex items-center gap-0.5', changeColor(delta24h))}>
                  {delta24h > 0 ? <TrendingUp className="h-3 w-3" /> : delta24h < 0 ? <TrendingDown className="h-3 w-3" /> : null}
                  {delta24h > 0 ? '+' : ''}{delta24h.toFixed(1)}¢
                </p>
              </div>
            )}
            {delta7d !== null && (
              <div>
                <p className="text-[9px] uppercase tracking-widest text-surface-500 mb-0.5">7d</p>
                <p className={cn('text-sm font-mono font-semibold flex items-center gap-0.5', changeColor(delta7d))}>
                  {delta7d > 0 ? <TrendingUp className="h-3 w-3" /> : delta7d < 0 ? <TrendingDown className="h-3 w-3" /> : null}
                  {delta7d > 0 ? '+' : ''}{delta7d.toFixed(1)}¢
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Chart */}
        <div className="rounded-xl bg-surface-200/50 border border-surface-300/60 p-4">
          {/* Time range tabs */}
          <div className="flex items-center gap-1 mb-4">
            {(['7d', '30d', 'all'] as TimeRange[]).map((r) => (
              <button
                key={r}
                onClick={() => setRange(r)}
                className={cn(
                  'px-3 py-1 rounded-lg text-xs font-mono font-medium transition-all',
                  range === r
                    ? 'bg-surface-300 text-white'
                    : 'text-surface-500 hover:text-surface-300 hover:bg-surface-300/40',
                )}
              >
                {r === 'all' ? 'All' : r}
              </button>
            ))}
            <div className="ml-auto flex items-center gap-1 text-[10px] text-surface-500 font-mono">
              <BarChart2 className="h-3 w-3" />
              {filteredHistory.length} snapshots
            </div>
          </div>

          <PriceChart ticks={filteredHistory} status={detail.status} />

          {/* Chart x-axis labels */}
          {filteredHistory.length >= 2 && (
            <div className="flex justify-between mt-1 text-[10px] text-surface-600 font-mono px-0.5">
              <span>
                {new Date(filteredHistory[0].recorded_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
              <span>
                {new Date(filteredHistory[filteredHistory.length - 1].recorded_at).toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })}
              </span>
            </div>
          )}
        </div>

        {/* Key stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {[
            { label: 'High', value: `${Math.round(detail.price_high)}¢`, color: 'text-emerald' },
            { label: 'Low', value: `${Math.round(detail.price_low)}¢`, color: 'text-against-400' },
            { label: 'Open', value: `${Math.round(detail.price_open)}¢`, color: 'text-surface-300' },
            { label: 'Volume', value: formatVolume(detail.volume), color: 'text-gold' },
          ].map(({ label, value, color }) => (
            <div
              key={label}
              className="rounded-xl bg-surface-200/50 border border-surface-300/40 p-3 text-center"
            >
              <p className="text-[10px] text-surface-500 uppercase tracking-widest font-mono mb-1">
                {label}
              </p>
              <p className={cn('text-base font-mono font-bold', color)}>{value}</p>
            </div>
          ))}
        </div>

        {/* Vote breakdown bar */}
        <div className="rounded-xl bg-surface-200/50 border border-surface-300/60 p-4">
          <div className="flex items-center justify-between mb-2 text-xs">
            <span className="text-for-400 font-semibold">For · {formatVolume(detail.blue_votes)}</span>
            <span className="flex items-center gap-1 text-surface-500">
              <Users className="h-3 w-3" />
              {formatVolume(detail.volume)} total
            </span>
            <span className="text-against-400 font-semibold">Against · {formatVolume(detail.red_votes)}</span>
          </div>
          <div className="h-3 rounded-full bg-surface-300/60 overflow-hidden flex">
            <motion.div
              className="h-full bg-for-500 rounded-l-full"
              initial={{ width: 0 }}
              animate={{ width: `${Math.round(currentPrice)}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
            <motion.div
              className="h-full bg-against-500 rounded-r-full"
              initial={{ width: 0 }}
              animate={{ width: `${Math.round(100 - currentPrice)}%` }}
              transition={{ duration: 0.6, ease: 'easeOut' }}
            />
          </div>
          <div className="flex items-center justify-between mt-1.5 text-[10px] text-surface-500 font-mono">
            <span>{Math.round(currentPrice)}¢ FOR</span>
            <span>{Math.round(100 - currentPrice)}¢ AGAINST</span>
          </div>
        </div>

        {/* Closing info */}
        {detail.voting_ends_at && detail.status === 'voting' && (
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-purple/10 border border-purple/20 text-sm">
            <Clock className="h-4 w-4 text-purple flex-shrink-0" />
            <span className="text-surface-200">
              Voting closes in <span className="font-semibold text-white">{timeUntil(detail.voting_ends_at)}</span>
            </span>
          </div>
        )}

        {/* CTA: vote */}
        {!isSettled && (
          <Link
            href={`/topic/${detail.id}`}
            className={cn(
              'flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-sm transition-all',
              'bg-for-600 hover:bg-for-500 text-white border border-for-500/40',
            )}
          >
            <Vote className="h-4 w-4" />
            Cast Your Vote
            <ArrowRight className="h-4 w-4" />
          </Link>
        )}

        {isSettled && (
          <Link
            href={`/topic/${detail.id}`}
            className="flex items-center justify-center gap-2 w-full py-3 rounded-xl font-semibold text-sm bg-surface-200 border border-surface-300/60 text-white hover:bg-surface-300 transition-colors"
          >
            <ExternalLink className="h-4 w-4" />
            View Full Topic
          </Link>
        )}

        {/* Top arguments */}
        {(detail.top_for.length > 0 || detail.top_against.length > 0) && (
          <div className="space-y-3">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-surface-500">
              Top Arguments
            </h2>

            {detail.top_for.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-for-400 uppercase tracking-widest">
                  For
                </p>
                {detail.top_for.map((arg) => (
                  <ArgCard key={arg.id} arg={arg} />
                ))}
              </div>
            )}

            {detail.top_against.length > 0 && (
              <div className="space-y-2">
                <p className="text-[11px] font-semibold text-against-400 uppercase tracking-widest">
                  Against
                </p>
                {detail.top_against.map((arg) => (
                  <ArgCard key={arg.id} arg={arg} />
                ))}
              </div>
            )}

            <Link
              href={`/topic/${detail.id}/arguments`}
              className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-white transition-colors"
            >
              View all arguments
              <ArrowRight className="h-3 w-3" />
            </Link>
          </div>
        )}

        {/* Market commentary */}
        <MarketCommentaryPanel topicId={id} currentUserId={currentUserId} />

        {/* Related markets */}
        {detail.related.length > 0 && (
          <div className="space-y-2">
            <h2 className="text-xs font-semibold uppercase tracking-widest text-surface-500">
              Related Markets
            </h2>
            {detail.related.map((m) => (
              <RelatedCard key={m.id} market={m} />
            ))}
          </div>
        )}

        {/* Meta info */}
        <div className="flex items-center gap-4 text-[11px] text-surface-600 font-mono pt-1 border-t border-surface-300/30">
          <span>Created {relTime(detail.created_at)}</span>
          <span className="flex items-center gap-1">
            <Users className="h-3 w-3" />
            {formatVolume(detail.view_count)} views
          </span>
          <Link
            href={`/topic/${detail.id}`}
            className="ml-auto flex items-center gap-1 hover:text-white transition-colors"
          >
            Full topic page
            <ExternalLink className="h-3 w-3" />
          </Link>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
