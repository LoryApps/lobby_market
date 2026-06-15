'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Check,
  Code2,
  Copy,
  ExternalLink,
  Loader2,
  Search,
  Share2,
  Sparkles,
  X,
  Zap,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils/cn'
import { createClient } from '@/lib/supabase/client'

// ─── Types ────────────────────────────────────────────────────────────────────

type BadgeStyle = 'default' | 'minimal' | 'compact'

interface SearchResult {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  clout: number
  total_votes: number
}

// ─── Style options ─────────────────────────────────────────────────────────────

const STYLE_OPTIONS: { id: BadgeStyle; label: string; description: string }[] = [
  { id: 'default', label: 'Full Card', description: 'All stats — votes, arguments, clout, streak, rep' },
  { id: 'minimal', label: 'Minimal', description: 'Name, role, votes, and clout in a clean strip' },
  { id: 'compact', label: 'Compact', description: 'Shields.io-style inline badge for markdown' },
]

// ─── Role label ───────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  person: 'Citizen',
  debator: 'Debator',
  troll_catcher: 'Troll Catcher',
  elder: 'Elder',
}

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ value, label }: { value: string; label: string }) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(value)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch {
      // best-effort
    }
  }

  return (
    <button
      onClick={copy}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold',
        'border transition-all',
        copied
          ? 'bg-emerald/20 border-emerald/50 text-emerald'
          : 'bg-surface-200 border-surface-300 text-surface-600 hover:border-surface-400 hover:text-white'
      )}
      aria-label={`Copy ${label}`}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied!' : `Copy ${label}`}
    </button>
  )
}

// ─── Embed code box ───────────────────────────────────────────────────────────

function EmbedBox({
  username,
  badgeUrl,
}: {
  username: string
  badgeUrl: string
}) {
  const profileUrl = `https://lobby.market/profile/${username}`
  const markdown = `[![Lobby Market Civic Badge](${badgeUrl})](${profileUrl})`
  const html = `<a href="${profileUrl}"><img src="${badgeUrl}" alt="Lobby Market civic badge for @${username}" /></a>`

  return (
    <div className="space-y-3">
      {/* Markdown embed */}
      <div className="rounded-xl bg-surface-200/60 border border-surface-300/60 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-surface-300/60">
          <span className="text-xs font-mono font-semibold text-surface-600">Markdown</span>
          <CopyButton value={markdown} label="Markdown" />
        </div>
        <pre className="px-3 py-2.5 text-xs font-mono text-surface-600 overflow-x-auto whitespace-pre-wrap break-all">
          {markdown}
        </pre>
      </div>

      {/* HTML embed */}
      <div className="rounded-xl bg-surface-200/60 border border-surface-300/60 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-surface-300/60">
          <span className="text-xs font-mono font-semibold text-surface-600">HTML</span>
          <CopyButton value={html} label="HTML" />
        </div>
        <pre className="px-3 py-2.5 text-xs font-mono text-surface-600 overflow-x-auto whitespace-pre-wrap break-all">
          {html}
        </pre>
      </div>

      {/* Direct URL */}
      <div className="rounded-xl bg-surface-200/60 border border-surface-300/60 overflow-hidden">
        <div className="flex items-center justify-between px-3 py-2 border-b border-surface-300/60">
          <span className="text-xs font-mono font-semibold text-surface-600">Direct URL</span>
          <CopyButton value={badgeUrl} label="URL" />
        </div>
        <pre className="px-3 py-2.5 text-xs font-mono text-surface-600 overflow-x-auto whitespace-pre-wrap break-all">
          {badgeUrl}
        </pre>
      </div>
    </div>
  )
}

// ─── Main component ────────────────────────────────────────────────────────────

export function BadgeClient() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<SearchResult | null>(null)
  const [style, setStyle] = useState<BadgeStyle>('default')
  const [badgeLoaded, setBadgeLoaded] = useState(false)
  const [badgeError, setBadgeError] = useState(false)
  const [currentUser, setCurrentUser] = useState<string | null>(null)

  // Pre-fill with the logged-in user
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from('profiles')
        .select('username, display_name, avatar_url, role, clout, total_votes')
        .eq('id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data) {
            setCurrentUser(data.username)
            setSelected(data as SearchResult)
          }
        })
    })
  }, [])

  // Debounced search
  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) { setResults([]); return }
    setSearching(true)
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}&tab=people&limit=6`)
      if (!res.ok) return
      const data = await res.json() as { people?: SearchResult[] }
      setResults(data.people ?? [])
    } catch {
      // best-effort
    } finally {
      setSearching(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => search(query), 300)
    return () => clearTimeout(timer)
  }, [query, search])

  function select(user: SearchResult) {
    setSelected(user)
    setQuery('')
    setResults([])
    setBadgeLoaded(false)
    setBadgeError(false)
  }

  function clear() {
    setSelected(null)
    setQuery('')
    setBadgeLoaded(false)
    setBadgeError(false)
  }

  const badgeUrl = selected
    ? `https://lobby.market/api/badge/${selected.username}${style !== 'default' ? `?style=${style}` : ''}`
    : null

  const previewUrl = selected
    ? `/api/badge/${selected.username}${style !== 'default' ? `?style=${style}` : ''}`
    : null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link
            href="/explore"
            className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200/60 border border-surface-300/60 hover:border-surface-400/60 transition-colors"
            aria-label="Back to Explore"
          >
            <ArrowLeft className="h-4 w-4 text-surface-600" aria-hidden="true" />
          </Link>
          <div>
            <h1 className="text-lg font-bold text-white flex items-center gap-2">
              <Share2 className="h-5 w-5 text-for-400" aria-hidden="true" />
              Civic Badge
            </h1>
            <p className="text-xs text-surface-500 mt-0.5">
              Embed your civic stats in READMEs, forums, and social bios
            </p>
          </div>
        </div>

        {/* User search */}
        <div className="mb-6 space-y-3">
          <label className="block text-xs font-semibold text-surface-600 uppercase tracking-wider">
            Citizen
          </label>

          {selected ? (
            <div className="flex items-center gap-3 p-3 rounded-xl bg-surface-200/60 border border-surface-300/60">
              <Avatar
                src={selected.avatar_url}
                fallback={selected.display_name || selected.username}
                size="sm"
              />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-white truncate">
                  {selected.display_name || selected.username}
                </p>
                <p className="text-xs text-surface-500 truncate">
                  @{selected.username} · {ROLE_LABEL[selected.role] ?? 'Citizen'}
                </p>
              </div>
              <button
                onClick={clear}
                aria-label="Clear selection"
                className="h-7 w-7 flex items-center justify-center rounded-lg bg-surface-300/60 hover:bg-surface-400/60 transition-colors"
              >
                <X className="h-3.5 w-3.5 text-surface-500" aria-hidden="true" />
              </button>
            </div>
          ) : (
            <div className="relative">
              <div className="absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none">
                {searching
                  ? <Loader2 className="h-4 w-4 text-surface-500 animate-spin" aria-hidden="true" />
                  : <Search className="h-4 w-4 text-surface-500" aria-hidden="true" />
                }
              </div>
              <input
                type="search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by username…"
                aria-label="Search for a citizen"
                className="w-full h-10 pl-9 pr-4 rounded-xl bg-surface-200/60 border border-surface-300/60 text-sm text-white placeholder:text-surface-500 focus:outline-none focus:border-for-500/60 focus:ring-1 focus:ring-for-500/30 transition-colors"
              />

              <AnimatePresence>
                {results.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: -4 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -4 }}
                    className="absolute top-full mt-1 left-0 right-0 rounded-xl bg-surface-200 border border-surface-300 shadow-xl shadow-black/30 z-20 overflow-hidden"
                  >
                    {results.map((user) => (
                      <button
                        key={user.id}
                        onClick={() => select(user)}
                        className="w-full flex items-center gap-2.5 px-3 py-2 hover:bg-surface-300/60 transition-colors text-left"
                      >
                        <Avatar
                          src={user.avatar_url}
                          fallback={user.display_name || user.username}
                          size="xs"
                        />
                        <div className="min-w-0 flex-1">
                          <span className="text-xs font-semibold text-white block truncate">
                            {user.display_name || user.username}
                          </span>
                          <span className="text-[11px] text-surface-500 block truncate">
                            @{user.username}
                          </span>
                        </div>
                        <span className="text-[11px] font-mono text-surface-500 flex-shrink-0">
                          {ROLE_LABEL[user.role] ?? 'Citizen'}
                        </span>
                      </button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          )}

          {/* Quick: use my own badge */}
          {!selected && currentUser && (
            <p className="text-xs text-surface-500">
              Or{' '}
              <button
                onClick={async () => {
                  const supabase = createClient()
                  const { data } = await supabase
                    .from('profiles')
                    .select('username, display_name, avatar_url, role, clout, total_votes')
                    .eq('username', currentUser)
                    .maybeSingle()
                  if (data) select(data as SearchResult)
                }}
                className="text-for-400 hover:text-for-300 transition-colors"
              >
                generate your own badge
              </button>
            </p>
          )}
        </div>

        {/* Style picker */}
        <div className="mb-6 space-y-3">
          <label className="block text-xs font-semibold text-surface-600 uppercase tracking-wider">
            Style
          </label>
          <div className="grid grid-cols-3 gap-2">
            {STYLE_OPTIONS.map((opt) => (
              <button
                key={opt.id}
                onClick={() => {
                  setStyle(opt.id)
                  setBadgeLoaded(false)
                  setBadgeError(false)
                }}
                aria-pressed={style === opt.id}
                className={cn(
                  'p-3 rounded-xl border text-left transition-all',
                  style === opt.id
                    ? 'bg-for-500/15 border-for-500/50 ring-1 ring-for-500/30'
                    : 'bg-surface-200/60 border-surface-300/60 hover:border-surface-400/60'
                )}
              >
                <p className={cn('text-xs font-semibold', style === opt.id ? 'text-for-300' : 'text-white')}>
                  {opt.label}
                </p>
                <p className="text-[11px] text-surface-500 mt-0.5 leading-tight">
                  {opt.description}
                </p>
              </button>
            ))}
          </div>
        </div>

        {/* Preview */}
        <div className="mb-6">
          <label className="block text-xs font-semibold text-surface-600 uppercase tracking-wider mb-3">
            Preview
          </label>
          <div className="rounded-xl bg-surface-200/40 border border-surface-300/60 p-6 flex items-center justify-center min-h-[160px]">
            {!selected ? (
              <div className="text-center">
                <Sparkles className="h-8 w-8 text-surface-400 mx-auto mb-2" aria-hidden="true" />
                <p className="text-sm text-surface-500">Search for a citizen to preview their badge</p>
              </div>
            ) : badgeError ? (
              <div className="text-center">
                <p className="text-sm text-surface-500">Could not load badge preview</p>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-3">
                {!badgeLoaded && (
                  <Loader2 className="h-5 w-5 text-surface-500 animate-spin" aria-label="Loading badge preview" />
                )}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  key={`${selected.username}-${style}`}
                  src={previewUrl!}
                  alt={`Civic badge for @${selected.username}`}
                  style={{ display: badgeLoaded ? 'block' : 'none' }}
                  onLoad={() => setBadgeLoaded(true)}
                  onError={() => setBadgeError(true)}
                  className={cn(
                    'max-w-full rounded-lg transition-opacity',
                    badgeLoaded ? 'opacity-100' : 'opacity-0'
                  )}
                />
                {badgeLoaded && (
                  <a
                    href={previewUrl!}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-surface-500 hover:text-surface-700 transition-colors"
                  >
                    <ExternalLink className="h-3 w-3" aria-hidden="true" />
                    Open raw SVG
                  </a>
                )}
              </div>
            )}
          </div>
        </div>

        {/* Embed code */}
        {selected && badgeUrl && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            className="mb-6"
          >
            <label className="block text-xs font-semibold text-surface-600 uppercase tracking-wider mb-3">
              Embed Code
            </label>
            <EmbedBox username={selected.username} badgeUrl={badgeUrl} />
          </motion.div>
        )}

        {/* Tips */}
        <div className="rounded-xl bg-surface-200/40 border border-surface-300/60 p-4 space-y-2">
          <p className="text-xs font-semibold text-surface-600 uppercase tracking-wider">Where to use it</p>
          <ul className="space-y-1.5">
            {[
              { icon: Code2, text: 'GitHub README.md — paste the Markdown embed in your profile README' },
              { icon: Zap, text: 'Forum signatures — use the HTML embed in your forum profile' },
              { icon: Share2, text: 'Social bios — link directly to your badge URL in your social bio' },
            ].map(({ icon: Icon, text }, i) => (
              <li key={i} className="flex items-start gap-2">
                <Icon className="h-3.5 w-3.5 text-surface-500 flex-shrink-0 mt-0.5" aria-hidden="true" />
                <span className="text-xs text-surface-500">{text}</span>
              </li>
            ))}
          </ul>
          <p className="text-[11px] text-surface-400 pt-1">
            Badges auto-update — clout, votes, and streak are refreshed every hour.
          </p>
        </div>

        {/* Link to profile */}
        {selected && (
          <div className="mt-4 text-center">
            <Link
              href={`/profile/${selected.username}`}
              className="text-xs text-for-400 hover:text-for-300 transition-colors"
            >
              View @{selected.username}&apos;s full civic profile →
            </Link>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
