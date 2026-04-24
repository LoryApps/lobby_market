'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Check,
  ChevronRight,
  Copy,
  ExternalLink,
  GitCompare,
  Loader2,
  RotateCcw,
  Scale,
  Search,
  Share2,
  Tag,
  Users,
  Zap,
  Eye,
  TrendingUp,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'
import { getTopicSignal, SIGNAL_PILL_CLASSES } from '@/lib/utils/topic-signal'

// ─── Types ────────────────────────────────────────────────────────────────────

interface CompareTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  view_count: number
  support_count: number
  feed_score: number
  created_at: string
  description: string | null
  activation_threshold: number | null
}

interface SearchResult {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_CONFIG: Record<string, {
  label: string
  variant: 'proposed' | 'active' | 'law' | 'failed'
  dot: string
}> = {
  proposed: { label: 'Proposed', variant: 'proposed', dot: 'bg-surface-400' },
  active:   { label: 'Active',   variant: 'active',   dot: 'bg-for-500' },
  voting:   { label: 'Voting',   variant: 'active',   dot: 'bg-purple' },
  law:      { label: 'LAW',      variant: 'law',      dot: 'bg-gold' },
  failed:   { label: 'Failed',   variant: 'failed',   dot: 'bg-against-500' },
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Topic Search Picker ──────────────────────────────────────────────────────

function TopicPicker({
  slot,
  current,
  onSelect,
  disabled,
}: {
  slot: 'A' | 'B'
  current: CompareTopic | null
  onSelect: (t: SearchResult) => void
  disabled?: boolean
}) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [open, setOpen] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [])

  const handleChange = useCallback((q: string) => {
    setQuery(q)
    if (timerRef.current) clearTimeout(timerRef.current)
    if (q.trim().length < 2) {
      setResults([])
      setOpen(false)
      return
    }
    timerRef.current = setTimeout(async () => {
      setSearching(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&tab=topics`)
        if (res.ok) {
          const json = await res.json() as { results: SearchResult[] }
          setResults(json.results ?? [])
          setOpen(true)
        }
      } finally {
        setSearching(false)
      }
    }, 300)
  }, [])

  const slotColor = slot === 'A' ? 'border-for-500/40 text-for-400' : 'border-against-500/40 text-against-400'
  const slotBg = slot === 'A' ? 'bg-for-500/10' : 'bg-against-500/10'

  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center gap-2 mb-1">
        <div className={cn('flex items-center justify-center h-6 w-6 rounded-md font-mono text-xs font-bold border', slotColor, slotBg)}>
          {slot}
        </div>
        <span className="text-xs font-mono text-surface-500 uppercase tracking-wide">
          {current ? 'Topic selected' : 'Pick a topic'}
        </span>
        {current && (
          <button
            onClick={() => onSelect({ id: '', statement: '', category: null, status: '', blue_pct: 0, total_votes: 0 })}
            className="ml-auto text-surface-500 hover:text-white transition-colors"
            aria-label="Clear selection"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>

      {current ? (
        <Link
          href={`/topic/${current.id}`}
          className={cn(
            'group p-3 rounded-xl border transition-all duration-200',
            slot === 'A'
              ? 'bg-for-500/5 border-for-500/30 hover:border-for-500/60'
              : 'bg-against-500/5 border-against-500/30 hover:border-against-500/60',
          )}
        >
          <p className="text-sm font-mono font-semibold text-white leading-snug line-clamp-3 mb-2 group-hover:text-for-300 transition-colors">
            {current.statement}
          </p>
          <div className="flex items-center gap-2 flex-wrap">
            {current.category && (
              <span className="text-[10px] font-mono text-surface-500">{current.category}</span>
            )}
            <span className="text-[10px] font-mono text-surface-600">·</span>
            <span className="text-[10px] font-mono text-surface-500">{relativeTime(current.created_at)}</span>
            <ExternalLink className="h-3 w-3 text-surface-600 ml-auto opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
        </Link>
      ) : (
        <div ref={containerRef} className="relative">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-500 pointer-events-none" />
            {searching && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-500 animate-spin" />
            )}
            <input
              type="text"
              placeholder="Search topics…"
              value={query}
              onChange={(e) => handleChange(e.target.value)}
              onFocus={() => results.length > 0 && setOpen(true)}
              disabled={disabled}
              className={cn(
                'w-full pl-9 pr-3 py-2.5 rounded-xl text-sm font-mono',
                'bg-surface-200 border text-white placeholder-surface-500',
                'focus:outline-none focus:ring-2 focus:ring-for-500/40',
                slot === 'A' ? 'border-for-500/20 focus:border-for-500/40' : 'border-against-500/20 focus:border-against-500/40',
                disabled && 'opacity-50 cursor-not-allowed',
              )}
            />
          </div>

          <AnimatePresence>
            {open && results.length > 0 && (
              <motion.div
                initial={{ opacity: 0, y: -4 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                transition={{ duration: 0.12 }}
                className="absolute z-50 top-full mt-1.5 left-0 right-0 rounded-xl bg-surface-100 border border-surface-300 shadow-xl overflow-hidden max-h-64 overflow-y-auto"
              >
                {results.map((r) => {
                  const cfg = STATUS_CONFIG[r.status] ?? STATUS_CONFIG.proposed
                  return (
                    <button
                      key={r.id}
                      onClick={() => {
                        onSelect(r)
                        setQuery('')
                        setResults([])
                        setOpen(false)
                      }}
                      className="w-full text-left flex items-start gap-2.5 px-3 py-2.5 hover:bg-surface-200 transition-colors border-b border-surface-300/50 last:border-0"
                    >
                      <span className={cn('mt-1 h-1.5 w-1.5 rounded-full flex-shrink-0', cfg.dot)} />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-mono font-medium text-white line-clamp-2 leading-snug">{r.statement}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          {r.category && <span className="text-[10px] font-mono text-surface-500">{r.category}</span>}
                          <span className="text-[10px] font-mono text-for-400">{Math.round(r.blue_pct)}% for</span>
                        </div>
                      </div>
                    </button>
                  )
                })}
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      )}
    </div>
  )
}

// ─── Stat Row ─────────────────────────────────────────────────────────────────

function StatRow({
  label,
  valA,
  valB,
  higherIsBetter = true,
  format = (v: number) => v.toLocaleString(),
}: {
  label: string
  valA: number
  valB: number
  higherIsBetter?: boolean
  format?: (v: number) => string
}) {
  const aWins = higherIsBetter ? valA > valB : valA < valB
  const bWins = higherIsBetter ? valB > valA : valB < valA
  const tie = valA === valB

  return (
    <div className="grid grid-cols-3 items-center py-2.5 border-b border-surface-300/40 last:border-0">
      <span className={cn(
        'text-xs font-mono font-semibold tabular-nums text-right pr-3',
        !tie && aWins ? 'text-for-300' : 'text-surface-400',
      )}>
        {format(valA)}
      </span>
      <span className="text-[10px] font-mono text-surface-500 text-center uppercase tracking-wide">
        {label}
      </span>
      <span className={cn(
        'text-xs font-mono font-semibold tabular-nums pl-3',
        !tie && bWins ? 'text-against-300' : 'text-surface-400',
      )}>
        {format(valB)}
      </span>
    </div>
  )
}

// ─── Head to Head Bar ─────────────────────────────────────────────────────────

function HeadToHeadBar({ topicA, topicB }: { topicA: CompareTopic; topicB: CompareTopic }) {
  const aFor = Math.round(topicA.blue_pct)
  const bFor = Math.round(topicB.blue_pct)
  const total = aFor + bFor
  const aShare = total > 0 ? Math.round((aFor / total) * 100) : 50

  return (
    <div className="bg-surface-100 border border-surface-300 rounded-2xl p-5">
      <div className="flex items-center gap-2 mb-4">
        <GitCompare className="h-4 w-4 text-purple" />
        <span className="text-xs font-mono text-surface-500 uppercase tracking-wide">Head-to-Head · FOR %</span>
      </div>

      {/* Main bar */}
      <div className="relative h-8 rounded-full overflow-hidden bg-surface-200 mb-3">
        <motion.div
          initial={{ width: '50%' }}
          animate={{ width: `${aShare}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="absolute left-0 top-0 h-full bg-gradient-to-r from-for-600 to-for-500 rounded-full"
        />
        <motion.div
          initial={{ width: '50%' }}
          animate={{ width: `${100 - aShare}%` }}
          transition={{ duration: 0.8, ease: 'easeOut' }}
          className="absolute right-0 top-0 h-full bg-gradient-to-l from-against-600 to-against-500 rounded-full"
        />
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="h-full w-0.5 bg-surface-100/60" />
        </div>
      </div>

      {/* Labels */}
      <div className="flex items-center justify-between text-xs font-mono">
        <div className="flex items-center gap-1.5">
          <span className="h-2 w-2 rounded-full bg-for-500 flex-shrink-0" />
          <span className="text-for-300 font-semibold">{aFor}% FOR</span>
          <span className="text-surface-500">A</span>
        </div>
        <div className="text-[10px] text-surface-600 uppercase tracking-wide">vs</div>
        <div className="flex items-center gap-1.5">
          <span className="text-surface-500">B</span>
          <span className="text-against-300 font-semibold">{bFor}% FOR</span>
          <span className="h-2 w-2 rounded-full bg-against-500 flex-shrink-0" />
        </div>
      </div>

      {/* Delta note */}
      {Math.abs(aFor - bFor) > 0 && (
        <p className="text-center text-[11px] font-mono text-surface-500 mt-3">
          {Math.abs(aFor - bFor) === 0 ? (
            'Identical support — deadlock.'
          ) : aFor > bFor ? (
            <>
              <span className="text-for-400 font-semibold">Topic A</span> leads by{' '}
              <span className="text-white font-semibold">{Math.abs(aFor - bFor)} pp</span>
            </>
          ) : (
            <>
              <span className="text-against-400 font-semibold">Topic B</span> leads by{' '}
              <span className="text-white font-semibold">{Math.abs(aFor - bFor)} pp</span>
            </>
          )}
        </p>
      )}
    </div>
  )
}

// ─── Topic Side Card ──────────────────────────────────────────────────────────

function TopicSideCard({ topic, side }: { topic: CompareTopic; side: 'A' | 'B' }) {
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct
  const cfg = STATUS_CONFIG[topic.status] ?? STATUS_CONFIG.proposed
  const signal = getTopicSignal(topic)
  const signalClasses = signal ? SIGNAL_PILL_CLASSES[signal.color] : null

  const isA = side === 'A'

  return (
    <div className={cn(
      'flex flex-col gap-3 p-4 rounded-2xl border',
      isA
        ? 'bg-for-500/5 border-for-500/20'
        : 'bg-against-500/5 border-against-500/20',
    )}>
      {/* Slot label */}
      <div className="flex items-center gap-2">
        <div className={cn(
          'flex items-center justify-center h-6 w-6 rounded-md font-mono text-xs font-bold border',
          isA ? 'bg-for-500/15 border-for-500/40 text-for-300' : 'bg-against-500/15 border-against-500/40 text-against-300',
        )}>
          {side}
        </div>
        <Badge variant={cfg.variant}>
          <span className={cn('mr-1 h-1.5 w-1.5 rounded-full inline-block', cfg.dot)} />
          {cfg.label}
        </Badge>
        {topic.category && (
          <span className="flex items-center gap-1 text-[10px] font-mono text-surface-500">
            <Tag className="h-3 w-3" />
            {topic.category}
          </span>
        )}
        <Link
          href={`/topic/${topic.id}`}
          className="ml-auto flex items-center gap-1 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
          aria-label="Open topic"
        >
          Open <ExternalLink className="h-3 w-3" />
        </Link>
      </div>

      {/* Statement */}
      <p className="font-mono text-sm font-semibold text-white leading-snug">
        {topic.statement}
      </p>

      {/* Vote bar */}
      <div className="space-y-1">
        <div className="h-2.5 w-full rounded-full overflow-hidden bg-surface-300 flex">
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${forPct}%` }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="bg-for-500 h-full"
          />
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${againstPct}%` }}
            transition={{ duration: 0.7, ease: 'easeOut' }}
            className="bg-against-500 h-full"
          />
        </div>
        <div className="flex items-center justify-between text-[11px] font-mono">
          <span className="text-for-400 font-semibold">{forPct}% FOR</span>
          <span className="text-against-400 font-semibold">{againstPct}% AGAINST</span>
        </div>
      </div>

      {/* Signal pill */}
      {signal && signalClasses && (
        <div>
          <span className={cn(
            'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold border',
            signalClasses.pill,
          )}>
            <span className={cn('h-1 w-1 rounded-full', signalClasses.dot)} />
            {signal.label}
          </span>
        </div>
      )}

      {/* Stats grid */}
      <div className="grid grid-cols-2 gap-2 mt-1">
        {[
          { icon: Users, label: 'Votes', value: topic.total_votes.toLocaleString() },
          { icon: Eye, label: 'Views', value: topic.view_count.toLocaleString() },
          { icon: TrendingUp, label: 'Score', value: Math.round(topic.feed_score).toLocaleString() },
          { icon: Zap, label: 'Support', value: topic.support_count.toLocaleString() },
        ].map(({ icon: Icon, label, value }) => (
          <div
            key={label}
            className="flex items-center gap-1.5 p-2 rounded-lg bg-surface-200/60 border border-surface-300/40"
          >
            <Icon className="h-3 w-3 text-surface-500 flex-shrink-0" />
            <div>
              <p className="text-[10px] font-mono text-surface-500">{label}</p>
              <p className="text-xs font-mono font-semibold text-white">{value}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Description excerpt */}
      {topic.description && (
        <p className="text-[11px] font-mono text-surface-500 leading-relaxed line-clamp-3">
          {topic.description}
        </p>
      )}
    </div>
  )
}

// ─── Main compare inner component ────────────────────────────────────────────

function ComparePageInner() {
  const searchParams = useSearchParams()
  const router = useRouter()

  const [topicA, setTopicA] = useState<CompareTopic | null>(null)
  const [topicB, setTopicB] = useState<CompareTopic | null>(null)
  const [loadingA, setLoadingA] = useState(false)
  const [loadingB, setLoadingB] = useState(false)
  const [copied, setCopied] = useState(false)
  const copyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const idA = searchParams.get('a')
  const idB = searchParams.get('b')

  async function fetchTopic(id: string): Promise<CompareTopic | null> {
    const res = await fetch(`/api/topics/${id}`)
    if (!res.ok) return null
    const json = await res.json() as { topic: CompareTopic }
    return json.topic ?? null
  }

  useEffect(() => {
    if (!idA) { setTopicA(null); return }
    if (topicA?.id === idA) return
    setLoadingA(true)
    fetchTopic(idA).then((t) => { setTopicA(t); setLoadingA(false) })
  }, [idA]) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!idB) { setTopicB(null); return }
    if (topicB?.id === idB) return
    setLoadingB(true)
    fetchTopic(idB).then((t) => { setTopicB(t); setLoadingB(false) })
  }, [idB]) // eslint-disable-line react-hooks/exhaustive-deps

  function updateUrl(a: string | null, b: string | null) {
    const params = new URLSearchParams()
    if (a) params.set('a', a)
    if (b) params.set('b', b)
    router.replace(`/compare?${params.toString()}`, { scroll: false })
  }

  function handleSelectA(result: SearchResult) {
    if (!result.id) {
      setTopicA(null)
      updateUrl(null, idB)
      return
    }
    updateUrl(result.id, idB)
  }

  function handleSelectB(result: SearchResult) {
    if (!result.id) {
      setTopicB(null)
      updateUrl(idA, null)
      return
    }
    updateUrl(idA, result.id)
  }

  function handleSwap() {
    if (!topicA && !topicB) return
    updateUrl(idB ?? null, idA ?? null)
  }

  async function handleShare() {
    const url = window.location.href
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Topic Comparison · Lobby Market', url })
        return
      }
      await navigator.clipboard.writeText(url)
      setCopied(true)
      if (copyTimerRef.current) clearTimeout(copyTimerRef.current)
      copyTimerRef.current = setTimeout(() => setCopied(false), 2000)
    } catch {
      // silently fail
    }
  }

  const bothLoaded = topicA !== null && topicB !== null
  const isLoading = loadingA || loadingB

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-5xl mx-auto px-4 py-8 pb-24 md:pb-10">
        {/* Header */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-purple/10 border border-purple/30 flex-shrink-0">
              <GitCompare className="h-5 w-5 text-purple" />
            </div>
            <div>
              <h1 className="font-mono text-3xl font-bold text-white leading-tight">
                Compare Topics
              </h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                Side-by-side consensus analysis for any two debates
              </p>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {bothLoaded && (
              <>
                <button
                  onClick={handleSwap}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono',
                    'bg-surface-200 border border-surface-300 text-surface-400',
                    'hover:bg-surface-300 hover:text-white transition-colors',
                  )}
                  aria-label="Swap topics A and B"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  Swap
                </button>
                <button
                  onClick={handleShare}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono',
                    'bg-surface-200 border border-surface-300 text-surface-400',
                    'hover:bg-surface-300 hover:text-white transition-colors',
                  )}
                  aria-label="Share this comparison"
                >
                  {copied ? (
                    <><Check className="h-3.5 w-3.5 text-emerald" /> Copied!</>
                  ) : (
                    <><Share2 className="h-3.5 w-3.5" /> Share</>
                  )}
                </button>
              </>
            )}
          </div>
        </div>

        {/* Topic pickers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          <div className="bg-surface-100 border border-surface-300 rounded-2xl p-4">
            <TopicPicker slot="A" current={topicA} onSelect={handleSelectA} />
          </div>
          <div className="bg-surface-100 border border-surface-300 rounded-2xl p-4">
            <TopicPicker slot="B" current={topicB} onSelect={handleSelectB} />
          </div>
        </div>

        {/* Loading spinner */}
        {isLoading && (
          <div className="flex items-center justify-center py-16 gap-2 text-surface-500">
            <Loader2 className="h-5 w-5 animate-spin" />
            <span className="text-sm font-mono">Loading topic data…</span>
          </div>
        )}

        {/* Empty state — prompt to search */}
        {!isLoading && !topicA && !topicB && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-20 gap-5 text-center"
          >
            <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-purple/10 border border-purple/30">
              <GitCompare className="h-8 w-8 text-purple" />
            </div>
            <div>
              <p className="font-mono font-semibold text-white text-lg">
                Pick two topics to compare
              </p>
              <p className="text-sm text-surface-500 font-mono mt-1 max-w-sm">
                Search for any two debates above to see a side-by-side consensus breakdown.
              </p>
            </div>
            <Link
              href="/"
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-mono',
                'bg-surface-200 border border-surface-300 text-surface-400',
                'hover:bg-surface-300 hover:text-white transition-colors',
              )}
            >
              Browse the feed <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </motion.div>
        )}

        {/* Half-filled state */}
        {!isLoading && (topicA || topicB) && !(topicA && topicB) && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-col items-center justify-center py-16 gap-4 text-center"
          >
            <Scale className="h-8 w-8 text-surface-600" />
            <p className="text-sm font-mono text-surface-500">
              Now search for the {topicA ? 'second' : 'first'} topic to complete the comparison.
            </p>
          </motion.div>
        )}

        {/* Full comparison view */}
        <AnimatePresence>
          {!isLoading && bothLoaded && topicA && topicB && (
            <motion.div
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.3 }}
              className="space-y-6"
            >
              {/* Head-to-head bar */}
              <HeadToHeadBar topicA={topicA} topicB={topicB} />

              {/* Side-by-side cards */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <TopicSideCard topic={topicA} side="A" />
                <TopicSideCard topic={topicB} side="B" />
              </div>

              {/* Stats table */}
              <div className="bg-surface-100 border border-surface-300 rounded-2xl p-5">
                <div className="flex items-center gap-2 mb-4">
                  <Scale className="h-4 w-4 text-surface-500" />
                  <span className="text-xs font-mono text-surface-500 uppercase tracking-wide">By the numbers</span>
                </div>

                {/* Column headers */}
                <div className="grid grid-cols-3 pb-2 mb-1 border-b border-surface-300/60">
                  <span className="text-[10px] font-mono text-for-400 text-right pr-3 uppercase tracking-wide">A</span>
                  <span className="text-[10px] font-mono text-surface-600 text-center uppercase tracking-wide">Stat</span>
                  <span className="text-[10px] font-mono text-against-400 pl-3 uppercase tracking-wide">B</span>
                </div>

                <StatRow label="Total Votes" valA={topicA.total_votes} valB={topicB.total_votes} />
                <StatRow label="Views" valA={topicA.view_count} valB={topicB.view_count} />
                <StatRow label="Support" valA={topicA.support_count} valB={topicB.support_count} />
                <StatRow label="Feed Score" valA={Math.round(topicA.feed_score)} valB={Math.round(topicB.feed_score)} />
                <StatRow
                  label="FOR %"
                  valA={Math.round(topicA.blue_pct)}
                  valB={Math.round(topicB.blue_pct)}
                  format={(v) => `${v}%`}
                />
                <StatRow
                  label="Contested"
                  valA={Math.round(Math.min(topicA.blue_pct, 100 - topicA.blue_pct))}
                  valB={Math.round(Math.min(topicB.blue_pct, 100 - topicB.blue_pct))}
                  higherIsBetter={false}
                  format={(v) => `${v}pp from 50`}
                />
              </div>

              {/* Quick actions */}
              <div className="flex items-center gap-3 flex-wrap">
                <Link
                  href={`/topic/${topicA.id}`}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-mono',
                    'bg-for-500/10 border border-for-500/30 text-for-300',
                    'hover:bg-for-500/20 transition-colors',
                  )}
                >
                  Topic A <ChevronRight className="h-3.5 w-3.5" />
                </Link>
                <Link
                  href={`/topic/${topicB.id}`}
                  className={cn(
                    'flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-mono',
                    'bg-against-500/10 border border-against-500/30 text-against-300',
                    'hover:bg-against-500/20 transition-colors',
                  )}
                >
                  Topic B <ChevronRight className="h-3.5 w-3.5" />
                </Link>
                <button
                  onClick={handleShare}
                  className={cn(
                    'ml-auto flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-mono',
                    'bg-surface-200 border border-surface-300 text-surface-400',
                    'hover:bg-surface-300 hover:text-white transition-colors',
                  )}
                >
                  {copied ? (
                    <><Check className="h-3.5 w-3.5 text-emerald" /> Link copied!</>
                  ) : (
                    <><Copy className="h-3.5 w-3.5" /> Copy link</>
                  )}
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      <BottomNav />
    </div>
  )
}

// ─── Page export with Suspense boundary ──────────────────────────────────────

export default function ComparePage() {
  return (
    <Suspense fallback={<CompareSkeleton />}>
      <ComparePageInner />
    </Suspense>
  )
}

function CompareSkeleton() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-5xl mx-auto px-4 py-8 pb-24 md:pb-12">
        <div className="mb-8 flex items-center gap-3">
          <div className="h-11 w-11 rounded-xl bg-surface-300 animate-pulse flex-shrink-0" />
          <div className="space-y-2">
            <div className="h-7 w-48 rounded bg-surface-300 animate-pulse" />
            <div className="h-4 w-72 rounded bg-surface-300 animate-pulse" />
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-8">
          {[0, 1].map((i) => (
            <div key={i} className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3">
              <div className="h-5 w-20 rounded bg-surface-300 animate-pulse" />
              <div className="h-10 w-full rounded-xl bg-surface-300 animate-pulse" />
              <div className="space-y-2">
                {[0, 1, 2].map((j) => (
                  <div key={j} className="h-14 w-full rounded-xl bg-surface-300 animate-pulse" />
                ))}
              </div>
            </div>
          ))}
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
