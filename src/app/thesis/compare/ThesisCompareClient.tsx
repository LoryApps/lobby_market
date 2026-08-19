'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  ArrowRight,
  Calendar,
  Check,
  CheckCircle,
  CircleDot,
  Clock,
  Link2,
  Loader2,
  Scale,
  Search,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Users,
  X,
  Zap,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Skeleton } from '@/components/ui/Skeleton'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'
import type { ThesisCompareResponse, ThesisCompareEntry } from '@/app/api/thesis/compare/route'
import type { ThesisSearchResult } from '@/app/api/thesis/search/route'

// ─── Status config ─────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, { label: string; color: string; icon: typeof CircleDot }> = {
  active:     { label: 'Active',     color: 'text-for-400',     icon: CircleDot },
  vindicated: { label: 'Vindicated', color: 'text-gold',        icon: Trophy },
  refuted:    { label: 'Refuted',    color: 'text-against-400', icon: X },
  expired:    { label: 'Expired',    color: 'text-surface-500', icon: Clock },
}

const CAT_COLORS: Record<string, string> = {
  economics:   'text-gold border-gold/40 bg-gold/10',
  politics:    'text-for-400 border-for-500/40 bg-for-500/10',
  technology:  'text-purple border-purple/40 bg-purple/10',
  science:     'text-emerald border-emerald/40 bg-emerald/10',
  ethics:      'text-against-400 border-against-500/40 bg-against-500/10',
  philosophy:  'text-surface-400 border-surface-400/40 bg-surface-300/20',
  culture:     'text-pink-400 border-pink-500/40 bg-pink-500/10',
  health:      'text-green-400 border-green-500/40 bg-green-500/10',
  environment: 'text-teal-400 border-teal-500/40 bg-teal-500/10',
  education:   'text-indigo-400 border-indigo-500/40 bg-indigo-500/10',
}

// ─── Helpers ───────────────────────────────────────────────────────────────────

function fmtDate(iso: string | null): string {
  if (!iso) return '—'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
}

function fmtDays(n: number | null): string {
  if (n === null) return 'No deadline'
  if (n < 0) return 'Overdue'
  if (n === 0) return 'Today'
  if (n === 1) return '1 day left'
  return `${n} days left`
}

// ─── Thesis search dropdown ────────────────────────────────────────────────────

interface ThesisPickerProps {
  label: string
  side: 'A' | 'B'
  selected: ThesisCompareEntry | null
  onSelect: (id: string) => void
  onClear: () => void
}

function ThesisPicker({ label, side, selected, onSelect, onClear }: ThesisPickerProps) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<ThesisSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const doSearch = useCallback(async (q: string) => {
    if (q.length < 2) { setResults([]); return }
    setSearching(true)
    try {
      const res = await fetch(`/api/thesis/search?q=${encodeURIComponent(q)}&limit=8`)
      if (res.ok) {
        const data = await res.json()
        setResults(data.results ?? [])
      }
    } finally {
      setSearching(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => doSearch(query), 300)
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [query, doSearch])

  const sideColor = side === 'A' ? 'border-for-500/40 bg-for-500/5' : 'border-against-500/40 bg-against-500/5'
  const sideBadge = side === 'A' ? 'bg-for-500 text-white' : 'bg-against-500 text-white'
  const sideRing = side === 'A' ? 'ring-for-500/30' : 'ring-against-500/30'

  if (selected) {
    const sc = STATUS_CONFIG[selected.status] ?? STATUS_CONFIG.active
    const Icon = sc.icon
    return (
      <div className={cn('rounded-xl border p-4', sideColor)}>
        <div className="flex items-start justify-between gap-2 mb-3">
          <span className={cn('text-xs font-mono font-bold px-2 py-0.5 rounded', sideBadge)}>
            THESIS {side}
          </span>
          <button
            onClick={onClear}
            className="text-surface-500 hover:text-white transition-colors"
            aria-label="Clear selection"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
        <p className="text-sm font-medium text-white leading-relaxed line-clamp-3 mb-2">
          {selected.statement}
        </p>
        <div className="flex items-center gap-2 flex-wrap">
          <span className={cn('text-xs font-mono px-1.5 py-0.5 rounded border', CAT_COLORS[selected.category] ?? 'text-surface-400 border-surface-400/40')}>
            {selected.category}
          </span>
          <span className={cn('flex items-center gap-1 text-xs font-mono', sc.color)}>
            <Icon className="h-3 w-3" />
            {sc.label}
          </span>
          {selected.author && (
            <span className="flex items-center gap-1 text-xs text-surface-500">
              <Users className="h-3 w-3" />
              {selected.author.display_name ?? selected.author.username}
            </span>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className={cn('rounded-xl border', sideColor)}>
      <div className="p-4">
        <div className="flex items-center justify-between gap-2 mb-3">
          <span className={cn('text-xs font-mono font-bold px-2 py-0.5 rounded', sideBadge)}>
            THESIS {label}
          </span>
        </div>
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 pointer-events-none" />
          <input
            type="text"
            placeholder="Search theses by keyword…"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setOpen(true) }}
            onFocus={() => setOpen(true)}
            onBlur={() => setTimeout(() => setOpen(false), 200)}
            className={cn(
              'w-full pl-9 pr-4 py-2 rounded-lg text-sm bg-surface-100 border border-surface-300',
              'text-white placeholder:text-surface-500 outline-none',
              `focus:ring-2 ${sideRing} focus:border-transparent transition-all`
            )}
          />
          {searching && (
            <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 animate-spin" />
          )}
        </div>
      </div>

      <AnimatePresence>
        {open && results.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="border-t border-surface-300 max-h-52 overflow-y-auto"
          >
            {results.map((r) => {
              const total = r.agree_count + r.disagree_count
              const agreePct = total > 0 ? Math.round((r.agree_count / total) * 100) : 50
              return (
                <button
                  key={r.id}
                  onMouseDown={() => { onSelect(r.id); setOpen(false); setQuery('') }}
                  className="w-full text-left px-4 py-3 hover:bg-surface-200 transition-colors border-b border-surface-300/50 last:border-0"
                >
                  <p className="text-sm text-white line-clamp-2 mb-1">{r.statement}</p>
                  <div className="flex items-center gap-2">
                    <span className={cn('text-xs font-mono px-1.5 py-0.5 rounded border', CAT_COLORS[r.category] ?? 'text-surface-400 border-surface-400/40')}>
                      {r.category}
                    </span>
                    <span className="text-xs text-for-400">{agreePct}% agree</span>
                    <span className="text-xs text-surface-500">{total} votes</span>
                  </div>
                </button>
              )
            })}
          </motion.div>
        )}
        {open && query.length >= 2 && !searching && results.length === 0 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="border-t border-surface-300 px-4 py-3 text-sm text-surface-500 text-center"
          >
            No theses found for &ldquo;{query}&rdquo;
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Thesis panel ──────────────────────────────────────────────────────────────

interface ThesisPanelProps {
  entry: ThesisCompareEntry
  side: 'A' | 'B'
  highlight?: 'more_popular' | 'more_contested' | 'closer_resolution' | null
  onVote: (id: string, agree: boolean) => void
  voteBusy: boolean
}

function ThesisPanel({ entry, side, highlight, onVote, voteBusy }: ThesisPanelProps) {
  const sc = STATUS_CONFIG[entry.status] ?? STATUS_CONFIG.active
  const Icon = sc.icon
  const sideAccent = side === 'A' ? 'border-for-500/40' : 'border-against-500/40'
  const sideBg = side === 'A' ? 'bg-for-500/5' : 'bg-against-500/5'
  const sideBar = side === 'A' ? 'bg-for-500' : 'bg-against-500'

  const total = entry.agree_count + entry.disagree_count
  const agreePct = entry.agree_pct
  const disagreeBarPct = 100 - agreePct

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn('rounded-xl border flex flex-col gap-4 p-5', sideAccent, sideBg)}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-2">
        <div className={cn('flex items-center gap-1.5 text-xs font-mono', sc.color)}>
          <Icon className="h-3.5 w-3.5" />
          {sc.label}
        </div>
        <span className={cn('text-xs font-mono px-1.5 py-0.5 rounded border capitalize', CAT_COLORS[entry.category] ?? '')}>
          {entry.category}
        </span>
      </div>

      {/* Statement */}
      <p className="text-base font-medium text-white leading-relaxed">
        {entry.statement}
      </p>

      {/* Rationale */}
      {entry.rationale && (
        <p className="text-sm text-surface-400 leading-relaxed line-clamp-3">
          {entry.rationale}
        </p>
      )}

      {/* Agree bar */}
      <div>
        <div className="flex justify-between text-xs font-mono mb-1.5">
          <span className="text-for-400">{agreePct}% agree</span>
          <span className="text-against-400">{disagreeBarPct}% disagree</span>
        </div>
        <div className="h-2 rounded-full bg-surface-200 overflow-hidden">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${agreePct}%` }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className={cn('h-full rounded-full', sideBar)}
          />
        </div>
        <p className="text-xs text-surface-500 mt-1.5 font-mono">
          {total.toLocaleString()} {total === 1 ? 'voice' : 'voices'}
        </p>
      </div>

      {/* Meta */}
      <div className="grid grid-cols-2 gap-3 text-xs">
        <div className="flex items-center gap-1.5 text-surface-400">
          <Calendar className="h-3.5 w-3.5" />
          <span>Created {fmtDate(entry.created_at)}</span>
        </div>
        <div className={cn('flex items-center gap-1.5', entry.days_to_resolve !== null && entry.days_to_resolve <= 7 ? 'text-against-400' : 'text-surface-400')}>
          <Clock className="h-3.5 w-3.5" />
          <span>{fmtDays(entry.days_to_resolve)}</span>
        </div>
      </div>

      {/* Author */}
      {entry.author && (
        <Link href={`/profile/${entry.author.username}`} className="flex items-center gap-2 text-sm hover:text-white transition-colors text-surface-400 group">
          <Avatar
            src={entry.author.avatar_url}
            username={entry.author.username}
            size={24}
          />
          <span className="group-hover:text-white transition-colors">
            {entry.author.display_name ?? entry.author.username}
          </span>
        </Link>
      )}

      {/* Related topic */}
      {entry.related_topic_id && entry.related_topic_statement && (
        <Link
          href={`/topic/${entry.related_topic_id}`}
          className="flex items-center gap-1.5 text-xs text-surface-500 hover:text-for-400 transition-colors"
        >
          <ArrowRight className="h-3.5 w-3.5 flex-shrink-0" />
          <span className="line-clamp-1">{entry.related_topic_statement}</span>
        </Link>
      )}

      {/* Highlight badge */}
      {highlight && (
        <div className={cn('flex items-center gap-1.5 text-xs font-mono px-2 py-1.5 rounded-lg', side === 'A' ? 'bg-for-500/15 text-for-300' : 'bg-against-500/15 text-against-300')}>
          <Zap className="h-3 w-3" />
          {highlight === 'more_popular' && 'More community engagement'}
          {highlight === 'more_contested' && 'More closely contested'}
          {highlight === 'closer_resolution' && 'Resolves sooner'}
        </div>
      )}

      {/* Vote buttons */}
      {entry.status === 'active' && (
        <div className="flex gap-2 mt-auto pt-2 border-t border-surface-300/50">
          <button
            onClick={() => onVote(entry.id, true)}
            disabled={voteBusy}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-mono font-semibold transition-all',
              entry.viewer_vote === true
                ? 'bg-for-500 text-white border border-for-500'
                : 'bg-for-500/10 text-for-400 border border-for-500/30 hover:bg-for-500/20'
            )}
          >
            <ThumbsUp className="h-4 w-4" />
            {entry.viewer_vote === true ? 'Agreed' : 'Agree'}
          </button>
          <button
            onClick={() => onVote(entry.id, false)}
            disabled={voteBusy}
            className={cn(
              'flex-1 flex items-center justify-center gap-1.5 py-2 rounded-lg text-sm font-mono font-semibold transition-all',
              entry.viewer_vote === false
                ? 'bg-against-500 text-white border border-against-500'
                : 'bg-against-500/10 text-against-400 border border-against-500/30 hover:bg-against-500/20'
            )}
          >
            <ThumbsDown className="h-4 w-4" />
            {entry.viewer_vote === false ? 'Disagreed' : 'Disagree'}
          </button>
        </div>
      )}
    </motion.div>
  )
}

// ─── Insight strip ─────────────────────────────────────────────────────────────

function InsightStrip({ insights }: { insights: NonNullable<ThesisCompareResponse['insights']> }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.2 }}
      className="rounded-xl border border-surface-300 bg-surface-100 p-4"
    >
      <h3 className="text-xs font-mono font-bold text-surface-500 uppercase tracking-wider mb-3 flex items-center gap-1.5">
        <Scale className="h-3.5 w-3.5" />
        Comparison Insights
      </h3>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
        {insights.same_category && (
          <div className="flex items-center gap-1.5 text-sm text-emerald">
            <CheckCircle className="h-4 w-4 flex-shrink-0" />
            <span>Same category: <span className="font-mono capitalize">{insights.category_a}</span></span>
          </div>
        )}
        {!insights.same_category && (
          <div className="flex items-center gap-1.5 text-sm text-surface-400">
            <Scale className="h-4 w-4 flex-shrink-0" />
            <span className="font-mono capitalize">{insights.category_a}</span>
            <span className="text-surface-600">vs</span>
            <span className="font-mono capitalize">{insights.category_b}</span>
          </div>
        )}
        {insights.more_popular !== 'equal' && (
          <div className="flex items-center gap-1.5 text-sm text-surface-400">
            <Users className="h-4 w-4 flex-shrink-0 text-for-400" />
            Thesis {insights.more_popular.toUpperCase()} has more engagement
          </div>
        )}
        {insights.more_contested !== 'equal' && (
          <div className="flex items-center gap-1.5 text-sm text-surface-400">
            <Scale className="h-4 w-4 flex-shrink-0 text-purple" />
            Thesis {insights.more_contested.toUpperCase()} is more contested
          </div>
        )}
        {insights.closer_resolution && insights.closer_resolution !== 'equal' && (
          <div className="flex items-center gap-1.5 text-sm text-surface-400">
            <Clock className="h-4 w-4 flex-shrink-0 text-against-400" />
            Thesis {insights.closer_resolution.toUpperCase()} resolves sooner
          </div>
        )}
        {insights.overlap_tags.length > 0 && (
          <div className="col-span-2 sm:col-span-3 flex items-center gap-1.5 text-sm text-surface-400 flex-wrap">
            <Zap className="h-4 w-4 flex-shrink-0 text-gold" />
            <span className="text-surface-500">Common themes:</span>
            {insights.overlap_tags.map((t) => (
              <span key={t} className="font-mono text-xs text-gold bg-gold/10 border border-gold/20 px-1.5 py-0.5 rounded">
                {t}
              </span>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  )
}

// ─── Main client ───────────────────────────────────────────────────────────────

export function ThesisCompareClient() {
  const router = useRouter()
  const searchParams = useSearchParams()

  const [idA, setIdA] = useState<string | null>(searchParams.get('a'))
  const [idB, setIdB] = useState<string | null>(searchParams.get('b'))

  const [data, setData] = useState<ThesisCompareResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [voteBusy, setVoteBusy] = useState(false)
  const [copied, setCopied] = useState(false)

  const load = useCallback(async (a: string, b: string) => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/thesis/compare?a=${a}&b=${b}`)
      if (!res.ok) throw new Error('Failed to load comparison')
      const json: ThesisCompareResponse = await res.json()
      setData(json)
      if (!json.a) setError('Thesis A not found or not public')
      else if (!json.b) setError('Thesis B not found or not public')
    } catch {
      setError('Failed to load theses. Please try again.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (idA && idB) {
      load(idA, idB)
      const url = new URL(window.location.href)
      url.searchParams.set('a', idA)
      url.searchParams.set('b', idB)
      router.replace(url.pathname + url.search, { scroll: false })
    }
  }, [idA, idB, load, router])

  async function handleVote(thesisId: string, agree: boolean) {
    if (!data || voteBusy) return
    setVoteBusy(true)
    try {
      const isA = data.a?.id === thesisId
      const entry = isA ? data.a : data.b
      if (!entry) return

      const currentVote = entry.viewer_vote
      if (currentVote === agree) {
        await fetch(`/api/thesis/${thesisId}/vote`, { method: 'DELETE' })
        setData((d) => {
          if (!d) return d
          const updated: ThesisCompareEntry = {
            ...entry,
            viewer_vote: null,
            agree_count: agree ? Math.max(0, entry.agree_count - 1) : entry.agree_count,
            disagree_count: !agree ? Math.max(0, entry.disagree_count - 1) : entry.disagree_count,
            agree_pct: 0,
            disagree_pct: 0,
          }
          const total = updated.agree_count + updated.disagree_count
          updated.agree_pct = total > 0 ? Math.round((updated.agree_count / total) * 100) : 50
          updated.disagree_pct = 100 - updated.agree_pct
          return isA ? { ...d, a: updated } : { ...d, b: updated }
        })
      } else {
        await fetch(`/api/thesis/${thesisId}/vote`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ agree }),
        })
        setData((d) => {
          if (!d) return d
          const prevVote = entry.viewer_vote
          const updated: ThesisCompareEntry = {
            ...entry,
            viewer_vote: agree,
            agree_count: agree
              ? entry.agree_count + 1
              : prevVote === true
                ? Math.max(0, entry.agree_count - 1)
                : entry.agree_count,
            disagree_count: !agree
              ? entry.disagree_count + 1
              : prevVote === false
                ? Math.max(0, entry.disagree_count - 1)
                : entry.disagree_count,
            agree_pct: 0,
            disagree_pct: 0,
          }
          const total = updated.agree_count + updated.disagree_count
          updated.agree_pct = total > 0 ? Math.round((updated.agree_count / total) * 100) : 50
          updated.disagree_pct = 100 - updated.agree_pct
          return isA ? { ...d, a: updated } : { ...d, b: updated }
        })
      }
    } finally {
      setVoteBusy(false)
    }
  }

  async function copyLink() {
    const url = window.location.href
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2000)
  }

  const canCompare = !!(idA && idB)
  const hasResults = !!(data?.a && data?.b)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-5xl mx-auto px-4 py-8 pb-24 md:pb-12">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <Link href="/thesis" className="text-surface-500 hover:text-white transition-colors">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div className="h-10 w-10 rounded-xl bg-purple/10 border border-purple/30 flex items-center justify-center">
              <Scale className="h-5 w-5 text-purple" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Thesis Compare</h1>
              <p className="text-sm text-surface-500">Side-by-side civic prediction analysis</p>
            </div>
          </div>
        </div>

        {/* Pickers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
          <ThesisPicker
            label="A"
            side="A"
            selected={data?.a ?? null}
            onSelect={(id) => { setIdA(id); setData(null) }}
            onClear={() => { setIdA(null); setData(null) }}
          />
          <ThesisPicker
            label="B"
            side="B"
            selected={data?.b ?? null}
            onSelect={(id) => { setIdB(id); setData(null) }}
            onClear={() => { setIdB(null); setData(null) }}
          />
        </div>

        {/* Action bar */}
        <div className="flex items-center justify-between gap-4 mb-6">
          {canCompare && !hasResults && (
            <button
              onClick={() => { if (idA && idB) load(idA, idB) }}
              disabled={loading}
              className="flex items-center gap-2 px-4 py-2 rounded-lg bg-purple text-white font-mono text-sm font-semibold hover:bg-purple/90 transition-colors disabled:opacity-50"
            >
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <Scale className="h-4 w-4" />}
              {loading ? 'Loading…' : 'Compare'}
            </button>
          )}
          {hasResults && (
            <button
              onClick={copyLink}
              className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-200 border border-surface-300 text-surface-400 hover:text-white text-sm font-mono transition-colors"
            >
              {copied ? <Check className="h-4 w-4 text-emerald" /> : <Link2 className="h-4 w-4" />}
              {copied ? 'Copied!' : 'Copy link'}
            </button>
          )}
          {!canCompare && (
            <p className="text-sm text-surface-500 font-mono">
              Search for two theses above to compare them
            </p>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="rounded-xl border border-against-500/30 bg-against-500/10 px-4 py-3 text-sm text-against-300 mb-6">
            {error}
          </div>
        )}

        {/* Loading skeletons */}
        {loading && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
            {[0, 1].map((i) => (
              <div key={i} className="rounded-xl border border-surface-300 p-5 space-y-3">
                <Skeleton className="h-4 w-24 rounded" />
                <Skeleton className="h-16 w-full rounded" />
                <Skeleton className="h-2 w-full rounded" />
                <Skeleton className="h-4 w-48 rounded" />
              </div>
            ))}
          </div>
        )}

        {/* Compare panels */}
        <AnimatePresence>
          {hasResults && !loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-4"
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <ThesisPanel
                  entry={data!.a!}
                  side="A"
                  highlight={
                    data?.insights?.more_popular === 'a' ? 'more_popular'
                    : data?.insights?.more_contested === 'a' ? 'more_contested'
                    : data?.insights?.closer_resolution === 'a' ? 'closer_resolution'
                    : null
                  }
                  onVote={handleVote}
                  voteBusy={voteBusy}
                />
                <ThesisPanel
                  entry={data!.b!}
                  side="B"
                  highlight={
                    data?.insights?.more_popular === 'b' ? 'more_popular'
                    : data?.insights?.more_contested === 'b' ? 'more_contested'
                    : data?.insights?.closer_resolution === 'b' ? 'closer_resolution'
                    : null
                  }
                  onVote={handleVote}
                  voteBusy={voteBusy}
                />
              </div>

              {/* Insights */}
              {data?.insights && <InsightStrip insights={data.insights} />}

              {/* View detail links */}
              <div className="grid grid-cols-2 gap-4">
                {[
                  { entry: data!.a!, label: 'A' },
                  { entry: data!.b!, label: 'B' },
                ].map(({ entry, label }) => (
                  <Link
                    key={entry.id}
                    href={`/thesis/${entry.id}`}
                    className="flex items-center justify-center gap-2 py-2.5 rounded-lg border border-surface-300 bg-surface-100 text-surface-400 hover:text-white hover:border-surface-400 transition-colors text-sm font-mono"
                  >
                    View Thesis {label} in full
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state */}
        {!canCompare && !loading && !hasResults && (
          <div className="rounded-xl border border-surface-300 bg-surface-100 p-12 text-center">
            <Scale className="h-10 w-10 text-surface-500 mx-auto mb-3" />
            <p className="text-white font-medium mb-1">Compare Two Civic Theses</p>
            <p className="text-sm text-surface-500 max-w-md mx-auto">
              Search for two theses above to see them side-by-side — agreement splits, resolution
              timelines, community engagement, and what they have in common.
            </p>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
