import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  BarChart2,
  Brain,
  ChevronRight,
  Coins,
  ExternalLink,
  Gavel,
  MessageSquare,
  Scale,
  Star,
  Target,
  TrendingDown,
  TrendingUp,
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
  Economics:   { text: 'text-gold',         bg: 'bg-gold/10',         border: 'border-gold/30' },
  Politics:    { text: 'text-for-400',      bg: 'bg-for-500/10',      border: 'border-for-500/30' },
  Technology:  { text: 'text-purple',       bg: 'bg-purple/10',       border: 'border-purple/30' },
  Science:     { text: 'text-emerald',      bg: 'bg-emerald/10',      border: 'border-emerald/30' },
  Ethics:      { text: 'text-for-300',      bg: 'bg-for-300/10',      border: 'border-for-300/30' },
  Philosophy:  { text: 'text-purple',       bg: 'bg-purple/10',       border: 'border-purple/30' },
  Culture:     { text: 'text-against-300',  bg: 'bg-against-400/10',  border: 'border-against-400/30' },
  Health:      { text: 'text-emerald',      bg: 'bg-emerald/10',      border: 'border-emerald/30' },
  Environment: { text: 'text-emerald',      bg: 'bg-emerald/10',      border: 'border-emerald/30' },
  Education:   { text: 'text-gold',         bg: 'bg-gold/10',         border: 'border-gold/30' },
}

function catColor(cat: string | null) {
  return CATEGORY_COLOR[cat ?? ''] ?? { text: 'text-surface-400', bg: 'bg-surface-300/30', border: 'border-surface-400/30' }
}

function directionConfig(dir: string) {
  if (dir === 'for') return { label: 'FOR', color: 'text-for-400', bg: 'bg-for-500/10', border: 'border-for-500/30', Icon: TrendingUp }
  if (dir === 'against') return { label: 'AGAINST', color: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30', Icon: TrendingDown }
  return { label: 'NEUTRAL', color: 'text-surface-400', bg: 'bg-surface-300/20', border: 'border-surface-400/30', Icon: Scale }
}

function confidenceStars(n: number) {
  return Array.from({ length: 5 }, (_, i) => (
    <Star
      key={i}
      className={cn('h-3 w-3', i < n ? 'text-gold fill-gold/60' : 'text-surface-600')}
    />
  ))
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name')
    .eq('username', params.username)
    .maybeSingle()

  if (!profile) return { title: 'Exchange Profile · Lobby Market' }

  const name = profile.display_name || profile.username
  return {
    title: `${name}'s Exchange Profile · Lobby Market`,
    description: `${name}'s civic prediction market activity — market calls, tournament history, and analyst record on the Lobby Exchange.`,
    openGraph: {
      title: `${name} on the Lobby Exchange`,
      description: `Market ideas, tournament results, and prediction record for ${name}.`,
      type: 'profile',
      siteName: 'Lobby Market',
    },
    twitter: {
      card: 'summary',
      title: `${name} · Exchange Profile`,
      description: `${name}'s civic prediction market analyst record on Lobby Market.`,
    },
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ProfileExchangePage({ params }: PageProps) {
  const supabase = await createClient()

  // ── Resolve profile ──────────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, clout, reputation_score, total_votes')
    .eq('username', params.username)
    .maybeSingle()

  if (!profile) notFound()

  // ── Determine if viewing own profile ──────────────────────────────────────
  const { data: { user } } = await supabase.auth.getUser()
  const isOwner = user?.id === profile.id

  // ── Market ideas (public) ─────────────────────────────────────────────────
  const { data: rawIdeas } = await supabase
    .from('market_ideas')
    .select(`
      id, title, body, direction, target_price, confidence, upvotes, downvotes, created_at,
      topics ( id, statement, category, status, blue_pct, total_votes )
    `)
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(20)

  interface IdeaTopic {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
  }

  interface IdeaRow {
    id: string
    title: string
    body: string
    direction: string
    target_price: number | null
    confidence: number
    upvotes: number
    downvotes: number
    created_at: string
    topics: IdeaTopic | IdeaTopic[] | null
  }

  const ideas: IdeaRow[] = (rawIdeas ?? []) as IdeaRow[]

  // ── Tournament history (public) ────────────────────────────────────────────
  const { data: rawEntries } = await supabase
    .from('exchange_tournament_entries')
    .select(`
      id, score, predictions_correct, predictions_total, rank, joined_at,
      exchange_tournaments ( id, title, category, status, starts_at, ends_at, prize_description )
    `)
    .eq('user_id', profile.id)
    .order('joined_at', { ascending: false })
    .limit(10)

  interface TournamentRef {
    id: string
    title: string
    category: string | null
    status: string
    starts_at: string
    ends_at: string
    prize_description: string | null
  }

  interface TournamentEntry {
    id: string
    score: number
    predictions_correct: number
    predictions_total: number
    rank: number | null
    joined_at: string
    exchange_tournaments: TournamentRef | TournamentRef[] | null
  }

  const tournamentEntries: TournamentEntry[] = (rawEntries ?? []) as TournamentEntry[]

  // ── Vote-based market record (how well did their votes align with outcomes) ──
  const { data: resolvedVotes } = await supabase
    .from('votes')
    .select('side, topics!inner( status, blue_pct )')
    .eq('user_id', profile.id)
    .in('topics.status', ['law', 'failed'])
    .limit(200)

  interface ResolvedVote {
    side: string
    topics: { status: string; blue_pct: number } | { status: string; blue_pct: number }[]
  }

  const voteRows: ResolvedVote[] = (resolvedVotes ?? []) as ResolvedVote[]

  let wins = 0
  let losses = 0
  for (const v of voteRows) {
    const topic = Array.isArray(v.topics) ? v.topics[0] : v.topics
    if (!topic) continue
    const wonFor = v.side === 'for' && topic.status === 'law'
    const wonAgainst = v.side === 'against' && topic.status === 'failed'
    if (wonFor || wonAgainst) wins++
    else losses++
  }
  const totalResolved = wins + losses
  const winRate = totalResolved > 0 ? Math.round((wins / totalResolved) * 100) : null

  // ── Top market calls — resolved votes where they were on the right side ─────
  const { data: rawTopCalls } = await supabase
    .from('votes')
    .select('side, created_at, topics!inner( id, statement, category, status, blue_pct, total_votes )')
    .eq('user_id', profile.id)
    .eq('topics.status', 'law')
    .eq('side', 'for')
    .order('created_at', { ascending: false })
    .limit(5)

  interface TopCall {
    side: string
    created_at: string
    topics: {
      id: string
      statement: string
      category: string | null
      status: string
      blue_pct: number
      total_votes: number
    } | {
      id: string
      statement: string
      category: string | null
      status: string
      blue_pct: number
      total_votes: number
    }[]
  }

  const topCalls: TopCall[] = (rawTopCalls ?? []) as TopCall[]

  // ── Compute aggregate stats from ideas ─────────────────────────────────────
  const totalIdeas = ideas.length
  const totalUpvotes = ideas.reduce((s, i) => s + (i.upvotes ?? 0), 0)
  const tournamentsEntered = tournamentEntries.length
  const bestRank = tournamentEntries.reduce<number | null>((best, e) => {
    if (e.rank === null) return best
    return best === null ? e.rank : Math.min(best, e.rank)
  }, null)

  const displayName = profile.display_name || profile.username

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 space-y-6">

        {/* ── Back + heading ───────────────────────────────────────────── */}
        <div className="flex items-center gap-3">
          <Link
            href={`/profile/${profile.username}`}
            className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 text-surface-500 hover:text-white hover:bg-surface-300 transition-colors flex-shrink-0"
            aria-label="Back to profile"
          >
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="flex items-center gap-2 min-w-0">
            <Avatar src={profile.avatar_url} username={profile.username} size="sm" />
            <div className="min-w-0">
              <p className="font-mono text-xs text-surface-400 truncate">Exchange profile</p>
              <p className="font-mono text-sm font-semibold text-white truncate">{displayName}</p>
            </div>
          </div>
          <div className="flex-1" />
          <Link
            href="/exchange"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-gold/10 border border-gold/30 text-gold text-xs font-mono hover:bg-gold/20 transition-colors"
          >
            <BarChart2 className="h-3.5 w-3.5" />
            Exchange
          </Link>
        </div>

        {/* ── Analyst card ─────────────────────────────────────────────── */}
        <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-gold/10 border border-gold/30 flex-shrink-0">
              <Brain className="h-5 w-5 text-gold" />
            </div>
            <div>
              <p className="font-mono text-xs text-surface-400 uppercase tracking-wider">Market Analyst</p>
              <p className="font-mono text-base font-bold text-white">{displayName}</p>
            </div>
            {isOwner && (
              <Link
                href="/exchange/command-center"
                className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 text-surface-400 hover:text-white hover:bg-surface-300 text-xs font-mono transition-colors"
              >
                Command Center
                <ChevronRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>

          {/* Stat grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <StatTile
              label="Market Calls"
              value={totalIdeas}
              color="text-purple"
              icon={<MessageSquare className="h-3.5 w-3.5" />}
            />
            <StatTile
              label="Win Rate"
              value={winRate !== null ? `${winRate}%` : '—'}
              color={winRate !== null && winRate >= 60 ? 'text-emerald' : winRate !== null && winRate < 40 ? 'text-against-400' : 'text-gold'}
              icon={<Target className="h-3.5 w-3.5" />}
              sub={totalResolved > 0 ? `${totalResolved} resolved` : undefined}
            />
            <StatTile
              label="Idea Upvotes"
              value={totalUpvotes}
              color="text-for-400"
              icon={<Zap className="h-3.5 w-3.5" />}
            />
            <StatTile
              label="Tournaments"
              value={tournamentsEntered}
              color="text-gold"
              icon={<Trophy className="h-3.5 w-3.5" />}
              sub={bestRank !== null ? `Best rank #${bestRank}` : undefined}
            />
          </div>

          {/* Win rate bar */}
          {winRate !== null && totalResolved >= 5 && (
            <div className="space-y-1.5">
              <div className="flex justify-between text-[10px] font-mono text-surface-500">
                <span>Correct calls ({wins})</span>
                <span>Incorrect ({losses})</span>
              </div>
              <div className="h-1.5 bg-surface-300 rounded-full overflow-hidden">
                <div
                  className={cn(
                    'h-full rounded-full transition-all',
                    winRate >= 60 ? 'bg-emerald' : winRate >= 40 ? 'bg-gold' : 'bg-against-500'
                  )}
                  style={{ width: `${winRate}%` }}
                />
              </div>
            </div>
          )}
        </div>

        {/* ── Market Ideas ──────────────────────────────────────────────── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-sm font-semibold text-white flex items-center gap-2">
              <MessageSquare className="h-4 w-4 text-purple" />
              Market Ideas
              {totalIdeas > 0 && (
                <span className="text-xs text-surface-500 font-normal">({totalIdeas})</span>
              )}
            </h2>
            {isOwner && (
              <Link
                href="/exchange/ideas"
                className="text-[10px] font-mono text-purple hover:text-purple/80 transition-colors"
              >
                View all ideas →
              </Link>
            )}
          </div>

          {ideas.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              iconColor="text-purple"
              iconBg="bg-purple/10"
              iconBorder="border-purple/30"
              title="No market ideas yet"
              description={
                isOwner
                  ? 'Share your thesis on a civic market — your calls will appear here.'
                  : `${displayName} hasn't published any market ideas yet.`
              }
              actions={
                isOwner
                  ? [{ label: 'Browse markets', href: '/exchange' }]
                  : undefined
              }
            />
          ) : (
            <div className="space-y-3">
              {ideas.slice(0, 8).map((idea) => {
                const topic = Array.isArray(idea.topics) ? idea.topics[0] : idea.topics
                const dir = directionConfig(idea.direction)
                const DirIcon = dir.Icon
                const cat = topic?.category ?? null
                const cc = catColor(cat)
                const price = topic ? Math.round(topic.blue_pct ?? 50) : null
                const netScore = (idea.upvotes ?? 0) - (idea.downvotes ?? 0)

                return (
                  <div
                    key={idea.id}
                    className="rounded-xl bg-surface-100 border border-surface-300 p-4 space-y-3 hover:border-surface-400/60 transition-colors"
                  >
                    {/* Direction + topic */}
                    <div className="flex items-start gap-2 flex-wrap">
                      <span className={cn(
                        'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold border flex-shrink-0',
                        dir.bg, dir.border, dir.color
                      )}>
                        <DirIcon className="h-2.5 w-2.5" />
                        {dir.label}
                      </span>
                      {cat && (
                        <span className={cn(
                          'inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-mono border flex-shrink-0',
                          cc.bg, cc.border, cc.text
                        )}>
                          {cat}
                        </span>
                      )}
                      {idea.target_price !== null && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-surface-200 border border-surface-300/60 text-[10px] font-mono text-surface-400 flex-shrink-0">
                          <Target className="h-2.5 w-2.5" />
                          Target {idea.target_price}¢
                        </span>
                      )}
                    </div>

                    {/* Title */}
                    <p className="font-mono text-sm font-semibold text-white leading-snug">{idea.title}</p>

                    {/* Body */}
                    <p className="text-xs text-surface-400 leading-relaxed line-clamp-3">{idea.body}</p>

                    {/* Topic link */}
                    {topic && (
                      <Link
                        href={`/exchange/${topic.id}`}
                        className="flex items-center gap-2 p-2.5 rounded-lg bg-surface-200/60 hover:bg-surface-200 transition-colors group"
                      >
                        <div className="flex-1 min-w-0">
                          <p className="text-[11px] text-surface-400 font-mono truncate">{topic.statement}</p>
                        </div>
                        {price !== null && (
                          <span className={cn(
                            'text-[11px] font-mono font-semibold flex-shrink-0',
                            price >= 60 ? 'text-for-400' : price <= 40 ? 'text-against-400' : 'text-surface-400'
                          )}>
                            {price}¢
                          </span>
                        )}
                        <ExternalLink className="h-3 w-3 text-surface-600 group-hover:text-surface-400 flex-shrink-0" />
                      </Link>
                    )}

                    {/* Footer */}
                    <div className="flex items-center justify-between text-[10px] font-mono text-surface-500">
                      <div className="flex items-center gap-1">
                        {confidenceStars(idea.confidence)}
                        <span className="ml-1">{idea.confidence}/5 conviction</span>
                      </div>
                      <div className="flex items-center gap-3">
                        <span className={cn(netScore > 0 ? 'text-for-400' : netScore < 0 ? 'text-against-400' : 'text-surface-500')}>
                          {netScore > 0 ? '+' : ''}{netScore} votes
                        </span>
                        <span>{relativeTime(idea.created_at)}</span>
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ── Top market calls (correct resolved votes) ─────────────────── */}
        {topCalls.length > 0 && (
          <section className="space-y-3">
            <h2 className="font-mono text-sm font-semibold text-white flex items-center gap-2">
              <Gavel className="h-4 w-4 text-gold" />
              Best Calls
              <span className="text-xs text-surface-500 font-normal">(voted FOR, became Law)</span>
            </h2>

            <div className="space-y-2">
              {topCalls.map((call) => {
                const topic = Array.isArray(call.topics) ? call.topics[0] : call.topics
                if (!topic) return null
                const cc = catColor(topic.category)
                return (
                  <Link
                    key={topic.id}
                    href={`/exchange/${topic.id}`}
                    className="flex items-center gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300 hover:border-gold/30 hover:bg-gold/5 transition-colors group"
                  >
                    <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-gold/10 border border-gold/30 flex-shrink-0">
                      <Gavel className="h-3.5 w-3.5 text-gold" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-white truncate leading-snug">{topic.statement}</p>
                      <div className="flex items-center gap-2 mt-0.5">
                        {topic.category && (
                          <span className={cn('text-[10px] font-mono', cc.text)}>{topic.category}</span>
                        )}
                        <span className="text-[10px] font-mono text-surface-500">
                          {topic.total_votes?.toLocaleString()} votes · {relativeTime(call.created_at)}
                        </span>
                      </div>
                    </div>
                    <span className="text-[10px] font-mono text-gold bg-gold/10 border border-gold/30 px-2 py-0.5 rounded-md flex-shrink-0">
                      LAW
                    </span>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {/* ── Tournament History ────────────────────────────────────────── */}
        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h2 className="font-mono text-sm font-semibold text-white flex items-center gap-2">
              <Trophy className="h-4 w-4 text-gold" />
              Tournaments
              {tournamentsEntered > 0 && (
                <span className="text-xs text-surface-500 font-normal">({tournamentsEntered})</span>
              )}
            </h2>
            <Link
              href="/exchange/tournaments"
              className="text-[10px] font-mono text-gold hover:text-gold/80 transition-colors"
            >
              Browse →
            </Link>
          </div>

          {tournamentEntries.length === 0 ? (
            <EmptyState
              icon={Trophy}
              iconColor="text-gold"
              iconBg="bg-gold/10"
              iconBorder="border-gold/30"
              title="No tournaments entered"
              description={
                isOwner
                  ? 'Join a prediction tournament to compete against other civic analysts.'
                  : `${displayName} hasn't entered any tournaments yet.`
              }
              actions={
                isOwner
                  ? [{ label: 'Browse tournaments', href: '/exchange/tournaments' }]
                  : undefined
              }
            />
          ) : (
            <div className="space-y-2">
              {tournamentEntries.map((entry) => {
                const tourn = Array.isArray(entry.exchange_tournaments)
                  ? entry.exchange_tournaments[0]
                  : entry.exchange_tournaments
                if (!tourn) return null

                const accuracy = entry.predictions_total > 0
                  ? Math.round((entry.predictions_correct / entry.predictions_total) * 100)
                  : null
                const isFinished = tourn.status === 'finished'
                const cc = catColor(tourn.category)

                return (
                  <div
                    key={entry.id}
                    className="flex items-center gap-3 p-3 rounded-xl bg-surface-100 border border-surface-300"
                  >
                    {/* Rank badge */}
                    <div className={cn(
                      'flex items-center justify-center h-9 w-9 rounded-lg border flex-shrink-0',
                      entry.rank === 1
                        ? 'bg-gold/10 border-gold/30 text-gold'
                        : entry.rank !== null && entry.rank <= 3
                          ? 'bg-for-500/10 border-for-500/30 text-for-400'
                          : 'bg-surface-200 border-surface-300 text-surface-400'
                    )}>
                      {entry.rank !== null ? (
                        <span className="font-mono text-sm font-bold">#{entry.rank}</span>
                      ) : (
                        <Users className="h-4 w-4" />
                      )}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-mono text-white truncate">{tourn.title}</p>
                      <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                        {tourn.category && (
                          <span className={cn('text-[10px] font-mono', cc.text)}>{tourn.category}</span>
                        )}
                        {accuracy !== null && (
                          <span className={cn(
                            'text-[10px] font-mono',
                            accuracy >= 70 ? 'text-emerald' : accuracy >= 50 ? 'text-for-400' : 'text-surface-500'
                          )}>
                            {accuracy}% accuracy
                          </span>
                        )}
                        <span className="text-[10px] font-mono text-surface-500">
                          {entry.predictions_correct}/{entry.predictions_total} correct
                        </span>
                      </div>
                    </div>

                    {/* Status */}
                    <div className="flex-shrink-0 text-right">
                      {isFinished ? (
                        <span className="text-[10px] font-mono text-surface-500">Finished</span>
                      ) : (
                        <span className="text-[10px] font-mono text-emerald">Active</span>
                      )}
                      <p className="text-[10px] font-mono text-surface-600 mt-0.5">
                        {relativeTime(entry.joined_at)}
                      </p>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ── CTA for owner ─────────────────────────────────────────────── */}
        {isOwner && (
          <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5">
            <p className="font-mono text-sm font-semibold text-white mb-1">Grow your analyst record</p>
            <p className="text-xs text-surface-400 mb-4">
              Share market theses, enter tournaments, and vote accurately to build your reputation on the Exchange.
            </p>
            <div className="flex flex-wrap gap-2">
              <Link
                href="/exchange"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-gold/10 border border-gold/30 text-gold text-xs font-mono hover:bg-gold/20 transition-colors"
              >
                <BarChart2 className="h-3.5 w-3.5" />
                Browse markets
              </Link>
              <Link
                href="/exchange/tournaments"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-200 text-surface-400 hover:text-white hover:bg-surface-300 text-xs font-mono transition-colors"
              >
                <Trophy className="h-3.5 w-3.5" />
                Join tournament
              </Link>
              <Link
                href="/exchange/portfolio"
                className="flex items-center gap-1.5 px-3 py-2 rounded-lg bg-surface-200 text-surface-400 hover:text-white hover:bg-surface-300 text-xs font-mono transition-colors"
              >
                <Coins className="h-3.5 w-3.5" />
                My portfolio
              </Link>
            </div>
          </div>
        )}

      </main>

      <BottomNav />
    </div>
  )
}

// ─── Stat Tile ─────────────────────────────────────────────────────────────────

function StatTile({
  label,
  value,
  color,
  icon,
  sub,
}: {
  label: string
  value: string | number
  color: string
  icon: React.ReactNode
  sub?: string
}) {
  return (
    <div className="rounded-xl bg-surface-200/60 border border-surface-300/60 p-3 space-y-1">
      <div className="flex items-center gap-1.5 text-surface-500">
        {icon}
        <span className="text-[10px] font-mono uppercase tracking-wider">{label}</span>
      </div>
      <p className={cn('font-mono text-xl font-bold', color)}>{value}</p>
      {sub && <p className="text-[10px] font-mono text-surface-500">{sub}</p>}
    </div>
  )
}
