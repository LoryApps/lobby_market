import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  Award,
  ChevronRight,
  Clock,
  Coins,
  Target,
  ThumbsDown,
  ThumbsUp,
  Trophy,
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

interface PageProps {
  params: { username: string }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 30) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function deadlineLabel(iso: string | null): { label: string; urgent: boolean } | null {
  if (!iso) return null
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return { label: 'Expired', urgent: false }
  const h = Math.floor(diff / 3_600_000)
  const d = Math.floor(h / 24)
  if (h < 1) return { label: '< 1h left', urgent: true }
  if (h < 24) return { label: `${h}h left`, urgent: true }
  if (d < 3) return { label: `${d}d left`, urgent: true }
  if (d < 7) return { label: `${d}d left`, urgent: false }
  return {
    label: new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
    urgent: false,
  }
}

function fmtNum(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
}

const CATEGORY_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  Economics:   { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Politics:    { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
  Technology:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Science:     { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Ethics:      { text: 'text-for-300',     bg: 'bg-for-300/10',     border: 'border-for-300/30' },
  Philosophy:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Culture:     { text: 'text-against-300', bg: 'bg-against-400/10', border: 'border-against-400/30' },
  Health:      { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Environment: { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Education:   { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
}

function getCategoryColor(cat: string | null) {
  return CATEGORY_COLOR[cat ?? ''] ?? { text: 'text-surface-400', bg: 'bg-surface-300/30', border: 'border-surface-400/30' }
}

const STATUS_CONFIG: Record<string, { label: string; color: string; bg: string; border: string }> = {
  open:    { label: 'Open',    color: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
  awarded: { label: 'Awarded', color: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  expired: { label: 'Expired', color: 'text-surface-500', bg: 'bg-surface-300/20', border: 'border-surface-400/30' },
}

const SIDE_CONFIG: Record<string, { label: string; color: string; Icon: React.ElementType }> = {
  for:     { label: 'FOR',     color: 'text-for-400',     Icon: ThumbsUp },
  against: { label: 'AGAINST', color: 'text-against-400', Icon: ThumbsDown },
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent = 'neutral',
}: {
  label: string
  value: string | number
  sub?: string
  accent?: 'gold' | 'for' | 'against' | 'emerald' | 'purple' | 'neutral'
}) {
  const accentClass = {
    gold:    'text-gold',
    for:     'text-for-400',
    against: 'text-against-400',
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

interface BountyRow {
  id: string
  topic_id: string
  side: string | null
  amount: number
  description: string
  deadline: string | null
  winner_argument_id: string | null
  winner_id: string | null
  status: string
  created_at: string
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
  } | null
}

interface WonBountyRow {
  id: string
  topic_id: string
  amount: number
  description: string
  created_at: string
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
  } | null
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('username', params.username)
    .single()

  const name = profile?.display_name ?? params.username

  return {
    title: `${name}'s Bounties · Lobby Market`,
    description: `See the civic argument bounties ${name} has posted and won on Lobby Market — clout staked to commission the best arguments on debate topics.`,
    openGraph: {
      title: `${name}'s Bounties`,
      description: `${name}'s bounty board on Lobby Market — clout wagered to commission top-quality civic arguments.`,
      type: 'profile',
      siteName: 'Lobby Market',
      url: `${BASE_URL}/profile/${params.username}/bounties`,
    },
    twitter: {
      card: 'summary',
      title: `${name}'s Bounties · Lobby Market`,
      description: `How much clout has ${name} put on the line? Bounties posted and won on Lobby Market.`,
    },
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ProfileBountiesPage({ params }: PageProps) {
  const supabase = await createClient()

  // 1. Load profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role')
    .eq('username', params.username)
    .single()

  if (!profile) notFound()

  // 2. Current viewer
  const { data: { user } } = await supabase.auth.getUser()
  const isOwner = user?.id === profile.id
  const displayName = profile.display_name ?? profile.username

  // 3. Bounties this user CREATED
  const { data: createdRows } = await supabase
    .from('topic_bounties')
    .select(`
      id,
      topic_id,
      side,
      amount,
      description,
      deadline,
      winner_argument_id,
      winner_id,
      status,
      created_at,
      topics!topic_bounties_topic_id_fkey(id, statement, category, status)
    `)
    .eq('creator_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(100)

  const created: BountyRow[] = (createdRows ?? []).map((r) => {
    const raw = r as {
      id: string
      topic_id: string
      side: string | null
      amount: number
      description: string
      deadline: string | null
      winner_argument_id: string | null
      winner_id: string | null
      status: string
      created_at: string
      topics: { id: string; statement: string; category: string | null; status: string } | null
    }
    return {
      id: raw.id,
      topic_id: raw.topic_id,
      side: raw.side,
      amount: raw.amount,
      description: raw.description,
      deadline: raw.deadline,
      winner_argument_id: raw.winner_argument_id,
      winner_id: raw.winner_id,
      status: raw.status,
      created_at: raw.created_at,
      topic: raw.topics ?? null,
    }
  })

  // 4. Bounties this user WON (winner_id = profile.id)
  const { data: wonRows } = await supabase
    .from('topic_bounties')
    .select(`
      id,
      topic_id,
      amount,
      description,
      created_at,
      topics!topic_bounties_topic_id_fkey(id, statement, category, status)
    `)
    .eq('winner_id', profile.id)
    .eq('status', 'awarded')
    .order('created_at', { ascending: false })
    .limit(50)

  const won: WonBountyRow[] = (wonRows ?? []).map((r) => {
    const raw = r as {
      id: string
      topic_id: string
      amount: number
      description: string
      created_at: string
      topics: { id: string; statement: string; category: string | null; status: string } | null
    }
    return {
      id: raw.id,
      topic_id: raw.topic_id,
      amount: raw.amount,
      description: raw.description,
      created_at: raw.created_at,
      topic: raw.topics ?? null,
    }
  })

  // 5. Compute stats
  const totalCreated = created.length
  const totalStaked = created.reduce((s, b) => s + b.amount, 0)
  const openCount = created.filter((b) => b.status === 'open').length
  const awardedCount = created.filter((b) => b.status === 'awarded').length
  const totalWon = won.length
  const cloutWon = won.reduce((s, b) => s + b.amount, 0)

  // 6. Category breakdown (created bounties)
  const catMap: Record<string, number> = {}
  for (const b of created) {
    const cat = b.topic?.category ?? 'Other'
    catMap[cat] = (catMap[cat] ?? 0) + 1
  }
  const topCategories = Object.entries(catMap).sort((a, b) => b[1] - a[1]).slice(0, 5)

  const hasActivity = totalCreated > 0 || totalWon > 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">

        {/* ── Back link ─────────────────────────────────────────────── */}
        <Link
          href={`/profile/${profile.username}`}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors mb-6"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to profile
        </Link>

        {/* ── Header ────────────────────────────────────────────────── */}
        <div className="flex items-center gap-4 mb-6">
          <Avatar
            src={profile.avatar_url}
            fallback={displayName}
            size="lg"
            className="rounded-2xl ring-2 ring-surface-400/30 flex-shrink-0"
          />
          <div>
            <h1 className="font-mono text-xl font-bold text-white leading-tight">
              {isOwner ? 'Your' : `${displayName}'s`} Bounties
            </h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {hasActivity ? (
                <>
                  <span className="flex items-center gap-1 text-[11px] font-mono text-gold">
                    <Coins className="h-3 w-3" />
                    {totalCreated} bounty{totalCreated !== 1 ? 'ies' : ''} posted
                  </span>
                  {totalWon > 0 && (
                    <>
                      <span className="text-surface-600">·</span>
                      <span className="flex items-center gap-1 text-[11px] font-mono text-emerald">
                        <Trophy className="h-3 w-3" />
                        {totalWon} won
                      </span>
                    </>
                  )}
                </>
              ) : (
                <span className="text-xs font-mono text-surface-500">No bounty activity yet</span>
              )}
            </div>
          </div>
        </div>

        {!hasActivity ? (
          <EmptyState
            icon={Coins}
            title={isOwner ? 'No bounty activity yet' : `${displayName} hasn't posted any bounties`}
            description={
              isOwner
                ? 'Post a bounty on any topic to commission the best argument — stake your clout and let the community compete.'
                : 'Check back later — this citizen hasn\'t posted any bounties yet.'
            }
            actions={isOwner ? [{ label: 'Browse topics', href: '/topics' }, { label: 'Open bounties', href: '/bounties' }] : undefined}
          />
        ) : (
          <>
            {/* ── Stats row ─────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <StatCard
                label="Posted"
                value={totalCreated}
                sub="bounties created"
                accent="gold"
              />
              <StatCard
                label="Staked"
                value={fmtNum(totalStaked)}
                sub="clout risked"
                accent="for"
              />
              <StatCard
                label="Awarded"
                value={awardedCount}
                sub="winners picked"
                accent="emerald"
              />
              <StatCard
                label="Won"
                value={totalWon}
                sub={`${fmtNum(cloutWon)} clout earned`}
                accent="purple"
              />
            </div>

            {/* ── Category breakdown (if enough data) ──────────────── */}
            {topCategories.length > 1 && (
              <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 mb-6">
                <h2 className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5" />
                  Categories funded
                </h2>
                <div className="space-y-2">
                  {topCategories.map(([cat, count]) => {
                    const colors = getCategoryColor(cat)
                    const pct = Math.round((count / totalCreated) * 100)
                    return (
                      <div key={cat} className="flex items-center gap-3">
                        <span className={cn('text-[10px] font-mono w-24 flex-shrink-0 uppercase tracking-wide', colors.text)}>
                          {cat}
                        </span>
                        <div className="flex-1 h-1.5 bg-surface-300 rounded-full overflow-hidden">
                          <div
                            className={cn('h-full rounded-full', colors.bg.replace('/10', '/60'))}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-surface-500 w-8 text-right">
                          {count}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Nav breadcrumb ────────────────────────────────────── */}
            <div className="flex items-center gap-2 mb-5 flex-wrap">
              {[
                { href: `/profile/${profile.username}`,           label: 'Profile' },
                { href: `/profile/${profile.username}/votes`,     label: 'Votes' },
                { href: `/profile/${profile.username}/arguments`, label: 'Arguments' },
                { href: `/profile/${profile.username}/evidence`,  label: 'Evidence' },
                { href: `/profile/${profile.username}/bounties`,  label: 'Bounties', active: true },
              ].map(({ href, label, active }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'text-xs font-mono px-3 py-1.5 rounded-lg border transition-colors',
                    active
                      ? 'bg-gold/10 border-gold/30 text-gold'
                      : 'bg-surface-100 border-surface-300 text-surface-400 hover:text-white hover:border-surface-400',
                  )}
                >
                  {label}
                </Link>
              ))}
            </div>

            {/* ── Created bounties ──────────────────────────────────── */}
            {totalCreated > 0 && (
              <section className="mb-8">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Target className="h-3.5 w-3.5 text-gold" />
                    {isOwner ? 'Your' : 'Posted'} Bounties
                    <span className="text-surface-600 font-normal">({totalCreated})</span>
                  </h2>
                  {openCount > 0 && (
                    <span className="text-[10px] font-mono text-for-400">
                      {openCount} open
                    </span>
                  )}
                </div>

                <div className="space-y-3">
                  {created.map((bounty) => {
                    const statusCfg = STATUS_CONFIG[bounty.status] ?? STATUS_CONFIG.expired
                    const catColors = getCategoryColor(bounty.topic?.category ?? null)
                    const dl = deadlineLabel(bounty.deadline)
                    const sideCfg = bounty.side ? SIDE_CONFIG[bounty.side] : null

                    return (
                      <div
                        key={bounty.id}
                        className={cn(
                          'rounded-xl border bg-surface-100 p-4 hover:border-surface-400 transition-colors',
                          bounty.status === 'open'
                            ? 'border-for-500/20 bg-for-500/5'
                            : bounty.status === 'awarded'
                            ? 'border-gold/20 bg-gold/5'
                            : 'border-surface-300',
                        )}
                      >
                        <div className="flex items-start gap-3">
                          {/* Amount badge */}
                          <div className={cn(
                            'flex-shrink-0 flex flex-col items-center justify-center h-11 w-11 rounded-xl border font-mono',
                            bounty.status === 'open'
                              ? 'bg-for-500/10 border-for-500/30 text-for-400'
                              : bounty.status === 'awarded'
                              ? 'bg-gold/10 border-gold/30 text-gold'
                              : 'bg-surface-200 border-surface-300 text-surface-500',
                          )}>
                            <Coins className="h-3 w-3 mb-0.5" />
                            <span className="text-[10px] font-black">{bounty.amount}</span>
                          </div>

                          <div className="flex-1 min-w-0">
                            {/* Badges row */}
                            <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                              <span className={cn(
                                'text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border font-semibold',
                                statusCfg.color, statusCfg.bg, statusCfg.border,
                              )}>
                                {statusCfg.label}
                              </span>

                              {sideCfg && (
                                <span className={cn('flex items-center gap-0.5 text-[9px] font-mono uppercase tracking-wider', sideCfg.color)}>
                                  <sideCfg.Icon className="h-2.5 w-2.5" />
                                  {sideCfg.label}
                                </span>
                              )}

                              {bounty.topic?.category && (
                                <span className={cn(
                                  'text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border',
                                  catColors.text, catColors.bg, catColors.border,
                                )}>
                                  {bounty.topic.category}
                                </span>
                              )}
                            </div>

                            {/* Description */}
                            <p className="text-xs font-mono text-surface-300 leading-snug mb-1.5 line-clamp-2">
                              {bounty.description}
                            </p>

                            {/* Meta row */}
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] font-mono text-surface-600 flex items-center gap-1">
                                <Clock className="h-2.5 w-2.5" />
                                {relativeTime(bounty.created_at)}
                              </span>

                              {dl && (
                                <span className={cn(
                                  'text-[10px] font-mono flex items-center gap-1',
                                  dl.urgent ? 'text-against-400' : 'text-surface-500',
                                )}>
                                  <Clock className="h-2.5 w-2.5" />
                                  {dl.label}
                                </span>
                              )}
                            </div>
                          </div>

                          {/* Topic link */}
                          {bounty.topic && (
                            <Link
                              href={`/topic/${bounty.topic.id}`}
                              className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
                              title="View topic"
                            >
                              <ChevronRight className="h-3.5 w-3.5" />
                            </Link>
                          )}
                        </div>

                        {/* Topic statement */}
                        {bounty.topic && (
                          <Link
                            href={`/topic/${bounty.topic.id}`}
                            className="mt-3 block text-[10px] font-mono text-surface-600 hover:text-surface-400 transition-colors border-t border-surface-300/60 pt-2.5 line-clamp-1"
                          >
                            on: {bounty.topic.statement}
                          </Link>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* ── Won bounties ──────────────────────────────────────── */}
            {totalWon > 0 && (
              <section className="mb-8">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider flex items-center gap-1.5">
                    <Trophy className="h-3.5 w-3.5 text-gold" />
                    Bounties Won
                    <span className="text-surface-600 font-normal">({totalWon})</span>
                  </h2>
                  <span className="text-[10px] font-mono text-gold">
                    {fmtNum(cloutWon)} clout earned
                  </span>
                </div>

                <div className="space-y-3">
                  {won.map((bounty) => {
                    const catColors = getCategoryColor(bounty.topic?.category ?? null)

                    return (
                      <div
                        key={bounty.id}
                        className="rounded-xl border border-gold/20 bg-gold/5 p-4 hover:border-gold/30 transition-colors"
                      >
                        <div className="flex items-start gap-3">
                          {/* Amount badge */}
                          <div className="flex-shrink-0 flex flex-col items-center justify-center h-11 w-11 rounded-xl border bg-gold/10 border-gold/30 text-gold font-mono">
                            <Award className="h-3 w-3 mb-0.5" />
                            <span className="text-[10px] font-black">{bounty.amount}</span>
                          </div>

                          <div className="flex-1 min-w-0">
                            {/* Badges row */}
                            <div className="flex items-center gap-1.5 flex-wrap mb-1.5">
                              <span className="text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border font-semibold text-gold bg-gold/10 border-gold/30">
                                Awarded
                              </span>
                              {bounty.topic?.category && (
                                <span className={cn(
                                  'text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border',
                                  catColors.text, catColors.bg, catColors.border,
                                )}>
                                  {bounty.topic.category}
                                </span>
                              )}
                            </div>

                            {/* Bounty prompt */}
                            <p className="text-xs font-mono text-surface-300 leading-snug mb-1.5 line-clamp-2">
                              {bounty.description}
                            </p>

                            {/* Meta */}
                            <span className="text-[10px] font-mono text-surface-600 flex items-center gap-1">
                              <Clock className="h-2.5 w-2.5" />
                              {relativeTime(bounty.created_at)}
                            </span>
                          </div>

                          {/* Topic link */}
                          {bounty.topic && (
                            <Link
                              href={`/topic/${bounty.topic.id}`}
                              className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 text-surface-500 hover:text-gold hover:bg-gold/10 transition-colors"
                              title="View topic"
                            >
                              <ChevronRight className="h-3.5 w-3.5" />
                            </Link>
                          )}
                        </div>

                        {/* Topic statement */}
                        {bounty.topic && (
                          <Link
                            href={`/topic/${bounty.topic.id}`}
                            className="mt-3 block text-[10px] font-mono text-surface-600 hover:text-surface-400 transition-colors border-t border-gold/20 pt-2.5 line-clamp-1"
                          >
                            on: {bounty.topic.statement}
                          </Link>
                        )}
                      </div>
                    )
                  })}
                </div>
              </section>
            )}

            {/* ── Footer CTA ────────────────────────────────────────── */}
            <div className={cn(
              'rounded-2xl border p-5 text-center',
              isOwner
                ? 'border-gold/20 bg-gold/5'
                : 'border-surface-300 bg-surface-100',
            )}>
              <Coins className={cn('h-5 w-5 mx-auto mb-2', isOwner ? 'text-gold' : 'text-surface-500')} />
              <h3 className="font-mono text-sm font-bold text-white mb-1">
                {isOwner ? 'Commission the best argument' : 'Browse open bounties'}
              </h3>
              <p className="text-xs font-mono text-surface-500 mb-4">
                {isOwner
                  ? 'Stake your clout on any debate topic to invite citizens to argue their best case. You pick the winner.'
                  : 'Citizens stake clout to commission top arguments. Win a bounty by writing the most compelling case.'}
              </p>
              <div className="flex items-center justify-center gap-3 flex-wrap">
                <Link
                  href="/bounties"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gold/20 border border-gold/30 text-gold text-sm font-mono font-semibold hover:bg-gold/30 transition-colors"
                >
                  <Coins className="h-4 w-4" />
                  {isOwner ? 'Browse topics' : 'Open bounties'}
                </Link>
                <Link
                  href="/leaderboard/bounties"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-surface-300 text-sm font-mono font-semibold hover:bg-surface-300 hover:text-white transition-colors"
                >
                  <Trophy className="h-4 w-4" />
                  Bounty leaderboard
                </Link>
              </div>
            </div>
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
