import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  BarChart2,
  ExternalLink,
  Flame,
  Globe,
  MessageSquare,
  ThumbsDown,
  ThumbsUp,
  Users,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Avatar } from '@/components/ui/Avatar'
import { ShareCardButton } from '@/components/profile/ShareCardButton'
import { cn } from '@/lib/utils/cn'
import type { Profile } from '@/lib/supabase/types'

interface Props {
  params: { username: string }
}

export const dynamic = 'force-dynamic'

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()
  const { data } = await supabase
    .from('profiles')
    .select('username, display_name, role, clout, total_votes')
    .eq('username', params.username)
    .maybeSingle()

  if (!data) return { title: 'Civic Card · Lobby Market' }

  const displayName = data.display_name || data.username
  const title = `${displayName}'s Civic Card · Lobby Market`
  const description = `${data.total_votes.toLocaleString()} votes cast · ${data.clout.toLocaleString()} clout · ${data.role} on Lobby Market`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
      siteName: 'Lobby Market',
      images: [{ url: `/api/og/profile/${data.username}`, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`/api/og/profile/${data.username}`],
    },
  }
}

// ─── Role helpers ──────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  person: 'Citizen',
  debator: 'Debator',
  troll_catcher: 'Troll Catcher',
  elder: 'Elder',
  lawmaker: 'Lawmaker',
  senator: 'Senator',
}

const ROLE_STYLE: Record<
  string,
  { text: string; bg: string; border: string }
> = {
  elder:         { text: 'text-gold',        bg: 'bg-gold/10',     border: 'border-gold/40'     },
  senator:       { text: 'text-purple',      bg: 'bg-purple/10',   border: 'border-purple/40'   },
  lawmaker:      { text: 'text-gold',        bg: 'bg-gold/10',     border: 'border-gold/30'     },
  troll_catcher: { text: 'text-emerald',     bg: 'bg-emerald/10',  border: 'border-emerald/40'  },
  debator:       { text: 'text-for-400',     bg: 'bg-for-500/10',  border: 'border-for-500/40'  },
  person:        { text: 'text-surface-500', bg: 'bg-surface-200', border: 'border-surface-400' },
}

// ─── Category styles ───────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, { bar: string; text: string }> = {
  Economics:   { bar: 'bg-gold',         text: 'text-gold'        },
  Politics:    { bar: 'bg-for-500',      text: 'text-for-400'     },
  Technology:  { bar: 'bg-purple',       text: 'text-purple'      },
  Science:     { bar: 'bg-emerald',      text: 'text-emerald'     },
  Ethics:      { bar: 'bg-against-500',  text: 'text-against-400' },
  Philosophy:  { bar: 'bg-indigo-400',   text: 'text-indigo-400'  },
  Culture:     { bar: 'bg-orange-400',   text: 'text-orange-400'  },
  Health:      { bar: 'bg-pink-400',     text: 'text-pink-400'    },
  Environment: { bar: 'bg-green-400',    text: 'text-green-400'   },
  Education:   { bar: 'bg-cyan-400',     text: 'text-cyan-400'    },
}

function catStyle(cat: string) {
  return CATEGORY_COLORS[cat] ?? { bar: 'bg-surface-500', text: 'text-surface-500' }
}

// ─── Stat block ────────────────────────────────────────────────────────────────

function StatBlock({
  icon: Icon,
  iconClass,
  value,
  label,
}: {
  icon: typeof Flame
  iconClass: string
  value: string | number
  label: string
}) {
  return (
    <div className="flex flex-col items-center gap-1 flex-1 min-w-0">
      <Icon className={cn('h-4 w-4 flex-shrink-0', iconClass)} />
      <span className="text-lg font-mono font-bold text-white tabular-nums">
        {typeof value === 'number' ? value.toLocaleString() : value}
      </span>
      <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider text-center">
        {label}
      </span>
    </div>
  )
}

// ─── Category bar row ──────────────────────────────────────────────────────────

function CategoryBar({ category, pct }: { category: string; pct: number }) {
  const style = catStyle(category)
  return (
    <div className="flex items-center gap-2">
      <span className={cn('text-[10px] font-mono font-semibold w-20 flex-shrink-0 truncate', style.text)}>
        {category}
      </span>
      <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden">
        <div
          className={cn('h-full rounded-full', style.bar)}
          style={{ width: `${Math.max(4, pct)}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-surface-500 tabular-nums w-8 text-right flex-shrink-0">
        {pct}%
      </span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CivicCardPage({ params }: Props) {
  const supabase = await createClient()

  // Fetch profile
  const { data: profileData } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', params.username)
    .maybeSingle()

  if (!profileData) notFound()

  const profile = profileData as Profile

  // Fetch user's votes to compute category breakdown (two-step, avoids join complexity)
  const { data: voteRows } = await supabase
    .from('votes')
    .select('topic_id')
    .eq('user_id', profile.id)
    .limit(500)

  const topicIds = Array.from(new Set((voteRows ?? []).map((v) => v.topic_id)))

  let topCategories: { category: string; pct: number }[] = []

  if (topicIds.length > 0) {
    const { data: topicRows } = await supabase
      .from('topics')
      .select('category')
      .in('id', topicIds)
      .not('category', 'is', null)

    const catCounts = new Map<string, number>()
    for (const t of topicRows ?? []) {
      if (t.category) catCounts.set(t.category, (catCounts.get(t.category) ?? 0) + 1)
    }

    const total = Array.from(catCounts.values()).reduce((a, b) => a + b, 0)
    topCategories = Array.from(catCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([category, cnt]) => ({
        category,
        pct: total > 0 ? Math.round((cnt / total) * 100) : 0,
      }))
  }

  // Computed values
  const forPct = profile.total_votes > 0
    ? Math.round((profile.blue_vote_count / profile.total_votes) * 100)
    : 50
  const againstPct = 100 - forPct

  const roleLabel = ROLE_LABEL[profile.role] ?? profile.role
  const roleStyle = ROLE_STYLE[profile.role] ?? ROLE_STYLE.person
  const displayName = profile.display_name || profile.username

  const cardUrl = `https://lobby.market/card/${profile.username}`

  const twitterShareUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(
    `My civic profile on Lobby Market — ${profile.total_votes.toLocaleString()} votes cast, ${profile.clout.toLocaleString()} clout earned.`
  )}&url=${encodeURIComponent(cardUrl)}`

  const premiumRole = ['elder', 'senator', 'lawmaker'].includes(profile.role)

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col items-center justify-center py-8 px-4">

      {/* ── Card ─────────────────────────────────────────────────── */}
      <div className="w-full max-w-sm">

        {/* Gradient border wrapper */}
        <div className="relative rounded-3xl p-px bg-gradient-to-b from-surface-400/60 to-surface-300/20 shadow-2xl shadow-black/60">
          <div className="relative rounded-3xl bg-surface-100 overflow-hidden">

            {/* Top accent line */}
            <div className="h-px w-full bg-gradient-to-r from-for-600 via-purple to-against-600" />

            {/* Ambient glow */}
            <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
              <div className="absolute inset-x-0 top-0 h-32 bg-gradient-to-b from-for-900/20 to-transparent" />
            </div>

            <div className="relative p-6 space-y-6">

              {/* ── Brand + role ── */}
              <div className="flex items-center justify-between">
                <Link
                  href="/"
                  className="flex items-center gap-1.5 opacity-70 hover:opacity-100 transition-opacity"
                  aria-label="Lobby Market"
                >
                  <span className="text-xs font-mono font-bold text-white tracking-widest uppercase">
                    LOBBY
                  </span>
                  <div className="flex h-0.5 w-6">
                    <div className="flex-1 bg-for-500 rounded-l-full" />
                    <div className="flex-1 bg-against-500 rounded-r-full" />
                  </div>
                </Link>

                <span
                  className={cn(
                    'text-[10px] font-mono font-bold uppercase tracking-wider px-2.5 py-1 rounded-full border',
                    roleStyle.text,
                    roleStyle.bg,
                    roleStyle.border,
                  )}
                >
                  {roleLabel}
                </span>
              </div>

              {/* ── Avatar + identity ── */}
              <div className="flex items-center gap-4">
                <div className={cn(
                  'rounded-2xl p-0.5 flex-shrink-0',
                  premiumRole
                    ? 'bg-gradient-to-b from-gold/60 to-gold/10'
                    : 'bg-surface-300',
                )}>
                  <div className="rounded-[14px] overflow-hidden">
                    <Avatar
                      src={profile.avatar_url}
                      fallback={displayName}
                      size="lg"
                    />
                  </div>
                </div>
                <div className="min-w-0 flex-1">
                  <h1 className="text-xl font-bold text-white truncate leading-tight">
                    {displayName}
                  </h1>
                  <p className="text-sm font-mono text-surface-500 truncate">
                    @{profile.username}
                  </p>
                  {profile.bio && (
                    <p className="text-xs text-surface-600 mt-1.5 line-clamp-2 leading-relaxed">
                      {profile.bio}
                    </p>
                  )}
                </div>
              </div>

              {/* ── Stats row ── */}
              <div className="grid grid-cols-4 gap-2 py-4 border-y border-surface-300/60">
                <StatBlock
                  icon={BarChart2}
                  iconClass="text-for-400"
                  value={profile.total_votes}
                  label="Votes"
                />
                <StatBlock
                  icon={MessageSquare}
                  iconClass="text-purple"
                  value={profile.total_arguments}
                  label="Args"
                />
                <StatBlock
                  icon={Zap}
                  iconClass="text-gold"
                  value={profile.clout}
                  label="Clout"
                />
                <StatBlock
                  icon={Flame}
                  iconClass="text-against-400"
                  value={profile.vote_streak}
                  label="Streak"
                />
              </div>

              {/* ── Vote split ── */}
              {profile.total_votes > 0 && (
                <div className="space-y-2">
                  <div className="flex items-center justify-between text-[11px] font-mono">
                    <span className="flex items-center gap-1 text-for-400 font-semibold">
                      <ThumbsUp className="h-3 w-3" aria-hidden="true" />
                      {forPct}% FOR
                    </span>
                    <span className="text-surface-600">
                      {profile.total_votes.toLocaleString()} votes
                    </span>
                    <span className="flex items-center gap-1 text-against-400 font-semibold">
                      {againstPct}% AGAINST
                      <ThumbsDown className="h-3 w-3" aria-hidden="true" />
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden bg-surface-300 flex">
                    <div
                      className="h-full bg-gradient-to-r from-for-700 to-for-500 rounded-l-full"
                      style={{ width: `${forPct}%` }}
                    />
                    <div
                      className="h-full bg-gradient-to-l from-against-700 to-against-500 rounded-r-full ml-auto"
                      style={{ width: `${againstPct}%` }}
                    />
                  </div>
                </div>
              )}

              {/* ── Category breakdown ── */}
              {topCategories.length > 0 && (
                <div className="space-y-2">
                  <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">
                    Top Categories
                  </p>
                  <div className="space-y-1.5">
                    {topCategories.map(({ category, pct }) => (
                      <CategoryBar key={category} category={category} pct={pct} />
                    ))}
                  </div>
                </div>
              )}

              {/* ── Social ── */}
              {(profile.followers_count > 0 || profile.following_count > 0) && (
                <div className="flex items-center gap-3 text-xs font-mono text-surface-500">
                  <Users className="h-3.5 w-3.5 flex-shrink-0" aria-hidden="true" />
                  <span>
                    <span className="text-white font-semibold">
                      {profile.followers_count.toLocaleString()}
                    </span>{' '}
                    followers ·{' '}
                    <span className="text-white font-semibold">
                      {profile.following_count.toLocaleString()}
                    </span>{' '}
                    following
                  </span>
                </div>
              )}

              {/* ── Social links ── */}
              {profile.social_links && (
                <div className="flex flex-wrap gap-3">
                  {profile.social_links.twitter && (
                    <a
                      href={`https://twitter.com/${profile.social_links.twitter}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
                    >
                      {/* X logo */}
                      <svg viewBox="0 0 24 24" className="h-3 w-3 fill-current" aria-hidden="true">
                        <path d="M18.244 2.25h3.308l-7.227 8.26 8.502 11.24H16.17l-4.714-6.231-5.401 6.231H2.746l7.73-8.835L1.254 2.25H8.08l4.253 5.622zm-1.161 17.52h1.833L7.084 4.126H5.117z" />
                      </svg>
                      @{profile.social_links.twitter}
                    </a>
                  )}
                  {profile.social_links.website && (
                    <a
                      href={profile.social_links.website.startsWith('http')
                        ? profile.social_links.website
                        : `https://${profile.social_links.website}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex items-center gap-1.5 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
                    >
                      <Globe className="h-3 w-3" aria-hidden="true" />
                      {profile.social_links.website.replace(/^https?:\/\//, '').replace(/\/$/, '')}
                    </a>
                  )}
                </div>
              )}

              {/* ── Actions ── */}
              <div className="flex gap-2 pt-1">
                <ShareCardButton
                  cardUrl={cardUrl}
                  twitterUrl={twitterShareUrl}
                  displayName={displayName}
                />
                <Link
                  href={`/profile/${profile.username}`}
                  className={cn(
                    'inline-flex items-center justify-center gap-1.5',
                    'h-9 px-3 rounded-xl text-xs font-mono font-semibold flex-shrink-0',
                    'bg-surface-200 border border-surface-300 text-surface-400',
                    'hover:bg-surface-300 hover:text-white transition-colors',
                  )}
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  Profile
                </Link>
              </div>

            </div>
          </div>
        </div>

        {/* ── Member since ── */}
        <p className="text-center text-[10px] font-mono text-surface-600 mt-4">
          Citizen since{' '}
          {new Date(profile.created_at).toLocaleDateString('en-US', {
            month: 'long',
            year: 'numeric',
          })}
        </p>
      </div>
    </div>
  )
}
