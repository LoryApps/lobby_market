import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  MessageSquare,
  ThumbsUp,
  ThumbsDown,
  Users,
  Trophy,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'

export const dynamic = 'force-dynamic'

interface VotersPageProps {
  params: { id: string }
}

// ─── Types ────────────────────────────────────────────────────────────────────

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

// ─── generateMetadata ─────────────────────────────────────────────────────────

export async function generateMetadata({ params }: VotersPageProps): Promise<Metadata> {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('statement, total_votes, blue_pct, status')
    .eq('id', params.id)
    .single()

  if (!topic) return { title: 'Voters · Lobby Market' }

  const forPct = Math.round(topic.blue_pct ?? 50)
  const stmt: string = topic.statement ?? ''
  const title = `Who voted · ${stmt.slice(0, 60)}${stmt.length > 60 ? '…' : ''} · Lobby Market`
  const description = `${topic.total_votes?.toLocaleString() ?? 0} citizens voted — ${forPct}% For, ${100 - forPct}% Against.`

  return {
    title,
    description,
    openGraph: { title, description, type: 'website', siteName: 'Lobby Market' },
    robots: { index: false },
  }
}

// ─── Role badge variant helper ────────────────────────────────────────────────

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

// ─── VoterCard ────────────────────────────────────────────────────────────────

function VoterCard({
  voter,
  rank,
  side,
}: {
  voter: VoterProfile
  rank: number
  side: 'blue' | 'red'
}) {
  const isFor = side === 'blue'
  const accentText = isFor ? 'text-for-400' : 'text-against-400'
  const accentBg = isFor ? 'hover:border-for-500/40' : 'hover:border-against-500/40'

  return (
    <div
      className={cn(
        'flex flex-col rounded-xl',
        'border border-surface-300 bg-surface-100',
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
        <Avatar
          src={voter.avatar_url}
          fallback={voter.display_name ?? voter.username}
          size="sm"
        />

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
          </div>
        </div>
      </Link>

      {/* Hot take / reason */}
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
}: {
  side: 'blue' | 'red'
  voters: VoterProfile[]
  count: number
  pct: number
}) {
  const isFor = side === 'blue'

  return (
    <div className="flex flex-col gap-3">
      {/* Column header */}
      <div
        className={cn(
          'flex items-center gap-2 px-4 py-3 rounded-xl border',
          isFor
            ? 'bg-for-600/10 border-for-500/30'
            : 'bg-against-600/10 border-against-500/30'
        )}
      >
        {isFor ? (
          <ThumbsUp className="h-4 w-4 text-for-400 flex-shrink-0" />
        ) : (
          <ThumbsDown className="h-4 w-4 text-against-400 flex-shrink-0" />
        )}
        <div className="flex-1 min-w-0">
          <div className={cn('text-sm font-mono font-bold', isFor ? 'text-for-400' : 'text-against-400')}>
            {isFor ? 'FOR' : 'AGAINST'}
          </div>
          <div className="text-xs font-mono text-surface-500">
            {pct}% · {count.toLocaleString()} votes
          </div>
        </div>
      </div>

      {/* Voter list */}
      {voters.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-10 rounded-xl border border-surface-300 bg-surface-100">
          <Users className="h-8 w-8 text-surface-500 mb-2" />
          <p className="text-sm text-surface-500 font-mono">No voters yet</p>
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {voters.map((v, i) => (
            <VoterCard key={v.id} voter={v} rank={i + 1} side={side} />
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function VotersPage({ params }: VotersPageProps) {
  const supabase = await createClient()

  // Fetch the topic
  const { data: topicRaw } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, blue_votes, red_votes')
    .eq('id', params.id)
    .single()

  if (!topicRaw) notFound()

  const topic = topicRaw as {
    id: string
    statement: string
    category: string | null
    status: string
    blue_pct: number
    total_votes: number
    blue_votes: number
    red_votes: number
  }

  const forPct = Math.round(topic.blue_pct ?? 50)
  const againstPct = 100 - forPct
  const blueVotes = topic.blue_votes ?? 0
  const redVotes = topic.red_votes ?? 0
  const totalVotes = topic.total_votes ?? 0

  // ── Fetch FOR votes (blue) ────────────────────────────────────────────────
  const { data: forVoteRows } = await supabase
    .from('votes')
    .select('user_id, created_at, reason')
    .eq('topic_id', params.id)
    .eq('side', 'blue')
    .order('created_at', { ascending: false })
    .limit(50)

  // ── Fetch AGAINST votes (red) ─────────────────────────────────────────────
  const { data: againstVoteRows } = await supabase
    .from('votes')
    .select('user_id, created_at, reason')
    .eq('topic_id', params.id)
    .eq('side', 'red')
    .order('created_at', { ascending: false })
    .limit(50)

  // ── Batch-fetch profiles for both sets ────────────────────────────────────
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

  function buildVoters(voteRows: Array<{ user_id: string; created_at: string; reason?: string | null }>): VoterProfile[] {
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

  const statusLabel: Record<string, string> = {
    proposed: 'Proposed',
    active: 'Active',
    voting: 'Voting',
    law: 'Established Law',
    failed: 'Failed',
    continued: 'Continued',
  }

  const statusText = statusLabel[topic.status] ?? topic.status

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 py-8 pb-24 md:pb-12">

        {/* ── Back link ── */}
        <Link
          href={`/topic/${params.id}`}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors mb-6"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to topic
        </Link>

        {/* ── Topic statement header ── */}
        <div className="bg-surface-100 border border-surface-300 rounded-2xl p-5 mb-6">
          {topic.category && (
            <span className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-2 block">
              {topic.category} · {statusText}
            </span>
          )}
          <h1 className="text-base font-medium text-white leading-snug mb-4">
            {topic.statement}
          </h1>

          {/* Vote summary bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-for-400 font-semibold">{forPct}% For</span>
              <span className="text-surface-500 flex items-center gap-1">
                <Users className="h-3 w-3" />
                {totalVotes.toLocaleString()} total votes
              </span>
              <span className="text-against-400 font-semibold">{againstPct}% Against</span>
            </div>
            <div className="relative h-2.5 rounded-full overflow-hidden bg-against-900/40">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-for-600 to-for-400 rounded-full"
                style={{ width: `${forPct}%` }}
              />
            </div>
          </div>
        </div>

        {/* ── Section header ── */}
        <div className="flex items-center gap-2 mb-5">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300">
            <Trophy className="h-4 w-4 text-gold" />
          </div>
          <div>
            <h2 className="text-sm font-mono font-semibold text-white">Who Voted</h2>
            <p className="text-xs font-mono text-surface-500">
              Top voters by reputation · up to 50 per side
            </p>
          </div>
        </div>

        {totalVotes === 0 ? (
          /* Empty state */
          <div className="flex flex-col items-center justify-center py-20 text-center">
            <div className="h-12 w-12 rounded-xl bg-surface-200 border border-surface-300 flex items-center justify-center mb-4">
              <Zap className="h-5 w-5 text-surface-500" />
            </div>
            <p className="text-surface-500 text-sm font-mono">No votes cast yet.</p>
            <p className="text-surface-600 text-xs mt-1 font-mono">
              Be the first to take a stance.
            </p>
            <Link
              href={`/topic/${params.id}`}
              className="mt-5 inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-for-600 hover:bg-for-700 text-white text-sm font-mono font-medium transition-colors"
            >
              <ThumbsUp className="h-4 w-4" />
              Vote now
            </Link>
          </div>
        ) : (
          /* Two-column voter grid */
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <VoterColumn
              side="blue"
              voters={forVoters}
              count={blueVotes}
              pct={forPct}
            />
            <VoterColumn
              side="red"
              voters={againstVoters}
              count={redVotes}
              pct={againstPct}
            />
          </div>
        )}

        {/* ── Footer note ── */}
        {totalVotes > 0 && (
          <p className="text-center text-xs font-mono text-surface-600 mt-8">
            Ranked by reputation score. Showing recent voters within each side.
          </p>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
