import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowRight,
  AtSign,
  BarChart2,
  Code2,
  ExternalLink,
  Globe,
  MessageSquare,
  ThumbsDown,
  ThumbsUp,
  Users,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { Avatar } from '@/components/ui/Avatar'
import { ARCHETYPE_CONFIG, type ArchetypeId } from '@/lib/config/archetypes'
import { cn } from '@/lib/utils/cn'
import type { Profile } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

interface PageProps {
  params: { username: string }
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, bio, avatar_url, role, clout, total_votes, total_arguments, civic_archetype')
    .eq('username', params.username)
    .maybeSingle()

  if (!profile) {
    return { title: 'Civic Profile · Lobby Market' }
  }

  const name = profile.display_name || profile.username
  const archetype = profile.civic_archetype
    ? ARCHETYPE_CONFIG[profile.civic_archetype as ArchetypeId]?.name
    : null

  const descParts = [
    archetype ? `${archetype} on Lobby Market` : 'Civic voice on Lobby Market',
    `${profile.clout.toLocaleString()} clout · ${profile.total_votes.toLocaleString()} votes`,
    profile.bio ? profile.bio.slice(0, 100) : null,
  ].filter(Boolean)

  const title = `${name} (@${profile.username}) · Lobby Market`
  const description = descParts.join(' · ')

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
      siteName: 'Lobby Market',
      images: [
        {
          url: `/api/og/profile/${profile.username}`,
          width: 1200,
          height: 630,
          alt: `${name}'s Lobby Card`,
        },
      ],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [`/api/og/profile/${profile.username}`],
    },
    alternates: {
      canonical: `https://lobby.market/u/${profile.username}`,
    },
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_META: Record<string, { label: string; className: string }> = {
  elder:         { label: 'Elder',         className: 'bg-gold/15 text-gold border-gold/40' },
  troll_catcher: { label: 'Troll Catcher', className: 'bg-emerald/15 text-emerald border-emerald/40' },
  debator:       { label: 'Debater',       className: 'bg-for-500/15 text-for-400 border-for-500/40' },
  person:        { label: 'Citizen',       className: 'bg-surface-300/50 text-surface-400 border-surface-400/30' },
}

function fmt(n: number) {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toLocaleString()
}

// ─── Types ────────────────────────────────────────────────────────────────────

type TopArg = {
  id: string
  content: string
  side: string
  upvotes: number
  topics: { id: string; statement: string } | null
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function LobbyCardPage({ params }: PageProps) {
  const supabase = await createClient()

  const { data: profileRaw } = await supabase
    .from('profiles')
    .select('*')
    .eq('username', params.username)
    .maybeSingle()

  if (!profileRaw) notFound()

  const profile = profileRaw as Profile

  const { data: argsRaw } = await supabase
    .from('topic_arguments')
    .select('id, content, side, upvotes, topics!inner(id, statement)')
    .eq('author_id', profile.id)
    .order('upvotes', { ascending: false })
    .limit(3)

  const topArgs = (argsRaw ?? []) as unknown as TopArg[]

  const links = profile.social_links as { twitter?: string; github?: string; website?: string } | null

  const archetype = profile.civic_archetype
    ? ARCHETYPE_CONFIG[profile.civic_archetype as ArchetypeId]
    : null
  const ArchIcon = archetype?.icon ?? null

  const roleInfo = ROLE_META[profile.role] ?? ROLE_META.person

  const memberSince = new Date(profile.created_at).toLocaleDateString('en-GB', {
    month: 'short',
    year: 'numeric',
  })

  const forPct = profile.total_votes > 0
    ? Math.round((profile.blue_vote_count / profile.total_votes) * 100)
    : 50

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      {/* ── Background glow ───────────────────────────────────────── */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[600px] h-[400px] bg-for-600/5 rounded-full blur-3xl" />
        <div className="absolute bottom-0 right-1/4 w-96 h-96 bg-against-600/4 rounded-full blur-3xl" />
      </div>

      {/* ── Brand header ──────────────────────────────────────────── */}
      <header className="relative z-10 flex items-center justify-between px-4 py-3 border-b border-surface-200">
        <Link
          href="/"
          className="font-mono text-sm font-bold text-white tracking-widest hover:text-for-400 transition-colors"
        >
          LOBBY MARKET
        </Link>
        <Link
          href="/sign-in"
          className="text-xs font-mono text-surface-500 hover:text-white transition-colors"
        >
          Sign in →
        </Link>
      </header>

      {/* ── Main card ────────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 flex items-start justify-center px-4 py-8 md:py-12">
        <div className="w-full max-w-lg space-y-4">

          {/* ── Identity card ─────────────────────────────────────── */}
          <div className="rounded-2xl border border-surface-300 bg-surface-100 p-6">
            <div className="flex items-start gap-4">
              <Avatar
                src={profile.avatar_url}
                fallback={profile.display_name || profile.username}
                size="lg"
              />
              <div className="flex-1 min-w-0 pt-0.5">
                <div className="flex items-center gap-2 flex-wrap mb-1">
                  <h1 className="text-xl font-bold text-white leading-tight truncate">
                    {profile.display_name || profile.username}
                  </h1>
                  <span className={cn(
                    'inline-flex text-[10px] font-mono font-semibold px-2 py-0.5 rounded-full border flex-shrink-0',
                    roleInfo.className
                  )}>
                    {roleInfo.label}
                  </span>
                </div>
                <p className="text-sm font-mono text-surface-500 mb-2">
                  @{profile.username} · Member since {memberSince}
                </p>
                {profile.bio && (
                  <p className="text-sm text-surface-600 leading-relaxed">
                    {profile.bio}
                  </p>
                )}
              </div>
            </div>

            {/* ── Archetype badge ─────────────────────────────────── */}
            {archetype && ArchIcon && (
              <div className={cn(
                'mt-4 flex items-center gap-3 p-3 rounded-xl border',
                archetype.bgColor, archetype.borderColor
              )}>
                <ArchIcon className={cn('h-5 w-5 flex-shrink-0', archetype.color)} />
                <div>
                  <p className={cn('text-sm font-mono font-bold', archetype.color)}>
                    {archetype.name}
                  </p>
                  <p className="text-xs font-mono text-surface-500 italic">
                    &ldquo;{archetype.tagline}&rdquo;
                  </p>
                </div>
              </div>
            )}
          </div>

          {/* ── Stats row ─────────────────────────────────────────── */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {[
              { label: 'Clout', value: fmt(profile.clout), icon: Zap, color: 'text-gold' },
              { label: 'Votes', value: fmt(profile.total_votes), icon: BarChart2, color: 'text-for-400' },
              { label: 'Arguments', value: fmt(profile.total_arguments), icon: MessageSquare, color: 'text-purple' },
              { label: 'Followers', value: fmt(profile.followers_count), icon: Users, color: 'text-emerald' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div
                key={label}
                className="rounded-xl border border-surface-300 bg-surface-100 p-4 text-center"
              >
                <Icon className={cn('h-4 w-4 mx-auto mb-1.5', color)} />
                <p className="text-lg font-mono font-bold text-white">{value}</p>
                <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">{label}</p>
              </div>
            ))}
          </div>

          {/* ── Vote stance bar ───────────────────────────────────── */}
          {profile.total_votes > 0 && (
            <div className="rounded-xl border border-surface-300 bg-surface-100 p-4">
              <div className="flex items-center justify-between mb-2">
                <div className="flex items-center gap-1.5">
                  <ThumbsUp className="h-3.5 w-3.5 text-for-400" />
                  <span className="text-xs font-mono text-for-400 font-bold">
                    {forPct}% For
                  </span>
                </div>
                <span className="text-[10px] font-mono text-surface-500">
                  Civic stance across {fmt(profile.total_votes)} votes
                </span>
                <div className="flex items-center gap-1.5">
                  <span className="text-xs font-mono text-against-400 font-bold">
                    {100 - forPct}% Against
                  </span>
                  <ThumbsDown className="h-3.5 w-3.5 text-against-400" />
                </div>
              </div>
              <div className="h-2 rounded-full bg-against-900/60 overflow-hidden">
                <div
                  className="h-full bg-for-500 rounded-full transition-all"
                  style={{ width: `${forPct}%` }}
                />
              </div>
            </div>
          )}

          {/* ── Top arguments ─────────────────────────────────────── */}
          {topArgs.length > 0 && (
            <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5">
              <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest mb-3">
                Top Arguments
              </h2>
              <div className="space-y-3">
                {topArgs.map((arg) => {
                  const isFor = arg.side === 'blue'
                  return (
                    <Link
                      key={arg.id}
                      href={arg.topics ? `/topic/${arg.topics.id}` : '#'}
                      className={cn(
                        'block p-3.5 rounded-xl border transition-all',
                        isFor
                          ? 'border-for-500/20 hover:border-for-500/40 bg-for-950/20'
                          : 'border-against-500/20 hover:border-against-500/40 bg-against-950/20'
                      )}
                    >
                      <div className="flex items-start gap-2.5 mb-2">
                        {isFor
                          ? <ThumbsUp className="h-3.5 w-3.5 text-for-400 flex-shrink-0 mt-0.5" />
                          : <ThumbsDown className="h-3.5 w-3.5 text-against-400 flex-shrink-0 mt-0.5" />
                        }
                        <p className="text-sm text-white leading-snug line-clamp-2 font-mono">
                          &ldquo;{arg.content}&rdquo;
                        </p>
                      </div>
                      <div className="flex items-center justify-between pl-6">
                        <p className="text-[10px] font-mono text-surface-500 truncate max-w-[240px]">
                          {arg.topics?.statement}
                        </p>
                        <div className={cn(
                          'flex items-center gap-1 text-[10px] font-mono font-bold px-1.5 py-0.5 rounded border',
                          isFor
                            ? 'text-for-400 border-for-500/30 bg-for-500/10'
                            : 'text-against-400 border-against-500/30 bg-against-500/10'
                        )}>
                          <Zap className="h-2.5 w-2.5" />
                          {fmt(arg.upvotes)}
                        </div>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </div>
          )}

          {/* ── Social links ──────────────────────────────────────── */}
          {(links?.twitter || links?.github || links?.website) && (
            <div className="flex flex-wrap gap-2">
              {links.twitter && (
                <a
                  href={`https://x.com/${links.twitter}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors text-xs font-mono text-surface-400 hover:text-white"
                >
                  <AtSign className="h-3.5 w-3.5" />
                  {links.twitter}
                </a>
              )}
              {links.github && (
                <a
                  href={`https://github.com/${links.github}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors text-xs font-mono text-surface-400 hover:text-white"
                >
                  <Code2 className="h-3.5 w-3.5" />
                  {links.github}
                </a>
              )}
              {links.website && (
                <a
                  href={links.website}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-100 border border-surface-300 hover:border-surface-400 transition-colors text-xs font-mono text-surface-400 hover:text-white"
                >
                  <Globe className="h-3.5 w-3.5" />
                  {links.website.replace(/^https?:\/\//, '')}
                </a>
              )}
            </div>
          )}

          {/* ── CTA buttons ───────────────────────────────────────── */}
          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href={`/profile/${profile.username}`}
              className="flex-1 flex items-center justify-center gap-2 rounded-xl border border-surface-300 bg-surface-100 hover:border-surface-400 hover:bg-surface-200 px-5 py-3 text-sm font-mono font-semibold text-surface-400 hover:text-white transition-all"
            >
              <ExternalLink className="h-4 w-4" />
              Full Profile
            </Link>
            <Link
              href="/sign-in"
              className="flex-1 flex items-center justify-center gap-2 rounded-xl bg-for-600 hover:bg-for-500 border border-for-500/50 hover:border-for-400 px-5 py-3 text-sm font-mono font-semibold text-white transition-all shadow-lg shadow-for-900/30"
            >
              Join the Lobby
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          {/* ── Footer tag ────────────────────────────────────────── */}
          <p className="text-center text-[10px] font-mono text-surface-600">
            lobby.market · The People&rsquo;s Consensus Engine
          </p>
        </div>
      </main>
    </div>
  )
}
