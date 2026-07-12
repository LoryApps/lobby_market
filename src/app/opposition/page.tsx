import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowUpRight,
  ChevronRight,
  Flag,
  Landmark,
  MessageSquare,
  Scale,
  Shield,
  Swords,
  TrendingDown,
  Users,
  Vote,
  XCircle,
  Zap,
  AlertTriangle,
  CheckCircle2,
  BookOpen,
  Target,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils/cn'

export const dynamic = 'force-dynamic'
export const revalidate = 300

export const metadata: Metadata = {
  title: "His Majesty's Official Opposition · Lobby Market",
  description:
    'The Official Opposition — the largest civic coalition not in government, their Leader, Shadow Cabinet, counter-programme, and the tools of parliamentary opposition.',
  openGraph: {
    title: "HM Official Opposition · Lobby Market",
    description:
      'The civic counter-government: Leader of the Opposition, Shadow Cabinet, alternative proposals, and the formal opposition programme.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary_large_image',
    title: "HM Official Opposition · Lobby Market",
    description:
      'The formal parliamentary opposition — Shadow Cabinet, counter-programme, and confidence tools.',
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
  const content = (
    <div className="flex items-start justify-between gap-2 mb-4">
      <div className="flex items-start gap-2.5">
        <Icon className="h-4 w-4 text-against-400 mt-0.5 shrink-0" />
        <div>
          <h2 className="text-sm font-mono font-bold text-white uppercase tracking-wide">
            {title}
            {badge && (
              <span className="ml-2 text-[10px] font-normal text-surface-500 normal-case tracking-normal">
                ({badge})
              </span>
            )}
          </h2>
          {subtitle && (
            <p className="text-xs text-surface-500 mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {href && (
        <ChevronRight className="h-4 w-4 text-surface-600 shrink-0 mt-0.5" />
      )}
    </div>
  )

  if (href) {
    return (
      <Link href={href} className="block hover:opacity-80 transition-opacity">
        {content}
      </Link>
    )
  }
  return content
}

function StatPill({
  icon: Icon,
  value,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>
  value: string | number
  label: string
}) {
  return (
    <div className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
      <Icon className="h-3 w-3 text-surface-600" />
      <span className="font-semibold text-white">{value}</span>
      <span>{label}</span>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function OppositionPage() {
  const supabase = await createClient()

  // ── Fetch coalitions in parallel ──────────────────────────────────────────
  const [coalitionsRes, activeTopicsRes, openMotionRes] = await Promise.allSettled([
    supabase
      .from('coalitions')
      .select('id, name, description, member_count, coalition_influence, wins, losses, created_at, creator_id')
      .eq('is_public', true)
      .order('coalition_influence', { ascending: false })
      .order('member_count', { ascending: false })
      .limit(2),

    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .in('status', ['voting', 'active'])
      .order('total_votes', { ascending: false })
      .limit(30),

    // Most recent open confidence motion
    supabase
      .from('confidence_motions')
      .select('id, reason, status, votes_for, votes_against, expires_at, created_at')
      .eq('status', 'open')
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ])

  const coalitions = coalitionsRes.status === 'fulfilled' ? (coalitionsRes.value.data ?? []) : []
  const activeTopics = activeTopicsRes.status === 'fulfilled' ? (activeTopicsRes.value.data ?? []) : []
  const openMotion = openMotionRes.status === 'fulfilled' ? openMotionRes.value.data : null

  // First coalition = governing party; second = official opposition
  const govCoalition = coalitions[0] ?? null
  const oppCoalition = coalitions[1] ?? null

  // ── Opposition leader ──────────────────────────────────────────────────────
  let oppLeader: {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    clout: number
    total_votes: number
    total_arguments: number
  } | null = null

  let oppMembers: Array<{
    user_id: string
    role: string
    username: string
    display_name: string | null
    avatar_url: string | null
    clout: number
  }> = []

  if (oppCoalition) {
    const { data: memberRows } = await supabase
      .from('coalition_members')
      .select('user_id, role')
      .eq('coalition_id', oppCoalition.id)
      .in('role', ['leader', 'officer'])
      .limit(8)

    if (memberRows && memberRows.length > 0) {
      const ids = memberRows.map((m) => m.user_id)
      const roleMap = Object.fromEntries(memberRows.map((m) => [m.user_id, m.role]))

      const { data: profiles } = await supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, clout, total_votes, total_arguments')
        .in('id', ids)
        .order('clout', { ascending: false })

      if (profiles && profiles.length > 0) {
        oppMembers = profiles.map((p) => ({
          ...p,
          user_id: p.id,
          role: roleMap[p.id] ?? 'officer',
        })) as typeof oppMembers

        const leaderProfile = oppMembers.find((m) => m.role === 'leader') ?? oppMembers[0]
        oppLeader = {
          id: leaderProfile.user_id,
          username: leaderProfile.username,
          display_name: leaderProfile.display_name,
          avatar_url: leaderProfile.avatar_url,
          clout: leaderProfile.clout,
          total_votes: (leaderProfile as { total_votes?: number }).total_votes ?? 0,
          total_arguments: (leaderProfile as { total_arguments?: number }).total_arguments ?? 0,
        }
      }
    }

    // Fallback: highest-clout member
    if (!oppLeader) {
      const { data: fallbackMembers } = await supabase
        .from('coalition_members')
        .select('user_id')
        .eq('coalition_id', oppCoalition.id)
        .limit(20)

      if (fallbackMembers && fallbackMembers.length > 0) {
        const ids = fallbackMembers.map((m) => m.user_id)
        const { data: top } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, clout, total_votes, total_arguments')
          .in('id', ids)
          .order('clout', { ascending: false })
          .limit(1)
          .maybeSingle()
        if (top) {
          oppLeader = { ...top, id: top.id }
          oppMembers = [{ ...top, user_id: top.id, role: 'leader' }]
        }
      }
    }
  }

  // ── Opposition counter-programme ──────────────────────────────────────────
  // Topics where the opposition coalition has taken an 'against' stance
  type StanceRow = { topic_id: string; stance: string; statement: string | null }
  let counterProgramme: Array<StanceRow & {
    topic_statement: string
    topic_category: string | null
    topic_status: string
    topic_blue_pct: number
    topic_total_votes: number
  }> = []

  // Alternative proposals — topics the opposition supports that are currently contested
  let alternativeAgenda: typeof counterProgramme = []

  if (oppCoalition) {
    const [againstRes, forRes] = await Promise.allSettled([
      supabase
        .from('coalition_stances')
        .select('topic_id, stance, statement')
        .eq('coalition_id', oppCoalition.id)
        .eq('stance', 'against')
        .limit(6),
      supabase
        .from('coalition_stances')
        .select('topic_id, stance, statement')
        .eq('coalition_id', oppCoalition.id)
        .eq('stance', 'for')
        .limit(6),
    ])

    const againstStances: StanceRow[] = againstRes.status === 'fulfilled' ? (againstRes.value.data ?? []) : []
    const forStances: StanceRow[] = forRes.status === 'fulfilled' ? (forRes.value.data ?? []) : []

    // Enrich both with topic data
    async function enrichStances(stances: StanceRow[]) {
      if (stances.length === 0) return []
      const ids = stances.map((s) => s.topic_id)
      const { data: topics } = await supabase
        .from('topics')
        .select('id, statement, category, status, blue_pct, total_votes')
        .in('id', ids)
      const topicMap = Object.fromEntries((topics ?? []).map((t) => [t.id, t]))
      return stances
        .map((s) => {
          const t = topicMap[s.topic_id]
          if (!t) return null
          return {
            ...s,
            topic_statement: t.statement,
            topic_category: t.category,
            topic_status: t.status,
            topic_blue_pct: t.blue_pct ?? 50,
            topic_total_votes: t.total_votes ?? 0,
          }
        })
        .filter((x): x is NonNullable<typeof x> => x !== null)
    }

    counterProgramme = await enrichStances(againstStances)
    alternativeAgenda = await enrichStances(forStances)
  }

  // If no stances, show generic contested topics as counter-programme
  if (counterProgramme.length === 0) {
    counterProgramme = activeTopics.slice(0, 5).map((t) => ({
      topic_id: t.id,
      stance: 'against',
      statement: null,
      topic_statement: t.statement,
      topic_category: t.category,
      topic_status: t.status,
      topic_blue_pct: t.blue_pct ?? 50,
      topic_total_votes: t.total_votes ?? 0,
    }))
  }

  const oppTotalDebates = (oppCoalition?.wins ?? 0) + (oppCoalition?.losses ?? 0)
  const oppWinRate = oppTotalDebates > 0
    ? Math.round(((oppCoalition?.wins ?? 0) / oppTotalDebates) * 100)
    : null

  // Confidence motion totals
  const totalMotionVotes = (openMotion?.votes_for ?? 0) + (openMotion?.votes_against ?? 0)
  const noConfidencePct = totalMotionVotes > 0
    ? Math.round(((openMotion?.votes_for ?? 0) / totalMotionVotes) * 100)
    : null

  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <div className="min-h-screen bg-surface-0 text-white">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-20 pb-28 space-y-10">

        {/* ── Page header ─────────────────────────────────────────────────── */}
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-[10px] font-mono uppercase tracking-widest text-against-400">
            <Landmark className="h-3 w-3" />
            His Majesty&apos;s Official Opposition
          </div>
          <h1 className="text-3xl font-mono font-bold text-white leading-tight">
            The Opposition
          </h1>
          <p className="text-sm text-surface-500 max-w-prose">
            The largest civic coalition not in government — holding power to account,
            proposing alternatives, and ready to govern if the people choose.
          </p>

          {/* Breadcrumb nav */}
          <nav aria-label="Parliamentary navigation" className="flex flex-wrap gap-2 pt-1">
            {[
              { href: '/parliament',  label: 'Parliament' },
              { href: '/government',  label: 'HM Government' },
              { href: '/speaker',     label: 'Speaker' },
              { href: '/shadow-cabinet', label: 'Shadow Cabinet' },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[11px] font-mono text-surface-500 hover:text-white px-2 py-1 rounded-md hover:bg-surface-200 transition-colors"
              >
                {link.label}
              </Link>
            ))}
          </nav>
        </div>

        {/* ── No opposition exists ─────────────────────────────────────────── */}
        {!oppCoalition && (
          <div className="p-8 rounded-2xl bg-surface-100 border border-against-500/20 text-center space-y-3">
            <Flag className="h-10 w-10 text-against-400 mx-auto opacity-50" />
            <p className="text-sm font-mono text-white">No Official Opposition Yet</p>
            <p className="text-xs text-surface-500">
              The Official Opposition emerges when a second public coalition forms.{' '}
              <Link href="/coalitions/create" className="text-against-400 hover:text-against-300 underline underline-offset-2">
                Form a coalition
              </Link>{' '}
              to challenge the government.
            </p>
          </div>
        )}

        {oppCoalition && (
          <>
            {/* ── Opposition coalition banner ──────────────────────────────── */}
            <section aria-label="Official Opposition">
              <div className="p-5 rounded-2xl bg-gradient-to-br from-against-500/10 to-surface-100 border border-against-500/25">
                <div className="flex items-start justify-between gap-3 mb-4">
                  <div>
                    <p className="text-[10px] font-mono uppercase tracking-widest text-against-400 mb-1">
                      Official Opposition
                    </p>
                    <Link
                      href={`/coalitions/${oppCoalition.id}`}
                      className="text-xl font-bold text-white hover:text-against-300 transition-colors"
                    >
                      {oppCoalition.name}
                    </Link>
                    {oppCoalition.description && (
                      <p className="text-xs text-surface-500 mt-1 line-clamp-2">
                        {oppCoalition.description}
                      </p>
                    )}
                  </div>
                  <Link
                    href={`/coalitions/${oppCoalition.id}`}
                    aria-label="View coalition"
                    className="flex items-center justify-center h-9 w-9 rounded-xl bg-against-500/10 border border-against-500/30 text-against-400 hover:bg-against-500/20 transition-colors shrink-0"
                  >
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </div>

                {/* Stats row */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 rounded-xl bg-surface-200/80 border border-surface-300/60 text-center">
                    <p className="text-lg font-mono font-bold text-white">
                      {oppCoalition.member_count.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-surface-500 mt-0.5">Members</p>
                  </div>
                  <div className="p-3 rounded-xl bg-surface-200/80 border border-surface-300/60 text-center">
                    <p className="text-lg font-mono font-bold text-against-300">
                      {oppCoalition.coalition_influence.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-surface-500 mt-0.5">Influence</p>
                  </div>
                  <div className="p-3 rounded-xl bg-surface-200/80 border border-surface-300/60 text-center">
                    <p className="text-lg font-mono font-bold text-emerald">
                      {oppCoalition.wins.toLocaleString()}
                    </p>
                    <p className="text-[10px] text-surface-500 mt-0.5">Debates Won</p>
                  </div>
                  <div className="p-3 rounded-xl bg-surface-200/80 border border-surface-300/60 text-center">
                    <p className="text-lg font-mono font-bold text-white">
                      {oppWinRate !== null ? `${oppWinRate}%` : '—'}
                    </p>
                    <p className="text-[10px] text-surface-500 mt-0.5">Win Rate</p>
                  </div>
                </div>
              </div>
            </section>

            {/* ── Two-column layout ─────────────────────────────────────────── */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">

              {/* ── LEFT COLUMN ──────────────────────────────────────────────── */}
              <div className="space-y-8">

                {/* Leader of the Opposition */}
                {oppLeader && (
                  <section aria-label="Leader of the Opposition">
                    <SectionHeader
                      icon={Flag}
                      title="Leader of the Opposition"
                      subtitle="Head of the Official Opposition"
                    />
                    <Link
                      href={`/profile/${oppLeader.username}`}
                      className="group flex items-center gap-4 p-4 rounded-2xl bg-surface-100 border border-against-500/20 hover:border-against-500/40 hover:bg-surface-100/80 transition-all"
                    >
                      <div className="relative shrink-0">
                        <Avatar
                          src={oppLeader.avatar_url}
                          fallback={oppLeader.display_name ?? oppLeader.username}
                          size="lg"
                          className="ring-2 ring-against-500/40 group-hover:ring-against-500/70 transition-all"
                        />
                        <div className="absolute -bottom-1 -right-1 p-1 rounded-full bg-against-500 border border-surface-0">
                          <Flag className="h-3 w-3 text-white" />
                        </div>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-[10px] font-mono uppercase tracking-widest text-against-400 mb-0.5">
                          Leader of the Opposition
                        </p>
                        <p className="text-base font-bold text-white truncate group-hover:text-against-300 transition-colors">
                          {oppLeader.display_name ?? oppLeader.username}
                        </p>
                        <p className="text-xs text-surface-500 truncate">
                          @{oppLeader.username}
                        </p>
                        <div className="flex items-center gap-3 mt-2 flex-wrap">
                          <StatPill icon={Zap} value={oppLeader.clout.toLocaleString()} label="clout" />
                          <StatPill icon={Vote} value={oppLeader.total_votes.toLocaleString()} label="votes" />
                          <StatPill icon={MessageSquare} value={oppLeader.total_arguments.toLocaleString()} label="args" />
                        </div>
                      </div>
                      <ArrowUpRight className="h-4 w-4 text-surface-600 group-hover:text-against-300 transition-colors shrink-0" />
                    </Link>
                  </section>
                )}

                {/* Opposition Bench */}
                {oppMembers.length > 1 && (
                  <section aria-label="Opposition Bench">
                    <SectionHeader
                      icon={Users}
                      title="Opposition Bench"
                      subtitle="Shadow Cabinet officers"
                      href={`/coalitions/${oppCoalition.id}`}
                    />
                    <div className="space-y-2">
                      {oppMembers.slice(1, 6).map((member) => (
                        <Link
                          key={member.user_id}
                          href={`/profile/${member.username}`}
                          className="flex items-center gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300/40 hover:border-against-500/30 hover:bg-surface-100/80 transition-all group"
                        >
                          <Avatar
                            src={member.avatar_url}
                            fallback={member.display_name ?? member.username}
                            size="sm"
                            className="ring-1 ring-surface-400/30 shrink-0"
                          />
                          <div className="flex-1 min-w-0">
                            <p className="text-sm font-semibold text-white truncate group-hover:text-against-300 transition-colors">
                              {member.display_name ?? member.username}
                            </p>
                            <p className="text-[11px] text-surface-500 truncate">
                              @{member.username}
                            </p>
                          </div>
                          <div className="flex items-center gap-1.5 shrink-0">
                            <span className="text-[10px] font-mono text-against-300">
                              {member.clout.toLocaleString()}
                            </span>
                            <span className="text-[10px] text-surface-600">clout</span>
                            {member.role === 'officer' && (
                              <span className="ml-1 text-[10px] font-medium px-1.5 py-0.5 rounded-full bg-against-500/10 border border-against-500/20 text-against-400">
                                Officer
                              </span>
                            )}
                          </div>
                        </Link>
                      ))}
                      {oppMembers.length > 6 && (
                        <Link
                          href={`/coalitions/${oppCoalition.id}`}
                          className="flex items-center justify-center gap-1.5 py-2.5 rounded-xl border border-dashed border-surface-400/30 text-xs font-mono text-surface-500 hover:text-white hover:border-against-500/30 transition-colors"
                        >
                          <Users className="h-3.5 w-3.5" />
                          {oppMembers.length - 6} more members
                        </Link>
                      )}
                    </div>
                  </section>
                )}

                {/* Confidence Motion */}
                <section aria-label="Confidence Motion">
                  <SectionHeader
                    icon={AlertTriangle}
                    title="Motion of No Confidence"
                    subtitle="Current confidence in the government"
                  />
                  {openMotion ? (
                    <div className="p-4 rounded-2xl bg-surface-100 border border-against-500/20 space-y-3">
                      <div className="flex items-start gap-2">
                        <AlertTriangle className="h-4 w-4 text-against-400 mt-0.5 shrink-0" />
                        <p className="text-xs text-surface-400 italic leading-relaxed">
                          &ldquo;{openMotion.reason}&rdquo;
                        </p>
                      </div>

                      {/* Vote bar */}
                      <div className="space-y-1.5">
                        <div className="flex justify-between text-[10px] font-mono">
                          <span className="text-against-400">
                            No Confidence {openMotion.votes_for}
                          </span>
                          <span className="text-surface-500">
                            {totalMotionVotes} votes
                          </span>
                          <span className="text-for-400">
                            Confidence {openMotion.votes_against}
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-for-500/30 overflow-hidden">
                          <div
                            className="h-full bg-against-500 rounded-full transition-all"
                            style={{ width: `${noConfidencePct ?? 50}%` }}
                          />
                        </div>
                        <p className="text-[10px] font-mono text-surface-600 text-center">
                          Expires {formatDate(openMotion.expires_at)}
                        </p>
                      </div>

                      <Link
                        href="/confidence"
                        className="flex items-center justify-center gap-1.5 py-2 rounded-lg bg-against-500/10 border border-against-500/30 text-xs font-mono text-against-400 hover:bg-against-500/20 transition-colors"
                      >
                        <Scale className="h-3.5 w-3.5" />
                        Vote on Motion
                      </Link>
                    </div>
                  ) : (
                    <div className="p-5 rounded-2xl bg-surface-100 border border-surface-300/40 space-y-3">
                      <p className="text-xs text-surface-500 text-center">
                        No active confidence motion. The government has not been challenged.
                      </p>
                      <div className="flex items-center justify-between text-[11px] font-mono text-surface-500">
                        <span className="flex items-center gap-1">
                          <CheckCircle2 className="h-3 w-3 text-emerald" />
                          Government stable
                        </span>
                        <Link
                          href="/confidence"
                          className="text-against-400 hover:text-against-300 transition-colors"
                        >
                          Table a motion →
                        </Link>
                      </div>
                    </div>
                  )}
                </section>

              </div>

              {/* ── RIGHT COLUMN ──────────────────────────────────────────────── */}
              <div className="space-y-8">

                {/* Counter-Programme */}
                <section aria-label="Opposition counter-programme">
                  <SectionHeader
                    icon={XCircle}
                    title="Counter-Programme"
                    subtitle="Topics the opposition opposes"
                    href="/topics"
                    badge={counterProgramme.length > 0 ? `${counterProgramme.length} items` : undefined}
                  />
                  {counterProgramme.length === 0 ? (
                    <div className="p-5 rounded-xl bg-surface-100 border border-surface-300/40 text-center">
                      <p className="text-xs text-surface-500">
                        No formal counter-positions declared yet.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {counterProgramme.map((item) => {
                        const badge = STATUS_BADGE[item.topic_status] ?? STATUS_BADGE.proposed
                        const forPct = Math.round(item.topic_blue_pct)
                        const againstPct = 100 - forPct
                        return (
                          <Link
                            key={item.topic_id}
                            href={`/topic/${item.topic_id}`}
                            className="block p-3 rounded-xl bg-surface-100 border border-surface-300/40 hover:border-against-500/30 hover:bg-surface-100/80 transition-all group"
                          >
                            <div className="flex items-start justify-between gap-2 mb-2">
                              <p className="text-xs font-semibold text-white leading-tight line-clamp-2 flex-1 group-hover:text-against-300 transition-colors">
                                {item.topic_statement}
                              </p>
                              <span className={cn(
                                'shrink-0 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border',
                                badge.cls,
                              )}>
                                {badge.label}
                              </span>
                            </div>
                            {item.statement && (
                              <p className="text-[11px] text-surface-500 italic mb-2 line-clamp-1">
                                &ldquo;{item.statement}&rdquo;
                              </p>
                            )}
                            <div className="flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 min-w-0">
                                {item.topic_category && (
                                  <span className={cn(
                                    'text-[10px] font-mono',
                                    catColor(item.topic_category),
                                  )}>
                                    {item.topic_category}
                                  </span>
                                )}
                              </div>
                              <div className="flex items-center gap-1 text-[10px] font-mono shrink-0">
                                <span className="text-for-400">{forPct}%</span>
                                <span className="text-surface-600">/</span>
                                <span className="text-against-400">{againstPct}%</span>
                              </div>
                            </div>
                          </Link>
                        )
                      })}
                    </div>
                  )}
                </section>

                {/* Alternative Agenda */}
                {alternativeAgenda.length > 0 && (
                  <section aria-label="Opposition alternative agenda">
                    <SectionHeader
                      icon={BookOpen}
                      title="Alternative Agenda"
                      subtitle="The opposition's positive programme"
                      badge={`${alternativeAgenda.length} proposals`}
                    />
                    <div className="space-y-2">
                      {alternativeAgenda.slice(0, 4).map((item) => {
                        const badge = STATUS_BADGE[item.topic_status] ?? STATUS_BADGE.proposed
                        return (
                          <Link
                            key={item.topic_id}
                            href={`/topic/${item.topic_id}`}
                            className="block p-3 rounded-xl bg-surface-100 border border-surface-300/40 hover:border-for-500/30 hover:bg-surface-100/80 transition-all group"
                          >
                            <div className="flex items-start justify-between gap-2">
                              <p className="text-xs font-semibold text-white leading-tight line-clamp-2 flex-1 group-hover:text-for-300 transition-colors">
                                {item.topic_statement}
                              </p>
                              <span className={cn(
                                'shrink-0 text-[10px] font-mono font-bold px-2 py-0.5 rounded-full border',
                                badge.cls,
                              )}>
                                {badge.label}
                              </span>
                            </div>
                            {item.topic_category && (
                              <p className={cn('text-[10px] font-mono mt-1', catColor(item.topic_category))}>
                                {item.topic_category}
                              </p>
                            )}
                          </Link>
                        )
                      })}
                    </div>
                  </section>
                )}

                {/* Tools of opposition */}
                <section aria-label="Opposition tools">
                  <SectionHeader
                    icon={Shield}
                    title="Opposition Tools"
                    subtitle="Democratic mechanisms to hold power to account"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    {[
                      {
                        href: '/civic-questions',
                        icon: MessageSquare,
                        label: 'Questions Time',
                        desc: 'Challenge ministers publicly',
                      },
                      {
                        href: '/debate/create',
                        icon: Swords,
                        label: 'Challenge Debate',
                        desc: 'Request a formal debate',
                      },
                      {
                        href: '/motions',
                        icon: Scale,
                        label: 'Table a Motion',
                        desc: 'Propose a formal motion',
                      },
                      {
                        href: '/oversight',
                        icon: Target,
                        label: 'Oversight',
                        desc: 'Scrutiny and accountability',
                      },
                      {
                        href: '/shadow-cabinet',
                        icon: Shield,
                        label: 'Shadow Cabinet',
                        desc: 'Our alternative ministers',
                      },
                      {
                        href: '/government',
                        icon: Landmark,
                        label: 'View Government',
                        desc: "The ruling coalition's agenda",
                      },
                    ].map((tool) => (
                      <Link
                        key={tool.href}
                        href={tool.href}
                        className="flex items-start gap-2.5 p-3 rounded-xl bg-surface-100 border border-surface-300/40 hover:border-against-500/30 hover:bg-surface-100/80 transition-all group"
                      >
                        <tool.icon className="h-4 w-4 text-against-400 mt-0.5 shrink-0 group-hover:text-against-300 transition-colors" />
                        <div>
                          <p className="text-xs font-semibold text-white group-hover:text-against-300 transition-colors">
                            {tool.label}
                          </p>
                          <p className="text-[10px] text-surface-500 mt-0.5">
                            {tool.desc}
                          </p>
                        </div>
                      </Link>
                    ))}
                  </div>
                </section>

              </div>
            </div>

            {/* ── vs Government banner ──────────────────────────────────────── */}
            {govCoalition && (
              <section aria-label="Opposition vs Government">
                <div className="p-4 rounded-2xl bg-surface-100 border border-surface-300/40">
                  <div className="flex items-center justify-between gap-4">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="p-2 rounded-lg bg-against-500/10 border border-against-500/20 shrink-0">
                        <Flag className="h-4 w-4 text-against-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[10px] font-mono text-against-400 uppercase tracking-wide">Opposition</p>
                        <p className="text-sm font-bold text-white truncate">{oppCoalition.name}</p>
                      </div>
                    </div>
                    <div className="flex flex-col items-center gap-1 shrink-0">
                      <Swords className="h-4 w-4 text-surface-500" />
                      <span className="text-[10px] font-mono text-surface-600">vs</span>
                    </div>
                    <div className="flex items-center gap-3 min-w-0 justify-end">
                      <div className="min-w-0 text-right">
                        <p className="text-[10px] font-mono text-gold uppercase tracking-wide">Government</p>
                        <p className="text-sm font-bold text-white truncate">{govCoalition.name}</p>
                      </div>
                      <div className="p-2 rounded-lg bg-gold/10 border border-gold/20 shrink-0">
                        <Landmark className="h-4 w-4 text-gold" />
                      </div>
                    </div>
                  </div>

                  <div className="mt-4 grid grid-cols-3 gap-3 text-center">
                    <div>
                      <p className="text-lg font-mono font-bold text-against-400">
                        {oppCoalition.coalition_influence.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-surface-500">Opp. Influence</p>
                    </div>
                    <div>
                      <TrendingDown className="h-5 w-5 text-surface-600 mx-auto mb-0.5" />
                      <p className="text-[10px] text-surface-500">Influence Gap</p>
                      <p className="text-xs font-mono text-surface-400">
                        {Math.abs(govCoalition.coalition_influence - oppCoalition.coalition_influence).toLocaleString()}
                      </p>
                    </div>
                    <div>
                      <p className="text-lg font-mono font-bold text-gold">
                        {govCoalition.coalition_influence.toLocaleString()}
                      </p>
                      <p className="text-[10px] text-surface-500">Gov. Influence</p>
                    </div>
                  </div>

                  <Link
                    href={`/coalitions/${oppCoalition.id}`}
                    className="mt-3 flex items-center justify-center gap-2 py-2.5 rounded-xl bg-against-500/10 border border-against-500/20 text-xs font-mono text-against-400 hover:bg-against-500/15 hover:text-against-300 transition-colors"
                  >
                    <Flag className="h-3.5 w-3.5" />
                    Join the Opposition
                    <ChevronRight className="h-3.5 w-3.5" />
                  </Link>
                </div>
              </section>
            )}
          </>
        )}

        {/* ── Parliamentary links footer ─────────────────────────────────── */}
        <nav aria-label="More parliamentary links" className="pt-2">
          <p className="text-[10px] font-mono uppercase tracking-widest text-surface-600 mb-3">
            The Civic Parliament
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              { href: '/parliament',       label: 'Full Parliament' },
              { href: '/government',       label: 'HM Government' },
              { href: '/speaker',          label: "Speaker's Chair" },
              { href: '/order-paper',      label: 'Order Paper' },
              { href: '/committee-reports',label: 'Committees' },
              { href: '/oversight',        label: 'Oversight' },
              { href: '/civic-questions',  label: 'Questions Time' },
              { href: '/shadow-cabinet',   label: 'Shadow Cabinet' },
              { href: '/motions',          label: 'Motions' },
              { href: '/grand-council',    label: 'Grand Council' },
            ].map((link) => (
              <Link
                key={link.href}
                href={link.href}
                className="text-[11px] font-mono text-surface-500 hover:text-white px-2.5 py-1 rounded-lg bg-surface-200/60 hover:bg-surface-200 border border-surface-300/40 transition-colors"
              >
                {link.href === '/opposition' ? (
                  <span className="text-against-400">{link.label}</span>
                ) : (
                  link.label
                )}
              </Link>
            ))}
          </div>
        </nav>

      </main>

      <BottomNav />
    </div>
  )
}
