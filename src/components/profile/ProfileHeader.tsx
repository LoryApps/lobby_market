'use client'

import { useCallback, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  AtSign,
  BarChart2,
  Calendar,
  Code2,
  GitCompare,
  Globe,
  Loader2,
  Settings,
  Share2,
  UserCheck,
  UserMinus,
  UserPlus,
} from 'lucide-react'
import Link from 'next/link'
import { Avatar } from '@/components/ui/Avatar'
import { Button } from '@/components/ui/Button'
import { GiftCloutButton } from '@/components/clout/GiftCloutButton'
import { RoleBadge, getRoleRingClass } from './RoleBadge'
import { FollowersModal, type FollowTab } from './FollowersModal'

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

          <div className="flex items-center gap-2 text-xs font-mono text-surface-500 mb-2">
            <Calendar className="h-3.5 w-3.5" />
            Joined {formatJoinDate(profile.created_at)}
          </div>

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
