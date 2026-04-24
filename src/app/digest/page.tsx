import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  BarChart2,
  Calendar,
  Crown,
  Flame,
  Gavel,
  Mic,
  Scale,
  Sparkles,
  TrendingUp,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils/cn'
import type { DigestData } from '@/app/api/digest/route'

export const dynamic = 'force-dynamic'
export const revalidate = 1800

export const metadata: Metadata = {
  title: 'Weekly Digest · Lobby Market',
  description:
    'A curated weekly roundup of laws established, trending topics, and top voices in the Lobby.',
  openGraph: {
    title: 'Weekly Digest · Lobby Market',
    description: 'Laws passed, debates settled, and voices heard — the week in review.',
    type: 'website',
    siteName: 'Lobby Market',
  },
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3_600_000)
  const d = Math.floor(h / 24)
  if (h < 1) return 'just now'
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function voteBar(bluePct: number, className?: string) {
  const forPct = Math.round(bluePct)
  const againstPct = 100 - forPct
  return (
    <div className={cn('flex items-center gap-2', className)}>
      <span className="text-[11px] font-mono text-for-400 w-8 text-right shrink-0">
        {forPct}%
      </span>
      <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden">
        <div
          className="h-full bg-for-500 rounded-full transition-all"
          style={{ width: `${forPct}%` }}
        />
      </div>
      <span className="text-[11px] font-mono text-against-400 w-8 shrink-0">
        {againstPct}%
      </span>
    </div>
  )
}

const CATEGORY_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  Economics: { text: 'text-gold', bg: 'bg-gold/10', border: 'border-gold/30' },
  Politics: { text: 'text-for-400', bg: 'bg-for-500/10', border: 'border-for-500/30' },
  Technology: { text: 'text-purple', bg: 'bg-purple/10', border: 'border-purple/30' },
  Science: { text: 'text-emerald', bg: 'bg-emerald/10', border: 'border-emerald/30' },
  Ethics: { text: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  Philosophy: { text: 'text-purple', bg: 'bg-purple/10', border: 'border-purple/30' },
  Culture: { text: 'text-gold', bg: 'bg-gold/10', border: 'border-gold/30' },
  Health: { text: 'text-emerald', bg: 'bg-emerald/10', border: 'border-emerald/30' },
  Environment: { text: 'text-emerald', bg: 'bg-emerald/10', border: 'border-emerald/30' },
  Education: { text: 'text-for-400', bg: 'bg-for-500/10', border: 'border-for-500/30' },
  Other: { text: 'text-surface-500', bg: 'bg-surface-300/30', border: 'border-surface-400/30' },
}

function catColors(category: string | null) {
  return CATEGORY_COLORS[category ?? 'Other'] ?? CATEGORY_COLORS.Other
}

// ─── Role helpers ─────────────────────────────────────────────────────────────

const ROLE_LABELS: Record<string, string> = {
  person: 'Citizen',
  senator: 'Senator',
  lobbyist: 'Lobbyist',
  moderator: 'Moderator',
  troll_catcher: 'Troll Catcher',
  admin: 'Admin',
}

// ─── Section wrapper ──────────────────────────────────────────────────────────

function Section({
  icon: Icon,
  iconColor,
  iconBg,
  title,
  subtitle,
  children,
}: {
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  iconBg: string
  title: string
  subtitle?: string
  children: React.ReactNode
}) {
  return (
    <section className="mb-8">
      <div className="flex items-center gap-3 mb-4">
        <div
          className={cn(
            'flex items-center justify-center h-9 w-9 rounded-xl border',
            iconBg
          )}
        >
          <Icon className={cn('h-4 w-4', iconColor)} />
        </div>
        <div>
          <h2 className="text-base font-bold text-white font-mono">{title}</h2>
          {subtitle && (
            <p className="text-xs text-surface-500 mt-0.5">{subtitle}</p>
          )}
        </div>
      </div>
      {children}
    </section>
  )
}

// ─── Stat pill ────────────────────────────────────────────────────────────────

function StatPill({
  label,
  value,
  color,
}: {
  label: string
  value: string | number
  color: string
}) {
  return (
    <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 text-center">
      <p className={cn('text-2xl font-bold font-mono tabular-nums', color)}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      <p className="text-xs text-surface-500 mt-1">{label}</p>
    </div>
  )
}

// ─── Empty state ──────────────────────────────────────────────────────────────

function EmptyWeek({ message }: { message: string }) {
  return (
    <div className="rounded-xl bg-surface-100 border border-surface-300 px-6 py-10 text-center">
      <p className="text-sm text-surface-500 font-mono">{message}</p>
    </div>
  )
}

// ─── Data fetch ───────────────────────────────────────────────────────────────

async function fetchDigest(): Promise<DigestData | null> {
  try {
    const supabase = await createClient()

    const now = new Date()
    const weekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)
    const weekAgoIso = weekAgo.toISOString()

    const fmt = (d: Date) =>
      d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
    const weekLabel = `${fmt(weekAgo)}–${fmt(now)}, ${now.getFullYear()}`

    const [
      newLawsRes,
      viralRes,
      contestedCandidatesRes,
      newTopicsRes,
      newUsersRes,
      newDebatesRes,
      topVotersRes,
    ] = await Promise.all([
      supabase
        .from('laws')
        .select('id, statement, category, total_votes, blue_pct, established_at')
        .gte('established_at', weekAgoIso)
        .eq('is_active', true)
        .order('total_votes', { ascending: false })
        .limit(6),

      supabase
        .from('topics')
        .select('id, statement, category, status, total_votes, blue_pct, view_count')
        .gte('created_at', weekAgoIso)
        .in('status', ['active', 'voting', 'law', 'failed'])
        .order('total_votes', { ascending: false })
        .limit(1),

      supabase
        .from('topics')
        .select('id, statement, category, status, total_votes, blue_pct, view_count')
        .gte('created_at', weekAgoIso)
        .gte('total_votes', 5)
        .in('status', ['active', 'voting', 'law', 'failed'])
        .limit(100),

      supabase.from('topics').select('id').gte('created_at', weekAgoIso),
      supabase.from('profiles').select('id').gte('created_at', weekAgoIso),
      supabase.from('debates').select('id').gte('created_at', weekAgoIso),

      supabase
        .from('profiles')
        .select('id, username, display_name, avatar_url, role, clout, reputation_score, total_votes')
        .gt('total_votes', 0)
        .order('reputation_score', { ascending: false })
        .limit(5),
    ])

    // Most contested: pick topic closest to 50/50
    let mostContested = null
    const candidates = contestedCandidatesRes.data ?? []
    if (candidates.length > 0) {
      mostContested = candidates.reduce((best: typeof candidates[0], t) => {
        const distBest = Math.abs((best.blue_pct ?? 50) - 50)
        const distCurr = Math.abs((t.blue_pct ?? 50) - 50)
        return distCurr < distBest ? t : best
      })
    }

    const catMap: Record<string, { laws: number; votes: number }> = {}
    for (const l of newLawsRes.data ?? []) {
      const cat = l.category ?? 'Other'
      if (!catMap[cat]) catMap[cat] = { laws: 0, votes: 0 }
      catMap[cat].laws += 1
      catMap[cat].votes += l.total_votes ?? 0
    }
    for (const t of candidates) {
      const cat = t.category ?? 'Other'
      if (!catMap[cat]) catMap[cat] = { laws: 0, votes: 0 }
      catMap[cat].votes += t.total_votes ?? 0
    }

    const categoryBreakdown = Object.entries(catMap)
      .map(([category, d]) => ({ category, ...d }))
      .sort((a, b) => b.votes - a.votes)
      .slice(0, 6)

    const viralVotes = (viralRes.data?.[0]?.total_votes ?? 0) as number
    const candidateVotes = candidates.reduce((s, t) => s + (t.total_votes ?? 0), 0)

    return {
      week: {
        start: weekAgoIso,
        end: now.toISOString(),
        label: weekLabel,
      },
      newLaws: (newLawsRes.data ?? []) as DigestData['newLaws'],
      mostViral: (viralRes.data?.[0] ?? null) as DigestData['mostViral'],
      mostContested: (mostContested ?? null) as DigestData['mostContested'],
      topVoters: (topVotersRes.data ?? []) as DigestData['topVoters'],
      categoryBreakdown,
      platformCounts: {
        newTopics: newTopicsRes.data?.length ?? 0,
        newVotes: Math.max(viralVotes, candidateVotes),
        newUsers: newUsersRes.data?.length ?? 0,
        newDebates: newDebatesRes.data?.length ?? 0,
      },
    }
  } catch {
    return null
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function DigestPage() {
  const digest = await fetchDigest()

  if (!digest) {
    return (
      <div className="min-h-screen bg-surface-50">
        <TopBar />
        <main className="max-w-2xl mx-auto px-4 pt-8 pb-24 md:pb-12">
          <p className="text-surface-500 font-mono text-sm text-center mt-24">
            Failed to load digest. Please try again later.
          </p>
        </main>
        <BottomNav />
      </div>
    )
  }

  const hasLaws = digest.newLaws.length > 0
  const hasTopics = digest.mostViral !== null || digest.mostContested !== null
  const hasVoters = digest.topVoters.length > 0
  const hasCategories = digest.categoryBreakdown.length > 0
  const maxCategoryVotes = Math.max(...digest.categoryBreakdown.map((c) => c.votes), 1)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-center gap-2 mb-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gold/10 border border-gold/30">
              <Calendar className="h-5 w-5 text-gold" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white font-mono">Weekly Digest</h1>
              <p className="text-xs text-surface-500 mt-0.5 font-mono">
                {digest.week.label}
              </p>
            </div>
          </div>
          <p className="text-sm text-surface-600">
            The week in consensus — laws made, battles fought, voices heard.
          </p>
        </div>

        {/* ── Platform counts ────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
          <StatPill
            label="New topics"
            value={digest.platformCounts.newTopics}
            color="text-for-400"
          />
          <StatPill
            label="New laws"
            value={digest.newLaws.length}
            color="text-gold"
          />
          <StatPill
            label="New citizens"
            value={digest.platformCounts.newUsers}
            color="text-emerald"
          />
          <StatPill
            label="New debates"
            value={digest.platformCounts.newDebates}
            color="text-purple"
          />
        </div>

        {/* ── Laws established ───────────────────────────────────────────── */}
        <Section
          icon={Gavel}
          iconColor="text-gold"
          iconBg="bg-gold/10 border-gold/30"
          title="Laws established this week"
          subtitle={
            hasLaws
              ? `${digest.newLaws.length} topic${digest.newLaws.length !== 1 ? 's' : ''} reached consensus`
              : undefined
          }
        >
          {!hasLaws ? (
            <EmptyWeek message="No laws established this week. Go vote." />
          ) : (
            <div className="space-y-2">
              {digest.newLaws.map((law) => {
                const col = catColors(law.category)
                return (
                  <Link
                    key={law.id}
                    href={`/law/${law.id}`}
                    className="group block rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 px-4 py-3.5 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <p className="text-sm font-medium text-white group-hover:text-for-300 transition-colors line-clamp-2 flex-1">
                        {law.statement}
                      </p>
                      <ArrowRight className="h-4 w-4 text-surface-500 group-hover:text-for-400 transition-colors shrink-0 mt-0.5" />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      {law.category && (
                        <span
                          className={cn(
                            'text-[10px] font-mono px-2 py-0.5 rounded-full border',
                            col.text,
                            col.bg,
                            col.border
                          )}
                        >
                          {law.category}
                        </span>
                      )}
                      <span className="text-[11px] font-mono text-surface-500">
                        {law.total_votes.toLocaleString()} votes
                      </span>
                      <span className="text-[11px] font-mono text-surface-600">
                        {relativeTime(law.established_at)}
                      </span>
                    </div>
                    {voteBar(law.blue_pct, 'mt-2.5')}
                  </Link>
                )
              })}
            </div>
          )}
        </Section>

        {/* ── Spotlight topics ───────────────────────────────────────────── */}
        <Section
          icon={Flame}
          iconColor="text-against-400"
          iconBg="bg-against-500/10 border-against-500/30"
          title="Topic spotlight"
          subtitle="Most viral and most divisive"
        >
          {!hasTopics ? (
            <EmptyWeek message="No active topics in the last 7 days." />
          ) : (
            <div className="grid sm:grid-cols-2 gap-3">
              {digest.mostViral && (
                <Link
                  href={`/topic/${digest.mostViral.id}`}
                  className="group block rounded-xl bg-surface-100 border border-surface-300 hover:border-for-500/50 p-4 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex items-center justify-center h-6 w-6 rounded-lg bg-for-500/15">
                      <TrendingUp className="h-3 w-3 text-for-400" />
                    </div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-for-400">
                      Most viral
                    </span>
                  </div>
                  <p className="text-sm font-medium text-white group-hover:text-for-300 transition-colors line-clamp-3 mb-2">
                    {digest.mostViral.statement}
                  </p>
                  <p className="text-[11px] font-mono text-surface-500">
                    {digest.mostViral.total_votes.toLocaleString()} votes ·{' '}
                    {digest.mostViral.view_count?.toLocaleString() ?? 0} views
                  </p>
                  {voteBar(digest.mostViral.blue_pct, 'mt-2')}
                </Link>
              )}

              {digest.mostContested && (
                <Link
                  href={`/topic/${digest.mostContested.id}`}
                  className="group block rounded-xl bg-surface-100 border border-surface-300 hover:border-against-500/50 p-4 transition-colors"
                >
                  <div className="flex items-center gap-2 mb-2">
                    <div className="flex items-center justify-center h-6 w-6 rounded-lg bg-against-500/15">
                      <Scale className="h-3 w-3 text-against-400" />
                    </div>
                    <span className="text-[10px] font-mono uppercase tracking-wider text-against-400">
                      Most contested
                    </span>
                  </div>
                  <p className="text-sm font-medium text-white group-hover:text-against-300 transition-colors line-clamp-3 mb-2">
                    {digest.mostContested.statement}
                  </p>
                  <p className="text-[11px] font-mono text-surface-500">
                    {digest.mostContested.total_votes.toLocaleString()} votes ·{' '}
                    {Math.round(Math.abs(digest.mostContested.blue_pct - 50))}pp from 50/50
                  </p>
                  {voteBar(digest.mostContested.blue_pct, 'mt-2')}
                </Link>
              )}
            </div>
          )}
        </Section>

        {/* ── Category breakdown ─────────────────────────────────────────── */}
        {hasCategories && (
          <Section
            icon={BarChart2}
            iconColor="text-purple"
            iconBg="bg-purple/10 border-purple/30"
            title="Active categories"
            subtitle="Where the debates are happening"
          >
            <div className="rounded-xl bg-surface-100 border border-surface-300 divide-y divide-surface-300 overflow-hidden">
              {digest.categoryBreakdown.map((cat) => {
                const col = catColors(cat.category)
                const barWidth = Math.round((cat.votes / maxCategoryVotes) * 100)
                return (
                  <Link
                    key={cat.category}
                    href={`/topic/categories#${cat.category.toLowerCase()}`}
                    className="group flex items-center gap-3 px-4 py-3 hover:bg-surface-200 transition-colors"
                  >
                    <span
                      className={cn(
                        'text-xs font-mono px-2 py-0.5 rounded-full border w-24 text-center shrink-0',
                        col.text,
                        col.bg,
                        col.border
                      )}
                    >
                      {cat.category}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all', col.bg.replace('/10', '/60'))}
                        style={{ width: `${barWidth}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-mono text-surface-500 shrink-0 w-16 text-right">
                      {cat.votes.toLocaleString()} votes
                    </span>
                    {cat.laws > 0 && (
                      <span className="text-[10px] font-mono text-gold shrink-0">
                        {cat.laws} law{cat.laws !== 1 ? 's' : ''}
                      </span>
                    )}
                  </Link>
                )
              })}
            </div>
          </Section>
        )}

        {/* ── Top voices ─────────────────────────────────────────────────── */}
        <Section
          icon={Crown}
          iconColor="text-gold"
          iconBg="bg-gold/10 border-gold/30"
          title="Top voices"
          subtitle="Highest-reputation participants"
        >
          {!hasVoters ? (
            <EmptyWeek message="No voter data available yet." />
          ) : (
            <div className="space-y-2">
              {digest.topVoters.map((voter, i) => (
                <Link
                  key={voter.id}
                  href={`/profile/${voter.username}`}
                  className="group flex items-center gap-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 px-4 py-3 transition-colors"
                >
                  {/* Rank */}
                  <span
                    className={cn(
                      'text-sm font-bold font-mono w-6 text-center shrink-0',
                      i === 0
                        ? 'text-gold'
                        : i === 1
                        ? 'text-surface-600'
                        : i === 2
                        ? 'text-amber-700'
                        : 'text-surface-500'
                    )}
                  >
                    {i + 1}
                  </span>

                  <Avatar
                    src={voter.avatar_url}
                    fallback={voter.display_name ?? voter.username}
                    size="sm"
                  />

                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium text-white group-hover:text-for-300 transition-colors truncate">
                      {voter.display_name ?? voter.username}
                    </p>
                    <p className="text-[11px] font-mono text-surface-500">
                      @{voter.username} ·{' '}
                      {ROLE_LABELS[voter.role] ?? voter.role}
                    </p>
                  </div>

                  <div className="text-right shrink-0">
                    <p className="text-sm font-bold font-mono text-gold">
                      {Math.round(voter.clout).toLocaleString()}
                    </p>
                    <p className="text-[10px] font-mono text-surface-500">clout</p>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </Section>

        {/* ── Footer links ───────────────────────────────────────────────── */}
        <div className="mt-6 pt-6 border-t border-surface-300 flex flex-wrap gap-3">
          <Link
            href="/trending"
            className="flex items-center gap-2 text-sm text-surface-500 hover:text-white transition-colors"
          >
            <TrendingUp className="h-4 w-4" />
            Trending now
          </Link>
          <Link
            href="/stats"
            className="flex items-center gap-2 text-sm text-surface-500 hover:text-white transition-colors"
          >
            <BarChart2 className="h-4 w-4" />
            Platform stats
          </Link>
          <Link
            href="/law"
            className="flex items-center gap-2 text-sm text-surface-500 hover:text-white transition-colors"
          >
            <Scale className="h-4 w-4" />
            Law Codex
          </Link>
          <Link
            href="/debate"
            className="flex items-center gap-2 text-sm text-surface-500 hover:text-white transition-colors"
          >
            <Mic className="h-4 w-4" />
            Debates
          </Link>
          <Link
            href="/leaderboard"
            className="flex items-center gap-2 text-sm text-surface-500 hover:text-white transition-colors"
          >
            <Crown className="h-4 w-4" />
            Leaderboard
          </Link>
          <Link
            href="/brief"
            className="flex items-center gap-2 text-sm text-surface-500 hover:text-white transition-colors"
          >
            <Sparkles className="h-4 w-4" />
            Daily Brief
          </Link>
        </div>

        <p className="text-center text-[10px] font-mono text-surface-600 mt-8">
          Digest refreshes every 30 minutes · Lobby Market
        </p>
      </main>

      <BottomNav />
    </div>
  )
}
