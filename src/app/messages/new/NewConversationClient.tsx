'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { useRouter } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import { Search, MessageSquare, X } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'
import type { DmConversation } from '@/lib/supabase/types'

interface UserResult {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function roleLabel(role: string | null): string | null {
  if (!role || role === 'citizen') return null
  return role.replace(/_/g, ' ')
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function UserRow({
  user,
  onClick,
  subtitle,
}: {
  user: { id: string; username: string; display_name: string | null; avatar_url: string | null; role?: string | null }
  onClick: () => void
  subtitle?: string
}) {
  const label = roleLabel(user.role ?? null)
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full flex items-center gap-3 px-4 py-3 hover:bg-surface-200 transition-colors text-left group"
    >
      <Avatar
        src={user.avatar_url}
        fallback={user.display_name ?? user.username}
        size="md"
        className="flex-shrink-0"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-semibold text-white truncate">
            {user.display_name ?? user.username}
          </span>
          <span className="text-xs text-surface-500">@{user.username}</span>
          {label && (
            <span className="text-[10px] font-mono text-for-400 bg-for-500/10 px-1.5 py-0.5 rounded-full capitalize">
              {label}
            </span>
          )}
        </div>
        {subtitle && (
          <p className="text-xs text-surface-500 truncate mt-0.5">{subtitle}</p>
        )}
      </div>
      <span className="text-xs font-mono text-surface-600 group-hover:text-for-400 transition-colors flex-shrink-0">
        Message →
      </span>
    </button>
  )
}

function SkeletonRows() {
  return (
    <div className="divide-y divide-surface-300/60">
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex items-center gap-3 px-4 py-3 animate-pulse">
          <div className="h-10 w-10 rounded-full bg-surface-300 flex-shrink-0" />
          <div className="flex-1 space-y-1.5">
            <div className="h-3.5 w-32 bg-surface-300 rounded" />
            <div className="h-3 w-24 bg-surface-300/60 rounded" />
          </div>
        </div>
      ))}
    </div>
  )
}

// ─── Main component ───────────────────────────────────────────────────────────

export function NewConversationClient() {
  const router = useRouter()
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<UserResult[]>([])
  const [recent, setRecent] = useState<DmConversation[]>([])
  const [searching, setSearching] = useState(false)
  const [loadingRecent, setLoadingRecent] = useState(true)
  const inputRef = useRef<HTMLInputElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  // Focus the input immediately
  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  // Load recent conversations for quick-start shortcuts
  useEffect(() => {
    async function loadRecent() {
      try {
        const res = await fetch('/api/messages')
        if (res.ok) {
          const data = await res.json()
          setRecent((data.conversations ?? []).slice(0, 5))
        }
      } finally {
        setLoadingRecent(false)
      }
    }
    loadRecent()
  }, [])

  const search = useCallback(async (q: string) => {
    if (!q.trim()) {
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    try {
      const res = await fetch(`/api/users/suggest?q=${encodeURIComponent(q.trim())}&limit=10`)
      if (res.ok) {
        const data = await res.json()
        setResults(data.results ?? [])
      }
    } catch {
      // best-effort
    } finally {
      setSearching(false)
    }
  }, [])

  const handleQueryChange = useCallback(
    (value: string) => {
      setQuery(value)
      if (debounceRef.current) clearTimeout(debounceRef.current)
      if (!value.trim()) {
        setResults([])
        setSearching(false)
        return
      }
      setSearching(true)
      debounceRef.current = setTimeout(() => search(value), 300)
    },
    [search]
  )

  const navigate = useCallback(
    (username: string) => {
      router.push(`/messages/${username}`)
    },
    [router]
  )

  const showSearch = query.trim().length > 0
  const showRecent = !showSearch

  return (
    <div className="space-y-4">
      {/* Search input */}
      <div className="relative">
        <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 pointer-events-none" />
        <input
          ref={inputRef}
          type="text"
          value={query}
          onChange={(e) => handleQueryChange(e.target.value)}
          placeholder="Search by username…"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          className={cn(
            'w-full h-11 pl-9 pr-10 rounded-xl border bg-surface-100 text-white placeholder-surface-500',
            'text-sm font-mono border-surface-300 focus:border-for-500/60 focus:outline-none focus:ring-2 focus:ring-for-500/20 transition-all'
          )}
        />
        {query && (
          <button
            type="button"
            onClick={() => handleQueryChange('')}
            aria-label="Clear search"
            className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-white transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        )}
      </div>

      {/* Results panel */}
      <div className="rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden">
        <AnimatePresence mode="wait">

          {/* ── Search results ─────────────────────────────────────────── */}
          {showSearch && (
            <motion.div
              key="search"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12 }}
            >
              <div className="px-4 py-2.5 border-b border-surface-300">
                <span className="text-[11px] font-mono text-surface-500 uppercase tracking-wider">
                  {searching ? 'Searching…' : `${results.length} result${results.length !== 1 ? 's' : ''}`}
                </span>
              </div>

              {searching ? (
                <SkeletonRows />
              ) : results.length === 0 ? (
                <div className="px-5 py-10 text-center">
                  <p className="text-sm font-mono text-surface-500">No users found for &ldquo;{query}&rdquo;</p>
                  <p className="text-xs text-surface-600 mt-1">Try a different username.</p>
                </div>
              ) : (
                <div className="divide-y divide-surface-300/60">
                  {results.map((user, idx) => (
                    <motion.div
                      key={user.id}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.03 }}
                    >
                      <UserRow user={user} onClick={() => navigate(user.username)} />
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

          {/* ── Recent conversations ───────────────────────────────── */}
          {showRecent && (
            <motion.div
              key="recent"
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.12 }}
            >
              <div className="px-4 py-2.5 border-b border-surface-300">
                <span className="text-[11px] font-mono text-surface-500 uppercase tracking-wider">
                  Recent conversations
                </span>
              </div>

              {loadingRecent ? (
                <SkeletonRows />
              ) : recent.length === 0 ? (
                <div className="py-12 px-5">
                  <EmptyState
                    icon={MessageSquare}
                    title="No recent conversations"
                    description="Search for a username above to start your first conversation."
                    size="sm"
                  />
                </div>
              ) : (
                <div className="divide-y divide-surface-300/60">
                  {recent.map((conv, idx) => (
                    <motion.div
                      key={conv.partner.id}
                      initial={{ opacity: 0, x: -4 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: idx * 0.03 }}
                    >
                      <UserRow
                        user={conv.partner}
                        onClick={() => navigate(conv.partner.username)}
                        subtitle={conv.last_message}
                      />
                    </motion.div>
                  ))}
                </div>
              )}
            </motion.div>
          )}

        </AnimatePresence>
      </div>
    </div>
  )
}
