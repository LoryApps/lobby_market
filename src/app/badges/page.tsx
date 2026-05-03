'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  Award,
  Check,
  Code2,
  Copy,
  ExternalLink,
  Loader2,
  RefreshCw,
  Search,
  Shield,
  User,
  X,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'

// ─── Types ────────────────────────────────────────────────────────────────────

interface SearchResult {
  username: string
  display_name: string | null
  role: string
  clout: number
}

// ─── Copy button ──────────────────────────────────────────────────────────────

function CopyButton({ text, label }: { text: string; label?: string }) {
  const [copied, setCopied] = useState(false)

  function handleCopy() {
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <button
      onClick={handleCopy}
      aria-label={copied ? 'Copied!' : `Copy ${label ?? 'code'}`}
      className={cn(
        'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold',
        'border transition-all focus:outline-none focus-visible:ring-2 focus-visible:ring-for-400/50',
        copied
          ? 'bg-emerald/10 border-emerald/40 text-emerald'
          : 'bg-surface-200 border-surface-300 text-surface-500 hover:text-white hover:border-surface-400'
      )}
    >
      {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
      {copied ? 'Copied!' : (label ?? 'Copy')}
    </button>
  )
}

// ─── Code block ───────────────────────────────────────────────────────────────

function CodeBlock({ code, label }: { code: string; label: string }) {
  return (
    <div className="rounded-xl border border-surface-300 overflow-hidden">
      <div className="flex items-center justify-between px-4 py-2 bg-surface-200 border-b border-surface-300">
        <span className="text-xs font-mono text-surface-500">{label}</span>
        <CopyButton text={code} label={label} />
      </div>
      <pre className="px-4 py-3 text-xs font-mono text-surface-600 overflow-x-auto bg-surface-100 leading-relaxed whitespace-pre-wrap break-all">
        {code}
      </pre>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const BASE = 'https://lobby.market'

export default function BadgesPage() {
  const [username, setUsername] = useState('')
  const [previewUsername, setPreviewUsername] = useState('')
  const [search, setSearch] = useState('')
  const [results, setResults] = useState<SearchResult[]>([])
  const [searchOpen, setSearchOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [imgLoading, setImgLoading] = useState(false)
  const [imgError, setImgError] = useState(false)
  const [myUsername, setMyUsername] = useState<string | null>(null)

  // Load current user's username
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => {
      if (!user) return
      supabase
        .from('profiles')
        .select('username')
        .eq('id', user.id)
        .maybeSingle()
        .then(({ data }) => {
          if (data?.username) {
            setMyUsername(data.username)
            if (!previewUsername) {
              setPreviewUsername(data.username)
              setUsername(data.username)
            }
          }
        })
    })
  }, [previewUsername])

  // Search users
  const searchUsers = useCallback(async (q: string) => {
    if (!q.trim() || q.length < 2) {
      setResults([])
      return
    }
    setLoading(true)
    try {
      const res = await fetch(
        `/api/search?q=${encodeURIComponent(q)}&tab=people&limit=6`,
        { cache: 'no-store' }
      )
      if (!res.ok) {
        setResults([])
        return
      }
      const data = await res.json()
      setResults((data.people ?? []) as SearchResult[])
    } catch {
      setResults([])
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timer = setTimeout(() => {
      searchUsers(search)
    }, 300)
    return () => clearTimeout(timer)
  }, [search, searchUsers])

  function selectUser(u: string) {
    setUsername(u)
    setPreviewUsername(u)
    setSearch('')
    setResults([])
    setSearchOpen(false)
    setImgError(false)
    setImgLoading(true)
  }

  function applyUsername() {
    if (username.trim()) {
      setPreviewUsername(username.trim().replace(/^@/, ''))
      setImgError(false)
      setImgLoading(true)
    }
  }

  const badgeUrl = previewUsername
    ? `${BASE}/api/badges/profile/${encodeURIComponent(previewUsername)}`
    : ''

  const markdownCode = previewUsername
    ? `[![Lobby Market Badge](${badgeUrl})](${BASE}/profile/${previewUsername})`
    : ''

  const htmlCode = previewUsername
    ? `<a href="${BASE}/profile/${previewUsername}" target="_blank" rel="noopener">\n  <img src="${badgeUrl}" alt="Lobby Market profile badge for @${previewUsername}" />\n</a>`
    : ''

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* Header */}
        <div className="mb-8">
          <Link
            href="/developers"
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors mb-4"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Developer docs
          </Link>

          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30 flex-shrink-0">
              <Shield className="h-5 w-5 text-for-400" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">
                Profile Badges
              </h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                Embed your civic identity on GitHub, your portfolio, and beyond
              </p>
            </div>
          </div>
        </div>

        {/* User selector */}
        <div className="bg-surface-100 border border-surface-300 rounded-2xl p-5 mb-6">
          <h2 className="text-sm font-mono font-semibold text-white mb-3 flex items-center gap-2">
            <User className="h-4 w-4 text-for-400" />
            Choose a profile
          </h2>

          <div className="flex gap-2 mb-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && applyUsername()}
                placeholder="Enter username..."
                className={cn(
                  'w-full h-9 px-3 rounded-lg text-sm font-mono',
                  'bg-surface-200 border border-surface-300',
                  'text-white placeholder:text-surface-500',
                  'focus:outline-none focus:border-for-500/60 focus:ring-1 focus:ring-for-500/20',
                  'transition-colors'
                )}
              />
            </div>
            <button
              onClick={applyUsername}
              className={cn(
                'px-3 h-9 rounded-lg text-sm font-mono font-semibold',
                'bg-for-600 text-white hover:bg-for-500',
                'border border-for-500/40 transition-colors',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-400/50'
              )}
            >
              Preview
            </button>
          </div>

          {/* User search */}
          <div className="relative">
            <div className="flex items-center gap-2 px-3 h-9 rounded-lg bg-surface-200 border border-surface-300 focus-within:border-surface-400 transition-colors">
              <Search className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" />
              <input
                type="text"
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setSearchOpen(true)
                }}
                onFocus={() => setSearchOpen(true)}
                placeholder="Search by username..."
                className="flex-1 bg-transparent text-sm font-mono text-white placeholder:text-surface-500 focus:outline-none"
              />
              {loading && <Loader2 className="h-3.5 w-3.5 text-surface-500 animate-spin" />}
              {search && !loading && (
                <button onClick={() => { setSearch(''); setResults([]) }} aria-label="Clear search">
                  <X className="h-3.5 w-3.5 text-surface-500 hover:text-white transition-colors" />
                </button>
              )}
            </div>

            <AnimatePresence>
              {searchOpen && results.length > 0 && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  transition={{ duration: 0.15 }}
                  className="absolute top-full mt-1 left-0 right-0 z-20 bg-surface-100 border border-surface-300 rounded-xl overflow-hidden shadow-xl"
                >
                  {results.map((r) => (
                    <button
                      key={r.username}
                      onClick={() => selectUser(r.username)}
                      className="flex items-center gap-3 w-full px-3 py-2.5 hover:bg-surface-200 transition-colors text-left"
                    >
                      <div className="flex items-center justify-center h-7 w-7 rounded-full bg-surface-300 text-xs font-bold text-white flex-shrink-0">
                        {(r.display_name || r.username)[0]?.toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate">
                          {r.display_name || r.username}
                        </p>
                        <p className="text-[10px] font-mono text-surface-500">@{r.username}</p>
                      </div>
                    </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
          </div>

          {myUsername && myUsername !== previewUsername && (
            <button
              onClick={() => selectUser(myUsername)}
              className="mt-2 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
            >
              Use my profile (@{myUsername})
            </button>
          )}
        </div>

        {/* Badge preview */}
        {previewUsername && (
          <motion.div
            key={previewUsername}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25 }}
            className="mb-6"
          >
            <div className="bg-surface-100 border border-surface-300 rounded-2xl p-5">
              <h2 className="text-sm font-mono font-semibold text-white mb-4 flex items-center gap-2">
                <Award className="h-4 w-4 text-gold" />
                Badge preview
              </h2>

              {/* Badge display area */}
              <div className="flex items-center justify-center p-8 rounded-xl bg-surface-50 border border-surface-300 mb-4 min-h-[160px]">
                {imgLoading && (
                  <div className="flex items-center gap-2 text-surface-500">
                    <Loader2 className="h-4 w-4 animate-spin" />
                    <span className="text-xs font-mono">Loading badge…</span>
                  </div>
                )}
                {imgError && (
                  <div className="flex flex-col items-center gap-2 text-surface-500">
                    <X className="h-5 w-5 text-against-400" />
                    <span className="text-xs font-mono">Badge unavailable for @{previewUsername}</span>
                  </div>
                )}
                <img
                  src={badgeUrl}
                  alt={`Lobby Market badge for @${previewUsername}`}
                  className={cn(
                    'max-w-full h-auto rounded-lg transition-opacity',
                    imgLoading || imgError ? 'hidden' : 'opacity-100'
                  )}
                  onLoad={() => { setImgLoading(false); setImgError(false) }}
                  onError={() => { setImgLoading(false); setImgError(true) }}
                  style={{ imageRendering: 'auto' }}
                />
              </div>

              {/* Direct link */}
              <div className="flex items-center justify-between gap-2 p-3 rounded-lg bg-surface-200 border border-surface-300">
                <a
                  href={badgeUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-mono text-surface-500 hover:text-for-400 transition-colors truncate flex-1"
                >
                  {badgeUrl}
                </a>
                <div className="flex items-center gap-2 flex-shrink-0">
                  <a
                    href={badgeUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label="Open badge in new tab"
                    className="flex items-center justify-center h-7 w-7 rounded-lg bg-surface-300 text-surface-500 hover:text-white transition-colors"
                  >
                    <ExternalLink className="h-3.5 w-3.5" />
                  </a>
                  <button
                    onClick={() => { setImgError(false); setImgLoading(true) }}
                    aria-label="Refresh badge preview"
                    className="flex items-center justify-center h-7 w-7 rounded-lg bg-surface-300 text-surface-500 hover:text-white transition-colors"
                  >
                    <RefreshCw className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        )}

        {/* Embed codes */}
        {previewUsername && (
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.25, delay: 0.1 }}
            className="space-y-4 mb-6"
          >
            <h2 className="text-sm font-mono font-semibold text-white flex items-center gap-2">
              <Code2 className="h-4 w-4 text-purple" />
              Embed code
            </h2>

            <CodeBlock code={markdownCode} label="Markdown (GitHub README)" />
            <CodeBlock code={htmlCode} label="HTML" />
            <CodeBlock
              code={badgeUrl}
              label="Direct SVG URL"
            />
          </motion.div>
        )}

        {/* Info section */}
        <div className="bg-surface-100 border border-surface-300 rounded-2xl p-5 space-y-3">
          <h2 className="text-sm font-mono font-semibold text-white">How it works</h2>
          <ul className="space-y-2">
            {[
              { label: 'Live data', desc: 'Badges pull fresh data on every render, cached for 5 minutes on the CDN.' },
              { label: 'SVG format', desc: 'Pure SVG — crisp at any screen density, no rasterisation artifacts.' },
              { label: 'Public profiles', desc: 'Any Lobby Market username is embeddable. The badge gracefully handles unknown users.' },
              { label: 'Stats shown', desc: 'Clout, total votes cast, reputation score, and current vote streak.' },
            ].map(({ label, desc }) => (
              <li key={label} className="flex items-start gap-2.5 text-xs font-mono">
                <Check className="h-3.5 w-3.5 text-emerald mt-0.5 flex-shrink-0" />
                <span>
                  <span className="text-white font-semibold">{label}: </span>
                  <span className="text-surface-500">{desc}</span>
                </span>
              </li>
            ))}
          </ul>
        </div>

      </main>

      <BottomNav />
    </div>
  )
}
