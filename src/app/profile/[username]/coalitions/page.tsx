import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  ChevronRight,
  Crown,
  Flag,
  Shield,
  Star,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'

export const dynamic = 'force-dynamic'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lobby.market'

// ─── Types ────────────────────────────────────────────────────────────────────

type MemberRole = 'leader' | 'officer' | 'member'
type RoleFilter = 'all' | MemberRole

interface CoalitionEntry {
  id: string
  name: string
  description: string | null
  member_count: number
  coalition_influence: number
  wins: number
  losses: number
  is_public: boolean
  created_at: string
  role: MemberRole
  joined_at: string
}

interface PageProps {
  params: { username: string }
  searchParams: { role?: string }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

function formatInfluence(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

// ─── Role config ──────────────────────────────────────────────────────────────

const ROLE_CONFIG: Record<
  MemberRole,
  {
    label: string
    icon: React.ComponentType<{ className?: string }>
    color: string
    bg: string
    border: string
  }
> = {
  leader:  { label: 'Leader',  icon: Crown,  color: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  officer: { label: 'Officer', icon: Shield, color: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  member:  { label: 'Member',  icon: Users,  color: 'text-surface-400', bg: 'bg-surface-200/60', border: 'border-surface-400/30' },
}

const FILTER_TABS: { id: RoleFilter; label: string }[] = [
  { id: 'all',     label: 'All' },
  { id: 'leader',  label: 'Leading' },
  { id: 'officer', label: 'Officer' },
  { id: 'member',  label: 'Member' },
]

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name')
    .eq('username', params.username)
    .maybeSingle()

  if (!profile) return { title: 'Coalitions · Lobby Market' }

  const displayName = profile.display_name ?? profile.username
  const title = `${displayName}'s Coalitions · Lobby Market`
  const description = `Coalition memberships for ${displayName} on Lobby Market — civic alliances, influence, and wins.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
      siteName: 'Lobby Market',
      url: `${BASE_URL}/profile/${params.username}/coalitions`,
      images: [{ url: `${BASE_URL}/api/og/profile/${params.username}`, width: 1200, height: 630, alt: title }],
    },
    twitter: { card: 'summary_large_image', title, description },
  }
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent = 'neutral',
}: {
  label: string
  value: string | number
  sub?: string
  accent?: 'for' | 'against' | 'gold' | 'emerald' | 'purple' | 'neutral'
}) {
  const accentClass = {
    for:     'text-for-400',
    against: 'text-against-400',
    gold:    'text-gold',
    emerald: 'text-emerald',
    purple:  'text-purple',
    neutral: 'text-white',
  }[accent]

  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 flex flex-col gap-1">
      <span className="text-[10px] font-mono text-surface-500 uppercase tracking-widest">{label}</span>
      <span className={cn('text-2xl font-black font-mono leading-none', accentClass)}>{value}</span>
      {sub && <span className="text-[10px] font-mono text-surface-600">{sub}</span>}
    </div>
  )
}

// ─── Coalition row ────────────────────────────────────────────────────────────

function CoalitionRow({ coalition }: { coalition: CoalitionEntry }) {
  const roleCfg = ROLE_CONFIG[coalition.role]
  const RoleIcon = roleCfg.icon
  const totalMatches = coalition.wins + coalition.losses
  const winRate = totalMatches > 0 ? Math.round((coalition.wins / totalMatches) * 100) : null

  return (
    <Link
      href={`/coalitions/${coalition.id}`}
      className="group flex flex-col gap-3 rounded-2xl border border-surface-300 bg-surface-100 p-4 hover:border-purple/40 hover:bg-purple/[0.03] transition-colors"
    >
      {/* Header row */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-purple/10 border border-purple/30 flex-shrink-0">
            <Users className="h-4.5 w-4.5 text-purple" />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-semibold text-white leading-snug truncate group-hover:text-purple transition-colors">
              {coalition.name}
            </p>
            {coalition.description && (
              <p className="text-[11px] text-surface-500 mt-0.5 line-clamp-1">
                {coalition.description}
              </p>
            )}
          </div>
        </div>
        <ChevronRight className="w-4 h-4 text-surface-500 shrink-0 mt-0.5 group-hover:text-surface-300 transition-colors" />
      </div>

      {/* Meta row */}
      <div className="flex items-center gap-2 flex-wrap">
        {/* Role badge */}
        <span
          className={cn(
            'flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-mono font-bold border',
            roleCfg.color, roleCfg.bg, roleCfg.border
          )}
        >
          <RoleIcon className="w-2.5 h-2.5" />
          {roleCfg.label}
        </span>

        {/* Member count */}
        <span className="flex items-center gap-1 text-[10px] font-mono text-surface-500">
          <Users className="w-2.5 h-2.5" />
          {coalition.member_count.toLocaleString()} member{coalition.member_count !== 1 ? 's' : ''}
        </span>

        {/* Influence */}
        {coalition.coalition_influence > 0 && (
          <span className="flex items-center gap-1 text-[10px] font-mono text-gold">
            <Zap className="w-2.5 h-2.5" />
            {formatInfluence(coalition.coalition_influence)} influence
          </span>
        )}

        {/* Win rate */}
        {winRate !== null && (
          <span
            className={cn(
              'flex items-center gap-1 text-[10px] font-mono',
              winRate >= 50 ? 'text-emerald' : 'text-against-400'
            )}
          >
            <Trophy className="w-2.5 h-2.5" />
            {winRate}% win rate ({coalition.wins}W–{coalition.losses}L)
          </span>
        )}

        {/* Joined date */}
        <span className="text-[10px] font-mono text-surface-600 ml-auto">
          Joined {formatDate(coalition.joined_at)}
        </span>
      </div>
    </Link>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ProfileCoalitionsPage({ params, searchParams }: PageProps) {
  const supabase = await createClient()

  // 1. Look up profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, clout, total_votes')
    .eq('username', params.username)
    .maybeSingle()

  if (!profile) notFound()

  // 2. Fetch coalition memberships with coalition details
  const { data: memberships } = await supabase
    .from('coalition_members')
    .select(`
      role,
      joined_at,
      coalitions (
        id,
        name,
        description,
        member_count,
        coalition_influence,
        wins,
        losses,
        is_public,
        created_at
      )
    `)
    .eq('user_id', profile.id)
    .order('joined_at', { ascending: false })

  const allCoalitions: CoalitionEntry[] = (memberships ?? [])
    .filter((m) => m.coalitions !== null)
    .map((m) => ({
      id: (m.coalitions as { id: string }).id,
      name: (m.coalitions as { name: string }).name,
      description: (m.coalitions as { description: string | null }).description,
      member_count: (m.coalitions as { member_count: number }).member_count ?? 0,
      coalition_influence: (m.coalitions as { coalition_influence: number }).coalition_influence ?? 0,
      wins: (m.coalitions as { wins: number }).wins ?? 0,
      losses: (m.coalitions as { losses: number }).losses ?? 0,
      is_public: (m.coalitions as { is_public: boolean }).is_public ?? true,
      created_at: (m.coalitions as { created_at: string }).created_at,
      role: m.role as MemberRole,
      joined_at: m.joined_at,
    }))

  // 3. Apply role filter
  const roleFilter = (searchParams.role ?? 'all') as RoleFilter
  const filteredCoalitions = roleFilter === 'all'
    ? allCoalitions
    : allCoalitions.filter((c) => c.role === roleFilter)

  // 4. Compute stats
  const totalCoalitions = allCoalitions.length
  const leadingCount = allCoalitions.filter((c) => c.role === 'leader').length
  const officerCount = allCoalitions.filter((c) => c.role === 'officer').length
  const totalInfluence = allCoalitions.reduce((sum, c) => sum + c.coalition_influence, 0)
  const totalWins = allCoalitions.reduce((sum, c) => sum + c.wins, 0)

  const displayName = profile.display_name ?? profile.username

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />
      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pb-24 pt-4 space-y-5">

        {/* Back link */}
        <Link
          href={`/profile/${params.username}`}
          className="inline-flex items-center gap-1.5 text-surface-400 hover:text-white text-sm transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to profile
        </Link>

        {/* Profile header */}
        <div className="flex items-center gap-3">
          <Avatar src={profile.avatar_url} fallback={profile.display_name ?? profile.username} size="md" />
          <div>
            <h1 className="text-lg font-bold text-white leading-tight">{displayName}</h1>
            <p className="text-sm text-surface-400 font-mono">@{profile.username} · Coalitions</p>
          </div>
        </div>

        {/* Stats grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Coalitions" value={totalCoalitions} accent="neutral" />
          <StatCard label="Leading" value={leadingCount} sub="as leader" accent="gold" />
          <StatCard label="Officer" value={officerCount} sub="roles held" accent="purple" />
          <StatCard
            label="Combined Wins"
            value={totalWins}
            sub={`${formatInfluence(totalInfluence)} influence`}
            accent="emerald"
          />
        </div>

        {/* Role filter tabs */}
        <div className="flex gap-1.5 flex-wrap">
          {FILTER_TABS.map((tab) => {
            const count = tab.id === 'all'
              ? allCoalitions.length
              : allCoalitions.filter((c) => c.role === tab.id).length
            const isActive = roleFilter === tab.id
            const isLeader = tab.id === 'leader'
            const isOfficer = tab.id === 'officer'
            return (
              <Link
                key={tab.id}
                href={tab.id === 'all'
                  ? `/profile/${params.username}/coalitions`
                  : `/profile/${params.username}/coalitions?role=${tab.id}`}
                className={cn(
                  'rounded-full px-3 py-1 text-[11px] font-mono font-bold border transition-colors',
                  isActive
                    ? isLeader
                      ? 'bg-gold/15 text-gold border-gold/40'
                      : isOfficer
                        ? 'bg-purple/15 text-purple border-purple/40'
                        : 'bg-for-500/20 text-for-300 border-for-500/50'
                    : 'bg-surface-100 text-surface-400 border-surface-300 hover:text-white hover:border-surface-400'
                )}
              >
                {tab.label}
                {count > 0 && (
                  <span className="ml-1 opacity-60">{count}</span>
                )}
              </Link>
            )
          })}
        </div>

        {/* Leadership callout */}
        {leadingCount > 0 && roleFilter === 'all' && (
          <div className="flex items-center gap-3 rounded-xl border border-gold/25 bg-gold/5 px-4 py-3">
            <Crown className="w-4 h-4 text-gold flex-shrink-0" />
            <p className="text-xs font-mono text-surface-400">
              <span className="text-gold font-semibold">{displayName}</span> leads {leadingCount} coalition{leadingCount !== 1 ? 's' : ''}.
              {' '}
              <Link href={`/profile/${params.username}/coalitions?role=leader`} className="text-gold/70 hover:text-gold transition-colors underline underline-offset-2">
                See them →
              </Link>
            </p>
          </div>
        )}

        {/* Coalition list */}
        {filteredCoalitions.length === 0 ? (
          <EmptyState
            icon={Users}
            title={roleFilter === 'all' ? 'No coalitions yet' : `No ${roleFilter} roles`}
            description={
              roleFilter === 'all'
                ? `${displayName} hasn't joined any coalitions yet.`
                : `${displayName} has no ${roleFilter} roles in any coalition.`
            }
            actions={
              roleFilter !== 'all'
                ? [{ label: 'View all coalitions', href: `/profile/${params.username}/coalitions` }]
                : undefined
            }
          />
        ) : (
          <div className="space-y-3">
            {/* Section header */}
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono text-surface-500 uppercase tracking-widest">
                {roleFilter === 'all'
                  ? 'All Coalitions'
                  : FILTER_TABS.find((t) => t.id === roleFilter)?.label ?? roleFilter}
                {' '}— {filteredCoalitions.length}
              </span>
              {leadingCount > 0 && roleFilter === 'all' && (
                <span className="flex items-center gap-1 text-[10px] font-mono text-gold">
                  <Crown className="w-3 h-3" />
                  {leadingCount} led
                </span>
              )}
            </div>

            {filteredCoalitions.map((coalition) => (
              <CoalitionRow key={coalition.id} coalition={coalition} />
            ))}
          </div>
        )}

        {/* Explore coalitions CTA */}
        {totalCoalitions === 0 && (
          <div className="flex flex-col items-center gap-3 pt-4">
            <Link
              href="/coalitions"
              className="inline-flex items-center gap-2 rounded-xl bg-purple/15 border border-purple/30 text-purple text-sm font-mono font-semibold px-5 py-2.5 hover:bg-purple/25 hover:border-purple/50 transition-colors"
            >
              <Flag className="w-4 h-4" />
              Browse Coalitions
            </Link>
          </div>
        )}

        {/* Achievement highlight */}
        {totalCoalitions > 0 && (
          <div className="flex items-center gap-3 rounded-xl border border-surface-300 bg-surface-100 px-4 py-3">
            <Star className="w-4 h-4 text-surface-500 flex-shrink-0" />
            <p className="text-xs font-mono text-surface-500">
              Active in {totalCoalitions} coalition{totalCoalitions !== 1 ? 's' : ''} ·{' '}
              {formatInfluence(totalInfluence)} combined influence ·{' '}
              <Link href="/coalitions" className="text-purple/80 hover:text-purple transition-colors underline underline-offset-2">
                Explore all coalitions
              </Link>
            </p>
          </div>
        )}

        {/* Footer link back to profile */}
        <div className="flex items-center justify-center pt-4">
          <Link
            href={`/profile/${params.username}`}
            className="inline-flex items-center gap-1.5 text-sm text-surface-500 hover:text-white transition-colors"
          >
            <Users className="w-4 h-4" />
            View full profile
          </Link>
        </div>
      </main>
      <BottomNav />
    </div>
  )
}
