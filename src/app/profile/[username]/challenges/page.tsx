import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  AlertTriangle,
  ArrowLeft,
  CheckCircle2,
  Clock,
  ExternalLink,
  Gavel,
  Scale,
  Shield,
  Swords,
  ThumbsDown,
  ThumbsUp,
  Trophy,
  XCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'

export const dynamic = 'force-dynamic'

const BASE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? 'https://lobby.market'

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

// ─── Status configs ────────────────────────────────────────────────────────────

const DC_STATUS: Record<string, { label: string; color: string; bg: string; border: string; icon: typeof Clock }> = {
  pending:   { label: 'Pending',   color: 'text-gold',         bg: 'bg-gold/10',         border: 'border-gold/30',         icon: Clock },
  accepted:  { label: 'Accepted',  color: 'text-emerald',      bg: 'bg-emerald/10',      border: 'border-emerald/30',      icon: CheckCircle2 },
  declined:  { label: 'Declined',  color: 'text-against-400',  bg: 'bg-against-500/10',  border: 'border-against-500/30',  icon: XCircle },
  cancelled: { label: 'Cancelled', color: 'text-surface-500',  bg: 'bg-surface-200/50',  border: 'border-surface-300/40',  icon: XCircle },
  expired:   { label: 'Expired',   color: 'text-surface-600',  bg: 'bg-surface-200/30',  border: 'border-surface-300/20',  icon: AlertTriangle },
}

const LC_STATUS: Record<string, { label: string; color: string; bg: string; border: string; icon: typeof Clock }> = {
  open:      { label: 'Open',      color: 'text-for-400',      bg: 'bg-for-500/10',      border: 'border-for-500/30',      icon: Scale },
  upheld:    { label: 'Upheld',    color: 'text-emerald',      bg: 'bg-emerald/10',      border: 'border-emerald/30',      icon: Trophy },
  dismissed: { label: 'Dismissed', color: 'text-against-400',  bg: 'bg-against-500/10',  border: 'border-against-500/30',  icon: XCircle },
}

const GROUNDS_LABEL: Record<string, string> = {
  constitutional: 'Constitutional',
  procedural: 'Procedural',
  factual: 'Factual',
  ethical: 'Ethical',
  practical: 'Practical',
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

interface PageProps {
  params: { username: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('username, display_name, avatar_url')
    .eq('username', params.username)
    .maybeSingle()

  if (!profile) return { title: 'Challenges · Lobby Market' }

  const displayName = profile.display_name ?? profile.username
  const title = `${displayName}'s Challenges · Lobby Market`
  const description = `${displayName}'s debate and law challenge record on Lobby Market — every challenge filed, received, and the outcome.`
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

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ProfileChallengesPage({ params }: PageProps) {
  const supabase = await createClient()

  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role, clout')
    .eq('username', params.username)
    .maybeSingle()

  if (!profile) notFound()

  const displayName = profile.display_name ?? profile.username

  // ── Debate challenges (sent + received) ──────────────────────────────────────

  type DebateChallengeRow = {
    id: string
    status: string
    message: string | null
    created_at: string
    expires_at: string
    responded_at: string | null
    debate_id: string | null
    challenger: { id: string; username: string; display_name: string | null; avatar_url: string | null } | null
    challenged: { id: string; username: string; display_name: string | null; avatar_url: string | null } | null
    topic: { id: string; statement: string; category: string | null } | null
  }

  const { data: rawDebateChallenges } = await supabase
    .from('debate_challenges')
    .select(`
      id,
      status,
      message,
      created_at,
      expires_at,
      responded_at,
      debate_id,
      challenger:profiles!debate_challenges_challenger_id_fkey ( id, username, display_name, avatar_url ),
      challenged:profiles!debate_challenges_challenged_id_fkey ( id, username, display_name, avatar_url ),
      topic:topics ( id, statement, category )
    `)
    .or(`challenger_id.eq.${profile.id},challenged_id.eq.${profile.id}`)
    .order('created_at', { ascending: false })
    .limit(100)

  const debateChallenges = (rawDebateChallenges as DebateChallengeRow[] | null) ?? []

  // ── Law challenges filed by this user ────────────────────────────────────────

  type LawChallengeRow = {
    id: string
    grounds: string
    title: string
    description: string
    status: string
    support_count: number
    oppose_count: number
    created_at: string
    law: { id: string; title: string } | null
  }

  const { data: rawLawChallenges } = await supabase
    .from('law_challenges')
    .select(`
      id,
      grounds,
      title,
      description,
      status,
      support_count,
      oppose_count,
      created_at,
      law:laws ( id, title )
    `)
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(50)

  const lawChallenges = (rawLawChallenges as LawChallengeRow[] | null) ?? []

  // ── Stats ────────────────────────────────────────────────────────────────────

  const dcSent     = debateChallenges.filter((c) => c.challenger?.id === profile.id)
  const dcReceived = debateChallenges.filter((c) => c.challenged?.id === profile.id)
  const dcPending  = debateChallenges.filter((c) => c.status === 'pending')
  const dcAccepted = debateChallenges.filter((c) => c.status === 'accepted')
  const lcOpen     = lawChallenges.filter((c) => c.status === 'open')
  const lcUpheld   = lawChallenges.filter((c) => c.status === 'upheld')

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">

        {/* Back link */}
        <Link
          href={`/profile/${profile.username}`}
          className="inline-flex items-center gap-2 text-surface-500 hover:text-white transition-colors text-sm font-mono mb-6"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to profile
        </Link>

        {/* Header */}
        <div className="flex items-center gap-4 mb-6">
          <Avatar src={profile.avatar_url} fallback={displayName} size="lg" />
          <div className="min-w-0">
            <h1 className="font-mono text-2xl font-bold text-white truncate">{displayName}</h1>
            <p className="text-sm font-mono text-surface-500 mt-0.5">
              @{profile.username} · Challenge Record
            </p>
          </div>
        </div>

        {/* Stats strip */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 mb-8">
          <div className="rounded-xl border border-surface-300 bg-surface-100 p-3 text-center">
            <div className="font-mono text-xl font-bold text-white">{debateChallenges.length}</div>
            <div className="text-[10px] font-mono text-surface-500 mt-0.5">total duels</div>
          </div>
          <div className="rounded-xl border border-surface-300 bg-surface-100 p-3 text-center">
            <div className={cn('font-mono text-xl font-bold', dcPending.length > 0 ? 'text-gold' : 'text-surface-500')}>
              {dcPending.length}
            </div>
            <div className="text-[10px] font-mono text-surface-500 mt-0.5">pending</div>
          </div>
          <div className="rounded-xl border border-surface-300 bg-surface-100 p-3 text-center">
            <div className={cn('font-mono text-xl font-bold', dcAccepted.length > 0 ? 'text-emerald' : 'text-surface-500')}>
              {dcAccepted.length}
            </div>
            <div className="text-[10px] font-mono text-surface-500 mt-0.5">accepted</div>
          </div>
          <div className="rounded-xl border border-surface-300 bg-surface-100 p-3 text-center">
            <div className="font-mono text-xl font-bold text-purple">{lawChallenges.length}</div>
            <div className="text-[10px] font-mono text-surface-500 mt-0.5">law challenges</div>
          </div>
          <div className="rounded-xl border border-surface-300 bg-surface-100 p-3 text-center">
            <div className={cn('font-mono text-xl font-bold', lcOpen.length > 0 ? 'text-for-400' : 'text-surface-500')}>
              {lcOpen.length}
            </div>
            <div className="text-[10px] font-mono text-surface-500 mt-0.5">open</div>
          </div>
          <div className="rounded-xl border border-surface-300 bg-surface-100 p-3 text-center">
            <div className={cn('font-mono text-xl font-bold', lcUpheld.length > 0 ? 'text-emerald' : 'text-surface-500')}>
              {lcUpheld.length}
            </div>
            <div className="text-[10px] font-mono text-surface-500 mt-0.5">upheld</div>
          </div>
        </div>

        {/* ── Debate Challenges ────────────────────────────────────────────────── */}
        <section className="mb-10">
          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center justify-center h-7 w-7 rounded-xl bg-purple/10 border border-purple/20 flex-shrink-0">
              <Swords className="h-3.5 w-3.5 text-purple" />
            </div>
            <h2 className="text-sm font-mono font-bold text-white">Debate Challenges</h2>
            <span className="text-xs font-mono text-surface-500">
              {dcSent.length} sent · {dcReceived.length} received
            </span>
          </div>

          {debateChallenges.length === 0 ? (
            <EmptyState
              icon={Swords}
              iconColor="text-purple"
              iconBg="bg-purple/10"
              iconBorder="border-purple/30"
              title="No debate challenges"
              description={`${displayName} has not sent or received any debate challenges yet.`}
              actions={[{ label: 'Browse debates', href: '/debate' }]}
            />
          ) : (
            <div className="space-y-3">
              {debateChallenges.map((c) => {
                const isSender = c.challenger?.id === profile.id
                const opponent = isSender ? c.challenged : c.challenger
                const opponentName = opponent?.display_name ?? opponent?.username ?? 'Unknown'
                const statusCfg = DC_STATUS[c.status] ?? DC_STATUS.pending
                const StatusIcon = statusCfg.icon
                const isExpired = c.status === 'pending' && new Date(c.expires_at) < new Date()

                return (
                  <div
                    key={c.id}
                    className={cn(
                      'rounded-xl border bg-surface-100 p-4',
                      isSender ? 'border-purple/20' : 'border-against-500/20'
                    )}
                  >
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-3 mb-2.5">
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <Shield className={cn('h-4 w-4 flex-shrink-0', isSender ? 'text-purple' : 'text-against-400')} />
                        <span className={cn('text-[10px] font-mono font-semibold uppercase tracking-wider', isSender ? 'text-purple' : 'text-against-400')}>
                          {isSender ? 'You challenged' : 'Challenged by'}
                        </span>
                        <span className="text-xs font-mono text-white font-semibold truncate">
                          {opponentName}
                        </span>
                      </div>
                      <div className={cn(
                        'flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-mono font-semibold border',
                        isExpired ? DC_STATUS.expired.bg : statusCfg.bg,
                        isExpired ? DC_STATUS.expired.border : statusCfg.border,
                        isExpired ? DC_STATUS.expired.color : statusCfg.color,
                      )}>
                        <StatusIcon className="h-2.5 w-2.5" />
                        {isExpired ? 'Expired' : statusCfg.label}
                      </div>
                    </div>

                    {/* Topic */}
                    {c.topic && (
                      <Link
                        href={`/topic/${c.topic.id}`}
                        className="flex items-start gap-1.5 mb-3 pl-6 group"
                      >
                        <Scale className="h-3 w-3 text-surface-600 flex-shrink-0 mt-0.5" />
                        <span className="text-[11px] font-mono text-surface-400 group-hover:text-white transition-colors line-clamp-2">
                          {c.topic.statement}
                        </span>
                        {c.topic.category && (
                          <span className="text-[10px] font-mono text-surface-600 flex-shrink-0">
                            · {c.topic.category}
                          </span>
                        )}
                      </Link>
                    )}

                    {/* Message */}
                    {c.message && (
                      <p className="text-[11px] font-mono text-surface-500 italic mb-3 pl-6 line-clamp-2">
                        &ldquo;{c.message}&rdquo;
                      </p>
                    )}

                    {/* Footer */}
                    <div className="flex items-center gap-3 pl-6 flex-wrap">
                      <span className="text-[10px] font-mono text-surface-600">
                        {relativeTime(c.created_at)}
                      </span>
                      {c.responded_at && (
                        <span className="text-[10px] font-mono text-surface-600">
                          · responded {relativeTime(c.responded_at)}
                        </span>
                      )}
                      {c.debate_id && (
                        <Link
                          href={`/debate/${c.debate_id}`}
                          className="ml-auto inline-flex items-center gap-1 text-[10px] font-mono text-purple hover:text-white transition-colors"
                        >
                          View debate
                          <ExternalLink className="h-2.5 w-2.5" />
                        </Link>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* ── Law Challenges ───────────────────────────────────────────────────── */}
        <section>
          <div className="flex items-center gap-2 mb-4">
            <div className="flex items-center justify-center h-7 w-7 rounded-xl bg-against-500/10 border border-against-500/20 flex-shrink-0">
              <Gavel className="h-3.5 w-3.5 text-against-400" />
            </div>
            <h2 className="text-sm font-mono font-bold text-white">Law Challenges</h2>
            <span className="text-xs font-mono text-surface-500">
              {lawChallenges.length} filed
            </span>
          </div>

          {lawChallenges.length === 0 ? (
            <EmptyState
              icon={Gavel}
              iconColor="text-against-400"
              iconBg="bg-against-500/10"
              iconBorder="border-against-500/30"
              title="No law challenges filed"
              description={`${displayName} has not filed any formal challenges against enacted laws.`}
              actions={[{ label: 'Browse laws', href: '/law' }]}
            />
          ) : (
            <div className="space-y-3">
              {lawChallenges.map((c) => {
                const statusCfg = LC_STATUS[c.status] ?? LC_STATUS.open
                const StatusIcon = statusCfg.icon
                const total = c.support_count + c.oppose_count
                const supportPct = total > 0 ? Math.round((c.support_count / total) * 100) : 0

                return (
                  <div
                    key={c.id}
                    className="rounded-xl border border-against-500/20 bg-surface-100 p-4"
                  >
                    {/* Top row */}
                    <div className="flex items-start justify-between gap-3 mb-2.5">
                      <div className="flex items-start gap-2 flex-1 min-w-0">
                        <Gavel className="h-4 w-4 text-against-400 flex-shrink-0 mt-0.5" />
                        <p className="text-sm font-mono text-white/90 leading-snug line-clamp-2">
                          {c.title}
                        </p>
                      </div>
                      <div className={cn(
                        'flex-shrink-0 flex items-center gap-1 px-2 py-0.5 rounded-lg text-[10px] font-mono font-semibold border',
                        statusCfg.bg, statusCfg.border, statusCfg.color,
                      )}>
                        <StatusIcon className="h-2.5 w-2.5" />
                        {statusCfg.label}
                      </div>
                    </div>

                    {/* Law name */}
                    {c.law && (
                      <Link
                        href={`/law/${c.law.id}`}
                        className="flex items-center gap-1.5 mb-2 pl-6 group"
                      >
                        <Scale className="h-3 w-3 text-surface-600 flex-shrink-0" />
                        <span className="text-[11px] font-mono text-surface-400 group-hover:text-white transition-colors truncate">
                          {c.law.title}
                        </span>
                      </Link>
                    )}

                    {/* Grounds badge */}
                    <div className="pl-6 mb-3">
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold bg-against-500/10 text-against-300 border border-against-500/20">
                        {GROUNDS_LABEL[c.grounds] ?? c.grounds} grounds
                      </span>
                    </div>

                    {/* Vote bar */}
                    {total > 0 && (
                      <div className="pl-6 mb-3">
                        <div className="flex justify-between text-[10px] font-mono mb-1">
                          <span className="flex items-center gap-1 text-emerald">
                            <ThumbsUp className="h-2.5 w-2.5" />
                            Support {supportPct}%
                          </span>
                          <span className="text-surface-600">{total} votes</span>
                          <span className="flex items-center gap-1 text-against-400">
                            Oppose {100 - supportPct}%
                            <ThumbsDown className="h-2.5 w-2.5" />
                          </span>
                        </div>
                        <div className="h-1.5 rounded-full bg-surface-300 overflow-hidden">
                          <div
                            className="h-full bg-gradient-to-r from-emerald to-emerald/70 rounded-full transition-all"
                            style={{ width: `${supportPct}%` }}
                          />
                        </div>
                      </div>
                    )}

                    {/* Footer */}
                    <div className="flex items-center gap-3 pl-6">
                      <span className="text-[10px] font-mono text-surface-600">
                        Filed {relativeTime(c.created_at)}
                      </span>
                      <Link
                        href={`/law/${c.law?.id}/challenges/${c.id}`}
                        className="ml-auto inline-flex items-center gap-1 text-[10px] font-mono text-against-400 hover:text-white transition-colors"
                      >
                        View challenge
                        <ExternalLink className="h-2.5 w-2.5" />
                      </Link>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </section>

        {/* CTA footer */}
        <div className="mt-10 pt-6 border-t border-surface-300 flex items-center justify-between flex-wrap gap-3">
          <Link
            href={`/profile/${profile.username}`}
            className="text-sm font-mono text-surface-500 hover:text-for-400 transition-colors"
          >
            ← Back to {displayName}&apos;s profile
          </Link>
          <div className="flex items-center gap-3">
            <Link
              href={`/profile/${profile.username}/debates`}
              className="inline-flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-white transition-colors"
            >
              <Swords className="h-3.5 w-3.5" />
              Debate record
            </Link>
            <Link
              href="/law"
              className="inline-flex items-center gap-1.5 text-sm font-mono text-surface-500 hover:text-white transition-colors"
            >
              <Gavel className="h-3.5 w-3.5" />
              Browse laws
              <ExternalLink className="h-3 w-3" />
            </Link>
          </div>
        </div>

      </main>

      <BottomNav />
    </div>
  )
}
