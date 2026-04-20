'use client'

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  Check,
  CheckCircle2,
  GitCompare,
  Loader2,
  RefreshCw,
  Search,
  Share2,
  Swords,
  ThumbsDown,
  ThumbsUp,
  Users,
  X,
  XCircle,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { CompareProfile, CompareResponse, SharedTopic, CategoryStat } from '@/app/api/users/compare/route'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SearchSuggestion {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLE_COLOR: Record<string, string> = {
  lawmaker: 'text-gold',
  senator:  'text-purple',
  debator:  'text-for-400',
  person:   'text-surface-500',
}

const ROLE_LABEL: Record<string, string> = {
  lawmaker: 'Lawmaker',
  senator:  'Senator',
  debator:  'Debator',
  person:   'Person',
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active:   'active',
  voting:   'active',
  law:      'law',
  failed:   'failed',
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M'
  if (n >= 1_000) return (n / 1_000).toFixed(1) + 'K'
  return n.toLocaleString('en-US')
}

// ─── User search input ────────────────────────────────────────────────────────

interface UserSearchInputProps {
  label: string
  value: string
  onChange: (v: string) => void
  onSelect: (username: string) => void
  accentClass: string
  disabled?: boolean
}

function UserSearchInput({ label, value, onChange, onSelect, accentClass, disabled }: UserSearchInputProps) {
  const [suggestions, setSuggestions] = useState<SearchSuggestion[]>([])
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const q = value.trim().replace(/^@/, '')
    if (q.length < 2) { setSuggestions([]); setOpen(false); return }

    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(async () => {
      setLoading(true)
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&type=people&limit=6`)
        if (res.ok) {
          const data = await res.json()
          const people: SearchSuggestion[] = (data.people ?? []).map((p: CompareProfile) => ({
            id: p.id,
            username: p.username,
            display_name: p.display_name,
            avatar_url: p.avatar_url,
            role: p.role,
          }))
          setSuggestions(people)
          setOpen(people.length > 0)
        }
      } finally {
        setLoading(false)
      }
    }, 280)
  }, [value])

  useEffect(() => {
    function handle(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [])

  function handleSelect(username: string) {
    onSelect(username)
    setOpen(false)
    setSuggestions([])
  }

  return (
    <div ref={containerRef} className="relative flex-1 min-w-0">
      <label className={cn('block text-[11px] font-mono font-semibold uppercase tracking-widest mb-1.5', accentClass)}>
        {label}
      </label>
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-500 pointer-events-none" />
        {loading && (
          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-500 animate-spin" />
        )}
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={() => suggestions.length > 0 && setOpen(true)}
          placeholder="@username"
          disabled={disabled}
          className={cn(
            'w-full pl-9 pr-9 py-2.5 rounded-xl text-sm font-mono',
            'bg-surface-200 border border-surface-300 text-white placeholder:text-surface-600',
            'focus:outline-none focus:ring-2 transition-all',
            accentClass === 'text-for-400'
              ? 'focus:ring-for-500/40 focus:border-for-500/60'
              : 'focus:ring-against-500/40 focus:border-against-500/60',
            disabled && 'opacity-50 cursor-not-allowed',
          )}
        />
      </div>

      <AnimatePresence>
        {open && suggestions.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: -4 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -4 }}
            className="absolute z-50 left-0 right-0 mt-1 rounded-xl bg-surface-200 border border-surface-300 shadow-xl overflow-hidden"
          >
            {suggestions.map((s) => (
              <button
                key={s.id}
                onClick={() => handleSelect(s.username)}
                className="w-full flex items-center gap-2.5 px-3 py-2.5 hover:bg-surface-300/60 transition-colors text-left"
              >
                <Avatar src={s.avatar_url} fallback={s.display_name || s.username} size="sm" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-white truncate">
                    {s.display_name || s.username}
                  </p>
                  <p className="text-[11px] text-surface-500">@{s.username}</p>
                </div>
                <span className={cn('ml-auto text-[10px] font-mono font-semibold flex-shrink-0', ROLE_COLOR[s.role] ?? 'text-surface-500')}>
                  {ROLE_LABEL[s.role] ?? s.role}
                </span>
              </button>
            ))}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}

// ─── Agreement meter ──────────────────────────────────────────────────────────

function AgreementMeter({ pct, agreeCount, disagreeCount }: { pct: number; agreeCount: number; disagreeCount: number }) {
  const [animated, setAnimated] = useState(false)

  useEffect(() => {
    const t = setTimeout(() => setAnimated(true), 100)
    return () => clearTimeout(t)
  }, [])

  const color =
    pct >= 70 ? { bar: 'bg-emerald', text: 'text-emerald', label: 'High Agreement' }
    : pct >= 40 ? { bar: 'bg-gold', text: 'text-gold', label: 'Moderate Agreement' }
    : { bar: 'bg-against-500', text: 'text-against-400', label: 'Low Agreement' }

  return (
    <div className="space-y-3">
      <div className="flex items-end justify-between">
        <div>
          <p className="text-[11px] font-mono text-surface-500 uppercase tracking-widest mb-0.5">
            Overall Agreement
          </p>
          <p className={cn('text-5xl font-mono font-black tabular-nums', color.text)}>
            {pct}%
          </p>
          <p className={cn('text-xs font-mono font-semibold mt-0.5', color.text)}>
            {color.label}
          </p>
        </div>
        <div className="text-right space-y-1">
          <p className="text-xs font-mono text-emerald flex items-center justify-end gap-1.5">
            <CheckCircle2 className="h-3.5 w-3.5" />
            {agreeCount} agreed
          </p>
          <p className="text-xs font-mono text-against-400 flex items-center justify-end gap-1.5">
            <XCircle className="h-3.5 w-3.5" />
            {disagreeCount} disagreed
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-3 rounded-full bg-surface-300 overflow-hidden">
        <motion.div
          className={cn('h-full rounded-full', color.bar)}
          initial={{ width: 0 }}
          animate={{ width: animated ? `${pct}%` : 0 }}
          transition={{ duration: 0.8, ease: 'easeOut', delay: 0.2 }}
        />
      </div>

      <div className="flex justify-between text-[10px] font-mono text-surface-600">
        <span>0% — Perfect Opposites</span>
        <span>100% — Mirror Minds</span>
      </div>
    </div>
  )
}

// ─── Category stats ───────────────────────────────────────────────────────────

const CAT_COLOR: Record<string, string> = {
  Economics:   '#f59e0b',
  Politics:    '#60a5fa',
  Technology:  '#8b5cf6',
  Science:     '#10b981',
  Ethics:      '#f87171',
  Philosophy:  '#a78bfa',
  Culture:     '#f472b6',
  Health:      '#2dd4bf',
  Environment: '#34d399',
  Education:   '#818cf8',
}

function CategoryBreakdown({ stats }: { stats: CategoryStat[]; userA?: CompareProfile; userB?: CompareProfile }) {
  if (stats.length === 0) return null

  return (
    <div className="space-y-2.5">
      {stats.map((s) => {
        const color = CAT_COLOR[s.category] ?? '#6b7280'
        return (
          <div key={s.category} className="flex items-center gap-3">
            <div className="w-20 flex-shrink-0">
              <span className="text-[11px] font-mono font-semibold text-surface-400 truncate block">
                {s.category}
              </span>
            </div>
            <div className="flex-1 relative h-5 rounded-full bg-surface-300 overflow-hidden">
              <motion.div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ backgroundColor: color + '66' }}
                initial={{ width: 0 }}
                animate={{ width: `${s.agree_pct}%` }}
                transition={{ duration: 0.6, ease: 'easeOut', delay: 0.1 }}
              />
              <div
                className="absolute inset-y-0 left-0 rounded-full"
                style={{ width: `${s.agree_pct}%`, backgroundColor: color + '22' }}
              />
            </div>
            <div className="w-14 flex-shrink-0 text-right">
              <span className="text-[11px] font-mono font-semibold" style={{ color }}>
                {s.agree_pct}%
              </span>
            </div>
            <div className="w-12 flex-shrink-0 text-right">
              <span className="text-[11px] font-mono text-surface-600">
                {s.shared}
              </span>
            </div>
          </div>
        )
      })}
      <div className="flex items-center gap-3 pt-1 border-t border-surface-300/60">
        <div className="w-20" />
        <div className="flex-1" />
        <div className="w-14 text-right text-[10px] font-mono text-surface-600">agree%</div>
        <div className="w-12 text-right text-[10px] font-mono text-surface-600">shared</div>
      </div>
    </div>
  )
}

// ─── Topic row ────────────────────────────────────────────────────────────────

function TopicRow({ topic }: { topic: SharedTopic; userA?: CompareProfile; userB?: CompareProfile }) {
  return (
    <Link
      href={`/topic/${topic.id}`}
      className={cn(
        'block rounded-xl border p-3.5 transition-all hover:scale-[1.005]',
        topic.agree
          ? 'bg-emerald/5 border-emerald/20 hover:border-emerald/40'
          : 'bg-against-500/5 border-against-500/20 hover:border-against-500/40',
      )}
    >
      <div className="flex items-start gap-3">
        {/* Agree/disagree icon */}
        <div
          className={cn(
            'flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-full mt-0.5',
            topic.agree ? 'bg-emerald/15' : 'bg-against-500/15',
          )}
        >
          {topic.agree ? (
            <Check className="h-3.5 w-3.5 text-emerald" />
          ) : (
            <X className="h-3.5 w-3.5 text-against-400" />
          )}
        </div>

        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-white leading-snug line-clamp-2">
            {topic.statement}
          </p>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {topic.category && (
              <span className="text-[10px] font-mono text-surface-500">{topic.category}</span>
            )}
            <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'}>
              {topic.status === 'law' ? 'LAW' : topic.status}
            </Badge>
            <span className="text-[10px] font-mono text-surface-600">
              {topic.blue_pct}% FOR · {fmtNum(topic.total_votes)} votes
            </span>
          </div>
        </div>

        {/* Side indicators */}
        <div className="flex-shrink-0 flex items-center gap-1.5">
          <div className={cn(
            'flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold',
            topic.side_a === 'blue' ? 'bg-for-500/20 text-for-400' : 'bg-against-500/20 text-against-400',
          )}>
            {topic.side_a === 'blue' ? <ThumbsUp className="h-2.5 w-2.5" /> : <ThumbsDown className="h-2.5 w-2.5" />}
          </div>
          <div className={cn(
            'flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-mono font-bold',
            topic.side_b === 'blue' ? 'bg-for-500/20 text-for-400' : 'bg-against-500/20 text-against-400',
          )}>
            {topic.side_b === 'blue' ? <ThumbsUp className="h-2.5 w-2.5" /> : <ThumbsDown className="h-2.5 w-2.5" />}
          </div>
        </div>
      </div>
    </Link>
  )
}

// ─── User card ────────────────────────────────────────────────────────────────

function UserCard({ user, accentClass, votes }: { user: CompareProfile; accentClass: string; votes?: number }) {
  return (
    <div className="flex flex-col items-center text-center gap-2">
      <Link href={`/profile/${user.username}`}>
        <Avatar
          src={user.avatar_url}
          fallback={user.display_name || user.username}
          size="lg"
          className="ring-2 ring-surface-300 hover:ring-surface-400 transition-all"
        />
      </Link>
      <div>
        <Link href={`/profile/${user.username}`} className="block font-semibold text-sm text-white hover:text-surface-200 transition-colors">
          {user.display_name || user.username}
        </Link>
        <p className={cn('text-[11px] font-mono', accentClass)}>@{user.username}</p>
      </div>
      <div className={cn('text-[10px] font-mono font-semibold uppercase tracking-wide px-2 py-0.5 rounded-full border',
        accentClass === 'text-for-400'
          ? 'border-for-500/30 bg-for-500/10 text-for-400'
          : 'border-against-500/30 bg-against-500/10 text-against-400'
      )}>
        {ROLE_LABEL[user.role] ?? user.role}
      </div>
      <div className="grid grid-cols-3 gap-3 text-center mt-1">
        <div>
          <p className="text-sm font-mono font-bold text-white">{fmtNum(votes ?? user.total_votes)}</p>
          <p className="text-[10px] font-mono text-surface-500">votes</p>
        </div>
        <div>
          <p className="text-sm font-mono font-bold text-white">{fmtNum(user.clout)}</p>
          <p className="text-[10px] font-mono text-surface-500">clout</p>
        </div>
        <div>
          <p className="text-sm font-mono font-bold text-white">{fmtNum(user.reputation_score)}</p>
          <p className="text-[10px] font-mono text-surface-500">rep</p>
        </div>
      </div>
    </div>
  )
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function CompareSkeleton() {
  return (
    <div className="space-y-6">
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6">
        <div className="grid grid-cols-2 gap-8 mb-8">
          {[0, 1].map((i) => (
            <div key={i} className="flex flex-col items-center gap-3">
              <Skeleton className="h-20 w-20 rounded-full" />
              <Skeleton className="h-4 w-24" />
              <Skeleton className="h-3 w-16" />
              <Skeleton className="h-16 w-full rounded-xl" />
            </div>
          ))}
        </div>
        <Skeleton className="h-24 w-full rounded-xl" />
      </div>
      <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-3">
        <Skeleton className="h-4 w-32" />
        {[0, 1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-5 w-full rounded-full" />
        ))}
      </div>
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

function CompareUsersInner() {
  const router = useRouter()
  const params = useSearchParams()

  const [inputA, setInputA] = useState(params.get('a') ?? '')
  const [inputB, setInputB] = useState(params.get('b') ?? '')
  const [data, setData] = useState<CompareResponse | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [showAll, setShowAll] = useState(false)
  const [copied, setCopied] = useState(false)
  const copyTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const a = params.get('a') ?? ''
  const b = params.get('b') ?? ''

  const fetchCompare = useCallback(async (ua: string, ub: string) => {
    if (!ua || !ub) return
    setLoading(true)
    setError(null)
    setData(null)
    setShowAll(false)
    try {
      const res = await fetch(`/api/users/compare?a=${encodeURIComponent(ua)}&b=${encodeURIComponent(ub)}`)
      const json = await res.json()
      if (!res.ok) {
        setError(json.error ?? 'Failed to compare users')
        return
      }
      setData(json as CompareResponse)
    } catch {
      setError('Network error — please try again')
    } finally {
      setLoading(false)
    }
  }, [])

  // Auto-fetch when URL params change
  useEffect(() => {
    if (a && b) {
      setInputA(a)
      setInputB(b)
      fetchCompare(a, b)
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [a, b])

  function handleCompare() {
    const ua = inputA.trim().replace(/^@/, '')
    const ub = inputB.trim().replace(/^@/, '')
    if (!ua || !ub) return
    router.push(`/compare-users?a=${encodeURIComponent(ua)}&b=${encodeURIComponent(ub)}`)
  }

  async function handleShare() {
    const url = window.location.href
    if (navigator.share) {
      try {
        await navigator.share({ title: 'Lobby Market — User Comparison', url })
        return
      } catch {
        // fall through
      }
    }
    await navigator.clipboard.writeText(url)
    setCopied(true)
    if (copyTimer.current) clearTimeout(copyTimer.current)
    copyTimer.current = setTimeout(() => setCopied(false), 2000)
  }

  const topicsToShow = showAll ? (data?.shared_topics ?? []) : (data?.shared_topics ?? []).slice(0, 10)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-8 pb-28 md:pb-12">

        {/* Header */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-purple/10 border border-purple/30">
              <GitCompare className="h-5 w-5 text-purple" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Compare Stances</h1>
              <p className="text-xs font-mono text-surface-500 mt-0.5">
                See how two Lobby members align on the issues
              </p>
            </div>
          </div>
        </div>

        {/* Search form */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 mb-6">
          <div className="flex items-end gap-3 mb-4">
            <UserSearchInput
              label="User A"
              value={inputA}
              onChange={setInputA}
              onSelect={(u) => setInputA(u)}
              accentClass="text-for-400"
              disabled={loading}
            />
            <div className="flex-shrink-0 pb-2.5">
              <Swords className="h-4 w-4 text-surface-500" />
            </div>
            <UserSearchInput
              label="User B"
              value={inputB}
              onChange={setInputB}
              onSelect={(u) => setInputB(u)}
              accentClass="text-against-400"
              disabled={loading}
            />
          </div>
          <button
            onClick={handleCompare}
            disabled={loading || !inputA.trim() || !inputB.trim()}
            className={cn(
              'w-full flex items-center justify-center gap-2 py-2.5 rounded-xl',
              'font-mono text-sm font-semibold transition-all',
              'bg-purple hover:bg-purple/90 text-white',
              'disabled:opacity-40 disabled:cursor-not-allowed',
            )}
          >
            {loading ? (
              <><Loader2 className="h-4 w-4 animate-spin" /> Comparing…</>
            ) : (
              <><Users className="h-4 w-4" /> Compare</>
            )}
          </button>
        </div>

        {/* Error */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              className="mb-6 rounded-xl bg-against-500/10 border border-against-500/30 p-4 text-sm font-mono text-against-400"
            >
              {error}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Loading */}
        {loading && <CompareSkeleton />}

        {/* Results */}
        <AnimatePresence>
          {data && !loading && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="space-y-5"
            >
              {/* Main card: user profiles + agreement meter */}
              <div className="rounded-2xl bg-surface-100 border border-surface-300 p-6 space-y-6">
                {/* User profiles */}
                <div className="grid grid-cols-2 gap-6">
                  <UserCard user={data.user_a} accentClass="text-for-400" votes={data.a_only_votes + data.shared_topic_count} />
                  <UserCard user={data.user_b} accentClass="text-against-400" votes={data.b_only_votes + data.shared_topic_count} />
                </div>

                <div className="border-t border-surface-300/60" />

                {/* Agreement meter */}
                {data.shared_topic_count > 0 ? (
                  <AgreementMeter
                    pct={data.agreement_pct}
                    agreeCount={data.agree_count}
                    disagreeCount={data.disagree_count}
                  />
                ) : (
                  <div className="text-center py-4">
                    <p className="text-sm font-mono text-surface-500">
                      No topics in common yet — these two haven&apos;t voted on the same debates.
                    </p>
                  </div>
                )}

                {/* Overlap stats */}
                {data.shared_topic_count > 0 && (
                  <div className="grid grid-cols-3 gap-3 text-center">
                    <div className="rounded-xl bg-surface-200 p-3">
                      <p className="text-xl font-mono font-black text-white">{data.shared_topic_count}</p>
                      <p className="text-[10px] font-mono text-surface-500 mt-0.5">shared topics</p>
                    </div>
                    <div className="rounded-xl bg-surface-200 p-3">
                      <p className="text-xl font-mono font-black text-emerald">{data.agree_count}</p>
                      <p className="text-[10px] font-mono text-surface-500 mt-0.5">agreed</p>
                    </div>
                    <div className="rounded-xl bg-surface-200 p-3">
                      <p className="text-xl font-mono font-black text-against-400">{data.disagree_count}</p>
                      <p className="text-[10px] font-mono text-surface-500 mt-0.5">disagreed</p>
                    </div>
                  </div>
                )}

                {/* Share */}
                <button
                  onClick={handleShare}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-surface-200 border border-surface-300 hover:border-surface-400 text-sm font-mono text-surface-400 hover:text-white transition-all"
                >
                  {copied ? <><Check className="h-4 w-4 text-emerald" /> Link copied!</> : <><Share2 className="h-4 w-4" /> Share comparison</>}
                </button>
              </div>

              {/* Category breakdown */}
              {data.category_stats.length > 0 && (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <h2 className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-widest">
                      Agreement by Category
                    </h2>
                  </div>
                  <CategoryBreakdown stats={data.category_stats} userA={data.user_a} userB={data.user_b} />
                </div>
              )}

              {/* Shared topics list */}
              {data.shared_topics.length > 0 && (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-widest">
                      Shared Votes
                      <span className="text-surface-600 ml-2">({data.shared_topic_count})</span>
                    </h2>
                    <div className="flex items-center gap-3">
                      <div className="flex items-center gap-1.5 text-[10px] font-mono text-surface-600">
                        <span className={cn('font-mono text-[10px]', 'text-for-400')}>
                          @{data.user_a.username}
                        </span>
                        <span className="text-surface-600">/</span>
                        <span className={cn('font-mono text-[10px]', 'text-against-400')}>
                          @{data.user_b.username}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Legend */}
                  <div className="flex items-center gap-4 mb-3">
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-emerald">
                      <CheckCircle2 className="h-3 w-3" /> Agree
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-against-400">
                      <XCircle className="h-3 w-3" /> Disagree
                    </div>
                    <div className="flex items-center gap-1.5 text-[10px] font-mono text-surface-500 ml-auto">
                      <ThumbsUp className="h-3 w-3 text-for-400" /> FOR
                      <ThumbsDown className="h-3 w-3 text-against-400 ml-1" /> AGAINST
                    </div>
                  </div>

                  <div className="space-y-2">
                    {topicsToShow.map((t) => (
                      <TopicRow key={t.id} topic={t} userA={data.user_a} userB={data.user_b} />
                    ))}
                  </div>

                  {data.shared_topics.length > 10 && (
                    <button
                      onClick={() => setShowAll((v) => !v)}
                      className="mt-3 w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-surface-200 hover:bg-surface-300 text-xs font-mono text-surface-400 hover:text-white transition-all"
                    >
                      {showAll ? (
                        <><RefreshCw className="h-3 w-3" /> Show fewer</>
                      ) : (
                        <><ArrowRight className="h-3 w-3" /> Show all {data.shared_topics.length} shared topics</>
                      )}
                    </button>
                  )}
                </div>
              )}

              {/* Unique votes summary */}
              {(data.a_only_votes > 0 || data.b_only_votes > 0) && (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
                  <h2 className="text-xs font-mono font-semibold text-surface-400 uppercase tracking-widest mb-3">
                    Unique Votes
                  </h2>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="rounded-xl bg-for-500/5 border border-for-500/20 p-3 text-center">
                      <p className="text-lg font-mono font-black text-for-400">{data.a_only_votes}</p>
                      <p className="text-[10px] font-mono text-surface-500 mt-0.5">
                        topics only @{data.user_a.username} voted on
                      </p>
                    </div>
                    <div className="rounded-xl bg-against-500/5 border border-against-500/20 p-3 text-center">
                      <p className="text-lg font-mono font-black text-against-400">{data.b_only_votes}</p>
                      <p className="text-[10px] font-mono text-surface-500 mt-0.5">
                        topics only @{data.user_b.username} voted on
                      </p>
                    </div>
                  </div>
                </div>
              )}

            </motion.div>
          )}
        </AnimatePresence>

        {/* Empty state — no search yet */}
        {!data && !loading && !error && !a && (
          <div className="text-center py-12">
            <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-purple/10 border border-purple/20 mx-auto mb-4">
              <GitCompare className="h-8 w-8 text-purple" />
            </div>
            <p className="text-sm font-mono text-surface-500 max-w-xs mx-auto">
              Enter two usernames above to compare their voting stances across debates.
            </p>
          </div>
        )}

      </main>
      <BottomNav />
    </div>
  )
}

// ─── Export ───────────────────────────────────────────────────────────────────

export default function CompareUsersPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 py-8 pb-28">
          <div className="h-12 w-48 animate-pulse rounded-xl bg-surface-300/50 mb-6" />
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 h-32 animate-pulse" />
        </main>
        <BottomNav />
      </div>
    }>
      <CompareUsersInner />
    </Suspense>
  )
}
