import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  BarChart2,
  Scale,
  ThumbsDown,
  ThumbsUp,
  Users,
  TrendingUp,
  TrendingDown,
  Minus,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'

export const dynamic = 'force-dynamic'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lobby.market'

interface PageProps {
  params: { username: string }
}

// ─── Category colors ──────────────────────────────────────────────────────────

const CATEGORY_COLOR: Record<string, { text: string; bg: string; border: string; dot: string }> = {
  Economics:   { text: 'text-gold',          bg: 'bg-gold/10',         border: 'border-gold/30',         dot: 'bg-gold' },
  Politics:    { text: 'text-for-400',       bg: 'bg-for-500/10',      border: 'border-for-500/30',      dot: 'bg-for-500' },
  Technology:  { text: 'text-purple',        bg: 'bg-purple/10',       border: 'border-purple/30',       dot: 'bg-purple' },
  Science:     { text: 'text-emerald',       bg: 'bg-emerald/10',      border: 'border-emerald/30',      dot: 'bg-emerald' },
  Ethics:      { text: 'text-for-300',       bg: 'bg-for-300/10',      border: 'border-for-300/30',      dot: 'bg-for-300' },
  Philosophy:  { text: 'text-purple',        bg: 'bg-purple/10',       border: 'border-purple/30',       dot: 'bg-purple' },
  Culture:     { text: 'text-against-300',   bg: 'bg-against-400/10',  border: 'border-against-400/30',  dot: 'bg-against-400' },
  Health:      { text: 'text-emerald',       bg: 'bg-emerald/10',      border: 'border-emerald/30',      dot: 'bg-emerald' },
  Environment: { text: 'text-emerald',       bg: 'bg-emerald/10',      border: 'border-emerald/30',      dot: 'bg-emerald' },
  Education:   { text: 'text-gold',          bg: 'bg-gold/10',         border: 'border-gold/30',         dot: 'bg-gold' },
}

function getCategoryColor(cat: string | null) {
  return CATEGORY_COLOR[cat ?? ''] ?? {
    text: 'text-surface-400',
    bg: 'bg-surface-300/30',
    border: 'border-surface-400/30',
    dot: 'bg-surface-500',
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface PositionRow {
  id: string
  side: string
  created_at: string
  topic_id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number | null
  total_votes: number | null
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name, total_votes, blue_vote_count, red_vote_count')
    .eq('username', params.username)
    .single()

  const name = profile?.display_name ?? params.username
  const total = profile?.total_votes ?? 0
  const forCount = profile?.blue_vote_count ?? 0
  const againstCount = profile?.red_vote_count ?? 0

  const desc = `${name}'s public civic record: ${forCount.toLocaleString()} FOR positions and ${againstCount.toLocaleString()} AGAINST positions across ${total.toLocaleString()} civic topics on Lobby Market.`

  return {
    title: `${name}'s Civic Positions · Lobby Market`,
    description: desc,
    openGraph: {
      title: `${name}'s Civic Positions`,
      description: desc,
      type: 'profile',
      siteName: 'Lobby Market',
      url: `${BASE_URL}/profile/${params.username}/positions`,
    },
    twitter: {
      card: 'summary',
      title: `${name}'s Civic Positions · Lobby Market`,
      description: desc,
    },
  }
}

// ─── Consensus deviation indicator ────────────────────────────────────────────

function ConsensusDeviation({
  userSide,
  platformPct,
}: {
  userSide: string
  platformPct: number | null
}) {
  if (platformPct === null) return null
  const userFor = userSide === 'blue'
  const platformFor = platformPct >= 50
  const withMajority = userFor === platformFor
  const margin = Math.abs(platformPct - 50)

  if (margin < 10) {
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-mono text-surface-500">
        <Minus className="h-2.5 w-2.5" />
        Split
      </span>
    )
  }

  return (
    <span className={cn(
      'inline-flex items-center gap-1 text-[10px] font-mono',
      withMajority ? 'text-emerald/70' : 'text-against-400/70',
    )}>
      {withMajority ? (
        <TrendingUp className="h-2.5 w-2.5" />
      ) : (
        <TrendingDown className="h-2.5 w-2.5" />
      )}
      {withMajority ? 'Majority' : 'Minority'}
    </span>
  )
}

// ─── Position card ────────────────────────────────────────────────────────────

function PositionCard({ pos }: { pos: PositionRow }) {
  const isFor = pos.side === 'blue'
  const colors = getCategoryColor(pos.category)
  const isLaw = pos.status === 'law'
  const isFailed = pos.status === 'failed'
  const isResolved = isLaw || isFailed
  const votedWithOutcome = isResolved
    ? (isFor && isLaw) || (!isFor && isFailed)
    : null

  const forPct = pos.blue_pct ?? 50

  const statusBadge: 'proposed' | 'active' | 'law' | 'failed' =
    pos.status === 'law' ? 'law' :
    pos.status === 'failed' ? 'failed' :
    pos.status === 'active' ? 'active' :
    'proposed'

  return (
    <Link
      href={`/topic/${pos.topic_id}`}
      className={cn(
        'group block rounded-xl border transition-all duration-150',
        'hover:border-surface-400/80 hover:-translate-y-px',
        isFor
          ? 'bg-for-900/20 border-for-800/30 hover:bg-for-900/30'
          : 'bg-against-900/20 border-against-800/30 hover:bg-against-900/30',
      )}
    >
      <div className="flex items-start gap-3 p-3">
        {/* Side indicator */}
        <div className={cn(
          'flex-shrink-0 mt-0.5 flex items-center justify-center h-7 w-7 rounded-lg',
          isFor ? 'bg-for-500/20 text-for-400' : 'bg-against-500/20 text-against-400',
        )}>
          {isFor
            ? <ThumbsUp className="h-3.5 w-3.5" />
            : <ThumbsDown className="h-3.5 w-3.5" />
          }
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {/* Statement */}
          <p className="text-sm font-semibold text-white leading-snug line-clamp-2 group-hover:text-for-100 transition-colors mb-1.5">
            {pos.statement}
          </p>

          {/* Meta row */}
          <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
            {/* Category chip */}
            {pos.category && (
              <span className={cn(
                'inline-flex items-center gap-1 text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded-md',
                colors.bg, colors.border, colors.text,
                'border',
              )}>
                <span className={cn('h-1.5 w-1.5 rounded-full', colors.dot)} />
                {pos.category}
              </span>
            )}

            {/* Status badge */}
            <Badge variant={statusBadge} className="text-[10px] py-0 px-1.5">
              {isLaw ? 'LAW' : pos.status.toUpperCase()}
            </Badge>

            {/* Consensus comparison */}
            <ConsensusDeviation userSide={pos.side} platformPct={forPct} />

            {/* Outcome indicator for resolved topics */}
            {isResolved && votedWithOutcome !== null && (
              <span className={cn(
                'text-[10px] font-mono',
                votedWithOutcome ? 'text-emerald' : 'text-surface-600',
              )}>
                {votedWithOutcome ? '✓ called it' : '✗ lost'}
              </span>
            )}
          </div>
        </div>

        {/* Vote bar */}
        <div className="flex-shrink-0 w-16 flex flex-col items-end gap-1">
          <div className="h-1.5 w-full rounded-full bg-against-900/60 overflow-hidden">
            <div
              className="h-full bg-for-500 rounded-full transition-all duration-500"
              style={{ width: `${forPct}%` }}
            />
          </div>
          <span className={cn(
            'text-[10px] font-mono font-bold',
            isFor ? 'text-for-400' : 'text-against-400',
          )}>
            {isFor ? `${Math.round(forPct)}%` : `${100 - Math.round(forPct)}%`}
          </span>
        </div>
      </div>
    </Link>
  )
}

// ─── Category group ───────────────────────────────────────────────────────────

function CategoryGroup({
  category,
  positions,
}: {
  category: string | null
  positions: PositionRow[]
}) {
  const label = category ?? 'Uncategorized'
  const colors = getCategoryColor(category)

  return (
    <div className="mb-5">
      <div className="flex items-center gap-2 mb-2">
        <span className={cn('h-2 w-2 rounded-full flex-shrink-0', colors.dot)} />
        <h3 className={cn('text-[11px] font-mono font-bold uppercase tracking-widest', colors.text)}>
          {label}
        </h3>
        <span className="text-[10px] font-mono text-surface-600">
          ({positions.length})
        </span>
      </div>
      <div className="space-y-2 pl-4">
        {positions.map((pos) => (
          <PositionCard key={pos.id} pos={pos} />
        ))}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function PositionsPage({ params }: PageProps) {
  const supabase = await createClient()

  // Auth check
  const { data: { user } } = await supabase.auth.getUser()

  // Load the profile being viewed
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, clout, total_votes, blue_vote_count, red_vote_count, civic_oath_value')
    .eq('username', params.username)
    .single()

  if (!profile) notFound()

  const isOwner = user?.id === profile.id

  // Load all votes with topic data (up to 500 most recent)
  const { data: votes } = await supabase
    .from('votes')
    .select(`
      id,
      side,
      created_at,
      topic_id,
      topics (
        statement,
        category,
        status,
        blue_pct,
        total_votes
      )
    `)
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(500)

  const rows: PositionRow[] = (votes ?? [])
    .filter((v) => v.topics)
    .map((v) => {
      const t = v.topics as {
        statement: string
        category: string | null
        status: string
        blue_pct: number | null
        total_votes: number | null
      }
      return {
        id: v.id,
        side: v.side,
        created_at: v.created_at,
        topic_id: v.topic_id,
        statement: t.statement,
        category: t.category,
        status: t.status,
        blue_pct: t.blue_pct,
        total_votes: t.total_votes,
      }
    })

  // Split into FOR / AGAINST
  const forRows = rows.filter((r) => r.side === 'blue')
  const againstRows = rows.filter((r) => r.side === 'red')

  // Group by category
  function groupByCategory(items: PositionRow[]): Map<string | null, PositionRow[]> {
    const map = new Map<string | null, PositionRow[]>()
    for (const item of items) {
      const cat = item.category
      if (!map.has(cat)) map.set(cat, [])
      map.get(cat)!.push(item)
    }
    // Sort groups by size descending
    return new Map([...map.entries()].sort((a, b) => b[1].length - a[1].length))
  }

  const forGroups = groupByCategory(forRows)
  const againstGroups = groupByCategory(againstRows)

  // Consensus stats
  const resolvedRows = rows.filter((r) => r.status === 'law' || r.status === 'failed')
  const correctCalls = resolvedRows.filter((r) => {
    const isFor = r.side === 'blue'
    return (isFor && r.status === 'law') || (!isFor && r.status === 'failed')
  })
  const accuracy = resolvedRows.length > 0
    ? Math.round((correctCalls.length / resolvedRows.length) * 100)
    : null

  // Contrarian positions (user is in the minority on a resolved topic)
  const contrarianPositions = rows.filter((r) => {
    if (r.blue_pct === null) return false
    const isFor = r.side === 'blue'
    const forPct = r.blue_pct
    // User voted against the platform majority (>60/40)
    return (isFor && forPct < 40) || (!isFor && forPct > 60)
  })

  // Laws the user helped pass
  const lawPositions = rows.filter((r) => r.status === 'law' && r.side === 'blue')

  const totalVotes = rows.length
  const forPct = totalVotes > 0 ? Math.round((forRows.length / totalVotes) * 100) : 50

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">
        {/* Header */}
        <div className="flex items-start gap-3 mb-6">
          <Link
            href={`/profile/${profile.username}`}
            aria-label="Back to profile"
            className="flex-shrink-0 mt-0.5 flex items-center justify-center h-9 w-9 rounded-lg bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-5 w-5" />
          </Link>

          <div className="flex items-center gap-3 flex-1 min-w-0">
            <Avatar
              src={profile.avatar_url}
              fallback={profile.display_name || profile.username}
              size="sm"
              className="flex-shrink-0"
            />
            <div className="min-w-0">
              <h1 className="text-base font-bold text-white truncate">
                {profile.display_name ?? profile.username}&rsquo;s Positions
              </h1>
              <p className="text-xs text-surface-500 font-mono truncate">
                @{profile.username} · {totalVotes.toLocaleString()} votes
              </p>
            </div>
          </div>

          <Link
            href={`/profile/${profile.username}/votes`}
            aria-label="View vote log"
            className="flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-mono font-semibold text-surface-500 border border-surface-400/30 hover:text-white hover:border-surface-400 transition-all"
          >
            <BarChart2 className="h-3 w-3" />
            Log
          </Link>
        </div>

        {/* Summary stats */}
        {totalVotes > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-6">
            <div className="rounded-xl border border-surface-300 bg-surface-100 p-3">
              <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-1">FOR</p>
              <p className="text-xl font-black font-mono text-for-400">{forRows.length.toLocaleString()}</p>
              <p className="text-[10px] font-mono text-surface-600">{forPct}% of votes</p>
            </div>
            <div className="rounded-xl border border-surface-300 bg-surface-100 p-3">
              <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-1">AGAINST</p>
              <p className="text-xl font-black font-mono text-against-400">{againstRows.length.toLocaleString()}</p>
              <p className="text-[10px] font-mono text-surface-600">{100 - forPct}% of votes</p>
            </div>
            <div className="rounded-xl border border-surface-300 bg-surface-100 p-3">
              <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-1">Accuracy</p>
              <p className={cn(
                'text-xl font-black font-mono',
                accuracy === null ? 'text-surface-400' :
                accuracy >= 70 ? 'text-emerald' :
                accuracy >= 50 ? 'text-gold' : 'text-surface-400',
              )}>
                {accuracy !== null ? `${accuracy}%` : '—'}
              </p>
              <p className="text-[10px] font-mono text-surface-600">
                {resolvedRows.length > 0 ? `${correctCalls.length}/${resolvedRows.length} resolved` : 'No resolved yet'}
              </p>
            </div>
            <div className="rounded-xl border border-surface-300 bg-surface-100 p-3">
              <p className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-1">Laws</p>
              <p className="text-xl font-black font-mono text-gold">
                {lawPositions.length}
              </p>
              <p className="text-[10px] font-mono text-surface-600">FOR positions that passed</p>
            </div>
          </div>
        )}

        {/* FOR/AGAINST split bar */}
        {totalVotes > 0 && (
          <div className="mb-6 rounded-xl bg-surface-100 border border-surface-300 p-4">
            <div className="flex justify-between text-[11px] font-mono mb-2">
              <span className="text-for-400 font-bold">
                <ThumbsUp className="h-3 w-3 inline mr-1" />
                FOR {forPct}%
              </span>
              <span className="text-surface-500">{totalVotes.toLocaleString()} positions</span>
              <span className="text-against-400 font-bold">
                {100 - forPct}% AGAINST
                <ThumbsDown className="h-3 w-3 inline ml-1" />
              </span>
            </div>
            <div className="h-2 rounded-full bg-against-900/60 overflow-hidden">
              <div
                className="h-full bg-for-500 rounded-full transition-all duration-700"
                style={{ width: `${forPct}%` }}
              />
            </div>
            {/* Category breakdown strip */}
            {forGroups.size > 0 && (
              <div className="mt-3 flex flex-wrap gap-1.5">
                {Array.from(forGroups.entries()).slice(0, 6).map(([cat, items]) => {
                  const colors = getCategoryColor(cat)
                  return (
                    <span
                      key={cat ?? 'other'}
                      className={cn(
                        'inline-flex items-center gap-1 text-[10px] font-mono px-2 py-0.5 rounded-full border',
                        colors.bg, colors.border, colors.text,
                      )}
                    >
                      <span className={cn('h-1.5 w-1.5 rounded-full', colors.dot)} />
                      {cat ?? 'Other'} ({items.length})
                    </span>
                  )
                })}
              </div>
            )}
          </div>
        )}

        {/* Contrarian highlight */}
        {contrarianPositions.length > 0 && (
          <div className="mb-6 rounded-xl border border-against-700/30 bg-against-900/20 p-4">
            <div className="flex items-center gap-2 mb-3">
              <TrendingDown className="h-4 w-4 text-against-400" />
              <h2 className="text-xs font-mono font-bold text-against-300 uppercase tracking-wider">
                Contrarian Positions · {contrarianPositions.length}
              </h2>
            </div>
            <p className="text-[11px] font-mono text-surface-500 mb-3">
              Votes where {isOwner ? 'you went' : `${profile.display_name ?? profile.username} went`} against the platform majority by 20+ points.
            </p>
            <div className="space-y-2">
              {contrarianPositions.slice(0, 5).map((pos) => {
                const isFor = pos.side === 'blue'
                const forPct = pos.blue_pct ?? 50
                return (
                  <Link
                    key={pos.id}
                    href={`/topic/${pos.topic_id}`}
                    className="flex items-center gap-2 group"
                  >
                    <span className={cn(
                      'flex-shrink-0 h-4 w-4 flex items-center justify-center rounded',
                      isFor ? 'text-for-400' : 'text-against-400',
                    )}>
                      {isFor ? <ThumbsUp className="h-3 w-3" /> : <ThumbsDown className="h-3 w-3" />}
                    </span>
                    <span className="text-xs font-mono text-surface-400 group-hover:text-white transition-colors line-clamp-1 flex-1">
                      {pos.statement}
                    </span>
                    <span className="flex-shrink-0 text-[10px] font-mono text-surface-600">
                      {isFor
                        ? `${Math.round(forPct)}% For (majority Against)`
                        : `${Math.round(forPct)}% For (majority For)`
                      }
                    </span>
                  </Link>
                )
              })}
            </div>
          </div>
        )}

        {/* Empty state */}
        {totalVotes === 0 && (
          <EmptyState
            icon={Scale}
            title="No positions yet"
            description={
              isOwner
                ? 'Start voting on topics to build your public civic record.'
                : `${profile.display_name ?? profile.username} hasn't voted on any topics yet.`
            }
            actions={isOwner ? [{ label: 'Browse topics', href: '/' }] : []}
          />
        )}

        {/* FOR positions */}
        {forRows.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <ThumbsUp className="h-4 w-4 text-for-400" />
              <h2 className="text-sm font-bold font-mono text-for-300 uppercase tracking-wider">
                FOR · {forRows.length}
              </h2>
              <div className="flex-1 h-px bg-for-900/40" />
            </div>
            {Array.from(forGroups.entries()).map(([cat, items]) => (
              <CategoryGroup key={cat ?? 'none'} category={cat} positions={items} />
            ))}
          </section>
        )}

        {/* AGAINST positions */}
        {againstRows.length > 0 && (
          <section className="mb-8">
            <div className="flex items-center gap-2 mb-4">
              <ThumbsDown className="h-4 w-4 text-against-400" />
              <h2 className="text-sm font-bold font-mono text-against-300 uppercase tracking-wider">
                AGAINST · {againstRows.length}
              </h2>
              <div className="flex-1 h-px bg-against-900/40" />
            </div>
            {Array.from(againstGroups.entries()).map(([cat, items]) => (
              <CategoryGroup key={cat ?? 'none'} category={cat} positions={items} />
            ))}
          </section>
        )}

        {/* Footer nav */}
        {totalVotes > 0 && (
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4 text-xs font-mono text-surface-500">
            <Link
              href={`/profile/${profile.username}`}
              className="hover:text-white transition-colors"
            >
              ← Profile
            </Link>
            <Link
              href={`/profile/${profile.username}/votes`}
              className="hover:text-white transition-colors flex items-center gap-1"
            >
              <BarChart2 className="h-3 w-3" />
              Vote log
            </Link>
            <Link
              href={`/profile/${profile.username}/analytics`}
              className="hover:text-white transition-colors flex items-center gap-1"
            >
              <TrendingUp className="h-3 w-3" />
              Analytics
            </Link>
            <Link
              href={`/compare-users?a=${profile.username}`}
              className="hover:text-white transition-colors flex items-center gap-1"
            >
              <Users className="h-3 w-3" />
              Compare with me
            </Link>
          </div>
        )}
      </main>
      <BottomNav />
    </div>
  )
}
