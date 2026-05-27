import type { Metadata } from 'next'
import Link from 'next/link'
import {
  Award,
  BookOpen,
  Crown,
  Flame,
  Gavel,
  Scale,
  Shield,
  Star,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Users,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils/cn'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Civic Lore · Lobby Market',
  description:
    'The legendary moments, record-breaking votes, and greatest arguments in Lobby Market history. A living chronicle of democracy in action.',
  openGraph: {
    title: 'Civic Lore · Lobby Market',
    description:
      'Platform records, hall-of-fame arguments, established laws, and legendary citizens — the defining moments of Lobby Market.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Civic Lore · Lobby Market',
    description: 'Records, legends, and the greatest moments in Lobby Market history.',
  },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

const CATEGORY_COLORS: Record<string, string> = {
  Economics:   'bg-gold/10 text-gold border-gold/30',
  Politics:    'bg-for-500/10 text-for-400 border-for-500/30',
  Technology:  'bg-purple/10 text-purple border-purple/30',
  Science:     'bg-emerald/10 text-emerald border-emerald/30',
  Ethics:      'bg-against-500/10 text-against-400 border-against-500/30',
  Philosophy:  'bg-purple/10 text-purple border-purple/30',
  Environment: 'bg-emerald/10 text-emerald border-emerald/30',
  Health:      'bg-emerald/10 text-emerald border-emerald/30',
  Education:   'bg-for-500/10 text-for-400 border-for-500/30',
  Social:      'bg-purple/10 text-purple border-purple/30',
}

function categoryPill(cat: string | null) {
  if (!cat) return null
  const cls = CATEGORY_COLORS[cat] ?? 'bg-surface-300/50 text-surface-500 border-surface-400/30'
  return (
    <span className={cn('inline-flex text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-full border', cls)}>
      {cat}
    </span>
  )
}

function VoteBar({ bluePct }: { bluePct: number }) {
  const forPct = Math.round(bluePct)
  const againstPct = 100 - forPct
  return (
    <div className="flex items-center gap-2 w-full">
      <span className="text-[10px] font-mono text-for-400 w-7 text-right tabular-nums">{forPct}%</span>
      <div className="flex-1 h-1.5 bg-surface-300 rounded-full overflow-hidden">
        <div
          className="h-full bg-for-500 rounded-full transition-all"
          style={{ width: `${forPct}%` }}
        />
      </div>
      <span className="text-[10px] font-mono text-against-400 w-7 tabular-nums">{againstPct}%</span>
    </div>
  )
}

// ─── Record Card ─────────────────────────────────────────────────────────────

interface RecordCardProps {
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  iconBg: string
  iconBorder: string
  label: string
  title: string
  subtitle?: string
  href?: string
  accent?: string
}

function RecordCard({
  icon: Icon,
  iconColor,
  iconBg,
  iconBorder,
  label,
  title,
  subtitle,
  href,
  accent = 'border-surface-300',
}: RecordCardProps) {
  const inner = (
    <div
      className={cn(
        'rounded-2xl bg-surface-100 border p-5 flex flex-col gap-3 h-full transition-all',
        accent,
        href && 'hover:border-surface-400 hover:-translate-y-0.5 cursor-pointer'
      )}
    >
      <div className={cn('flex items-center justify-center h-10 w-10 rounded-xl border', iconBg, iconBorder)}>
        <Icon className={cn('h-5 w-5', iconColor)} />
      </div>
      <div>
        <p className="text-[10px] font-mono font-semibold text-surface-500 uppercase tracking-widest mb-1">
          {label}
        </p>
        <p className="text-sm font-mono font-bold text-white leading-snug line-clamp-2">{title}</p>
        {subtitle && (
          <p className="text-xs font-mono text-surface-500 mt-1">{subtitle}</p>
        )}
      </div>
    </div>
  )

  if (href) {
    return <Link href={href}>{inner}</Link>
  }
  return inner
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function LorePage() {
  const supabase = await createClient()

  // Platform-wide stats
  const [
    { count: totalTopics },
    { count: totalLaws },
    { count: totalVotes },
    { count: totalArguments },
  ] = await Promise.all([
    supabase.from('topics').select('*', { count: 'exact', head: true }),
    supabase.from('topics').select('*', { count: 'exact', head: true }).eq('status', 'law'),
    supabase.from('votes').select('*', { count: 'exact', head: true }),
    supabase.from('topic_arguments').select('*', { count: 'exact', head: true }),
  ])

  // Most voted topic of all time
  const { data: mostVotedRaw } = await supabase
    .from('topics')
    .select('id, statement, category, blue_pct, total_votes, status')
    .order('total_votes', { ascending: false })
    .limit(1)
    .maybeSingle()
  const mostVoted = mostVotedRaw as {
    id: string; statement: string; category: string | null
    blue_pct: number; total_votes: number; status: string
  } | null

  // Most contested: closest to 50/50 (active/voting/law with min votes)
  const { data: contestedRaw } = await supabase
    .from('topics')
    .select('id, statement, category, blue_pct, total_votes, status')
    .gte('total_votes', 10)
    .order('total_votes', { ascending: false })
    .limit(200)

  let mostContested: typeof mostVoted = null
  if (contestedRaw) {
    const withDist = (contestedRaw as typeof mostVoted[]).map((t) => ({
      ...t!,
      dist: Math.abs((t!.blue_pct) - 50),
    }))
    withDist.sort((a, b) => a.dist - b.dist)
    mostContested = withDist[0] ?? null
  }

  // Strongest mandate: topic furthest from 50/50 (most decisive), min 50 votes
  const { data: mandateRaw } = await supabase
    .from('topics')
    .select('id, statement, category, blue_pct, total_votes, status')
    .gte('total_votes', 50)
    .order('total_votes', { ascending: false })
    .limit(200)

  let strongestMandate: typeof mostVoted = null
  if (mandateRaw) {
    const withDist = (mandateRaw as typeof mostVoted[]).map((t) => ({
      ...t!,
      dist: Math.abs((t!.blue_pct) - 50),
    }))
    withDist.sort((a, b) => b.dist - a.dist)
    strongestMandate = withDist[0] ?? null
  }

  // Established laws (all, ordered by total_votes desc)
  const { data: lawsRaw } = await supabase
    .from('topics')
    .select('id, statement, category, blue_pct, total_votes, created_at')
    .eq('status', 'law')
    .order('total_votes', { ascending: false })
    .limit(20)
  const laws = (lawsRaw ?? []) as {
    id: string; statement: string; category: string | null
    blue_pct: number; total_votes: number; created_at: string
  }[]

  // Top arguments of all time by upvotes
  const { data: argsRaw } = await supabase
    .from('topic_arguments')
    .select(`
      id, content, side, upvotes, created_at,
      topic_id,
      topics!inner(id, statement, status),
      profiles!inner(id, username, display_name, avatar_url, role, clout)
    `)
    .order('upvotes', { ascending: false })
    .limit(10)

  type TopArg = {
    id: string; content: string; side: string; upvotes: number; created_at: string
    topic_id: string
    topics: { id: string; statement: string; status: string }
    profiles: { id: string; username: string; display_name: string | null; avatar_url: string | null; role: string; clout: number }
  }
  const topArgs = (argsRaw ?? []) as unknown as TopArg[]

  // Legendary citizens: top by clout
  const { data: legendsRaw } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, clout, reputation_score, total_votes, total_arguments')
    .order('clout', { ascending: false })
    .limit(12)
  type Legend = {
    id: string; username: string; display_name: string | null; avatar_url: string | null
    role: string; clout: number; reputation_score: number; total_votes: number; total_arguments: number
  }
  const legends = (legendsRaw ?? []) as Legend[]

  // Format numbers
  function fmt(n: number | null | undefined) {
    if (!n) return '0'
    if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
    if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
    return n.toLocaleString()
  }

  const ROLE_BADGE: Record<string, { label: string; className: string }> = {
    elder:        { label: 'Elder',        className: 'bg-gold/15 text-gold border-gold/30' },
    troll_catcher:{ label: 'Troll Catcher',className: 'bg-emerald/15 text-emerald border-emerald/30' },
    debator:      { label: 'Debator',      className: 'bg-for-500/10 text-for-400 border-for-500/30' },
    person:       { label: 'Citizen',      className: 'bg-surface-300/50 text-surface-500 border-surface-400/30' },
  }

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-3xl mx-auto px-4 pt-8 pb-24 md:pb-12">

        {/* ── Hero ──────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-gold/10 border border-gold/30">
              <Crown className="h-6 w-6 text-gold" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">Civic Lore</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                Platform records, legends &amp; the greatest moments in Lobby history
              </p>
            </div>
          </div>

          {/* Platform stat pills */}
          <div className="flex flex-wrap gap-2 mt-4">
            {[
              { label: 'Topics', value: fmt(totalTopics ?? 0), icon: BookOpen, color: 'text-for-400' },
              { label: 'Laws', value: fmt(totalLaws ?? 0), icon: Gavel, color: 'text-gold' },
              { label: 'Votes', value: fmt(totalVotes ?? 0), icon: Scale, color: 'text-purple' },
              { label: 'Arguments', value: fmt(totalArguments ?? 0), icon: Zap, color: 'text-emerald' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div
                key={label}
                className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-surface-100 border border-surface-300"
              >
                <Icon className={cn('h-3.5 w-3.5', color)} />
                <span className="font-mono text-xs font-bold text-white">{value}</span>
                <span className="font-mono text-xs text-surface-500">{label}</span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Platform Records ──────────────────────────────────── */}
        <section className="mb-8">
          <h2 className="font-mono text-xs font-bold text-surface-500 uppercase tracking-widest mb-3">
            Platform Records
          </h2>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {mostVoted && (
              <RecordCard
                icon={Flame}
                iconColor="text-against-400"
                iconBg="bg-against-500/10"
                iconBorder="border-against-500/30"
                label="Most Voted"
                title={mostVoted.statement}
                subtitle={`${fmt(mostVoted.total_votes)} votes · ${Math.round(mostVoted.blue_pct)}% For`}
                href={`/topic/${mostVoted.id}`}
                accent="border-against-500/30"
              />
            )}
            {mostContested && (
              <RecordCard
                icon={Scale}
                iconColor="text-purple"
                iconBg="bg-purple/10"
                iconBorder="border-purple/30"
                label="Most Contested"
                title={mostContested.statement}
                subtitle={`${Math.round(mostContested.blue_pct)}% For — razor-thin margin`}
                href={`/topic/${mostContested.id}`}
                accent="border-purple/30"
              />
            )}
            {strongestMandate && (
              <RecordCard
                icon={Crown}
                iconColor="text-gold"
                iconBg="bg-gold/10"
                iconBorder="border-gold/30"
                label="Strongest Mandate"
                title={strongestMandate.statement}
                subtitle={`${Math.round(Math.abs(strongestMandate.blue_pct > 50 ? strongestMandate.blue_pct : 100 - strongestMandate.blue_pct))}% consensus · ${fmt(strongestMandate.total_votes)} votes`}
                href={`/topic/${strongestMandate.id}`}
                accent="border-gold/30"
              />
            )}
          </div>
        </section>

        {/* ── Laws Hall of Fame ─────────────────────────────────── */}
        {laws.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-mono text-xs font-bold text-surface-500 uppercase tracking-widest">
                Established Laws
              </h2>
              <Link
                href="/laws"
                className="text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
              >
                View all
              </Link>
            </div>
            <div className="space-y-2">
              {laws.map((law, i) => (
                <Link
                  key={law.id}
                  href={`/topic/${law.id}`}
                  className="flex items-start gap-3 p-4 rounded-xl bg-surface-100 border border-gold/20 hover:border-gold/40 transition-all group"
                >
                  {/* Rank */}
                  <div className="flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-lg bg-gold/10 border border-gold/20">
                    <span className="font-mono text-[11px] font-bold text-gold">#{i + 1}</span>
                  </div>

                  {/* Content */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-mono font-semibold text-white leading-snug line-clamp-2 group-hover:text-gold/90 transition-colors">
                      {law.statement}
                    </p>
                    <div className="flex items-center gap-2 mt-2">
                      {categoryPill(law.category)}
                      <span className="text-[10px] font-mono text-surface-500">
                        {fmt(law.total_votes)} votes
                      </span>
                    </div>
                    <div className="mt-2">
                      <VoteBar bluePct={law.blue_pct} />
                    </div>
                  </div>

                  {/* Law badge */}
                  <div className="flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-lg bg-gold/10 border border-gold/30">
                    <Gavel className="h-3.5 w-3.5 text-gold" />
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Top Arguments of All Time ─────────────────────────── */}
        {topArgs.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-mono text-xs font-bold text-surface-500 uppercase tracking-widest">
                Greatest Arguments
              </h2>
              <Link
                href="/arguments"
                className="text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
              >
                Browse all
              </Link>
            </div>
            <div className="space-y-2">
              {topArgs.map((arg, i) => {
                const isFor = arg.side === 'blue'
                return (
                  <div
                    key={arg.id}
                    className={cn(
                      'p-4 rounded-xl bg-surface-100 border transition-all',
                      isFor ? 'border-for-500/20 hover:border-for-500/40' : 'border-against-500/20 hover:border-against-500/40'
                    )}
                  >
                    {/* Header */}
                    <div className="flex items-start gap-2.5 mb-2">
                      {/* Rank */}
                      <span className="flex-shrink-0 font-mono text-[11px] font-bold text-surface-500 mt-0.5 w-5 text-right">
                        #{i + 1}
                      </span>

                      {/* Side icon */}
                      {isFor
                        ? <ThumbsUp className="h-3.5 w-3.5 text-for-400 flex-shrink-0 mt-0.5" />
                        : <ThumbsDown className="h-3.5 w-3.5 text-against-400 flex-shrink-0 mt-0.5" />
                      }

                      {/* Content */}
                      <p className="flex-1 text-sm font-mono text-white leading-snug">
                        &ldquo;{arg.content}&rdquo;
                      </p>

                      {/* Upvotes */}
                      <div className={cn(
                        'flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-lg border text-xs font-mono font-bold',
                        isFor ? 'bg-for-500/10 border-for-500/30 text-for-400' : 'bg-against-500/10 border-against-500/30 text-against-400'
                      )}>
                        <Star className="h-3 w-3" />
                        {fmt(arg.upvotes)}
                      </div>
                    </div>

                    {/* Footer: author + topic */}
                    <div className="flex items-center gap-2 pl-7 flex-wrap">
                      <Link
                        href={`/profile/${arg.profiles.username}`}
                        className="flex items-center gap-1.5 hover:opacity-80 transition-opacity"
                      >
                        <Avatar
                          src={arg.profiles.avatar_url}
                          fallback={arg.profiles.display_name || arg.profiles.username}
                          size="xs"
                        />
                        <span className="text-[11px] font-mono text-surface-400">
                          @{arg.profiles.username}
                        </span>
                      </Link>
                      <span className="text-surface-600 text-[10px]">on</span>
                      <Link
                        href={`/topic/${arg.topics.id}`}
                        className="text-[11px] font-mono text-surface-400 hover:text-white transition-colors truncate max-w-[180px]"
                      >
                        {arg.topics.statement}
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          </section>
        )}

        {/* ── Legendary Citizens ───────────────────────────────────── */}
        {legends.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-mono text-xs font-bold text-surface-500 uppercase tracking-widest">
                Legendary Citizens
              </h2>
              <Link
                href="/leaderboard"
                className="text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
              >
                Full leaderboard
              </Link>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {legends.map((legend, i) => {
                const roleInfo = ROLE_BADGE[legend.role] ?? ROLE_BADGE.person
                const isMedal = i < 3
                const medalColors = ['text-gold', 'text-surface-400', 'text-amber-600']
                const medalBgs = ['bg-gold/10', 'bg-surface-300/50', 'bg-amber-900/30']
                return (
                  <Link
                    key={legend.id}
                    href={`/profile/${legend.username}`}
                    className="flex items-center gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-all group"
                  >
                    {/* Rank */}
                    <div className={cn(
                      'flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-lg border',
                      isMedal ? medalBgs[i] : 'bg-surface-200 border-surface-400/30'
                    )}>
                      {isMedal
                        ? <Trophy className={cn('h-3.5 w-3.5', medalColors[i])} />
                        : <span className="font-mono text-[11px] font-bold text-surface-500">#{i + 1}</span>
                      }
                    </div>

                    {/* Avatar + info */}
                    <div className="flex items-center gap-2.5 flex-1 min-w-0">
                      <Avatar
                        src={legend.avatar_url}
                        fallback={legend.display_name || legend.username}
                        size="sm"
                      />
                      <div className="min-w-0">
                        <p className="text-xs font-mono font-bold text-white truncate group-hover:text-for-400 transition-colors">
                          {legend.display_name || legend.username}
                        </p>
                        <p className="text-[11px] font-mono text-surface-500 truncate">
                          @{legend.username}
                        </p>
                      </div>
                    </div>

                    {/* Role + clout */}
                    <div className="flex-shrink-0 text-right">
                      <div className="flex items-center gap-1 justify-end mb-1">
                        <Zap className="h-3 w-3 text-gold" />
                        <span className="text-[11px] font-mono font-bold text-gold">{fmt(legend.clout)}</span>
                      </div>
                      <span className={cn(
                        'inline-flex text-[9px] font-mono font-semibold px-1.5 py-0.5 rounded-full border',
                        roleInfo.className
                      )}>
                        {roleInfo.label}
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {/* ── See more links ──────────────────────────────────────── */}
        <section>
          <h2 className="font-mono text-xs font-bold text-surface-500 uppercase tracking-widest mb-3">
            Explore More History
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { href: '/arguments/hall-of-fame', icon: Award, label: 'Arguments\nHall of Fame', color: 'text-gold' },
              { href: '/laws', icon: Gavel, label: 'Law\nCodex', color: 'text-for-400' },
              { href: '/leaderboard', icon: Trophy, label: 'Full\nLeaderboard', color: 'text-purple' },
              { href: '/legacy', icon: Shield, label: 'Your\nLegacy', color: 'text-emerald' },
              { href: '/extremes', icon: Scale, label: 'Civic\nExtremes', color: 'text-against-400' },
              { href: '/timeline', icon: Users, label: 'Civic\nTimeline', color: 'text-surface-400' },
            ].map(({ href, icon: Icon, label, color }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2.5 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-surface-400 transition-all group"
              >
                <Icon className={cn('h-4 w-4 flex-shrink-0', color)} />
                <span className="text-xs font-mono font-semibold text-surface-400 group-hover:text-white transition-colors whitespace-pre-line leading-tight">
                  {label}
                </span>
              </Link>
            ))}
          </div>
        </section>

      </main>
      <BottomNav />
    </div>
  )
}
