import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  BarChart2,
  FileText,
  Gavel,
  MessageSquare,
  Mic,
  Swords,
  ThumbsDown,
  ThumbsUp,
  TrendingUp,
  Trophy,
  Users,
  Vote,
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

// ─── Impact score formula ─────────────────────────────────────────────────────
// Weighted composite that captures breadth + depth of civic engagement

function computeImpactScore(
  totalVotes: number,
  totalArguments: number,
  lawsCount: number,
  proposedLawsCount: number,
  reputationScore: number,
  debateCount: number,
) {
  const votePoints     = Math.min(totalVotes, 500)
  const argPoints      = Math.min(totalArguments * 8, 200)
  const lawPoints      = Math.min(lawsCount * 25, 150)
  const proposalPoints = Math.min(proposedLawsCount * 50, 100)
  const debatePoints   = Math.min(debateCount * 10, 50)
  const repBonus       = Math.min(reputationScore / 20, 50)

  const raw = votePoints + argPoints + lawPoints + proposalPoints + debatePoints + repBonus
  return Math.round(Math.min(raw, 1000))
}

function impactLabel(score: number): { label: string; color: string; bg: string } {
  if (score >= 800) return { label: 'Legendary Citizen', color: 'text-gold',        bg: 'bg-gold/10'        }
  if (score >= 600) return { label: 'Civic Champion',    color: 'text-emerald',     bg: 'bg-emerald/10'     }
  if (score >= 400) return { label: 'Active Voice',      color: 'text-for-300',     bg: 'bg-for-500/10'     }
  if (score >= 200) return { label: 'Rising Citizen',    color: 'text-purple',      bg: 'bg-purple/10'      }
  return                   { label: 'New Citizen',       color: 'text-surface-400', bg: 'bg-surface-300/20' }
}

const CATEGORY_COLORS: Record<string, string> = {
  Economics:   'bg-gold',
  Politics:    'bg-for-500',
  Technology:  'bg-purple',
  Science:     'bg-emerald',
  Ethics:      'bg-against-500',
  Philosophy:  'bg-against-400',
  Culture:     'bg-purple',
  Health:      'bg-emerald',
  Environment: 'bg-emerald',
  Education:   'bg-for-400',
}

const CATEGORY_TEXT: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-400',
  Philosophy:  'text-against-300',
  Culture:     'text-purple',
  Health:      'text-emerald',
  Environment: 'text-emerald',
  Education:   'text-for-400',
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, avatar_url, role, total_votes, reputation_score')
    .eq('username', params.username)
    .maybeSingle()

  if (!profile) return { title: 'Civic Impact · Lobby Market' }

  const displayName = profile.display_name ?? profile.username
  const title = `${displayName}'s Civic Impact · Lobby Market`
  const description = `See the civic impact of ${displayName} on Lobby Market — laws they helped shape, most persuasive arguments, and their influence on the community consensus.`
  const ogImage = `${BASE_URL}/api/og/profile/${profile.username}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
      siteName: 'Lobby Market',
      images: [{ url: ogImage, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImage],
    },
  }
}

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  label,
  count,
}: {
  icon: typeof Trophy
  label: string
  count?: number
}) {
  return (
    <div className="flex items-center gap-2 mb-3">
      <Icon className="h-4 w-4 text-surface-400" />
      <h2 className="text-xs font-mono uppercase tracking-widest text-surface-400">{label}</h2>
      {count != null && (
        <span className="ml-auto text-xs font-mono text-surface-500">{count}</span>
      )}
    </div>
  )
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  icon: Icon,
  value,
  label,
  accent,
}: {
  icon: typeof Trophy
  value: number | string
  label: string
  accent?: 'for' | 'against' | 'gold' | 'emerald' | 'purple'
}) {
  const colorMap = {
    for:     'text-for-300',
    against: 'text-against-300',
    gold:    'text-gold',
    emerald: 'text-emerald',
    purple:  'text-purple',
  } as const
  const iconColorMap = {
    for:     'text-for-400 bg-for-500/10',
    against: 'text-against-400 bg-against-500/10',
    gold:    'text-gold bg-gold/10',
    emerald: 'text-emerald bg-emerald/10',
    purple:  'text-purple bg-purple/10',
  } as const

  return (
    <div className="rounded-xl border border-surface-300 bg-surface-100 p-4 flex flex-col gap-2">
      <div className={cn('h-7 w-7 rounded-lg flex items-center justify-center', accent ? iconColorMap[accent] : 'text-surface-400 bg-surface-300/20')}>
        <Icon className="h-3.5 w-3.5" />
      </div>
      <div className={cn('font-mono text-xl font-bold', accent ? colorMap[accent] : 'text-white')}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </div>
      <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider leading-tight">
        {label}
      </div>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ProfileImpactPage({ params }: PageProps) {
  const supabase = await createClient()

  // ── Profile ────────────────────────────────────────────────────────────────
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, clout, reputation_score, total_votes, total_arguments, blue_vote_count, red_vote_count, created_at, civic_archetype')
    .eq('username', params.username)
    .maybeSingle()

  if (!profile) notFound()

  // ── Laws this user voted on that passed ────────────────────────────────────
  const { data: lawVotesRaw } = await supabase
    .from('votes')
    .select('side, topic_id')
    .eq('user_id', profile.id)

  const votedTopicIds = (lawVotesRaw ?? []).map((v) => v.topic_id)
  const votesBySide: Record<string, 'blue' | 'red'> = {}
  for (const v of lawVotesRaw ?? []) {
    votesBySide[v.topic_id] = v.side as 'blue' | 'red'
  }

  // Get topics that are now laws, that this user voted on
  let lawsContributed: Array<{
    id: string
    statement: string
    category: string | null
    blue_pct: number
    total_votes: number
    updated_at: string
    userSide: 'blue' | 'red'
    aligned: boolean
  }> = []

  if (votedTopicIds.length > 0) {
    const { data: lawTopics } = await supabase
      .from('topics')
      .select('id, statement, category, blue_pct, total_votes, updated_at')
      .eq('status', 'law')
      .in('id', votedTopicIds.slice(0, 500))
      .order('updated_at', { ascending: false })
      .limit(10)

    lawsContributed = (lawTopics ?? []).map((t) => {
      const side = votesBySide[t.id] ?? 'blue'
      const aligned = side === 'blue' ? t.blue_pct >= 50 : t.blue_pct < 50
      return { ...t, userSide: side as 'blue' | 'red', aligned }
    })
  }

  // ── Topics this user proposed ──────────────────────────────────────────────
  const { data: proposedTopicsRaw } = await supabase
    .from('topics')
    .select('id, statement, status, category, blue_pct, total_votes, created_at')
    .eq('author_id', profile.id)
    .order('total_votes', { ascending: false })
    .limit(8)

  const proposedTopics = proposedTopicsRaw ?? []
  const proposedLawsCount = proposedTopics.filter((t) => t.status === 'law').length

  // ── Top arguments by upvotes ───────────────────────────────────────────────
  const { data: topArgsRaw } = await supabase
    .from('topic_arguments')
    .select('id, content, upvotes, side, ai_score, ai_grade, topic_id, created_at')
    .eq('user_id', profile.id)
    .order('upvotes', { ascending: false })
    .limit(6)

  // Fetch topic statements for these arguments
  const argTopicIds = (topArgsRaw ?? []).map((a) => a.topic_id)
  const topicStatementsMap: Record<string, string> = {}
  if (argTopicIds.length > 0) {
    const { data: argTopics } = await supabase
      .from('topics')
      .select('id, statement')
      .in('id', argTopicIds)
    for (const t of argTopics ?? []) {
      topicStatementsMap[t.id] = t.statement
    }
  }

  const topArguments = (topArgsRaw ?? []).map((a) => ({
    ...a,
    topicStatement: topicStatementsMap[a.topic_id] ?? null,
  }))

  // ── Debate participation count ─────────────────────────────────────────────
  const { count: debateCount } = await supabase
    .from('debate_participants')
    .select('id', { count: 'exact', head: true })
    .eq('user_id', profile.id)

  const debateParticipations = debateCount ?? 0

  // ── Category breakdown ────────────────────────────────────────────────────
  // Get a rough category breakdown by looking at voted topics
  const { data: categoryVotes } = await supabase
    .from('votes')
    .select('topic_id')
    .eq('user_id', profile.id)
    .limit(200)

  let categoryBreakdown: Array<{ category: string; count: number }> = []
  if ((categoryVotes?.length ?? 0) > 0) {
    const cIds = (categoryVotes ?? []).map((v) => v.topic_id)
    const { data: catTopics } = await supabase
      .from('topics')
      .select('category')
      .in('id', cIds)
      .not('category', 'is', null)
    const catCounts: Record<string, number> = {}
    for (const t of catTopics ?? []) {
      if (t.category) catCounts[t.category] = (catCounts[t.category] ?? 0) + 1
    }
    categoryBreakdown = Object.entries(catCounts)
      .map(([category, count]) => ({ category, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }

  // ── Compute impact score ──────────────────────────────────────────────────
  const impactScore = computeImpactScore(
    profile.total_votes,
    profile.total_arguments,
    lawsContributed.length,
    proposedLawsCount,
    profile.reputation_score,
    debateParticipations,
  )
  const impact = impactLabel(impactScore)
  const scorePercent = Math.round((impactScore / 1000) * 100)

  const displayName = profile.display_name ?? profile.username
  const forPct = profile.total_votes > 0
    ? Math.round((profile.blue_vote_count / profile.total_votes) * 100)
    : 50

  const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
    proposed: 'proposed',
    active: 'active',
    voting: 'active',
    law: 'law',
    failed: 'failed',
    continued: 'proposed',
    archived: 'proposed',
  }
  const STATUS_LABEL: Record<string, string> = {
    proposed: 'Proposed',
    active: 'Active',
    voting: 'Voting',
    law: 'Law',
    failed: 'Failed',
    continued: 'Continued',
    archived: 'Archived',
  }

  return (
    <div className="min-h-screen bg-surface-0 flex flex-col">
      <TopBar />

      <main className="flex-1 max-w-2xl mx-auto w-full px-4 pt-20 pb-24 space-y-6">

        {/* ── Back nav ───────────────────────────────────────────────────── */}
        <div className="flex items-center gap-2">
          <Link
            href={`/profile/${params.username}`}
            className="flex items-center gap-1.5 text-surface-400 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" />
            <span className="text-sm font-mono">{displayName}</span>
          </Link>
          <span className="text-surface-600 text-sm">/</span>
          <span className="text-sm font-mono text-surface-400">Civic Impact</span>
        </div>

        {/* ── Hero ───────────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-surface-300 bg-surface-100 p-6 relative overflow-hidden">
          {/* Background score glow */}
          <div
            className="absolute inset-0 opacity-[0.04] pointer-events-none"
            style={{
              background: `radial-gradient(ellipse 60% 80% at 80% 50%, ${impactScore >= 600 ? '#d4af37' : impactScore >= 400 ? '#4ade80' : '#4186e0'} , transparent)`,
            }}
          />

          <div className="relative flex items-start gap-4">
            <Avatar
              src={profile.avatar_url}
              fallback={displayName}
              size="md"
            />
            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <h1 className="text-base font-bold text-white truncate">{displayName}</h1>
                  <p className="text-xs text-surface-500 font-mono">@{profile.username}</p>
                </div>
                <div className={cn('shrink-0 px-2.5 py-1 rounded-lg text-xs font-mono font-semibold border', impact.bg, impact.color, 'border-current/20')}>
                  {impact.label}
                </div>
              </div>

              {/* Score bar */}
              <div className="mt-4 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">Civic Impact Score</span>
                  <span className={cn('text-lg font-mono font-bold', impact.color)}>{impactScore.toLocaleString()}<span className="text-xs text-surface-500 font-normal"> / 1000</span></span>
                </div>
                <div className="h-2 rounded-full bg-surface-300/60 overflow-hidden">
                  <div
                    className={cn(
                      'h-full rounded-full transition-all duration-1000',
                      impactScore >= 800 ? 'bg-gold' :
                      impactScore >= 600 ? 'bg-emerald' :
                      impactScore >= 400 ? 'bg-for-400' :
                      impactScore >= 200 ? 'bg-purple' : 'bg-surface-400'
                    )}
                    style={{ width: `${scorePercent}%` }}
                  />
                </div>
              </div>

              {profile.civic_archetype && (
                <p className="mt-2 text-[11px] text-surface-500 font-mono">
                  {profile.civic_archetype}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* ── Key metrics ───────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <StatCard icon={Vote}        value={profile.total_votes}     label="Total Votes"         accent="for" />
          <StatCard icon={MessageSquare} value={profile.total_arguments} label="Arguments Made"      accent="purple" />
          <StatCard icon={Gavel}       value={lawsContributed.length}  label="Laws Shaped"         accent="gold" />
          <StatCard icon={Mic}         value={debateParticipations}    label="Debates Joined"      accent="against" />
        </div>

        {/* ── Vote alignment ────────────────────────────────────────────── */}
        {profile.total_votes > 0 && (
          <div className="rounded-xl border border-surface-300 bg-surface-100 p-4 space-y-2">
            <div className="flex items-center justify-between text-[10px] font-mono uppercase tracking-wider text-surface-500">
              <span className="text-for-400">FOR</span>
              <span>Vote Alignment</span>
              <span className="text-against-400">AGAINST</span>
            </div>
            <div className="h-3 rounded-full overflow-hidden flex bg-surface-300/40">
              <div
                className="h-full bg-for-500 transition-all duration-700"
                style={{ width: `${forPct}%` }}
              />
              <div
                className="h-full bg-against-500 flex-1"
              />
            </div>
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-for-300 font-semibold">{forPct}%</span>
              <span className="text-surface-500">{profile.total_votes.toLocaleString()} votes</span>
              <span className="text-against-300 font-semibold">{100 - forPct}%</span>
            </div>
          </div>
        )}

        {/* ── Category breakdown ────────────────────────────────────────── */}
        {categoryBreakdown.length > 0 && (
          <div className="rounded-xl border border-surface-300 bg-surface-100 p-4 space-y-3">
            <SectionHeader icon={BarChart2} label="Top Categories" />
            <div className="space-y-2">
              {categoryBreakdown.map(({ category, count }) => {
                const maxCount = categoryBreakdown[0]?.count ?? 1
                const pct = Math.round((count / maxCount) * 100)
                return (
                  <div key={category} className="space-y-1">
                    <div className="flex items-center justify-between text-xs">
                      <span className={cn('font-mono font-medium', CATEGORY_TEXT[category] ?? 'text-white')}>
                        {category}
                      </span>
                      <span className="text-surface-500 font-mono">{count}</span>
                    </div>
                    <div className="h-1.5 rounded-full bg-surface-300/40 overflow-hidden">
                      <div
                        className={cn('h-full rounded-full transition-all duration-700', CATEGORY_COLORS[category] ?? 'bg-surface-400')}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                )
              })}
            </div>
          </div>
        )}

        {/* ── Laws shaped ───────────────────────────────────────────────── */}
        <section>
          <SectionHeader icon={Gavel} label="Laws Shaped" count={lawsContributed.length} />
          {lawsContributed.length === 0 ? (
            <EmptyState
              icon={Gavel}
              title="No laws yet"
              description={`${displayName} hasn't voted on any topic that reached consensus yet.`}
              className="border border-surface-300 bg-surface-100 rounded-xl"
            />
          ) : (
            <div className="space-y-2">
              {lawsContributed.map((law) => (
                <Link
                  key={law.id}
                  href={`/topic/${law.id}`}
                  className="block rounded-xl border border-surface-300 bg-surface-100 p-4 hover:border-surface-400 hover:bg-surface-200/60 transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'mt-0.5 h-7 w-7 shrink-0 rounded-lg flex items-center justify-center',
                      law.aligned ? 'bg-gold/10' : 'bg-against-500/10'
                    )}>
                      <Gavel className={cn('h-3.5 w-3.5', law.aligned ? 'text-gold' : 'text-against-400')} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-white font-medium leading-snug line-clamp-2 group-hover:text-for-200 transition-colors">
                        {law.statement}
                      </p>
                      <div className="mt-1.5 flex items-center gap-2 flex-wrap">
                        {law.category && (
                          <span className={cn('text-[10px] font-mono', CATEGORY_TEXT[law.category] ?? 'text-surface-400')}>
                            {law.category}
                          </span>
                        )}
                        <span className={cn(
                          'text-[10px] font-mono font-semibold px-1.5 py-0.5 rounded border',
                          law.userSide === 'blue'
                            ? 'text-for-300 bg-for-500/10 border-for-500/30'
                            : 'text-against-300 bg-against-500/10 border-against-500/30'
                        )}>
                          Voted {law.userSide === 'blue' ? 'FOR' : 'AGAINST'}
                        </span>
                        <span className="text-[10px] text-surface-500 font-mono ml-auto">
                          {Math.round(law.blue_pct)}% consensus
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ── Top arguments ─────────────────────────────────────────────── */}
        <section>
          <SectionHeader icon={MessageSquare} label="Most Impactful Arguments" count={topArguments.length} />
          {topArguments.length === 0 ? (
            <EmptyState
              icon={MessageSquare}
              title="No arguments yet"
              description={`${displayName} hasn't posted any arguments yet.`}
              className="border border-surface-300 bg-surface-100 rounded-xl"
            />
          ) : (
            <div className="space-y-2">
              {topArguments.map((arg) => (
                <Link
                  key={arg.id}
                  href={`/arguments/${arg.id}`}
                  className="block rounded-xl border border-surface-300 bg-surface-100 p-4 hover:border-surface-400 hover:bg-surface-200/60 transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <div className={cn(
                      'mt-0.5 h-7 w-7 shrink-0 rounded-lg flex items-center justify-center',
                      arg.side === 'blue' ? 'bg-for-500/10' : 'bg-against-500/10'
                    )}>
                      {arg.side === 'blue'
                        ? <ThumbsUp className="h-3.5 w-3.5 text-for-400" />
                        : <ThumbsDown className="h-3.5 w-3.5 text-against-400" />
                      }
                    </div>
                    <div className="flex-1 min-w-0">
                      {arg.topicStatement && (
                        <p className="text-[10px] font-mono text-surface-500 mb-1 truncate">
                          {arg.topicStatement}
                        </p>
                      )}
                      <p className="text-sm text-surface-300 leading-snug line-clamp-2 group-hover:text-white transition-colors">
                        {arg.content}
                      </p>
                      <div className="mt-2 flex items-center gap-3">
                        <div className="flex items-center gap-1 text-xs font-mono text-gold">
                          <TrendingUp className="h-3 w-3" />
                          <span>{arg.upvotes} upvotes</span>
                        </div>
                        {arg.ai_grade && (
                          <span className={cn(
                            'text-[10px] font-mono px-1.5 py-0.5 rounded border',
                            arg.ai_grade === 'A' ? 'text-emerald bg-emerald/10 border-emerald/30' :
                            arg.ai_grade === 'B' ? 'text-for-300 bg-for-500/10 border-for-500/30' :
                            'text-surface-400 bg-surface-300/20 border-surface-400/20'
                          )}>
                            Grade {arg.ai_grade}
                          </span>
                        )}
                        <span className={cn(
                          'text-[10px] font-mono font-semibold',
                          arg.side === 'blue' ? 'text-for-400' : 'text-against-400'
                        )}>
                          {arg.side === 'blue' ? 'FOR' : 'AGAINST'}
                        </span>
                        <span className="ml-auto text-[10px] text-surface-600 font-mono">
                          {relativeTime(arg.created_at)}
                        </span>
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>

        {/* ── Topics proposed ───────────────────────────────────────────── */}
        {proposedTopics.length > 0 && (
          <section>
            <SectionHeader icon={FileText} label="Topics Proposed" count={proposedTopics.length} />
            <div className="space-y-2">
              {proposedTopics.map((topic) => (
                <Link
                  key={topic.id}
                  href={`/topic/${topic.id}`}
                  className="flex items-center gap-3 rounded-xl border border-surface-300 bg-surface-100 p-3.5 hover:border-surface-400 hover:bg-surface-200/60 transition-all group"
                >
                  <div className="flex-1 min-w-0">
                    <p className="text-sm text-white font-medium line-clamp-1 group-hover:text-for-200 transition-colors">
                      {topic.statement}
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'} size="xs">
                        {STATUS_LABEL[topic.status] ?? topic.status}
                      </Badge>
                      {topic.category && (
                        <span className={cn('text-[10px] font-mono', CATEGORY_TEXT[topic.category] ?? 'text-surface-400')}>
                          {topic.category}
                        </span>
                      )}
                      <span className="ml-auto text-[10px] font-mono text-surface-500">
                        {topic.total_votes.toLocaleString()} votes
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </section>
        )}

        {/* ── Additional links ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3 pb-4">
          <Link
            href={`/profile/${params.username}/arguments`}
            className="flex items-center gap-2 p-3.5 rounded-xl border border-surface-300 bg-surface-100 hover:border-surface-400 hover:bg-surface-200/60 transition-all group"
          >
            <MessageSquare className="h-4 w-4 text-purple group-hover:text-purple/80" />
            <span className="text-sm text-white font-medium">All Arguments</span>
          </Link>
          <Link
            href={`/profile/${params.username}/debates`}
            className="flex items-center gap-2 p-3.5 rounded-xl border border-surface-300 bg-surface-100 hover:border-surface-400 hover:bg-surface-200/60 transition-all group"
          >
            <Swords className="h-4 w-4 text-against-400 group-hover:text-against-300" />
            <span className="text-sm text-white font-medium">Debate Record</span>
          </Link>
          <Link
            href={`/profile/${params.username}/achievements`}
            className="flex items-center gap-2 p-3.5 rounded-xl border border-surface-300 bg-surface-100 hover:border-surface-400 hover:bg-surface-200/60 transition-all group"
          >
            <Trophy className="h-4 w-4 text-gold group-hover:text-gold/80" />
            <span className="text-sm text-white font-medium">Achievements</span>
          </Link>
          <Link
            href={`/profile/${params.username}`}
            className="flex items-center gap-2 p-3.5 rounded-xl border border-surface-300 bg-surface-100 hover:border-surface-400 hover:bg-surface-200/60 transition-all group"
          >
            <Users className="h-4 w-4 text-for-400 group-hover:text-for-300" />
            <span className="text-sm text-white font-medium">Full Profile</span>
          </Link>
        </div>

      </main>
      <BottomNav />
    </div>
  )
}
