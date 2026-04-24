import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowRight,
  BarChart2,
  Flame,
  Gavel,
  MessageSquare,
  Scale,
  Star,
  TrendingUp,
  Vote,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'

const BASE_URL = 'https://lobby.market'

// ─── Role config ───────────────────────────────────────────────────────────────

const ROLE_LABEL: Record<string, string> = {
  person: 'CITIZEN',
  debator: 'DEBATOR',
  troll_catcher: 'TROLL CATCHER',
  elder: 'ELDER',
}

const ROLE_COLOR: Record<string, { text: string; border: string; bg: string }> = {
  person:        { text: 'text-surface-500',  border: 'border-surface-500/40',  bg: 'bg-surface-300/20' },
  debator:       { text: 'text-for-400',      border: 'border-for-500/40',      bg: 'bg-for-500/10'     },
  troll_catcher: { text: 'text-emerald',      border: 'border-emerald/40',      bg: 'bg-emerald/10'     },
  elder:         { text: 'text-gold',         border: 'border-gold/40',         bg: 'bg-gold/10'        },
}

// ─── Category colors ─────────────────────────────────────────────────────────

const CAT_COLOR: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-300',
  Philosophy:  'text-for-300',
  Culture:     'text-gold',
  Health:      'text-against-300',
  Environment: 'text-emerald',
  Education:   'text-purple',
}

function categoryColor(cat: string): string {
  return CAT_COLOR[cat] ?? 'text-surface-400'
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString()
}

function getInitials(displayName: string | null, username: string): string {
  const name = displayName || username
  const parts = name.trim().split(/\s+/)
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase()
  return name.slice(0, 2).toUpperCase()
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface PageProps {
  params: { username: string }
}

interface ProfileData {
  id: string
  username: string
  display_name: string | null
  bio: string | null
  role: string
  clout: number
  reputation_score: number
  total_votes: number
  blue_vote_count: number
  red_vote_count: number
  total_arguments: number
  vote_streak: number
  created_at: string
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = await createClient()

  const { data } = await supabase
    .from('profiles')
    .select('username, display_name, role, clout, total_votes, reputation_score')
    .eq('username', params.username)
    .maybeSingle()

  if (!data) return { title: 'Lobby Market' }

  const displayName = data.display_name || data.username
  const roleLabel = ROLE_LABEL[data.role] ?? 'CITIZEN'
  const title = `${displayName} · Civic Profile · Lobby Market`
  const description = `${roleLabel} on Lobby Market — ${data.total_votes.toLocaleString()} votes cast · ${data.clout.toLocaleString()} clout earned`
  const ogImageUrl = `${BASE_URL}/api/og/profile/${encodeURIComponent(data.username)}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
      siteName: 'Lobby Market',
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: `${displayName}'s civic profile` }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
  }
}

// ─── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  iconColor,
  iconBg,
  label,
  value,
  sub,
}: {
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  iconBg: string
  label: string
  value: string
  sub?: string
}) {
  return (
    <div className="flex flex-col gap-1 rounded-xl bg-surface-200/60 border border-surface-300/60 p-4">
      <div className={cn('flex items-center justify-center h-8 w-8 rounded-lg mb-1', iconBg)}>
        <Icon className={cn('h-4 w-4', iconColor)} aria-hidden="true" />
      </div>
      <span className="text-xl font-mono font-bold text-white leading-none">{value}</span>
      <span className="text-[11px] font-mono text-surface-500 leading-tight">{label}</span>
      {sub && <span className="text-[10px] font-mono text-surface-600 leading-tight">{sub}</span>}
    </div>
  )
}

// ─── Political lean bar ────────────────────────────────────────────────────────

function LeanBar({ blueVotes, redVotes }: { blueVotes: number; redVotes: number }) {
  const total = blueVotes + redVotes
  if (total === 0) return null

  const forPct = Math.round((blueVotes / total) * 100)
  const againstPct = 100 - forPct
  const lean = forPct >= 50 ? 'FOR-leaning' : 'AGAINST-leaning'
  const leanColor = forPct >= 50 ? 'text-for-400' : 'text-against-400'
  const dominant = forPct >= 50 ? forPct : againstPct

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-[11px] font-mono">
        <span className="text-for-400 font-semibold">{forPct}% FOR</span>
        <span className={cn('font-semibold', leanColor)}>{dominant}% {lean}</span>
        <span className="text-against-400 font-semibold">{againstPct}% AGAINST</span>
      </div>
      <div
        className="relative h-2.5 w-full rounded-full overflow-hidden bg-surface-300"
        role="img"
        aria-label={`Political lean: ${forPct}% For, ${againstPct}% Against`}
      >
        <div
          className="absolute inset-y-0 left-0 rounded-l-full bg-gradient-to-r from-for-700 to-for-500"
          style={{ width: `${forPct}%` }}
        />
        <div
          className="absolute inset-y-0 right-0 rounded-r-full bg-gradient-to-l from-against-700 to-against-500"
          style={{ width: `${againstPct}%` }}
        />
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export const dynamic = 'force-dynamic'

export default async function ShareProfilePage({ params }: PageProps) {
  const supabase = await createClient()

  const { data: rawProfile } = await supabase
    .from('profiles')
    .select(
      'id, username, display_name, bio, role, clout, reputation_score, ' +
      'total_votes, blue_vote_count, red_vote_count, total_arguments, vote_streak, created_at'
    )
    .eq('username', params.username)
    .maybeSingle()

  if (!rawProfile) notFound()

  const profile = rawProfile as unknown as ProfileData

  // Count laws the user contributed to (authored topics that became law)
  const { count: lawCount } = await supabase
    .from('topics')
    .select('id', { count: 'exact', head: true })
    .eq('author_id', profile.id)
    .eq('status', 'law')

  // Get top 3 categories from user's vote history
  const { data: voteRows } = await supabase
    .from('votes')
    .select('topic_id')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(100)

  const topicIds = Array.from(new Set((voteRows ?? []).map((v) => v.topic_id)))
  let topCategories: string[] = []
  if (topicIds.length > 0) {
    const { data: topics } = await supabase
      .from('topics')
      .select('category')
      .in('id', topicIds.slice(0, 100))
    const catCounts = new Map<string, number>()
    for (const t of topics ?? []) {
      if (!t.category) continue
      catCounts.set(t.category, (catCounts.get(t.category) ?? 0) + 1)
    }
    topCategories = Array.from(catCounts.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
      .map(([cat]) => cat)
  }

  const displayName = profile.display_name || profile.username
  const initials = getInitials(profile.display_name, profile.username)
  const roleLabel = ROLE_LABEL[profile.role] ?? 'CITIZEN'
  const roleStyle = ROLE_COLOR[profile.role] ?? ROLE_COLOR.person
  const memberSince = new Date(profile.created_at).toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })

  const blueVotes = profile.blue_vote_count ?? 0
  const redVotes = profile.red_vote_count ?? 0

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <main className="flex-1 flex flex-col items-center justify-start px-4 py-10 pb-28 md:pb-12">
        <div className="w-full max-w-sm space-y-5">

          {/* ── Avatar + Name ─────────────────────────────────────────── */}
          <div className="text-center">
            {/* Avatar circle */}
            <div
              className={cn(
                'mx-auto flex items-center justify-center h-20 w-20 rounded-full border-2 mb-4',
                'text-2xl font-mono font-bold',
                roleStyle.bg,
                roleStyle.border,
                roleStyle.text,
              )}
              aria-hidden="true"
            >
              {initials}
            </div>

            <h1 className="text-2xl font-mono font-bold text-white leading-tight">{displayName}</h1>
            <p className="text-sm font-mono text-surface-500 mt-0.5">@{profile.username}</p>

            {/* Role badge */}
            <div
              className={cn(
                'inline-flex items-center gap-1.5 mt-3 px-3 py-1 rounded-full text-[11px] font-mono font-bold border',
                roleStyle.text,
                roleStyle.border,
                roleStyle.bg,
              )}
            >
              <Star className="h-3 w-3" aria-hidden="true" />
              {roleLabel}
            </div>
          </div>

          {/* ── Bio ─────────────────────────────────────────────────────── */}
          {profile.bio && (
            <p className="text-sm font-mono text-surface-400 text-center leading-relaxed px-2">
              {profile.bio}
            </p>
          )}

          {/* ── Civic Stats grid ─────────────────────────────────────────── */}
          <div className="grid grid-cols-2 gap-2.5">
            <StatCard
              icon={Vote}
              iconColor="text-for-400"
              iconBg="bg-for-500/15"
              label="Votes cast"
              value={formatNum(profile.total_votes)}
            />
            <StatCard
              icon={Flame}
              iconColor="text-gold"
              iconBg="bg-gold/15"
              label="Clout"
              value={formatNum(profile.clout)}
            />
            <StatCard
              icon={TrendingUp}
              iconColor="text-purple"
              iconBg="bg-purple/15"
              label="Reputation"
              value={formatNum(profile.reputation_score)}
            />
            <StatCard
              icon={MessageSquare}
              iconColor="text-emerald"
              iconBg="bg-emerald/15"
              label="Arguments"
              value={formatNum(profile.total_arguments)}
            />
            {(lawCount ?? 0) > 0 && (
              <StatCard
                icon={Gavel}
                iconColor="text-gold"
                iconBg="bg-gold/15"
                label="Laws made"
                value={formatNum(lawCount ?? 0)}
              />
            )}
            {profile.vote_streak > 0 && (
              <StatCard
                icon={Zap}
                iconColor="text-for-300"
                iconBg="bg-for-600/15"
                label="Vote streak"
                value={`${profile.vote_streak}d`}
                sub="consecutive days"
              />
            )}
          </div>

          {/* ── Political lean ────────────────────────────────────────────── */}
          {(blueVotes + redVotes) > 0 && (
            <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-3">
              <div className="flex items-center gap-2">
                <Scale className="h-3.5 w-3.5 text-surface-500" aria-hidden="true" />
                <span className="text-[11px] font-mono text-surface-500 uppercase tracking-wider">
                  Political lean
                </span>
              </div>
              <LeanBar blueVotes={blueVotes} redVotes={redVotes} />
            </div>
          )}

          {/* ── Top categories ────────────────────────────────────────────── */}
          {topCategories.length > 0 && (
            <div className="rounded-xl bg-surface-100 border border-surface-300 p-4">
              <div className="flex items-center gap-2 mb-3">
                <BarChart2 className="h-3.5 w-3.5 text-surface-500" aria-hidden="true" />
                <span className="text-[11px] font-mono text-surface-500 uppercase tracking-wider">
                  Top categories
                </span>
              </div>
              <div className="flex flex-wrap gap-2">
                {topCategories.map((cat) => (
                  <span
                    key={cat}
                    className={cn(
                      'px-2.5 py-1 rounded-full text-[11px] font-mono font-medium',
                      'bg-surface-200 border border-surface-300',
                      categoryColor(cat)
                    )}
                  >
                    {cat}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* ── Member since ──────────────────────────────────────────────── */}
          <p className="text-center text-xs font-mono text-surface-600">
            Civic member since {memberSince}
          </p>

          {/* ── CTAs ──────────────────────────────────────────────────────── */}
          <div className="flex flex-col gap-3">
            <Link
              href={`/profile/${profile.username}`}
              className={cn(
                'flex items-center justify-center gap-2 py-3.5 rounded-xl',
                'font-mono font-bold text-sm transition-all',
                'bg-for-600 hover:bg-for-500 text-white',
              )}
            >
              View full profile
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>

            <Link
              href="/"
              className={cn(
                'flex items-center justify-center gap-2 py-3 rounded-xl',
                'font-mono text-sm text-surface-400 hover:text-white',
                'bg-surface-200 border border-surface-300 hover:border-surface-400 transition-all',
              )}
            >
              Explore Lobby Market
            </Link>
          </div>

          {/* ── Brand ────────────────────────────────────────────────────── */}
          <div className="flex flex-col items-center gap-1 pt-4">
            <div className="flex items-center gap-1">
              <span className="text-white font-bold text-lg tracking-wider">LOBBY</span>
              <span className="text-surface-500 font-bold text-lg tracking-wider">MARKET</span>
            </div>
            <div className="flex h-0.5 w-24">
              <div className="flex-1 bg-for-500 rounded-l-full" />
              <div className="flex-1 bg-against-500 rounded-r-full" />
            </div>
            <p className="text-xs font-mono text-surface-600 mt-1">
              The people&apos;s consensus engine
            </p>
          </div>

        </div>
      </main>
      <BottomNav />
    </div>
  )
}
