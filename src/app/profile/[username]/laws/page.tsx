import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  BarChart2,
  ExternalLink,
  FileText,
  Gavel,
  Scale,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  Users,
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

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
  })
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface LawEntry {
  id: string
  topic_id: string
  statement: string
  category: string | null
  established_at: string
  blue_pct: number | null
  total_votes: number | null
  userVote: 'blue' | 'red' | null
  isProposer: boolean
  argumentCount: number
}

interface PageProps {
  params: { username: string }
}

// ─── Category colors ───────────────────────────────────────────────────────────

const CAT_COLOR: Record<string, string> = {
  Economics:   'text-gold',
  Politics:    'text-for-400',
  Technology:  'text-purple',
  Science:     'text-emerald',
  Ethics:      'text-against-300',
  Philosophy:  'text-for-300',
  Culture:     'text-gold',
  Health:      'text-against-300',
  Environment: 'text-emerald',
  Education:   'text-purple',
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name')
    .eq('username', params.username)
    .maybeSingle()

  if (!profile) return { title: 'Laws · Lobby Market' }

  const displayName = profile.display_name ?? profile.username
  const title = `${displayName}'s Laws · Lobby Market`
  const description = `${displayName}'s civic law record on Lobby Market — every law they backed, proposed, and argued for or against.`
  const ogImage = `${BASE_URL}/api/og/profile/${profile.username}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'profile',
      siteName: 'Lobby Market',
      images: [{ url: ogImage, width: 1200, height: 630, alt: title }],
    },
    twitter: { card: 'summary_large_image', title, description },
  }
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  color = 'text-white',
  icon: Icon,
}: {
  label: string
  value: number | string
  color?: string
  icon: typeof Gavel
}) {
  return (
    <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 flex items-center gap-3">
      <div className="flex-shrink-0 w-9 h-9 rounded-lg bg-surface-200 border border-surface-300 flex items-center justify-center">
        <Icon className={cn('h-4 w-4', color)} />
      </div>
      <div>
        <div className={cn('text-xl font-mono font-bold', color)}>{value}</div>
        <div className="text-[11px] font-mono text-surface-500 uppercase tracking-wider">{label}</div>
      </div>
    </div>
  )
}

// ─── Law row ──────────────────────────────────────────────────────────────────

function LawRow({ law, rank }: { law: LawEntry; rank: number }) {
  const forPct = Math.round(law.blue_pct ?? 50)
  const againstPct = 100 - forPct
  const catColor = CAT_COLOR[law.category ?? ''] ?? 'text-surface-400'

  return (
    <div className="flex items-start gap-3 px-4 py-4 hover:bg-surface-200/40 transition-colors group">
      {/* Rank */}
      <span className="text-xs font-mono text-surface-600 w-5 text-right mt-1 flex-shrink-0">
        {rank + 1}
      </span>

      {/* Vote badge */}
      <div className={cn(
        'flex-shrink-0 w-9 h-9 rounded-lg border flex items-center justify-center mt-0.5',
        law.userVote === 'blue'
          ? 'bg-for-500/10 border-for-500/30'
          : law.userVote === 'red'
            ? 'bg-against-500/10 border-against-500/30'
            : 'bg-surface-200 border-surface-300',
      )}>
        {law.userVote === 'blue' ? (
          <ThumbsUp className="h-4 w-4 text-for-400" />
        ) : law.userVote === 'red' ? (
          <ThumbsDown className="h-4 w-4 text-against-400" />
        ) : (
          <Gavel className="h-4 w-4 text-surface-500" />
        )}
      </div>

      {/* Statement + meta */}
      <div className="flex-1 min-w-0">
        <Link
          href={`/law/${law.id}`}
          className="text-sm font-mono text-white leading-snug line-clamp-2 group-hover:text-surface-100 transition-colors"
        >
          {law.statement}
        </Link>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5">
          {law.category && (
            <span className={cn('text-[10px] font-mono uppercase tracking-wider', catColor)}>
              {law.category}
            </span>
          )}
          <span className="text-[10px] font-mono text-surface-600">
            {formatDate(law.established_at)}
          </span>
          {law.total_votes != null && (
            <span className="text-[10px] font-mono text-surface-600">
              {law.total_votes.toLocaleString()} votes
            </span>
          )}
          {law.isProposer && (
            <Badge variant="gold" size="xs">Proposer</Badge>
          )}
          {law.argumentCount > 0 && (
            <span className="text-[10px] font-mono text-surface-600">
              {law.argumentCount} arg{law.argumentCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Vote bar */}
        {law.blue_pct != null && (
          <div className="mt-2 flex items-center gap-2">
            <div className="flex-1 h-1 rounded-full overflow-hidden flex bg-surface-300">
              <div className="h-full bg-for-500" style={{ width: `${forPct}%` }} />
              <div className="h-full bg-against-400" style={{ width: `${againstPct}%` }} />
            </div>
            <span className="text-[9px] font-mono text-for-400 flex-shrink-0">{forPct}% FOR</span>
          </div>
        )}
      </div>

      {/* Link */}
      <Link
        href={`/law/${law.id}`}
        className="flex-shrink-0 mt-1 text-surface-600 hover:text-surface-300 transition-colors"
        aria-label="View law"
      >
        <ExternalLink className="h-3.5 w-3.5" />
      </Link>
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ProfileLawsPage({ params }: PageProps) {
  const supabase = await createClient()

  // 1. Resolve profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, total_votes, total_arguments, reputation_score')
    .eq('username', params.username)
    .maybeSingle()

  if (!profile) notFound()

  // 2. Current viewer
  const { data: { user } } = await supabase.auth.getUser()
  const isOwner = user?.id === profile.id

  // 3. Fetch all topics the user authored that became laws
  const { data: authoredTopicRows } = await supabase
    .from('topics')
    .select('id')
    .eq('author_id', profile.id)
    .eq('status', 'law')

  const authoredTopicIds = new Set((authoredTopicRows ?? []).map((t) => t.id))

  // 4. Fetch all laws established from topics this user authored
  const authoredLawRows = authoredTopicIds.size > 0
    ? (await supabase
        .from('laws')
        .select('id, topic_id, statement, category, established_at, blue_pct, total_votes')
        .in('topic_id', [...authoredTopicIds])).data ?? []
    : []

  // 5. Fetch all votes by this user on topics that eventually became laws
  //    We join via topics to get only law-status topics
  const { data: voteRows } = await supabase
    .from('votes')
    .select('topic_id, side')
    .eq('user_id', profile.id)

  const voteMap = new Map<string, 'blue' | 'red'>()
  for (const v of voteRows ?? []) {
    voteMap.set(v.topic_id, v.side as 'blue' | 'red')
  }

  // 6. Fetch all laws for topics this user voted on
  const votedTopicIds = [...voteMap.keys()]
  const votedLawRows = votedTopicIds.length > 0
    ? (await supabase
        .from('laws')
        .select('id, topic_id, statement, category, established_at, blue_pct, total_votes')
        .in('topic_id', votedTopicIds)).data ?? []
    : []

  // 7. Fetch arguments by this user to get law topics they argued about
  const { data: argRows } = await supabase
    .from('topic_arguments')
    .select('topic_id')
    .eq('author_id', profile.id)

  const argTopicIds = new Set((argRows ?? []).map((a) => a.topic_id))

  // 8. Merge all laws into a unified set (deduplicated by law id)
  const lawMap = new Map<string, LawEntry>()

  function addLaw(
    row: { id: string; topic_id: string; statement: string; category: string | null; established_at: string; blue_pct: number | null; total_votes: number | null },
    userVote: 'blue' | 'red' | null,
    isProposer: boolean,
    argumentCount: number,
  ) {
    const existing = lawMap.get(row.id)
    if (existing) {
      // Merge — keep most specific data
      if (userVote) existing.userVote = userVote
      if (isProposer) existing.isProposer = true
      existing.argumentCount = Math.max(existing.argumentCount, argumentCount)
    } else {
      lawMap.set(row.id, {
        id: row.id,
        topic_id: row.topic_id,
        statement: row.statement,
        category: row.category,
        established_at: row.established_at,
        blue_pct: row.blue_pct,
        total_votes: row.total_votes,
        userVote,
        isProposer,
        argumentCount,
      })
    }
  }

  for (const law of authoredLawRows) {
    const vote = voteMap.get(law.topic_id) ?? null
    addLaw(law, vote, true, 0)
  }

  for (const law of votedLawRows) {
    const vote = voteMap.get(law.topic_id) ?? null
    addLaw(law, vote, authoredTopicIds.has(law.topic_id), 0)
  }

  // Fetch argument counts per law topic for user
  if (argTopicIds.size > 0) {
    const argTopicArr = [...argTopicIds]
    const { data: argLawRows } = await supabase
      .from('laws')
      .select('id, topic_id, statement, category, established_at, blue_pct, total_votes')
      .in('topic_id', argTopicArr)

    for (const law of argLawRows ?? []) {
      const vote = voteMap.get(law.topic_id) ?? null
      addLaw(law, vote, authoredTopicIds.has(law.topic_id), 1)
    }
  }

  const allLaws: LawEntry[] = [...lawMap.values()].sort(
    (a, b) => new Date(b.established_at).getTime() - new Date(a.established_at).getTime(),
  )

  // ─── Stats ──────────────────────────────────────────────────────────────────

  const lawsProposed = allLaws.filter((l) => l.isProposer).length
  const lawsBacked = allLaws.filter((l) => l.userVote === 'blue').length
  const lawsOpposed = allLaws.filter((l) => l.userVote === 'red').length
  const lawsArgued = allLaws.filter((l) => l.argumentCount > 0).length

  // Section splits
  const proposedLaws = allLaws.filter((l) => l.isProposer)
  const backedLaws = allLaws.filter((l) => !l.isProposer && l.userVote === 'blue')
  const otherLaws = allLaws.filter((l) => !l.isProposer && l.userVote !== 'blue')

  const displayName = profile.display_name ?? profile.username

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12 space-y-5">

        {/* Back link */}
        <Link
          href={`/profile/${profile.username}`}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          {displayName}&apos;s profile
        </Link>

        {/* Header */}
        <div className="flex items-center gap-4">
          <Avatar
            src={profile.avatar_url}
            username={profile.username}
            size="lg"
          />
          <div>
            <h1 className="font-mono text-2xl font-bold text-white">{displayName}</h1>
            <p className="text-sm font-mono text-surface-500 mt-0.5">
              Civic Law Record — {allLaws.length} law{allLaws.length !== 1 ? 's' : ''} total
            </p>
          </div>
        </div>

        {/* Stats row */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Laws Backed" value={lawsBacked} color="text-for-400" icon={ThumbsUp} />
          <StatCard label="Laws Proposed" value={lawsProposed} color="text-gold" icon={Trophy} />
          <StatCard label="Laws Opposed" value={lawsOpposed} color="text-against-300" icon={ThumbsDown} />
          <StatCard label="Laws Argued" value={lawsArgued} color="text-purple" icon={FileText} />
        </div>

        {/* Empty state */}
        {allLaws.length === 0 && (
          <EmptyState
            icon={Gavel}
            iconColor="text-gold"
            iconBg="bg-gold/10"
            iconBorder="border-gold/30"
            title="No law involvement yet"
            description={
              isOwner
                ? 'Vote on active topics and back the strongest arguments — when consensus is reached, you shape the law.'
                : `${displayName} hasn't been involved in any established laws yet.`
            }
            actions={isOwner ? [{ label: 'Browse active topics', href: '/' }] : []}
          />
        )}

        {/* Proposed laws */}
        {proposedLaws.length > 0 && (
          <section className="rounded-2xl bg-surface-100 border border-gold/30 overflow-hidden">
            <div className="px-4 py-3 border-b border-surface-300 flex items-center gap-2">
              <Trophy className="h-4 w-4 text-gold" />
              <h2 className="text-sm font-mono font-semibold text-white">Laws Proposed</h2>
              <span className="ml-auto text-xs font-mono text-surface-500">{proposedLaws.length}</span>
            </div>
            <div className="divide-y divide-surface-300/50">
              {proposedLaws.map((law, i) => (
                <LawRow key={law.id} law={law} rank={i} />
              ))}
            </div>
          </section>
        )}

        {/* Laws backed */}
        {backedLaws.length > 0 && (
          <section className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
            <div className="px-4 py-3 border-b border-surface-300 flex items-center gap-2">
              <ThumbsUp className="h-4 w-4 text-for-400" />
              <h2 className="text-sm font-mono font-semibold text-white">Laws Backed (FOR)</h2>
              <span className="ml-auto text-xs font-mono text-surface-500">{backedLaws.length}</span>
            </div>
            <div className="divide-y divide-surface-300/50">
              {backedLaws.map((law, i) => (
                <LawRow key={law.id} law={law} rank={i} />
              ))}
            </div>
          </section>
        )}

        {/* Other involvement (voted against, argued on, etc.) */}
        {otherLaws.length > 0 && (
          <section className="rounded-2xl bg-surface-100 border border-surface-300 overflow-hidden">
            <div className="px-4 py-3 border-b border-surface-300 flex items-center gap-2">
              <Scale className="h-4 w-4 text-surface-500" />
              <h2 className="text-sm font-mono font-semibold text-white">Other Law Involvement</h2>
              <span className="ml-auto text-xs font-mono text-surface-500">{otherLaws.length}</span>
            </div>
            <div className="divide-y divide-surface-300/50">
              {otherLaws.map((law, i) => (
                <LawRow key={law.id} law={law} rank={i} />
              ))}
            </div>
          </section>
        )}

        {/* Cross-links */}
        {allLaws.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
            {[
              { href: `/profile/${profile.username}`, label: 'Full Profile', icon: Users },
              { href: `/profile/${profile.username}/impact`, label: 'Civic Impact', icon: BarChart2 },
              { href: `/profile/${profile.username}/arguments`, label: 'Arguments', icon: FileText },
              { href: '/law', label: 'Law Codex', icon: Gavel },
              { href: '/laws', label: 'Browse Laws', icon: Scale },
            ].map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className="flex items-center gap-2 px-3 py-2 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white hover:border-surface-400 transition-colors"
              >
                <Icon className="h-3.5 w-3.5 flex-shrink-0" />
                <span className="truncate">{label}</span>
              </Link>
            ))}
          </div>
        )}

      </main>

      <BottomNav />
    </div>
  )
}
