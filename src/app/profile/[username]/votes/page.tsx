import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  CheckCircle2,
  ChevronRight,
  Gavel,
  MessageSquare,
  Scale,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  XCircle,
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

const CATEGORY_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  Economics:   { text: 'text-gold',          bg: 'bg-gold/10',          border: 'border-gold/30' },
  Politics:    { text: 'text-for-400',       bg: 'bg-for-500/10',       border: 'border-for-500/30' },
  Technology:  { text: 'text-purple',        bg: 'bg-purple/10',        border: 'border-purple/30' },
  Science:     { text: 'text-emerald',       bg: 'bg-emerald/10',       border: 'border-emerald/30' },
  Ethics:      { text: 'text-for-300',       bg: 'bg-for-300/10',       border: 'border-for-300/30' },
  Philosophy:  { text: 'text-purple',        bg: 'bg-purple/10',        border: 'border-purple/30' },
  Culture:     { text: 'text-against-300',   bg: 'bg-against-400/10',   border: 'border-against-400/30' },
  Health:      { text: 'text-emerald',       bg: 'bg-emerald/10',       border: 'border-emerald/30' },
  Environment: { text: 'text-emerald',       bg: 'bg-emerald/10',       border: 'border-emerald/30' },
  Education:   { text: 'text-gold',          bg: 'bg-gold/10',          border: 'border-gold/30' },
}

function getCategoryColor(cat: string | null) {
  return CATEGORY_COLOR[cat ?? ''] ?? { text: 'text-surface-400', bg: 'bg-surface-300/30', border: 'border-surface-400/30' }
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
  const forPct = total > 0 ? Math.round(((profile?.blue_vote_count ?? 0) / total) * 100) : 50
  const desc = `${name} has cast ${total.toLocaleString()} votes — ${forPct}% FOR across all civic topics on Lobby Market.`

  return {
    title: `${name}'s Vote Record · Lobby Market`,
    description: desc,
    openGraph: {
      title: `${name}'s Civic Vote Record`,
      description: desc,
      type: 'profile',
      siteName: 'Lobby Market',
      url: `${BASE_URL}/profile/${params.username}/votes`,
    },
    twitter: {
      card: 'summary',
      title: `${name}'s Civic Vote Record · Lobby Market`,
      description: desc,
    },
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
  accent?: 'for' | 'against' | 'gold' | 'emerald' | 'neutral'
}) {
  const accentClass = {
    for: 'text-for-400',
    against: 'text-against-400',
    gold: 'text-gold',
    emerald: 'text-emerald',
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

// ─── Category bar ─────────────────────────────────────────────────────────────

function CategoryBar({
  category,
  total,
  blue,
  red,
  maxTotal,
}: {
  category: string
  total: number
  blue: number
  red: number
  maxTotal: number
}) {
  const colors = getCategoryColor(category)
  const widthPct = Math.round((total / maxTotal) * 100)

  return (
    <div className="flex items-center gap-3 py-1.5">
      <div className="w-24 shrink-0 text-right">
        <span className={cn('text-[11px] font-mono', colors.text)}>{category}</span>
      </div>
      <div className="flex-1 h-6 rounded-lg bg-surface-200 overflow-hidden relative">
        <div
          className="h-full rounded-lg bg-surface-300/50 absolute inset-0"
          style={{ width: `${widthPct}%` }}
        />
        <div
          className="h-full rounded-lg bg-for-600/70 absolute left-0 inset-y-0 transition-all"
          style={{ width: `${(blue / total) * widthPct}%` }}
        />
        <div
          className="h-full rounded-lg bg-against-600/70 absolute inset-y-0 transition-all"
          style={{ left: `${(blue / total) * widthPct}%`, width: `${(red / total) * widthPct}%` }}
        />
      </div>
      <div className="w-24 shrink-0 flex items-center justify-between text-[10px] font-mono text-surface-500">
        <span className="text-for-400">{blue}F</span>
        <span className="text-against-400">{red}A</span>
        <span>{total}</span>
      </div>
    </div>
  )
}

// ─── Vote row ─────────────────────────────────────────────────────────────────

function VoteRow({
  vote,
}: {
  vote: {
    id: string
    side: string
    created_at: string
    reason: string | null
    topic_id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number | null
    with_majority: boolean | null
  }
}) {
  const isFor = vote.side === 'blue'
  const isResolved = vote.status === 'law' || vote.status === 'law' || vote.status === 'failed'
  const isLaw = vote.status === 'law'
  const isFailed = vote.status === 'failed'
  const colors = getCategoryColor(vote.category)

  const votedCorrectly =
    isResolved
      ? (isFor && isLaw) || (!isFor && isFailed)
      : null

  return (
    <Link
      href={`/topic/${vote.topic_id}`}
      className="flex items-start gap-3 rounded-xl border border-surface-300/60 bg-surface-100/50 p-4 hover:bg-surface-200/70 hover:border-surface-400/50 transition-all group"
    >
      {/* Side indicator */}
      <div className={cn(
        'mt-0.5 flex-shrink-0 flex items-center justify-center w-8 h-8 rounded-lg border',
        isFor
          ? 'bg-for-500/10 border-for-500/30 text-for-400'
          : 'bg-against-500/10 border-against-500/30 text-against-400',
      )}>
        {isFor
          ? <ThumbsUp className="h-3.5 w-3.5" />
          : <ThumbsDown className="h-3.5 w-3.5" />}
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0">
        <p className="text-sm text-surface-700 group-hover:text-white transition-colors leading-snug line-clamp-2">
          {vote.statement}
        </p>

        {/* Reason / hot take */}
        {vote.reason && (
          <p className={cn(
            'mt-1 text-[11px] font-mono italic leading-snug line-clamp-1',
            isFor ? 'text-for-400/80' : 'text-against-400/80',
          )}>
            &ldquo;{vote.reason}&rdquo;
          </p>
        )}

        {/* Meta row */}
        <div className="flex items-center gap-2 mt-1.5 flex-wrap">
          {vote.category && (
            <span className={cn(
              'text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border',
              colors.text, colors.bg, colors.border,
            )}>
              {vote.category}
            </span>
          )}

          {/* Outcome badge */}
          {isLaw && (
            <span className="flex items-center gap-0.5 text-[9px] font-mono text-gold bg-gold/10 border border-gold/30 px-1.5 py-0.5 rounded uppercase tracking-wider">
              <Gavel className="h-2.5 w-2.5" /> Law
            </span>
          )}
          {isFailed && (
            <span className="flex items-center gap-0.5 text-[9px] font-mono text-against-400 bg-against-500/10 border border-against-500/30 px-1.5 py-0.5 rounded uppercase tracking-wider">
              <XCircle className="h-2.5 w-2.5" /> Failed
            </span>
          )}
          {!isResolved && vote.status === 'active' && (
            <span className="flex items-center gap-0.5 text-[9px] font-mono text-for-300 bg-for-500/10 border border-for-500/30 px-1.5 py-0.5 rounded uppercase tracking-wider">
              <Zap className="h-2.5 w-2.5" /> Active
            </span>
          )}
          {!isResolved && vote.status === 'voting' && (
            <span className="flex items-center gap-0.5 text-[9px] font-mono text-purple bg-purple/10 border border-purple/30 px-1.5 py-0.5 rounded uppercase tracking-wider">
              <Scale className="h-2.5 w-2.5" /> Voting
            </span>
          )}

          {/* Majority alignment */}
          {votedCorrectly !== null && (
            votedCorrectly ? (
              <span className="flex items-center gap-0.5 text-[9px] font-mono text-emerald">
                <CheckCircle2 className="h-2.5 w-2.5" /> Correct call
              </span>
            ) : (
              <span className="flex items-center gap-0.5 text-[9px] font-mono text-against-400">
                <XCircle className="h-2.5 w-2.5" /> Minority view
              </span>
            )
          )}

          {vote.with_majority !== null && isResolved === false && (
            vote.with_majority ? (
              <span className="text-[9px] font-mono text-surface-500">With majority</span>
            ) : (
              <span className="text-[9px] font-mono text-surface-500">Contrarian</span>
            )
          )}
        </div>
      </div>

      {/* Date + arrow */}
      <div className="flex flex-col items-end gap-2 flex-shrink-0">
        <span className="text-[10px] font-mono text-surface-500">{relativeTime(vote.created_at)}</span>
        <ChevronRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-surface-400 transition-colors" />
      </div>
    </Link>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ProfileVotesPage({ params }: PageProps) {
  const supabase = await createClient()

  // 1. Look up the profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, total_votes, blue_vote_count, red_vote_count, vote_streak')
    .eq('username', params.username)
    .single()

  if (!profile) notFound()

  // 2. Current viewer
  const { data: { user } } = await supabase.auth.getUser()
  const isOwner = user?.id === profile.id
  const displayName = profile.display_name ?? profile.username

  // 3. Fetch up to 200 votes + topic info
  const { data: votesRaw } = await supabase
    .from('votes')
    .select('id, side, created_at, reason, topic_id')
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(200)

  const votes = votesRaw ?? []

  // 4. Fetch topic details for all voted topics
  const topicIds = [...new Set(votes.map((v) => v.topic_id))]
  const topicMap = new Map<string, {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number | null
  }>()

  if (topicIds.length > 0) {
    const { data: topics } = await supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct')
      .in('id', topicIds)

    for (const t of topics ?? []) {
      topicMap.set(t.id, t)
    }
  }

  // 5. Assemble rows
  const rows = votes.map((v) => {
    const t = topicMap.get(v.topic_id)
    const bluePct = t?.blue_pct ?? 50
    const isFor = (v.side as string) === 'blue'
    const withMajority = isFor ? bluePct >= 50 : bluePct < 50

    return {
      id: v.id,
      side: v.side as string,
      created_at: v.created_at,
      reason: v.reason as string | null,
      topic_id: v.topic_id,
      statement: t?.statement ?? 'Topic',
      category: t?.category ?? null,
      status: t?.status ?? 'active',
      blue_pct: bluePct,
      with_majority: withMajority,
    }
  })

  // 6. Compute stats
  const total = rows.length
  const forCount = rows.filter((r) => r.side === 'blue').length
  const forPct = total > 0 ? Math.round((forCount / total) * 100) : 0

  const resolvedRows = rows.filter((r) => r.status === 'law' || r.status === 'failed')
  const correctCalls = resolvedRows.filter((r) => {
    const isFor = r.side === 'blue'
    return (isFor && r.status === 'law') || (!isFor && r.status === 'failed')
  })
  const accuracy =
    resolvedRows.length > 0
      ? Math.round((correctCalls.length / resolvedRows.length) * 100)
      : null

  const lawsVotedForCount = rows.filter((r) => r.side === 'blue' && r.status === 'law').length
  const contrarian = rows.filter((r) => !r.with_majority).length
  const contrarian_pct = total > 0 ? Math.round((contrarian / total) * 100) : 0

  // 7. Category breakdown
  const catMap = new Map<string, { total: number; blue: number; red: number }>()
  for (const r of rows) {
    const cat = r.category ?? 'Other'
    const cur = catMap.get(cat) ?? { total: 0, blue: 0, red: 0 }
    cur.total++
    if (r.side === 'blue') { cur.blue++ } else { cur.red++ }
    catMap.set(cat, cur)
  }
  const categoryBreakdown = Array.from(catMap.entries())
    .map(([category, counts]) => ({ category, ...counts }))
    .sort((a, b) => b.total - a.total)
  const maxCategoryTotal = categoryBreakdown[0]?.total ?? 1

  return (
    <div className="min-h-screen bg-surface-0 flex flex-col">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-6 pb-24 md:pt-8">

        {/* ── Back link ───────────────────────────────────────────────── */}
        <Link
          href={`/profile/${profile.username}`}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors mb-6"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to profile
        </Link>

        {/* ── Header ──────────────────────────────────────────────────── */}
        <div className="flex items-center gap-4 mb-6">
          <Avatar
            src={profile.avatar_url}
            username={profile.username}
            size={48}
            className="w-12 h-12 rounded-2xl ring-2 ring-surface-400/30"
          />
          <div>
            <h1 className="font-mono text-xl font-bold text-white leading-tight">
              {isOwner ? 'Your' : `${displayName}'s`} Vote Record
            </h1>
            <p className="text-sm font-mono text-surface-500 mt-0.5">
              {total.toLocaleString()} vote{total !== 1 ? 's' : ''} on civic topics
            </p>
          </div>
        </div>

        {total === 0 ? (
          <EmptyState
            icon={Scale}
            title={isOwner ? 'No votes yet' : `${displayName} hasn't voted yet`}
            description={
              isOwner
                ? 'Cast your first vote on the feed to start building your civic record.'
                : 'Check back later — this citizen hasn\'t entered the debate yet.'
            }
            actions={isOwner ? [{ label: 'Go to feed', href: '/' }] : undefined}
          />
        ) : (
          <>
            {/* ── Key stats ──────────────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <StatCard
                label="FOR votes"
                value={`${forPct}%`}
                sub={`${forCount.toLocaleString()} of ${total.toLocaleString()}`}
                accent="for"
              />
              <StatCard
                label="Accuracy"
                value={accuracy !== null ? `${accuracy}%` : '—'}
                sub={
                  resolvedRows.length > 0
                    ? `${correctCalls.length}/${resolvedRows.length} resolved`
                    : 'No resolved topics yet'
                }
                accent={
                  accuracy === null
                    ? 'neutral'
                    : accuracy >= 70
                    ? 'emerald'
                    : accuracy >= 50
                    ? 'for'
                    : 'against'
                }
              />
              <StatCard
                label="Contrarian"
                value={`${contrarian_pct}%`}
                sub={`${contrarian} against majority`}
                accent="neutral"
              />
            </div>

            {/* ── FOR / AGAINST split bar ─────────────────────────── */}
            <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 mb-6">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[10px] font-mono text-surface-500 uppercase tracking-widest">Stance split</span>
                <div className="flex items-center gap-4 text-xs font-mono">
                  <span className="flex items-center gap-1 text-for-400">
                    <ThumbsUp className="h-3 w-3" /> FOR {forPct}%
                  </span>
                  <span className="flex items-center gap-1 text-against-400">
                    <ThumbsDown className="h-3 w-3" /> AGAINST {100 - forPct}%
                  </span>
                </div>
              </div>
              <div className="h-4 rounded-full bg-against-600/60 overflow-hidden">
                <div
                  className="h-full rounded-full bg-for-500 transition-all"
                  style={{ width: `${forPct}%` }}
                />
              </div>
              <div className="mt-3 flex items-center gap-6 text-xs font-mono text-surface-500">
                {lawsVotedForCount > 0 && (
                  <span className="flex items-center gap-1 text-gold">
                    <Gavel className="h-3 w-3" />
                    {lawsVotedForCount} vote{lawsVotedForCount !== 1 ? 's' : ''} became law
                  </span>
                )}
                {profile.vote_streak > 0 && (
                  <span className="flex items-center gap-1 text-for-300">
                    <Zap className="h-3 w-3" />
                    {profile.vote_streak}-day streak
                  </span>
                )}
                {accuracy !== null && accuracy >= 60 && (
                  <span className="flex items-center gap-1 text-emerald">
                    <Trophy className="h-3 w-3" />
                    {accuracy >= 80 ? 'Elite forecaster' : accuracy >= 70 ? 'Sharp voter' : 'Good accuracy'}
                  </span>
                )}
              </div>
            </div>

            {/* ── Category breakdown ──────────────────────────────── */}
            {categoryBreakdown.length > 0 && (
              <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 mb-6">
                <h2 className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-4">
                  Votes by category
                </h2>
                <div className="space-y-0.5">
                  {categoryBreakdown.map((cat) => (
                    <CategoryBar
                      key={cat.category}
                      category={cat.category}
                      total={cat.total}
                      blue={cat.blue}
                      red={cat.red}
                      maxTotal={maxCategoryTotal}
                    />
                  ))}
                </div>
              </div>
            )}

            {/* ── Accuracy callout (if resolved votes exist) ──────── */}
            {resolvedRows.length > 0 && accuracy !== null && (
              <div className={cn(
                'rounded-2xl border p-4 mb-6 flex items-center gap-4',
                accuracy >= 70
                  ? 'bg-emerald/5 border-emerald/20'
                  : accuracy >= 50
                  ? 'bg-for-500/5 border-for-500/20'
                  : 'bg-surface-100 border-surface-300',
              )}>
                <div className={cn(
                  'w-14 h-14 rounded-2xl flex items-center justify-center flex-shrink-0 text-2xl font-black font-mono',
                  accuracy >= 70 ? 'bg-emerald/10 text-emerald' : accuracy >= 50 ? 'bg-for-500/10 text-for-400' : 'bg-surface-200 text-surface-400',
                )}>
                  {accuracy}%
                </div>
                <div>
                  <p className={cn(
                    'text-sm font-semibold font-mono',
                    accuracy >= 70 ? 'text-emerald' : accuracy >= 50 ? 'text-for-400' : 'text-surface-400',
                  )}>
                    {accuracy >= 80
                      ? 'Elite civic forecaster'
                      : accuracy >= 70
                      ? 'Sharp voter — better than most'
                      : accuracy >= 50
                      ? 'More right than wrong'
                      : 'Still building accuracy'}
                  </p>
                  <p className="text-xs font-mono text-surface-500 mt-0.5">
                    Voted correctly on {correctCalls.length} of {resolvedRows.length} resolved topics
                  </p>
                </div>
              </div>
            )}

            {/* ── Vote list ──────────────────────────────────────── */}
            <div className="mb-3 flex items-center justify-between">
              <h2 className="text-[10px] font-mono text-surface-500 uppercase tracking-widest">
                All votes · {total.toLocaleString()}
              </h2>
              {total > 50 && (
                <span className="text-[10px] font-mono text-surface-600">Showing most recent 200</span>
              )}
            </div>

            <div className="space-y-2">
              {rows.map((vote) => (
                <VoteRow key={vote.id} vote={vote} />
              ))}
            </div>

            {/* ── Hot takes section ──────────────────────────────── */}
            {rows.some((r) => r.reason) && (
              <div className="mt-8 rounded-2xl border border-gold/20 bg-gold/5 p-5">
                <h2 className="flex items-center gap-2 text-[10px] font-mono text-gold uppercase tracking-widest mb-4">
                  <MessageSquare className="h-3.5 w-3.5" />
                  Hot takes · {rows.filter((r) => r.reason).length} {isOwner ? 'yours' : "of theirs"}
                </h2>
                <div className="space-y-3">
                  {rows
                    .filter((r) => r.reason)
                    .slice(0, 10)
                    .map((r) => (
                      <Link
                        key={r.id}
                        href={`/topic/${r.topic_id}`}
                        className="flex items-start gap-2 group"
                      >
                        <span className={cn(
                          'mt-1 h-2 w-2 rounded-full flex-shrink-0',
                          r.side === 'blue' ? 'bg-for-500' : 'bg-against-500',
                        )} />
                        <div className="min-w-0">
                          <p className={cn(
                            'text-[11px] font-mono italic',
                            r.side === 'blue' ? 'text-for-300' : 'text-against-300',
                          )}>
                            &ldquo;{r.reason}&rdquo;
                          </p>
                          <p className="text-[10px] font-mono text-surface-600 mt-0.5 truncate group-hover:text-surface-400 transition-colors">
                            {r.statement}
                          </p>
                        </div>
                      </Link>
                    ))}
                </div>
              </div>
            )}

            {/* ── CTA to analytics ────────────────────────────────── */}
            {isOwner && (
              <div className="mt-8 rounded-2xl border border-for-500/20 bg-for-500/5 p-5 flex items-center justify-between">
                <div>
                  <p className="font-mono text-sm text-white font-semibold mb-0.5">Deep dive into your analytics</p>
                  <p className="text-xs font-mono text-surface-500">Timing, streaks, category patterns and more</p>
                </div>
                <Link
                  href="/analytics/votes"
                  className="flex-shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-for-500/20 hover:bg-for-500/30 border border-for-500/30 text-for-400 text-xs font-mono font-semibold transition-colors"
                >
                  <Zap className="h-3.5 w-3.5" />
                  Analytics
                </Link>
              </div>
            )}
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
