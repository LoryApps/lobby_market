import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowUpRight,
  ChevronRight,
  Crown,
  FileText,
  Flag,
  Gavel,
  Landmark,
  MessageSquare,
  Scale,
  ScrollText,
  Shield,
  Swords,
  Users,
  Vote,
  Zap,
  Building2,
  CheckCircle2,
  AlertTriangle,
  TrendingUp,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils/cn'

export const dynamic = 'force-dynamic'
export const revalidate = 300

export const metadata: Metadata = {
  title: 'His Majesty\'s Government · Lobby Market',
  description:
    'The ruling civic government of the Lobby — the coalition in power, the Prime Minister, their legislative programme, and the government bench.',
  openGraph: {
    title: 'HM Government · Lobby Market',
    description:
      'The governing coalition of the Lobby Market civic parliament. See who holds power, their legislative programme, and their record in office.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'HM Government · Lobby Market',
    description:
      'The ruling civic government — coalition in power, Prime Minister, and legislative programme.',
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-GB', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })
}

const CATEGORY_COLORS: Record<string, string> = {
  Politics:    'text-for-400',
  Economics:   'text-gold',
  Technology:  'text-purple',
  Health:      'text-emerald',
  Science:     'text-for-300',
  Ethics:      'text-against-300',
  Culture:     'text-against-400',
  Philosophy:  'text-purple',
  Education:   'text-for-400',
  Environment: 'text-emerald',
}

function catColor(cat: string | null): string {
  return CATEGORY_COLORS[cat ?? ''] ?? 'text-surface-500'
}

const STATUS_BADGE: Record<string, { label: string; cls: string }> = {
  proposed: { label: 'Proposed',  cls: 'bg-surface-300/20 border-surface-400/30 text-surface-400' },
  active:   { label: 'Active',    cls: 'bg-for-500/10 border-for-500/30 text-for-400' },
  voting:   { label: 'Voting',    cls: 'bg-purple/10 border-purple/30 text-purple' },
  law:      { label: 'LAW',       cls: 'bg-gold/10 border-gold/30 text-gold' },
  failed:   { label: 'Failed',    cls: 'bg-against-500/10 border-against-500/30 text-against-400' },
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  title,
  subtitle,
  href,
  badge,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  subtitle?: string
  href?: string
  badge?: string
}) {
  return (
    <div className="flex items-start justify-between mb-4">
      <div className="flex items-center gap-3">
        <div className="p-2 rounded-xl bg-surface-200 border border-surface-300">
          <Icon className="h-4 w-4 text-gold" />
        </div>
        <div>
          <h2 className="text-sm font-bold text-white tracking-wider uppercase">{title}</h2>
          {subtitle && <p className="text-xs text-surface-500 mt-0.5">{subtitle}</p>}
        </div>
        {badge && (
          <span className="px-2 py-0.5 rounded-full bg-gold/20 border border-gold/30 text-gold text-[10px] font-mono font-bold">
            {badge}
          </span>
        )}
      </div>
      {href && (
        <Link
          href={href}
          className="flex items-center gap-1 text-xs text-surface-500 hover:text-gold transition-colors"
        >
          View all
          <ChevronRight className="h-3 w-3" />
        </Link>
      )}
    </div>
  )
}

// ─── Stat pill ─────────────────────────────────────────────────────────────────

function StatPill({ icon: Icon, value, label }: {
  icon: React.ComponentType<{ className?: string }>
  value: string | number
  label: string
}) {
  return (
    <div className="flex items-center gap-1.5 text-xs text-surface-400">
      <Icon className="h-3.5 w-3.5 text-surface-500 shrink-0" />
      <span className="font-semibold text-white">{value}</span>
      <span>{label}</span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function GovernmentPage() {
  const supabase = await createClient()

  // ── Fetch data in parallel ────────────────────────────────────────────────
  const [
    govCoalitionRes,
    lawsPassedRes,
    oppositionRes,
    activeTopicsRes,
  ] = await Promise.allSettled([
    // Ruling coalition: highest influence + public
    supabase
      .from('coalitions')
      .select('id, name, description, member_count, coalition_influence, wins, losses, created_at, creator_id')
      .eq('is_public', true)
      .order('coalition_influence', { ascending: false })
      .order('member_count', { ascending: false })
      .limit(1)
      .maybeSingle(),

    // Laws passed on the platform (global stat)
    supabase
      .from('topics')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'law'),

    // Opposition: second-highest coalition
    supabase
      .from('coalitions')
      .select('id, name, member_count, coalition_influence, creator_id')
      .eq('is_public', true)
      .order('coalition_influence', { ascending: false })
      .order('member_count', { ascending: false })
      .range(1, 1)
      .maybeSingle(),

    // Active topics in voting/active phase for programme
    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .in('status', ['voting', 'active'])
      .order('total_votes', { ascending: false })
      .limit(20),
  ])

  const govCoalition = govCoalitionRes.status === 'fulfilled' ? govCoalitionRes.value.data : null
  const lawsCount = lawsPassedRes.status === 'fulfilled' ? (lawsPassedRes.value.count ?? 0) : 0
  const opposition = oppositionRes.status === 'fulfilled' ? oppositionRes.value.data : null
  const activeTopics = activeTopicsRes.status === 'fulfilled' ? (activeTopicsRes.value.data ?? []) : []

  // ── Government members (leader + officers) ────────────────────────────────
  let govMembers: Array<{
    user_id: string
    role: string
    username: string
    display_name: string | null
    avatar_url: string | null
    clout: number
    reputation_score: number
    total_votes: number
    total_arguments: number
  }> = []

  let pmProfile: typeof govMembers[number] | null = null

  if (govCoalition) {
    const { data: members } = await supabase
      .from('coalition_members')
      .select('user_id, role')
      .eq('coalition_id', govCoalition.id)
      .in('role', ['leader', 'officer'])
      .limit(10)

    if (members && members.length > 0) {
      const memberIds = members.map((m) => m.user_id)
      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, clout, reputation_score, total_votes, total_arguments')
        .in('id', memberIds)

      if (profiles) {
        const roleMap = Object.fromEntries(members.map((m) => [m.user_id, m.role]))
        govMembers = profiles
          .map((p) => ({ ...p, user_id: p.id, role: roleMap[p.id] ?? 'member' }))
          .sort((a, b) => {
            if (a.role === 'leader' && b.role !== 'leader') return -1
            if (b.role === 'leader' && a.role !== 'leader') return 1
            return b.clout - a.clout
          })
        pmProfile = govMembers.find((m) => m.role === 'leader') ?? govMembers[0] ?? null
      }
    }

    // Fallback PM: highest-clout member of the coalition
    if (!pmProfile) {
      const { data: allMembers } = await supabase
        .from('coalition_members')
        .select('user_id')
        .eq('coalition_id', govCoalition.id)
        .limit(50)

      if (allMembers && allMembers.length > 0) {
        const ids = allMembers.map((m) => m.user_id)
        const { data: topProfile } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, clout, reputation_score, total_votes, total_arguments')
          .in('id', ids)
          .order('clout', { ascending: false })
          .limit(1)
          .maybeSingle()

        if (topProfile) {
          pmProfile = { ...topProfile, user_id: topProfile.id, role: 'leader' }
          govMembers = [pmProfile]
        }
      }
    }
  }

  // ── Coalition stances ─────────────────────────────────────────────────────
  let programme: Array<{
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
    stance: string
    stance_statement: string | null
  }> = []

  if (govCoalition) {
    const { data: stances } = await supabase
      .from('coalition_stances')
      .select('topic_id, stance, statement')
      .eq('coalition_id', govCoalition.id)
      .eq('stance', 'for')
      .limit(6)

    if (stances && stances.length > 0) {
      const topicIds = stances.map((s) => s.topic_id)
      const { data: topics } = await supabase
        .from('topics')
        .select('id, statement, category, status, blue_pct, total_votes')
        .in('id', topicIds)
        .in('status', ['proposed', 'active', 'voting', 'law'])

      if (topics) {
        const stanceMap = Object.fromEntries(
          stances.map((s) => [s.topic_id, { stance: s.stance, statement: s.statement }])
        )
        programme = topics.map((t) => ({
          ...t,
          blue_pct: t.blue_pct ?? 50,
          total_votes: t.total_votes ?? 0,
          stance: stanceMap[t.id]?.stance ?? 'for',
          stance_statement: stanceMap[t.id]?.statement ?? null,
        }))
      }
    }

    // If no explicit stances, show the top active topics as a proxy programme
    if (programme.length === 0) {
      programme = activeTopics.slice(0, 5).map((t) => ({
        ...t,
        blue_pct: t.blue_pct ?? 50,
        total_votes: t.total_votes ?? 0,
        stance: 'for',
        stance_statement: null,
      }))
    }
  }

  // ── Win rate ──────────────────────────────────────────────────────────────
  const totalDebates = (govCoalition?.wins ?? 0) + (govCoalition?.losses ?? 0)
  const winRate = totalDebates > 0
    ? Math.round(((govCoalition?.wins ?? 0) / totalDebates) * 100)
    : null

  // ── Opposition leader ─────────────────────────────────────────────────────
  let oppLeader: {
    username: string
    display_name: string | null
    avatar_url: string | null
    clout: number
  } | null = null

  if (opposition) {
    const { data: oppLeaderMember } = await supabase
      .from('coalition_members')
      .select('user_id')
      .eq('coalition_id', opposition.id)
      .eq('role', 'leader')
      .maybeSingle()

    if (oppLeaderMember) {
      const { data: p } = await supabase
        .from('profiles')
        .select('username, display_name, avatar_url, clout')
        .eq('id', oppLeaderMember.user_id)
        .maybeSingle()
      oppLeader = p ?? null
    }
  }

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-surface-0 text-white">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-20 pb-28 space-y-10">

        {/* ── Breadcrumb ─────────────────────────────────────────────────── */}
        <nav className="flex items-center gap-1.5 text-xs text-surface-500">
          <Link href="/parliament" className="hover:text-surface-300 transition-colors">
            Parliament
          </Link>
          <ChevronRight className="h-3 w-3" />
          <span className="text-surface-300">HM Government</span>
        </nav>

        {/* ── Page title ─────────────────────────────────────────────────── */}
        <header className="space-y-2">
          <div className="flex items-center gap-3">
            <div className="p-3 rounded-2xl bg-gold/10 border border-gold/30">
              <Crown className="h-6 w-6 text-gold" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-white">His Majesty&apos;s Government</h1>
              <p className="text-sm text-surface-500 mt-0.5">
                The ruling coalition of the civic parliament
              </p>
            </div>
          </div>
        </header>

        {!govCoalition ? (
          /* ── No government formed ─────────────────────────────────────── */
          <div className="p-10 rounded-2xl bg-surface-100 border border-surface-300 text-center space-y-4">
            <Building2 className="h-10 w-10 text-surface-500 mx-auto" />
            <div>
              <p className="text-sm font-semibold text-white">No Government Formed</p>
              <p className="text-xs text-surface-500 mt-1">
                No coalitions have yet established enough influence to form a government.
                Build or join a coalition to compete for power.
              </p>
            </div>
            <Link
              href="/coalitions"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gold/10 border border-gold/30 text-gold text-sm font-semibold hover:bg-gold/20 transition-all"
            >
              <Users className="h-4 w-4" />
              Browse Coalitions
            </Link>
          </div>
        ) : (
          <>
            {/* ── Government banner ────────────────────────────────────── */}
            <section
              className="relative overflow-hidden rounded-2xl border border-gold/30 bg-gradient-to-br from-gold/10 via-surface-100 to-surface-100 p-6"
              aria-label="Ruling Government"
            >
              {/* Background crest */}
              <Crown
                className="absolute -right-6 -top-6 h-32 w-32 text-gold/5 rotate-12"
                aria-hidden="true"
              />

              <div className="relative space-y-5">
                {/* Coalition name */}
                <div className="flex items-start justify-between gap-4">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <span className="text-[10px] font-mono font-bold px-2 py-0.5 rounded-full bg-gold/20 border border-gold/40 text-gold uppercase tracking-widest">
                        Government
                      </span>
                      <span className="text-[10px] text-surface-500">
                        In office since {formatDate(govCoalition.created_at)}
                      </span>
                    </div>
                    <h2 className="text-xl font-bold text-white leading-tight">
                      {govCoalition.name}
                    </h2>
                    {govCoalition.description && (
                      <p className="text-sm text-surface-400 mt-1 line-clamp-2">
                        {govCoalition.description}
                      </p>
                    )}
                  </div>
                  <Link
                    href={`/coalitions`}
                    className="shrink-0 flex items-center gap-1 text-xs text-gold hover:text-gold/80 transition-colors"
                  >
                    View coalition
                    <ArrowUpRight className="h-3.5 w-3.5" />
                  </Link>
                </div>

                {/* Government stats row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-surface-200/80 border border-surface-300/60 text-center">
                    <p className="text-lg font-mono font-bold text-white">
                      {govCoalition.member_count.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-surface-500 mt-0.5">Members</p>
                  </div>
                  <div className="p-3 rounded-xl bg-surface-200/80 border border-surface-300/60 text-center">
                    <p className="text-lg font-mono font-bold text-gold">
                      {govCoalition.coalition_influence.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-surface-500 mt-0.5">Influence</p>
                  </div>
                  <div className="p-3 rounded-xl bg-surface-200/80 border border-surface-300/60 text-center">
                    <p className="text-lg font-mono font-bold text-emerald">
                      {govCoalition.wins.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-surface-500 mt-0.5">Debates Won</p>
                  </div>
                  <div className="p-3 rounded-xl bg-surface-200/80 border border-surface-300/60 text-center">
                    <p className="text-lg font-mono font-bold text-white">
                      {winRate !== null ? `${winRate}%` : '—'}
                    </p>
                    <p className="text-[10px] text-surface-500 mt-0.5">Win Rate</p>
                  </div>
                </div>
              </div>
            </section>

            {/* ── Two-column layout ─────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

              {/* ── LEFT COLUMN ──────────────────────────────────────────── */}
              <div className="space-y-8">

                {/* Prime Minister */}
                {pmProfile && (
                  <section aria-label="Prime Minister">
                    <SectionHeader
                      icon={Crown}
                      title="Prime Minister"
                      subtitle="Leader of the governing coalition"
                    />
                    <Link
                      href={`/profile/${pmProfile.username}`}
                      className="group flex items-center gap-4 p-4 rounded-2xl bg-surface-100 border border-gold/20 hover:border-gold/50 hover:bg-surface-100/80 transition-all"
                    >
                      <div className="relative shrink-0">
                        <Avatar
                          src={pmProfile.avatar_url}
                          fallback={pmProfile.display_name ?? pmProfile.username}
                          size="lg"
                          className="ring-2 ring-gold/40 group-hover:ring-gold/70 transition-all"
                        />
                        <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-gold border border-surface-0">
                          <Crown className="h-3 w-3 text-surface-0" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-mono uppercase tracking-widest text-gold mb-0.5">
                          Prime Minister
                        </p>
                        <p className="text-base font-bold text-white truncate group-hover:text-gold transition-colors">
                          {pmProfile.display_name ?? pmProfile.username}
                        </p>
                        <p className="text-xs text-surface-500 truncate">
                          @{pmProfile.username}
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                          <StatPill icon={Zap} value={pmProfile.clout.toLocaleString()} label="clout" />
                          <StatPill icon={Vote} value={pmProfile.total_votes.toLocaleString()} label="votes" />
                          <StatPill icon={MessageSquare} value={pmProfile.total_arguments.toLocaleString()} label="args" />
                        </div>
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-surface-600 group-hover:text-gold transition-colors shrink-0" />
                    </Link>
                  </section>
                )}

                {/* Government Bench (Cabinet) */}
                {govMembers.length > 1 && (
                  <section aria-label="Government Bench">
                    <SectionHeader
                      icon={Users}
                      title="Government Bench"
                      subtitle="Cabinet officers of the ruling coalition"
                      href={`/coalitions`}
                    />
                    <div className="space-y-2">
                      {govMembers.slice(1, 6).map((member) => (
                        <Link
                          key={member.user_id}
                          href={`/profile/${member.username}`}
                          className="flex items-center gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300/40 hover:border-gold/30 hover:bg-surface-100/80 transition-all group"
                        >
                          <Avatar
                            src={member.avatar_url}
                            fallback={member.display_name ?? member.username}
                            size="sm"
                            className="ring-1 ring-surface-400/30 shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white truncate group-hover:text-gold transition-colors">
                              {member.display_name ?? member.username}
                            </p>
                            <p className="text-[11px] text-surface-500 truncate">
                              @{member.username}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] font-mono text-gold">
                              {member.clout.toLocaleString()}
                            </span>
                            <span className="text-[10px] text-surface-600">clout</span>
                            {member.role === 'officer' && (
                              <span className="ml-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-for-500/10 border border-for-500/20 text-for-400">
                                Officer
                              </span>
                            )}
                          </div>
                        </Link>
                      ))}
                    </div>
                  </section>
                )}

                {/* Global platform stats */}
                <section aria-label="Platform record">
                  <SectionHeader
                    icon={Gavel}
                    title="Legislative Record"
                    subtitle="Laws established across the platform"
                    href="/laws"
                  />
                  <div className="grid grid-cols-2 gap-3">
                    <div className="p-4 rounded-xl bg-surface-100 border border-gold/20 text-center">
                      <p className="text-2xl font-mono font-bold text-gold">
                        {lawsCount.toLocaleString()}
                      </p>
                      <p className="text-xs text-surface-500 mt-1">Laws Established</p>
                    </div>
                    <div className="p-4 rounded-xl bg-surface-100 border border-surface-300/40 text-center">
                      <p className="text-2xl font-mono font-bold text-white">
                        {activeTopics.length}
                      </p>
                      <p className="text-xs text-surface-500 mt-1">Active Debates</p>
                    </div>
                  </div>
                </section>
              </div>

              {/* ── RIGHT COLUMN ─────────────────────────────────────────── */}
              <div className="space-y-8">

                {/* Government Programme */}
                <section aria-label="Legislative programme">
                  <SectionHeader
                    icon={ScrollText}
                    title="Government Programme"
                    subtitle="Topics the government is driving forward"
                    href="/topics"
                    badge={programme.length > 0 ? `${programme.length} items` : undefined}
                  />
                  {programme.length === 0 ? (
                    <div className="p-6 rounded-xl bg-surface-100 border border-surface-300/40 text-center">
                      <p className="text-xs text-surface-500">
                        No programme declared yet. The government has not taken stances on any topics.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {programme.map((item) => {
                        const badge = STATUS_BADGE[item.status] ?? STATUS_BADGE.proposed
                        const forPct = Math.round(item.blue_pct)
                        const againstPct = 100 - forPct
                        return (
                          <Link
                            key={item.id}
                            href={`/topic/${item.id}`}
                            className="block p-3 rounded-xl bg-surface-100 border border-surface-300/40 hover:border-for-500/40 hover:bg-surface-100/80 transition-all group"
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <p className="text-xs font-semibold text-white leading-tight line-clamp-2 flex-1 group-hover:text-for-300 transition-colors">
                                {item.statement}
                              </p>
                              <span className={cn(
                                'shrink-0 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border',
                                badge.cls,
                              )}>
                                {badge.label}
                              </span>
                            </div>
                            {item.stance_statement && (
                              <p className="text-[11px] text-surface-500 italic mb-2 line-clamp-1">
                                &ldquo;{item.stance_statement}&rdquo;
                              </p>
                            )}
                            <div className="flex items-center gap-2 mb-1.5">
                              <CheckCircle2 className="h-3 w-3 text-for-400 shrink-0" />
                              <div className="flex-1 h-1 rounded-full bg-surface-300 overflow-hidden">
                                <div
                                  className="h-full bg-for-500 rounded-full"
                                  style={{ width: `${forPct}%` }}
                                />
                              </div>
                              <span className="text-[10px] text-surface-500 shrink-0">
                                {forPct}%F / {againstPct}%A
                              </span>
                            </div>
                            <div className="flex items-center gap-2 text-[10px] text-surface-600">
                              {item.category && (
                                <span className={cn('font-medium', catColor(item.category))}>
                                  {item.category}
                                </span>
                              )}
                              {item.total_votes > 0 && (
                                <>
                                  <span>·</span>
                                  <span>{item.total_votes.toLocaleString()} votes</span>
                                </>
                              )}
                            </div>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </section>

                {/* Official Opposition */}
                {opposition && (
                  <section aria-label="Official Opposition">
                    <SectionHeader
                      icon={Swords}
                      title="Official Opposition"
                      subtitle="The second-largest coalition in the Lobby"
                      href="/shadow-cabinet"
                    />
                    <div className="p-4 rounded-xl bg-surface-100 border border-against-500/20">
                      <div className="flex items-center justify-between gap-4">
                        <div>
                          <p className="text-sm font-bold text-white">{opposition.name}</p>
                          <div className="flex items-center gap-3 mt-1.5">
                            <StatPill icon={Users} value={opposition.member_count} label="members" />
                            <StatPill icon={TrendingUp} value={opposition.coalition_influence} label="influence" />
                          </div>
                        </div>
                        {oppLeader && (
                          <Link href={`/profile/${oppLeader.username}`} className="shrink-0">
                            <Avatar
                              src={oppLeader.avatar_url}
                              fallback={oppLeader.display_name ?? oppLeader.username}
                              size="md"
                              className="ring-2 ring-against-500/30 hover:ring-against-500/60 transition-all"
                            />
                          </Link>
                        )}
                      </div>
                      {oppLeader && (
                        <p className="text-[11px] text-surface-500 mt-2">
                          Leader of the Opposition:{' '}
                          <Link
                            href={`/profile/${oppLeader.username}`}
                            className="text-against-400 hover:text-against-300 transition-colors font-medium"
                          >
                            {oppLeader.display_name ?? oppLeader.username}
                          </Link>
                        </p>
                      )}
                    </div>
                  </section>
                )}

              </div>
            </div>

            {/* ── Parliamentary links ─────────────────────────────────── */}
            <section aria-label="Related parliamentary pages">
              <div className="flex items-center gap-2 mb-4">
                <Landmark className="h-3.5 w-3.5 text-surface-500" />
                <h2 className="text-xs font-bold text-surface-500 uppercase tracking-widest">
                  Parliamentary Chambers
                </h2>
              </div>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                {[
                  {
                    href: '/parliament',
                    label: 'Parliament Hub',
                    sublabel: 'Full Westminster overview',
                    icon: Building2,
                    color: 'text-for-400',
                    bg: 'bg-for-500/5',
                    border: 'border-for-500/20',
                  },
                  {
                    href: '/order-paper',
                    label: 'Order Paper',
                    sublabel: 'Legislative agenda',
                    icon: FileText,
                    color: 'text-purple',
                    bg: 'bg-purple/5',
                    border: 'border-purple/20',
                  },
                  {
                    href: '/opposition',
                    label: 'HM Opposition',
                    sublabel: 'Official opposition bench',
                    icon: Flag,
                    color: 'text-against-400',
                    bg: 'bg-against-500/5',
                    border: 'border-against-500/20',
                  },
                  {
                    href: '/shadow-cabinet',
                    label: 'Shadow Cabinet',
                    sublabel: 'Opposition portfolio',
                    icon: Shield,
                    color: 'text-against-400',
                    bg: 'bg-against-500/5',
                    border: 'border-against-500/20',
                  },
                  {
                    href: '/grand-council',
                    label: 'Grand Council',
                    sublabel: 'Binding motions',
                    icon: Landmark,
                    color: 'text-gold',
                    bg: 'bg-gold/5',
                    border: 'border-gold/20',
                  },
                  {
                    href: '/civic-questions',
                    label: 'Questions Time',
                    sublabel: 'Challenge leadership',
                    icon: MessageSquare,
                    color: 'text-for-300',
                    bg: 'bg-for-300/5',
                    border: 'border-for-300/20',
                  },
                  {
                    href: '/coalitions',
                    label: 'All Coalitions',
                    sublabel: 'Challenge for power',
                    icon: Users,
                    color: 'text-emerald',
                    bg: 'bg-emerald/5',
                    border: 'border-emerald/20',
                  },
                ].map((item) => {
                  const Icon = item.icon
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      className={cn(
                        'group flex flex-col gap-2 p-3.5 rounded-xl border transition-all duration-200',
                        'hover:scale-[1.02] hover:shadow-md',
                        item.bg, item.border,
                      )}
                    >
                      <div className="flex items-center justify-between">
                        <Icon className={cn('h-4 w-4', item.color)} />
                        <ArrowUpRight className="h-3 w-3 text-surface-600 group-hover:text-surface-400 transition-colors" />
                      </div>
                      <div>
                        <p className="text-xs font-bold text-white">{item.label}</p>
                        <p className="text-[10px] text-surface-500 mt-0.5">{item.sublabel}</p>
                      </div>
                    </Link>
                  )
                })}
              </div>
            </section>

            {/* No confidence prompt */}
            <section className="p-4 rounded-xl bg-surface-100 border border-against-500/20">
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-4 w-4 text-against-400 shrink-0 mt-0.5" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-semibold text-white">Challenge the Government</p>
                  <p className="text-[11px] text-surface-500 mt-0.5 leading-relaxed">
                    Table a formal motion of no confidence. Citizens will vote over 7 days. A
                    majority carries the motion — triggering a constitutional crisis.
                  </p>
                </div>
                <Link
                  href="/confidence"
                  className="shrink-0 flex items-center gap-1 px-3 py-1.5 rounded-lg bg-against-500/10 border border-against-500/20 text-against-400 text-xs font-semibold hover:bg-against-500/20 transition-all"
                >
                  <Scale className="h-3 w-3" />
                  Motion
                </Link>
              </div>
            </section>
          </>
        )}

      </main>

      <BottomNav />
    </div>
  )
}
