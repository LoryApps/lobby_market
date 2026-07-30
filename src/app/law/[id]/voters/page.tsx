import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  Award,
  CheckCircle2,
  Clock,
  Flame,
  Gavel,
  MessageSquare,
  Scale,
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
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'

export const dynamic = 'force-dynamic'

interface Props {
  params: { id: string }
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface VoterProfile {
  id: string
  username: string
  display_name: string | null
  avatar_url: string | null
  role: string
  reputation_score: number
  clout: number
  voted_at: string
  reason: string | null
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const supabase = await createClient()
  const { data: law } = await supabase
    .from('laws')
    .select('statement, total_votes, blue_pct, category')
    .eq('id', params.id)
    .maybeSingle()

  if (!law) return { title: 'Law Founders · Lobby Market' }

  const forPct = Math.round((law.blue_pct ?? 50))
  const stmt: string = law.statement ?? ''
  const title = `Founders: ${stmt.slice(0, 55)}${stmt.length > 55 ? '…' : ''} · Lobby Market`
  const description = `${(law.total_votes ?? 0).toLocaleString()} citizens shaped this consensus — ${forPct}% For, ${100 - forPct}% Against. Democratic mandate.`

  return {
    title,
    description,
    openGraph: { title, description, type: 'article', siteName: 'Lobby Market' },
    twitter: { card: 'summary', title, description },
    robots: { index: false },
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

type RoleBadgeVariant = 'person' | 'debator' | 'troll_catcher' | 'elder'

function roleVariant(role: string): RoleBadgeVariant {
  if (role === 'elder') return 'elder'
  if (role === 'troll_catcher') return 'troll_catcher'
  if (role === 'debator') return 'debator'
  return 'person'
}

const ROLE_LABEL: Record<string, string> = {
  person: 'Citizen',
  debator: 'Debater',
  troll_catcher: 'Moderator',
  elder: 'Elder',
}

function timeAgo(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const hours = Math.floor(diff / 3_600_000)
  const days = Math.floor(hours / 24)
  if (days >= 365) return `${Math.floor(days / 365)}y ago`
  if (days >= 30) return `${Math.floor(days / 30)}mo ago`
  if (days >= 1) return `${days}d ago`
  if (hours >= 1) return `${hours}h ago`
  return 'recently'
}

// ─── VoterCard ────────────────────────────────────────────────────────────────

function VoterCard({
  voter,
  rank,
  side,
  isFounder,
}: {
  voter: VoterProfile
  rank: number
  side: 'blue' | 'red'
  isFounder: boolean
}) {
  const isFor = side === 'blue'
  const accentBg = isFor ? 'hover:border-for-500/40' : 'hover:border-against-500/40'
  const accentText = isFor ? 'text-for-400' : 'text-against-400'

  return (
    <div
      className={cn(
        'flex flex-col rounded-xl border border-surface-300 bg-surface-100',
        'transition-colors duration-150',
        accentBg
      )}
    >
      <Link
        href={`/profile/${voter.username}`}
        className="flex items-center gap-3 px-3.5 py-3 group"
      >
        {/* Rank */}
        <span
          className={cn(
            'flex-shrink-0 w-5 text-xs font-mono text-center',
            rank <= 3 ? accentText : 'text-surface-600'
          )}
        >
          {rank <= 3 ? ['①', '②', '③'][rank - 1] : rank}
        </span>

        {/* Avatar */}
        <div className="relative flex-shrink-0">
          <Avatar
            src={voter.avatar_url}
            fallback={voter.display_name ?? voter.username}
            size="sm"
          />
          {isFounder && (
            <span
              aria-label="Founding voter"
              className="absolute -top-1 -right-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-gold text-[7px] leading-none ring-1 ring-surface-100"
            >
              ★
            </span>
          )}
        </div>

        {/* Name + role */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-sm font-medium text-white group-hover:text-surface-700 transition-colors truncate">
              {voter.display_name ?? voter.username}
            </span>
            <Badge variant={roleVariant(voter.role)} className="flex-shrink-0 text-[10px]">
              {ROLE_LABEL[voter.role] ?? voter.role}
            </Badge>
          </div>
          <div className="flex items-center gap-3 mt-0.5 text-[11px] font-mono text-surface-500">
            <span className="text-gold">{voter.reputation_score.toLocaleString()} rep</span>
            <span>{voter.clout.toLocaleString()} clout</span>
            <span>{timeAgo(voter.voted_at)}</span>
          </div>
        </div>
      </Link>

      {/* Reason */}
      {voter.reason && (
        <div
          className={cn(
            'mx-3.5 mb-3 flex items-start gap-2 rounded-lg px-3 py-2',
            isFor ? 'bg-for-600/10' : 'bg-against-600/10'
          )}
        >
          <MessageSquare
            className={cn('h-3 w-3 mt-0.5 flex-shrink-0', isFor ? 'text-for-500' : 'text-against-500')}
            aria-hidden="true"
          />
          <p className="text-[11px] font-mono text-surface-400 leading-relaxed">
            &ldquo;{voter.reason}&rdquo;
          </p>
        </div>
      )}
    </div>
  )
}

// ─── VoterColumn ──────────────────────────────────────────────────────────────

function VoterColumn({
  side,
  voters,
  count,
  pct,
  founderIds,
}: {
  side: 'blue' | 'red'
  voters: VoterProfile[]
  count: number
  pct: number
  founderIds: Set<string>
}) {
  const isFor = side === 'blue'

  return (
    <div className="flex flex-col gap-3">
      <div
        className={cn(
          'flex items-center gap-2 px-4 py-3 rounded-xl border',
          isFor ? 'bg-for-600/10 border-for-500/30' : 'bg-against-600/10 border-against-500/30'
        )}
      >
        {isFor
          ? <ThumbsUp className="h-4 w-4 text-for-400 flex-shrink-0" />
          : <ThumbsDown className="h-4 w-4 text-against-400 flex-shrink-0" />
        }
        <div className="flex-1 min-w-0">
          <div className={cn('text-sm font-mono font-bold', isFor ? 'text-for-400' : 'text-against-400')}>
            {isFor ? 'FOR' : 'AGAINST'}
          </div>
          <div className="text-xs font-mono text-surface-500">
            {pct}% · {count.toLocaleString()} votes
          </div>
        </div>
      </div>

      {voters.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 rounded-xl border border-surface-300 bg-surface-100">
          <Users className="h-8 w-8 text-surface-500 mb-2" />
          <p className="text-sm text-surface-500 font-mono">No voters</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {voters.map((v, i) => (
            <VoterCard
              key={v.id}
              voter={v}
              rank={i + 1}
              side={side}
              isFounder={founderIds.has(v.id)}
            />
          ))}
          {count > voters.length && (
            <p className="text-center text-xs font-mono text-surface-600 pt-1">
              +{(count - voters.length).toLocaleString()} more voters
            </p>
          )}
        </div>
      )}
    </div>
  )
}

// ─── MandateBar ───────────────────────────────────────────────────────────────

function MandateBar({
  forPct,
  totalVotes,
  blueVotes,
  redVotes,
  establishedAt,
}: {
  forPct: number
  totalVotes: number
  blueVotes: number
  redVotes: number
  establishedAt: string | null
}) {
  const againstPct = 100 - forPct
  const mandateStrength =
    forPct >= 80 ? 'Supermajority' :
    forPct >= 67 ? 'Strong Mandate' :
    forPct >= 60 ? 'Clear Mandate' :
    forPct >= 50 ? 'Slim Majority' :
    'Failed'

  const mandateColor =
    forPct >= 80 ? 'text-emerald' :
    forPct >= 67 ? 'text-for-300' :
    forPct >= 60 ? 'text-for-400' :
    'text-gold'

  return (
    <div className="bg-surface-100 border border-surface-300 rounded-2xl p-5 space-y-4">
      {/* Mandate badge */}
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-gold flex-shrink-0" />
        <span className="text-xs font-mono text-surface-500 uppercase tracking-wider">Established Law</span>
        <span className={cn('ml-auto text-xs font-mono font-semibold', mandateColor)}>{mandateStrength}</span>
      </div>

      {/* Vote bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-for-400 font-semibold">{forPct}% For</span>
          <span className="text-surface-500 flex items-center gap-1">
            <Users className="h-3 w-3" />
            {totalVotes.toLocaleString()} total
          </span>
          <span className="text-against-400 font-semibold">{againstPct}% Against</span>
        </div>
        <div className="relative h-3 rounded-full overflow-hidden bg-against-900/40">
          <div
            className="absolute inset-y-0 left-0 bg-gradient-to-r from-for-600 to-for-400 rounded-full"
            style={{ width: `${forPct}%` }}
          />
        </div>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-3">
        <div className="flex flex-col items-center rounded-lg bg-for-600/10 border border-for-500/20 py-2.5 px-2">
          <ThumbsUp className="h-3.5 w-3.5 text-for-400 mb-1" />
          <span className="text-sm font-mono font-bold text-for-300">{blueVotes.toLocaleString()}</span>
          <span className="text-[10px] font-mono text-surface-600">for</span>
        </div>
        <div className="flex flex-col items-center rounded-lg bg-surface-200 border border-surface-300 py-2.5 px-2">
          <Scale className="h-3.5 w-3.5 text-gold mb-1" />
          <span className="text-sm font-mono font-bold text-white">{totalVotes.toLocaleString()}</span>
          <span className="text-[10px] font-mono text-surface-600">total</span>
        </div>
        <div className="flex flex-col items-center rounded-lg bg-against-600/10 border border-against-500/20 py-2.5 px-2">
          <ThumbsDown className="h-3.5 w-3.5 text-against-400 mb-1" />
          <span className="text-sm font-mono font-bold text-against-300">{redVotes.toLocaleString()}</span>
          <span className="text-[10px] font-mono text-surface-600">against</span>
        </div>
      </div>

      {/* Established date */}
      {establishedAt && (
        <div className="flex items-center gap-1.5 text-[11px] font-mono text-surface-600">
          <Clock className="h-3 w-3" />
          Established {new Date(establishedAt).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric',
          })}
        </div>
      )}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function LawVotersPage({ params }: Props) {
  const supabase = await createClient()

  // Fetch law + its source topic_id
  const { data: lawRaw } = await supabase
    .from('laws')
    .select('id, statement, category, topic_id, blue_pct, total_votes, established_at')
    .eq('id', params.id)
    .maybeSingle()

  if (!lawRaw) notFound()

  const law = lawRaw as {
    id: string
    statement: string
    category: string | null
    topic_id: string
    blue_pct: number | null
    total_votes: number | null
    established_at: string | null
  }

  const forPct = Math.round(law.blue_pct ?? 50)
  const againstPct = 100 - forPct
  const totalVotes = law.total_votes ?? 0

  // Fetch vote tallies from the source topic
  const { data: topicRaw } = await supabase
    .from('topics')
    .select('blue_votes, red_votes')
    .eq('id', law.topic_id)
    .maybeSingle()

  const blueVotes = (topicRaw as { blue_votes?: number | null } | null)?.blue_votes ?? 0
  const redVotes = (topicRaw as { red_votes?: number | null } | null)?.red_votes ?? 0

  // Fetch FOR votes (top 30 by reputation, recent-first for tie-breaks)
  const { data: forVoteRows } = await supabase
    .from('votes')
    .select('user_id, created_at, reason')
    .eq('topic_id', law.topic_id)
    .eq('side', 'blue')
    .order('created_at', { ascending: true })
    .limit(50)

  // Fetch AGAINST votes
  const { data: againstVoteRows } = await supabase
    .from('votes')
    .select('user_id, created_at, reason')
    .eq('topic_id', law.topic_id)
    .eq('side', 'red')
    .order('created_at', { ascending: true })
    .limit(50)

  // Batch-fetch profiles
  const forUserIds = (forVoteRows ?? []).map((v) => v.user_id)
  const againstUserIds = (againstVoteRows ?? []).map((v) => v.user_id)
  const allUserIds = Array.from(new Set([...forUserIds, ...againstUserIds]))

  const { data: profileRows } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, reputation_score, clout')
    .in('id', allUserIds.length > 0 ? allUserIds : ['00000000-0000-0000-0000-000000000000'])

  type ProfileRow = {
    id: string
    username: string
    display_name: string | null
    avatar_url: string | null
    role: string
    reputation_score: number
    clout: number
  }

  const profileMap = new Map<string, ProfileRow>()
  for (const p of (profileRows ?? []) as ProfileRow[]) {
    profileMap.set(p.id, p)
  }

  // "Founding voters" = first 10 FOR voters chronologically
  const founderIds = new Set(forUserIds.slice(0, 10))

  function buildVoters(
    voteRows: Array<{ user_id: string; created_at: string; reason?: string | null }>
  ): VoterProfile[] {
    return voteRows
      .map((v) => {
        const p = profileMap.get(v.user_id)
        if (!p) return null
        return { ...p, voted_at: v.created_at, reason: v.reason ?? null }
      })
      .filter((v): v is VoterProfile => v !== null)
      .sort((a, b) => b.reputation_score - a.reputation_score)
  }

  const forVoters = buildVoters(forVoteRows ?? [])
  const againstVoters = buildVoters(againstVoteRows ?? [])

  // Top 5 founders by reputation for the featured row
  const featuredFounders = forVoters
    .filter((v) => founderIds.has(v.id))
    .slice(0, 5)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">

        {/* Back */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href={`/law/${params.id}`}
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            Back to law
          </Link>
          <Link
            href={`/topic/${law.topic_id}/voters`}
            className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
          >
            <Scale className="h-3.5 w-3.5" />
            View as topic
          </Link>
        </div>

        {/* Law header */}
        <div className="mb-2">
          {law.category && (
            <span className="text-xs font-mono text-surface-500 uppercase tracking-wider block mb-1">
              {law.category}
            </span>
          )}
          <h1 className="text-base font-medium text-white leading-snug mb-4">
            {law.statement}
          </h1>
        </div>

        {/* Mandate bar */}
        <div className="mb-6">
          <MandateBar
            forPct={forPct}
            totalVotes={totalVotes}
            blueVotes={blueVotes}
            redVotes={redVotes}
            establishedAt={law.established_at}
          />
        </div>

        {/* Founding voters spotlight */}
        {featuredFounders.length > 0 && (
          <div className="mb-6 bg-gold/5 border border-gold/20 rounded-2xl p-4">
            <div className="flex items-center gap-2 mb-3">
              <Award className="h-4 w-4 text-gold" />
              <span className="text-xs font-mono font-semibold text-gold uppercase tracking-wider">
                Founding Voters
              </span>
              <span className="text-[10px] font-mono text-surface-600 ml-auto">First to vote for this law</span>
            </div>
            <div className="flex flex-wrap gap-2">
              {featuredFounders.map((founder) => (
                <Link
                  key={founder.id}
                  href={`/profile/${founder.username}`}
                  className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg bg-surface-200 border border-gold/20 hover:border-gold/50 transition-colors"
                >
                  <Avatar
                    src={founder.avatar_url}
                    fallback={founder.display_name ?? founder.username}
                    size="xs"
                  />
                  <span className="text-xs font-mono text-white">
                    {founder.display_name ?? founder.username}
                  </span>
                  <Flame className="h-3 w-3 text-gold" />
                </Link>
              ))}
            </div>
          </div>
        )}

        {/* Section header */}
        <div className="flex items-center gap-2 mb-5">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300">
            <Trophy className="h-4 w-4 text-gold" />
          </div>
          <div>
            <h2 className="text-sm font-mono font-semibold text-white">Who Voted</h2>
            <p className="text-xs font-mono text-surface-500">
              Top voters by reputation · ★ = founding voter
            </p>
          </div>
        </div>

        {totalVotes === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-12 w-12 rounded-xl bg-surface-200 border border-surface-300 flex items-center justify-center mb-4">
              <Zap className="h-5 w-5 text-surface-500" />
            </div>
            <p className="text-surface-500 text-sm font-mono">No vote data available.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <VoterColumn
              side="blue"
              voters={forVoters}
              count={blueVotes}
              pct={forPct}
              founderIds={founderIds}
            />
            <VoterColumn
              side="red"
              voters={againstVoters}
              count={redVotes}
              pct={againstPct}
              founderIds={new Set()}
            />
          </div>
        )}

        {/* Footer */}
        {totalVotes > 0 && (
          <div className="mt-8 flex flex-col items-center gap-3">
            <p className="text-center text-xs font-mono text-surface-600">
              Ranked by reputation. Showing top 50 per side. ★ = among the first 10 voters.
            </p>
            <div className="flex items-center gap-4">
              <Link
                href={`/law/${params.id}/impact`}
                className="inline-flex items-center gap-1.5 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
              >
                <Gavel className="h-3.5 w-3.5" />
                View impact →
              </Link>
              <Link
                href={`/topic/${law.topic_id}`}
                className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
              >
                <Scale className="h-3.5 w-3.5" />
                Original debate →
              </Link>
            </div>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
