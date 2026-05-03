'use client'

import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AtSign,
  BarChart2,
  Calendar,
  Check,
  Code2,
  GitCompare,
  Globe,
  Loader2,
  MessageSquare,
  Search,
  Settings,
  Share2,
  Swords,
  UserCheck,
  UserMinus,
  UserPlus,
  X,
} from 'lucide-react'
import Link from 'next/link'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { GiftCloutButton } from '@/components/clout/GiftCloutButton'
import { RoleBadge, getRoleRingClass } from './RoleBadge'
import { FollowersModal, type FollowTab } from './FollowersModal'
import { AlignmentBadge } from './AlignmentBadge'
import { ARCHETYPE_CONFIG, type ArchetypeId } from '@/lib/config/archetypes'

// ── Inline bio markdown renderer ──────────────────────────────────────────────
// Supports: **bold**, *italic*, `code`, [text](url)

type InlineToken =
  | { t: 'text'; v: string }
  | { t: 'bold'; v: string }
  | { t: 'italic'; v: string }
  | { t: 'code'; v: string }
  | { t: 'link'; v: string; href: string }

function tokenizeBio(input: string): InlineToken[] {
  const tokens: InlineToken[] = []
  let s = input

  while (s.length > 0) {
    // Bold **…**
    const bold = s.match(/^\*\*([^*]+)\*\*/)
    if (bold) {
      tokens.push({ t: 'bold', v: bold[1] })
      s = s.slice(bold[0].length)
      continue
    }
    // Italic *…*
    const italic = s.match(/^\*([^*]+)\*/)
    if (italic) {
      tokens.push({ t: 'italic', v: italic[1] })
      s = s.slice(italic[0].length)
      continue
    }
    // Inline code `…`
    const code = s.match(/^`([^`]+)`/)
    if (code) {
      tokens.push({ t: 'code', v: code[1] })
      s = s.slice(code[0].length)
      continue
    }
    // Link [text](url)
    const link = s.match(/^\[([^\]]+)\]\((https?:\/\/[^)]+)\)/)
    if (link) {
      tokens.push({ t: 'link', v: link[1], href: link[2] })
      s = s.slice(link[0].length)
      continue
    }
    // Consume one char as plain text
    const next = s.match(/^[^*`[]+/) ?? [s[0]]
    tokens.push({ t: 'text', v: next[0] })
    s = s.slice(next[0].length)
  }

  return tokens
}

function BioText({ text }: { text: string }) {
  const tokens = tokenizeBio(text)

  const nodes: ReactNode[] = tokens.map((tok, i) => {
    switch (tok.t) {
      case 'bold':
        return (
          <strong key={i} className="font-semibold text-white">
            {tok.v}
          </strong>
        )
      case 'italic':
        return (
          <em key={i} className="italic">
            {tok.v}
          </em>
        )
      case 'code':
        return (
          <code
            key={i}
            className="px-1 py-0.5 rounded bg-surface-300 text-emerald font-mono text-xs"
          >
            {tok.v}
          </code>
        )
      case 'link':
        return (
          <a
            key={i}
            href={tok.href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-for-400 hover:text-for-300 underline underline-offset-2 transition-colors"
          >
            {tok.v}
          </a>
        )
      default:
        return <span key={i}>{tok.v}</span>
    }
  })

  return (
    <p className="text-sm text-surface-600 max-w-prose mb-3 leading-relaxed">
      {nodes}
    </p>
  )
}
import { ReputationMeter } from './ReputationMeter'
import type { Profile } from '@/lib/supabase/types'
import { cn } from '@/lib/utils/cn'

// ── Challenge button + modal ──────────────────────────────────────────────────

interface TopicOption {
  id: string
  statement: string
  category: string | null
  status: string
}

function ChallengeButton({
  challengedId,
  challengedName,
}: {
  challengedId: string
  challengedName: string
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [topics, setTopics] = useState<TopicOption[]>([])
  const [searching, setSearching] = useState(false)
  const [selected, setSelected] = useState<TopicOption | null>(null)
  const [message, setMessage] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [done, setDone] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const backdropRef = useRef<HTMLDivElement>(null)

  // Search topics
  useEffect(() => {
    if (!open) return
    if (query.trim().length < 3) {
      setTopics([])
      return
    }
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(query)}&type=topics&limit=8`, { cache: 'no-store' })
        if (res.ok) {
          const data = await res.json()
          setTopics((data.topics ?? []).slice(0, 8) as TopicOption[])
        }
      } catch {
        // best-effort
      } finally {
        setSearching(false)
      }
    }, 400)
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current)
    }
  }, [query, open])

  // Close on backdrop click
  function handleBackdrop(e: React.MouseEvent<HTMLDivElement>) {
    if (e.target === backdropRef.current) {
      setOpen(false)
      reset()
    }
  }

  // Escape key
  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') { setOpen(false); reset() }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [open])

  function reset() {
    setQuery('')
    setTopics([])
    setSelected(null)
    setMessage('')
    setError(null)
    setDone(false)
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!selected) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/challenges', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challenged_id: challengedId,
          topic_id: selected.id,
          message: message.trim() || undefined,
        }),
      })
      if (res.ok) {
        setDone(true)
      } else {
        const data = await res.json()
        setError(data.error ?? 'Failed to send challenge')
      }
    } catch {
      setError('Something went wrong')
    } finally {
      setSubmitting(false)
    }
  }

  const STATUS_COLOR: Record<string, string> = {
    active: 'text-for-400', voting: 'text-purple', law: 'text-gold',
    proposed: 'text-surface-500', failed: 'text-against-400',
  }

  return (
    <>
      <button
        onClick={() => { setOpen(true); reset() }}
        className={cn(
          'flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-mono font-semibold',
          'bg-against-600/15 hover:bg-against-600/25 text-against-300 hover:text-against-200',
          'border border-against-600/30 hover:border-against-500/50 transition-all'
        )}
        title={`Challenge ${challengedName} to a debate`}
      >
        <Swords className="h-4 w-4" />
        Challenge
      </button>

      <AnimatePresence>
        {open && (
          <div
            ref={backdropRef}
            className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/70 backdrop-blur-sm p-4"
            onClick={handleBackdrop}
          >
            <motion.div
              initial={{ opacity: 0, y: 20, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 20, scale: 0.96 }}
              transition={{ duration: 0.2, ease: 'easeOut' }}
              className="w-full max-w-md rounded-2xl border border-surface-300 bg-surface-100 shadow-2xl overflow-hidden"
              onClick={(e) => e.stopPropagation()}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-5 py-4 border-b border-surface-300">
                <div className="flex items-center gap-2.5">
                  <Swords className="h-5 w-5 text-against-400" />
                  <div>
                    <p className="text-sm font-mono font-bold text-white">Issue a Challenge</p>
                    <p className="text-[11px] font-mono text-surface-500">
                      Challenge @{challengedName} to debate a topic
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => { setOpen(false); reset() }}
                  className="h-8 w-8 flex items-center justify-center rounded-lg text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>

              {done ? (
                /* Success state */
                <div className="px-5 py-8 flex flex-col items-center gap-4 text-center">
                  <div className="h-14 w-14 rounded-full bg-for-500/15 border border-for-500/30 flex items-center justify-center">
                    <Check className="h-6 w-6 text-for-400" />
                  </div>
                  <div>
                    <p className="text-base font-mono font-bold text-white">Challenge sent!</p>
                    <p className="text-sm font-mono text-surface-500 mt-1">
                      @{challengedName} has 7 days to respond.
                    </p>
                  </div>
                  <button
                    onClick={() => { setOpen(false); reset() }}
                    className="px-6 py-2 rounded-xl bg-surface-200 border border-surface-300 text-sm font-mono text-white hover:bg-surface-300 transition-colors"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSubmit} className="p-5 space-y-4">

                  {/* Topic search */}
                  {!selected ? (
                    <div className="space-y-2">
                      <label className="block text-xs font-mono font-medium text-surface-500 uppercase tracking-wider">
                        Pick a topic
                      </label>
                      <div className="relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 pointer-events-none" />
                        <input
                          autoFocus
                          type="text"
                          value={query}
                          onChange={(e) => setQuery(e.target.value)}
                          placeholder="Search for a topic to debate…"
                          className={cn(
                            'w-full pl-9 pr-4 py-2.5 rounded-xl border text-sm font-mono',
                            'bg-surface-200 text-white placeholder:text-surface-500',
                            'border-surface-300 focus:border-for-500/50 focus:ring-2 focus:ring-for-500/20 focus:outline-none',
                            'transition-colors'
                          )}
                        />
                        {searching && (
                          <Loader2 className="absolute right-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 animate-spin" />
                        )}
                      </div>

                      {/* Results */}
                      {topics.length > 0 && (
                        <div className="space-y-1 max-h-52 overflow-y-auto rounded-xl border border-surface-300 bg-surface-200 p-1">
                          {topics.map((t) => (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => { setSelected(t); setQuery('') }}
                              className="w-full flex items-start gap-2 text-left px-3 py-2.5 rounded-lg hover:bg-surface-300 transition-colors"
                            >
                              <span className={cn('text-[10px] font-mono font-bold mt-0.5 flex-shrink-0 uppercase', STATUS_COLOR[t.status] ?? 'text-surface-500')}>
                                {t.status}
                              </span>
                              <span className="text-sm font-mono text-white leading-snug line-clamp-2">{t.statement}</span>
                            </button>
                          ))}
                        </div>
                      )}

                      {query.length >= 3 && !searching && topics.length === 0 && (
                        <p className="text-xs font-mono text-surface-500 text-center py-2">No topics found for &ldquo;{query}&rdquo;</p>
                      )}
                    </div>
                  ) : (
                    /* Selected topic */
                    <div className="space-y-2">
                      <label className="block text-xs font-mono font-medium text-surface-500 uppercase tracking-wider">
                        Topic
                      </label>
                      <div className="flex items-start gap-2 rounded-xl border border-for-500/30 bg-for-500/5 px-3 py-2.5">
                        <p className="flex-1 text-sm font-mono text-white leading-snug">{selected.statement}</p>
                        <button
                          type="button"
                          onClick={() => setSelected(null)}
                          className="flex-shrink-0 text-surface-500 hover:text-against-400 transition-colors"
                          aria-label="Clear selection"
                        >
                          <X className="h-3.5 w-3.5" />
                        </button>
                      </div>
                    </div>
                  )}

                  {/* Optional message */}
                  <div className="space-y-2">
                    <label className="block text-xs font-mono font-medium text-surface-500 uppercase tracking-wider">
                      Message <span className="normal-case font-normal">(optional)</span>
                    </label>
                    <textarea
                      value={message}
                      onChange={(e) => setMessage(e.target.value.slice(0, 280))}
                      placeholder="Add a short provocation…"
                      rows={2}
                      className={cn(
                        'w-full px-3 py-2.5 rounded-xl border text-sm font-mono resize-none',
                        'bg-surface-200 text-white placeholder:text-surface-500',
                        'border-surface-300 focus:border-for-500/50 focus:ring-2 focus:ring-for-500/20 focus:outline-none',
                        'transition-colors'
                      )}
                    />
                    <p className="text-[10px] font-mono text-surface-600 text-right">{message.length}/280</p>
                  </div>

                  {error && (
                    <p className="text-xs font-mono text-against-400 bg-against-600/10 border border-against-600/20 rounded-xl px-3 py-2">
                      {error}
                    </p>
                  )}

                  <button
                    type="submit"
                    disabled={!selected || submitting}
                    className={cn(
                      'w-full flex items-center justify-center gap-2 py-3 rounded-xl text-sm font-mono font-semibold transition-all',
                      'bg-against-600 hover:bg-against-500 text-white border border-against-500/50',
                      'disabled:opacity-50 disabled:cursor-not-allowed'
                    )}
                  >
                    {submitting ? (
                      <><Loader2 className="h-4 w-4 animate-spin" />Sending…</>
                    ) : (
                      <><Swords className="h-4 w-4" />Send challenge</>
                    )}
                  </button>
                </form>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  )
}

// ─────────────────────────────────────────────────────────────────────────────

interface ProfileHeaderProps {
  profile: Profile
  isOwner: boolean
  /** Whether the logged-in viewer already follows this profile */
  initialFollowing?: boolean
  /** Viewer's user-id (null = guest) */
  viewerId?: string | null
}

function formatJoinDate(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleDateString('en-US', { month: 'long', year: 'numeric' })
}

function formatCount(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

function FollowStat({
  label,
  value,
  onClick,
}: {
  label: string
  value: number
  onClick?: () => void
}) {
  if (onClick) {
    return (
      <button
        type="button"
        onClick={onClick}
        className="flex flex-col items-center gap-0.5 min-w-[52px] group focus:outline-none"
      >
        <span className="text-base font-mono font-bold text-white tabular-nums group-hover:text-for-400 transition-colors">
          {formatCount(value)}
        </span>
        <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider group-hover:text-surface-400 transition-colors">
          {label}
        </span>
      </button>
    )
  }

  return (
    <div className="flex flex-col items-center gap-0.5 min-w-[52px]">
      <span className="text-base font-mono font-bold text-white tabular-nums">
        {formatCount(value)}
      </span>
      <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">
        {label}
      </span>
    </div>
  )
}

export function ProfileHeader({
  profile,
  isOwner,
  initialFollowing = false,
  viewerId = null,
}: ProfileHeaderProps) {
  const [following, setFollowing] = useState(initialFollowing)
  const [toggling, setToggling] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [followersCount, setFollowersCount] = useState(
    profile.followers_count ?? 0
  )
  const [modalTab, setModalTab] = useState<FollowTab | null>(null)

  const ring = getRoleRingClass(profile.role)
  const displayName = profile.display_name || profile.username

  const handleFollow = useCallback(async () => {
    if (toggling) return

    // Guests → redirect to login
    if (!viewerId) {
      window.location.href = '/login'
      return
    }

    // Optimistic update
    const wasFollowing = following
    setFollowing(!wasFollowing)
    setFollowersCount((c) => (wasFollowing ? Math.max(0, c - 1) : c + 1))
    setToggling(true)

    try {
      const res = await fetch('/api/follow', {
        method: wasFollowing ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ target_id: profile.id }),
      })

      if (res.status === 401) {
        // Not authed — revert and redirect
        setFollowing(wasFollowing)
        setFollowersCount((c) => (wasFollowing ? c + 1 : Math.max(0, c - 1)))
        window.location.href = '/login'
        return
      }

      if (res.ok) {
        const data = (await res.json()) as {
          isFollowing: boolean
          followersCount: number
        }
        setFollowing(data.isFollowing)
        setFollowersCount(data.followersCount)
      } else {
        // Revert on unexpected error
        setFollowing(wasFollowing)
        setFollowersCount((c) => (wasFollowing ? c + 1 : Math.max(0, c - 1)))
      }
    } catch {
      setFollowing(wasFollowing)
      setFollowersCount((c) => (wasFollowing ? c + 1 : Math.max(0, c - 1)))
    } finally {
      setToggling(false)
    }
  }, [following, toggling, viewerId, profile.id])

  // Determine button label / icon for follow toggle
  let followLabel: string
  let FollowIcon: typeof UserPlus

  if (toggling) {
    followLabel = following ? 'Following' : 'Follow'
    FollowIcon = UserPlus
  } else if (following && hovered) {
    followLabel = 'Unfollow'
    FollowIcon = UserMinus
  } else if (following) {
    followLabel = 'Following'
    FollowIcon = UserCheck
  } else {
    followLabel = 'Follow'
    FollowIcon = UserPlus
  }

  return (
    <>
    <div className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-surface-100 to-surface-200 border border-surface-300 p-6 md:p-8">
      {/* Background blurs */}
      <div className="pointer-events-none absolute inset-0 opacity-20">
        <div className="absolute -top-24 -right-24 h-64 w-64 rounded-full bg-for-500/20 blur-3xl" />
        <div className="absolute -bottom-24 -left-24 h-64 w-64 rounded-full bg-emerald/10 blur-3xl" />
      </div>

      <div className="relative flex flex-col md:flex-row items-start md:items-center gap-6">
        {/* Avatar */}
        <motion.div
          initial={{ scale: 0.9, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ duration: 0.4 }}
          className={cn(
            'relative rounded-full ring-4 ring-offset-4 ring-offset-surface-100',
            ring
          )}
        >
          <Avatar
            src={profile.avatar_url}
            fallback={displayName}
            size="lg"
            className="h-24 w-24 md:h-28 md:w-28"
          />
          {profile.is_influencer && (
            <div className="absolute -top-1 -right-1 h-6 w-6 rounded-full bg-gold border-2 border-surface-100 flex items-center justify-center">
              <span className="text-[10px] font-bold text-black">★</span>
            </div>
          )}
        </motion.div>

        {/* Identity column */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center flex-wrap gap-2 mb-1">
            <h1 className="text-2xl md:text-3xl font-bold text-white truncate">
              {displayName}
            </h1>
            <RoleBadge role={profile.role} size="md" />
          </div>

          <div className="text-sm font-mono text-surface-500 mb-2">
            @{profile.username}
          </div>

          {profile.bio && <BioText text={profile.bio} />}

          {/* Follow stats row — counts are clickable to open the modal */}
          <div className="flex items-center gap-4 mb-3">
            <FollowStat
              label="followers"
              value={followersCount}
              onClick={() => setModalTab('followers')}
            />
            <div className="h-6 w-px bg-surface-400" aria-hidden />
            <FollowStat
              label="following"
              value={profile.following_count ?? 0}
              onClick={() => setModalTab('following')}
            />
          </div>

          {/* Civic alignment badge — shown to logged-in viewers of other profiles */}
          {viewerId && !isOwner && (
            <AlignmentBadge targetId={profile.id} className="mb-2" />
          )}

          <div className="flex items-center gap-2 text-xs font-mono text-surface-500 mb-2">
            <Calendar className="h-3.5 w-3.5" />
            Joined {formatJoinDate(profile.created_at)}
          </div>

          {/* Civic Archetype badge */}
          {profile.civic_archetype && ARCHETYPE_CONFIG[profile.civic_archetype as ArchetypeId] && (() => {
            const arch = ARCHETYPE_CONFIG[profile.civic_archetype as ArchetypeId]
            const AIcon = arch.icon
            return (
              <Link
                href="/archetype"
                className={cn(
                  'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full border mb-2',
                  'text-[11px] font-mono font-semibold transition-opacity hover:opacity-80',
                  arch.bgColor, arch.borderColor, arch.color
                )}
                title={`${arch.name} — ${arch.tagline}`}
              >
                <AIcon className="h-3 w-3 flex-shrink-0" aria-hidden />
                {arch.name}
              </Link>
            )
          })()}

          {/* Social links */}
          {profile.social_links && (
            <div className="flex items-center gap-3 flex-wrap">
              {profile.social_links.twitter && (
                <a
                  href={`https://twitter.com/${profile.social_links.twitter}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                >
                  <AtSign className="h-3.5 w-3.5" />
                  <span>@{profile.social_links.twitter}</span>
                </a>
              )}
              {profile.social_links.github && (
                <a
                  href={`https://github.com/${profile.social_links.github}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                >
                  <Code2 className="h-3.5 w-3.5" />
                  <span>{profile.social_links.github}</span>
                </a>
              )}
              {profile.social_links.website && (
                <a
                  href={profile.social_links.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                >
                  <Globe className="h-3.5 w-3.5" />
                  <span>
                    {profile.social_links.website
                      .replace(/^https?:\/\/(www\.)?/, '')
                      .replace(/\/$/, '')}
                  </span>
                </a>
              )}
            </div>
          )}
        </div>

        {/* Reputation meter */}
        <div className="flex-shrink-0">
          <ReputationMeter score={profile.reputation_score} />
        </div>
      </div>

      {/* Actions row */}
      <div className="relative mt-6 flex items-center gap-3">
        {isOwner ? (
          <div className="flex items-center gap-2 flex-wrap">
            <Link href="/profile/settings">
              <Button variant="default" size="md">
                <Settings className="h-4 w-4" />
                Edit profile
              </Button>
            </Link>
            <Link href="/analytics">
              <Button variant="default" size="md">
                <BarChart2 className="h-4 w-4" />
                Analytics
              </Button>
            </Link>
            <Link href={`/share/profile/${encodeURIComponent(profile.username)}`}>
              <Button variant="default" size="md" title="Share your civic card">
                <Share2 className="h-4 w-4" />
                Share card
              </Button>
            </Link>
          </div>
        ) : (
          <div className="flex items-center gap-2">
            <Button
              variant={following ? 'default' : 'for'}
              size="md"
              disabled={toggling}
              onClick={handleFollow}
              onMouseEnter={() => setHovered(true)}
              onMouseLeave={() => setHovered(false)}
              className={cn(
                'min-w-[110px] transition-colors',
                following && hovered && 'border-against-500/50 text-against-400 hover:bg-against-950/40'
              )}
            >
              {toggling ? (
                <Loader2 className="h-4 w-4 animate-spin" />
              ) : (
                <FollowIcon className="h-4 w-4" />
              )}
              {followLabel}
            </Button>

            {/* Gift Clout — only shown to logged-in viewers */}
            {viewerId && (
              <GiftCloutButton
                recipientId={profile.id}
                recipientName={profile.display_name || profile.username}
              />
            )}

            {/* Compare stances */}
            <Link href={`/compare-users?b=${encodeURIComponent(profile.username)}`}>
              <Button variant="default" size="md" title="Compare your stances">
                <GitCompare className="h-4 w-4" />
                Compare
              </Button>
            </Link>

            {/* Direct message */}
            <Link href={`/messages/${encodeURIComponent(profile.username)}`}>
              <Button variant="default" size="md" title="Send a message">
                <MessageSquare className="h-4 w-4" />
                Message
              </Button>
            </Link>

            {/* Challenge to debate */}
            <ChallengeButton
              challengedId={profile.id}
              challengedName={profile.display_name || profile.username}
            />

            {/* Share civic card */}
            <Link href={`/share/profile/${encodeURIComponent(profile.username)}`}>
              <Button variant="default" size="md" title="Share their civic card">
                <Share2 className="h-4 w-4" />
              </Button>
            </Link>
          </div>
        )}
      </div>
    </div>

    {/* Followers / Following modal */}
    <AnimatePresence>
      {modalTab !== null && (
        <FollowersModal
          username={profile.username}
          tab={modalTab}
          followersCount={followersCount}
          followingCount={profile.following_count ?? 0}
          viewerId={viewerId}
          onClose={() => setModalTab(null)}
          onTabChange={(t) => setModalTab(t)}
        />
      )}
    </AnimatePresence>
    </>
  )
}
