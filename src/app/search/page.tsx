'use client'

import { Suspense, useEffect, useRef, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import {
  Search,
  FileText,
  Scale,
  Users,
  TrendingUp,
  ArrowLeft,
  Loader2,
  Gavel,
  Zap,
  Clock,
  Tag,
  X,
  UserPlus,
  Check,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import { getTopicSignal, SIGNAL_PILL_CLASSES } from '@/lib/utils/topic-signal'

const SEARCH_SIGNAL_ICONS: Record<string, typeof TrendingUp> = {
  ending_soon:     Clock,
  brink_of_law:    Gavel,
  deadlock:        Scale,
  trending:        TrendingUp,
  gaining_support: Zap,
  strong_majority: TrendingUp,
}

// ─── Types ────────────────────────────────────────────────────────────────────

type Tab = 'topics' | 'laws' | 'people'

interface TopicResult {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  view_count: number
  created_at: string
}

interface LawResult {
  id: string
  statement: string
  full_statement: string | null
  category: string | null
  blue_pct: number | null
  total_votes: number | null
  established_at: string
}

interface PersonResult {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  reputation_score: number
}

interface SuggestedUser {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  reputation_score: number
  total_votes: number
  bio: string | null
}

interface TrendingData {
  trending: TopicResult[]
  categories: { name: string; count: number }[]
  recentLaws: { id: string; statement: string; category: string | null; established_at: string }[]
}

type SearchResult = TopicResult | LawResult | PersonResult

// ─── Config ───────────────────────────────────────────────────────────────────

const RECENT_KEY = 'lm_recent_searches'
const MAX_RECENT = 8

const tabs: { id: Tab; label: string; icon: typeof FileText }[] = [
  { id: 'topics', label: 'Topics', icon: FileText },
  { id: 'laws', label: 'Laws', icon: Scale },
  { id: 'people', label: 'People', icon: Users },
]

const statusBadge: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
  continued: 'proposed',
  archived: 'proposed',
}

const statusLabel: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
  continued: 'Continued',
  archived: 'Archived',
}

// Category → accent color mapping (matching the rest of the app)
const CATEGORY_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  Economics:   { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Politics:    { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
  Technology:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Science:     { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Ethics:      { text: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  Philosophy:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Culture:     { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Health:      { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Environment: { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Education:   { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
}

function getCategoryStyle(cat: string) {
  return CATEGORY_COLORS[cat] ?? { text: 'text-surface-500', bg: 'bg-surface-300/40', border: 'border-surface-400/40' }
}

// ─── localStorage helpers ─────────────────────────────────────────────────────

function loadRecent(): string[] {
  try {
    return JSON.parse(localStorage.getItem(RECENT_KEY) ?? '[]') as string[]
  } catch {
    return []
  }
}

function saveRecent(query: string) {
  const prev = loadRecent().filter((q) => q !== query)
  const next = [query, ...prev].slice(0, MAX_RECENT)
  localStorage.setItem(RECENT_KEY, JSON.stringify(next))
}

function removeRecent(query: string) {
  const next = loadRecent().filter((q) => q !== query)
  localStorage.setItem(RECENT_KEY, JSON.stringify(next))
}

// ─── Result rows ──────────────────────────────────────────────────────────────

function TopicRow({ item }: { item: TopicResult }) {
  const signal = getTopicSignal(item)
  return (
    <Link
      href={`/topic/${item.id}`}
      className={cn(
        'flex items-start gap-3 p-4 rounded-xl',
        'bg-surface-100 border border-surface-300',
        'hover:border-for-500/40 hover:bg-surface-100/80 transition-colors group'
      )}
    >
      <div className="flex-shrink-0 mt-0.5 h-8 w-8 rounded-lg bg-for-500/10 flex items-center justify-center">
        <FileText className="h-4 w-4 text-for-500" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white leading-snug line-clamp-2 group-hover:text-for-400 transition-colors">
          {item.statement}
        </p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {item.category && (
            <span className="text-xs text-surface-500">{item.category}</span>
          )}
          <Badge variant={statusBadge[item.status] ?? 'proposed'}>
            {statusLabel[item.status] ?? item.status}
          </Badge>
          {signal && (() => {
            const classes = SIGNAL_PILL_CLASSES[signal.color]
            const Icon = SEARCH_SIGNAL_ICONS[signal.id] ?? TrendingUp
            return (
              <span
                className={cn(
                  'inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full text-[10px] font-mono font-semibold border',
                  classes.pill,
                )}
                title={signal.description}
              >
                <span className={cn('h-1.5 w-1.5 rounded-full', classes.dot)} aria-hidden="true" />
                <Icon className="h-2.5 w-2.5" aria-hidden="true" />
                {signal.label}
              </span>
            )
          })()}
          <span className="text-xs text-surface-500">
            {item.total_votes.toLocaleString()} votes
          </span>
        </div>
      </div>
      <div className="flex-shrink-0 text-right">
        <div className="text-xs font-mono text-for-400">
          {Math.round(item.blue_pct)}%
        </div>
        <div className="text-xs text-against-400">
          {Math.round(100 - item.blue_pct)}%
        </div>
      </div>
    </Link>
  )
}

function LawRow({ item }: { item: LawResult }) {
  return (
    <Link
      href={`/law/${item.id}`}
      className={cn(
        'flex items-start gap-3 p-4 rounded-xl',
        'bg-surface-100 border border-surface-300',
        'hover:border-gold/40 hover:bg-surface-100/80 transition-colors group'
      )}
    >
      <div className="flex-shrink-0 mt-0.5 h-8 w-8 rounded-lg bg-gold/10 flex items-center justify-center">
        <Scale className="h-4 w-4 text-gold" />
      </div>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-white leading-snug line-clamp-2 group-hover:text-gold transition-colors">
          {item.statement}
        </p>
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {item.category && (
            <span className="text-xs text-surface-500">{item.category}</span>
          )}
          <Badge variant="law">LAW</Badge>
          {item.total_votes != null && (
            <span className="text-xs text-surface-500">
              {item.total_votes.toLocaleString()} votes
            </span>
          )}
        </div>
      </div>
    </Link>
  )
}

function PersonRow({ item }: { item: PersonResult }) {
  return (
    <Link
      href={`/profile/${item.username}`}
      className={cn(
        'flex items-center gap-3 p-4 rounded-xl',
        'bg-surface-100 border border-surface-300',
        'hover:border-surface-400 hover:bg-surface-100/80 transition-colors group'
      )}
    >
      <Avatar
        src={item.avatar_url}
        fallback={item.display_name || item.username}
        size="md"
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-white group-hover:text-for-400 transition-colors">
          {item.display_name || item.username}
        </p>
        <p className="text-xs text-surface-500">@{item.username}</p>
      </div>
      <div className="flex-shrink-0 flex flex-col items-end gap-1">
        <Badge variant={item.role as 'person' | 'debator' | 'troll_catcher' | 'elder'}>
          {item.role}
        </Badge>
        <div className="flex items-center gap-1 text-xs text-gold">
          <TrendingUp className="h-3 w-3" />
          <span>{item.clout.toLocaleString()}</span>
        </div>
      </div>
    </Link>
  )
}

// ─── Suggested person card (with inline follow button) ───────────────────────

function SuggestPersonCard({ user }: { user: SuggestedUser }) {
  const [following, setFollowing] = useState(false)
  const [loading, setLoading] = useState(false)

  async function handleFollow(e: React.MouseEvent) {
    e.preventDefault()
    e.stopPropagation()
    if (loading) return
    setLoading(true)
    try {
      if (following) {
        await fetch('/api/follow', {
          method: 'DELETE',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target_id: user.id }),
        })
        setFollowing(false)
      } else {
        await fetch('/api/follow', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ target_id: user.id }),
        })
        setFollowing(true)
      }
    } catch {
      // best-effort
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex items-center gap-3 p-3.5 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors group">
      <Link href={`/profile/${user.username}`} className="flex items-center gap-3 flex-1 min-w-0">
        <Avatar
          src={user.avatar_url}
          fallback={user.display_name || user.username}
          size="md"
        />
        <div className="flex-1 min-w-0">
          <p className="text-sm font-semibold text-white group-hover:text-for-400 transition-colors truncate">
            {user.display_name || user.username}
          </p>
          <div className="flex items-center gap-2 mt-0.5">
            <p className="text-xs text-surface-500">@{user.username}</p>
            <span className="text-surface-600 text-xs">·</span>
            <div className="flex items-center gap-1 text-xs text-gold">
              <TrendingUp className="h-2.5 w-2.5" />
              <span>{user.clout.toLocaleString()}</span>
            </div>
          </div>
          {user.bio && (
            <p className="text-xs text-surface-500 mt-0.5 line-clamp-1">{user.bio}</p>
          )}
        </div>
      </Link>
      <button
        onClick={handleFollow}
        disabled={loading}
        aria-label={following ? `Unfollow @${user.username}` : `Follow @${user.username}`}
        className={cn(
          'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold',
          'border transition-all duration-150 disabled:opacity-50',
          following
            ? 'bg-for-600/20 border-for-600/50 text-for-400 hover:bg-against-500/10 hover:border-against-500/40 hover:text-against-400'
            : 'bg-surface-300 border-surface-400 text-white hover:bg-for-600 hover:border-for-600'
        )}
      >
        {loading ? (
          <Loader2 className="h-3 w-3 animate-spin" />
        ) : following ? (
          <>
            <Check className="h-3 w-3" />
            Following
          </>
        ) : (
          <>
            <UserPlus className="h-3 w-3" />
            Follow
          </>
        )}
      </button>
    </div>
  )
}

// ─── Discovery panel (shown when query is empty) ──────────────────────────────

function DiscoveryPanelSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-4 w-28" />
        <div className="flex flex-wrap gap-2">
          {[1, 2, 3, 4, 5, 6].map((i) => (
            <Skeleton key={i} className="h-7 w-20 rounded-full" />
          ))}
        </div>
      </div>
      <div className="space-y-2">
        <Skeleton className="h-4 w-32" />
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-16 w-full rounded-xl" />
        ))}
      </div>
    </div>
  )
}

function DiscoveryPanel({
  data,
  suggestedPeople,
  recentSearches,
  onQuery,
  onRemoveRecent,
}: {
  data: TrendingData | null
  suggestedPeople: SuggestedUser[]
  recentSearches: string[]
  onQuery: (q: string) => void
  onRemoveRecent: (q: string) => void
}) {
  if (!data) return <DiscoveryPanelSkeleton />

  return (
    <div className="space-y-7">
      {/* Recent searches */}
      {recentSearches.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-2.5">
            <Clock className="h-3.5 w-3.5 text-surface-500" />
            <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider">
              Recent
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {recentSearches.map((q) => (
              <div key={q} className="flex items-center gap-1 group">
                <button
                  onClick={() => onQuery(q)}
                  className={cn(
                    'flex items-center gap-1.5 pl-3 pr-2 py-1.5 rounded-lg',
                    'bg-surface-200 border border-surface-300 text-sm text-surface-700',
                    'hover:bg-surface-300 hover:text-white transition-colors'
                  )}
                >
                  <Search className="h-3 w-3 text-surface-500 flex-shrink-0" />
                  <span className="font-mono text-xs">{q}</span>
                </button>
                <button
                  onClick={() => onRemoveRecent(q)}
                  aria-label={`Remove "${q}" from recent searches`}
                  className="h-5 w-5 rounded flex items-center justify-center text-surface-600 hover:text-white transition-colors opacity-0 group-hover:opacity-100"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Browse by category */}
      {data.categories.length > 0 && (
        <section>
          <div className="flex items-center gap-2 mb-2.5">
            <Tag className="h-3.5 w-3.5 text-surface-500" />
            <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider">
              Browse Categories
            </h2>
          </div>
          <div className="flex flex-wrap gap-2">
            {data.categories.map(({ name, count }) => {
              const style = getCategoryStyle(name)
              return (
                <Link
                  key={name}
                  href={`/?category=${encodeURIComponent(name)}`}
                  className={cn(
                    'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-medium',
                    'border transition-colors hover:opacity-80',
                    style.text, style.bg, style.border
                  )}
                >
                  {name}
                  <span className="opacity-60">· {count}</span>
                </Link>
              )
            })}
          </div>
        </section>
      )}

      {/* Trending topics */}
      {data.trending.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <Zap className="h-3.5 w-3.5 text-for-400" />
              <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider">
                Trending Now
              </h2>
            </div>
            <Link
              href="/trending"
              className="text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
            >
              See all →
            </Link>
          </div>
          <div className="space-y-2">
            {data.trending.map((topic) => (
              <Link
                key={topic.id}
                href={`/topic/${topic.id}`}
                className={cn(
                  'flex items-start gap-3 p-3.5 rounded-xl group',
                  'bg-surface-100 border border-surface-300',
                  'hover:border-for-500/40 hover:bg-surface-100/80 transition-colors'
                )}
              >
                <div className="flex-shrink-0 mt-0.5">
                  <div
                    className={cn(
                      'h-7 w-7 rounded-lg flex items-center justify-center',
                      topic.status === 'voting' ? 'bg-purple/10' : 'bg-for-500/10'
                    )}
                  >
                    {topic.status === 'voting' ? (
                      <Scale className="h-3.5 w-3.5 text-purple" />
                    ) : (
                      <Zap className="h-3.5 w-3.5 text-for-400" />
                    )}
                  </div>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white line-clamp-2 leading-snug group-hover:text-for-400 transition-colors">
                    {topic.statement}
                  </p>
                  <div className="flex items-center gap-2 mt-1">
                    {topic.category && (
                      <span className="text-xs text-surface-500">{topic.category}</span>
                    )}
                    <span className="text-xs text-surface-500">
                      {topic.total_votes.toLocaleString()} votes
                    </span>
                  </div>
                </div>
                {/* Mini vote bar */}
                <div className="flex-shrink-0 w-12 space-y-0.5">
                  <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
                    <div
                      className="h-full bg-for-500 rounded-full"
                      style={{ width: `${Math.round(topic.blue_pct)}%` }}
                    />
                  </div>
                  <div className="flex justify-between text-[10px] font-mono">
                    <span className="text-for-400">{Math.round(topic.blue_pct)}%</span>
                    <span className="text-against-400">{Math.round(100 - topic.blue_pct)}%</span>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Recently established laws */}
      {data.recentLaws.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <Gavel className="h-3.5 w-3.5 text-gold" />
              <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider">
                Recent Laws
              </h2>
            </div>
            <Link
              href="/law"
              className="text-xs font-mono text-gold hover:text-amber-300 transition-colors"
            >
              Codex →
            </Link>
          </div>
          <div className="space-y-2">
            {data.recentLaws.map((law) => (
              <Link
                key={law.id}
                href={`/law/${law.id}`}
                className={cn(
                  'flex items-start gap-3 p-3.5 rounded-xl group',
                  'bg-surface-100 border border-gold/20',
                  'hover:border-gold/50 hover:bg-surface-100/80 transition-colors'
                )}
              >
                <div className="flex-shrink-0 mt-0.5 h-7 w-7 rounded-lg bg-gold/10 flex items-center justify-center">
                  <Gavel className="h-3.5 w-3.5 text-gold" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white line-clamp-2 leading-snug group-hover:text-gold transition-colors">
                    {law.statement}
                  </p>
                  {law.category && (
                    <span className="text-xs text-surface-500 mt-0.5 block">{law.category}</span>
                  )}
                </div>
              </Link>
            ))}
          </div>
        </section>
      )}

      {/* Suggested people to follow */}
      {suggestedPeople.length > 0 && (
        <section>
          <div className="flex items-center justify-between mb-2.5">
            <div className="flex items-center gap-2">
              <Users className="h-3.5 w-3.5 text-purple" />
              <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider">
                People to Follow
              </h2>
            </div>
            <Link
              href="/search?tab=people"
              className="text-xs font-mono text-purple hover:text-purple/80 transition-colors"
            >
              See all →
            </Link>
          </div>
          <div className="space-y-2">
            {suggestedPeople.map((u) => (
              <SuggestPersonCard key={u.id} user={u} />
            ))}
          </div>
        </section>
      )}

      {/* Empty discovery state (DB not seeded) */}
      {data.trending.length === 0 && data.recentLaws.length === 0 && data.categories.length === 0 && suggestedPeople.length === 0 && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <div className="h-12 w-12 rounded-xl bg-surface-200 flex items-center justify-center mb-4">
            <Search className="h-5 w-5 text-surface-500" />
          </div>
          <p className="text-surface-500 text-sm">Start typing to search topics, laws, and people.</p>
        </div>
      )}
    </div>
  )
}

// ─── Empty results state ──────────────────────────────────────────────────────

function EmptyState({ query, tab }: { query: string; tab: Tab }) {
  const messages: Record<Tab, string> = {
    topics: 'No topics match your search.',
    laws: 'No laws match your search.',
    people: 'No people match your search.',
  }
  return (
    <div className="flex flex-col items-center justify-center py-16 px-4 text-center">
      <div className="h-12 w-12 rounded-xl bg-surface-200 flex items-center justify-center mb-4">
        <Search className="h-5 w-5 text-surface-500" />
      </div>
      <p className="text-surface-500 text-sm">
        {query.length > 0 ? messages[tab] : 'Start typing to search.'}
      </p>
      {query.length > 0 && (
        <p className="text-surface-600 text-xs mt-1">
          Try a shorter or different keyword.
        </p>
      )}
    </div>
  )
}

// ─── Main search content (inside Suspense) ────────────────────────────────────

function SearchContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialQ = searchParams.get('q') ?? ''
  const initialTab = (searchParams.get('tab') as Tab | null) ?? 'topics'

  const [query, setQuery] = useState(initialQ)
  const [activeTab, setActiveTab] = useState<Tab>(initialTab)
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const [discoveryData, setDiscoveryData] = useState<TrendingData | null>(null)
  const [suggestedPeople, setSuggestedPeople] = useState<SuggestedUser[]>([])
  const [recentSearches, setRecentSearches] = useState<string[]>([])
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Load recent searches from localStorage and fetch discovery data on mount
  useEffect(() => {
    setRecentSearches(loadRecent())

    Promise.all([
      fetch('/api/search/trending').then((r) => (r.ok ? r.json() : null)),
      fetch('/api/users/suggestions?limit=6').then((r) => (r.ok ? r.json() : null)),
    ])
      .then(([trending, suggestions]) => {
        if (trending) setDiscoveryData(trending as TrendingData)
        if (suggestions?.suggestions) setSuggestedPeople(suggestions.suggestions as SuggestedUser[])
      })
      .catch(() => {})
  }, [])

  const fetchResults = useCallback(async (q: string, tab: Tab) => {
    if (q.trim().length < 2) {
      setResults([])
      return
    }
    setLoading(true)
    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(q.trim())}&tab=${tab}`
      )
      if (res.ok) {
        const { results: data } = await res.json()
        setResults(data ?? [])
      }
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  // Debounce search + sync URL
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchResults(query, activeTab)
      const params = new URLSearchParams()
      if (query.trim()) params.set('q', query.trim())
      params.set('tab', activeTab)
      router.replace(`/search?${params.toString()}`, { scroll: false })
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, activeTab, fetchResults, router])

  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab)
    setResults([])
  }

  // Save to recent when query is committed (blur or Enter)
  const commitQuery = useCallback(() => {
    const q = query.trim()
    if (q.length >= 2) {
      saveRecent(q)
      setRecentSearches(loadRecent())
    }
  }, [query])

  const handleRemoveRecent = (q: string) => {
    removeRecent(q)
    setRecentSearches(loadRecent())
  }

  const handleRecentClick = (q: string) => {
    setQuery(q)
    inputRef.current?.focus()
  }

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const showDiscovery = query.trim().length < 2

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <button
            onClick={() => router.back()}
            className="flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors flex-shrink-0"
            aria-label="Go back"
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 pointer-events-none" aria-hidden="true" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onBlur={commitQuery}
              onKeyDown={(e) => { if (e.key === 'Enter') { commitQuery(); inputRef.current?.blur() } }}
              placeholder="Search topics, laws, people..."
              aria-label="Search"
              className={cn(
                'w-full h-10 pl-9 pr-4 rounded-xl',
                'bg-surface-200 border border-surface-300',
                'text-sm text-white placeholder:text-surface-500',
                'focus:outline-none focus:border-for-500/60 focus:ring-1 focus:ring-for-500/20',
                'transition-colors'
              )}
            />
            {loading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 animate-spin" aria-hidden="true" />
            )}
            {!loading && query.length > 0 && (
              <button
                onClick={() => setQuery('')}
                aria-label="Clear search"
                className="absolute right-3 top-1/2 -translate-y-1/2 h-5 w-5 rounded flex items-center justify-center text-surface-500 hover:text-white transition-colors"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>
        </div>

        {/* Tabs — only show when a query is active */}
        {!showDiscovery && (
          <div className="flex gap-1 p-1 bg-surface-200 rounded-xl mb-6" role="tablist" aria-label="Search categories">
            {tabs.map((tab) => {
              const Icon = tab.icon
              return (
                <button
                  key={tab.id}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  onClick={() => handleTabChange(tab.id)}
                  className={cn(
                    'flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg text-sm font-medium transition-colors',
                    activeTab === tab.id
                      ? 'bg-surface-100 text-white shadow-sm'
                      : 'text-surface-500 hover:text-surface-700'
                  )}
                >
                  <Icon className="h-3.5 w-3.5" aria-hidden="true" />
                  {tab.label}
                </button>
              )
            })}
          </div>
        )}

        {/* Content */}
        {showDiscovery ? (
          <DiscoveryPanel
            data={discoveryData}
            suggestedPeople={suggestedPeople}
            recentSearches={recentSearches}
            onQuery={handleRecentClick}
            onRemoveRecent={handleRemoveRecent}
          />
        ) : (
          <div className="space-y-2" role="feed" aria-label="Search results" aria-busy={loading}>
            {results.length === 0 && !loading ? (
              <EmptyState query={query} tab={activeTab} />
            ) : (
              results.map((item) => {
                if (activeTab === 'topics') {
                  return <TopicRow key={item.id} item={item as TopicResult} />
                }
                if (activeTab === 'laws') {
                  return <LawRow key={item.id} item={item as LawResult} />
                }
                return <PersonRow key={item.id} item={item as PersonResult} />
              })
            )}
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SearchPage() {
  return (
    <Suspense
      fallback={
        <div className="min-h-screen bg-surface-50">
          <TopBar />
          <div className="flex items-center justify-center pt-32">
            <Loader2 className="h-6 w-6 text-surface-500 animate-spin" />
          </div>
          <BottomNav />
        </div>
      }
    >
      <SearchContent />
    </Suspense>
  )
}
