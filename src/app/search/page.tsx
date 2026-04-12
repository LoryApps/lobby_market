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
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'

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

type SearchResult = TopicResult | LawResult | PersonResult

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

function TopicRow({ item }: { item: TopicResult }) {
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

function SearchContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const initialQ = searchParams.get('q') ?? ''
  const initialTab = (searchParams.get('tab') as Tab | null) ?? 'topics'

  const [query, setQuery] = useState(initialQ)
  const [activeTab, setActiveTab] = useState<Tab>(initialTab)
  const [results, setResults] = useState<SearchResult[]>([])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

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

  // Debounce search as user types
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    debounceRef.current = setTimeout(() => {
      fetchResults(query, activeTab)
      // Sync URL without hard navigation
      const params = new URLSearchParams()
      if (query.trim()) params.set('q', query.trim())
      params.set('tab', activeTab)
      router.replace(`/search?${params.toString()}`, { scroll: false })
    }, 300)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, activeTab, fetchResults, router])

  // Refetch when tab changes
  const handleTabChange = (tab: Tab) => {
    setActiveTab(tab)
    setResults([])
  }

  // Auto-focus on mount
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

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
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 pointer-events-none" />
            <input
              ref={inputRef}
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search topics, laws, people..."
              className={cn(
                'w-full h-10 pl-9 pr-4 rounded-xl',
                'bg-surface-200 border border-surface-300',
                'text-sm text-white placeholder:text-surface-500',
                'focus:outline-none focus:border-for-500/60 focus:ring-1 focus:ring-for-500/20',
                'transition-colors'
              )}
            />
            {loading && (
              <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 animate-spin" />
            )}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-1 p-1 bg-surface-200 rounded-xl mb-6">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                className={cn(
                  'flex-1 flex items-center justify-center gap-1.5 h-9 rounded-lg text-sm font-medium transition-colors',
                  activeTab === tab.id
                    ? 'bg-surface-100 text-white shadow-sm'
                    : 'text-surface-500 hover:text-surface-700'
                )}
              >
                <Icon className="h-3.5 w-3.5" />
                {tab.label}
              </button>
            )
          })}
        </div>

        {/* Results */}
        <div className="space-y-2">
          {results.length === 0 ? (
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
      </main>
      <BottomNav />
    </div>
  )
}

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
