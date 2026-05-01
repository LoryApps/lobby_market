import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  Award,
  ExternalLink,
  Gavel,
  MessageSquare,
  ThumbsDown,
  ThumbsUp,
  Users,
  XCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { SharePanel } from '@/components/ui/SharePanel'
import { cn } from '@/lib/utils/cn'

interface RecapPageProps {
  params: { id: string }
}

export async function generateMetadata({ params }: RecapPageProps): Promise<Metadata> {
  const supabase = await createClient()
  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category, status, blue_pct, total_votes')
    .eq('id', params.id)
    .single()

  if (!topic) return { title: 'Topic Recap · Lobby Market' }

  const verdict = topic.status === 'law' ? 'became law' : 'was rejected'
  const forPct = Math.round(topic.blue_pct ?? 50)

  return {
    title: `Recap: ${topic.statement.slice(0, 60)} · Lobby Market`,
    description: `This debate ${verdict} with ${forPct}% in favour and ${topic.total_votes.toLocaleString()} votes cast.`,
    openGraph: {
      title: `Civic Recap: ${topic.statement.slice(0, 70)}`,
      description: `This debate ${verdict} with ${forPct}% in favour and ${topic.total_votes.toLocaleString()} votes cast.`,
      type: 'article',
      siteName: 'Lobby Market',
      images: [{ url: `/api/og/topic/${params.id}`, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title: `Civic Recap: ${topic.statement.slice(0, 70)}`,
      description: `${forPct}% For · ${100 - forPct}% Against · ${topic.total_votes.toLocaleString()} votes`,
    },
  }
}

export const dynamic = 'force-dynamic'

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  })
}

function daysActive(createdAt: string, resolvedAt: string): number {
  return Math.max(
    1,
    Math.round((new Date(resolvedAt).getTime() - new Date(createdAt).getTime()) / 86400000)
  )
}

const CATEGORY_COLORS: Record<string, string> = {
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

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function TopicRecapPage({ params }: RecapPageProps) {
  const supabase = await createClient()
  const { id } = params

  // ── Fetch topic ────────────────────────────────────────────────────────────
  const { data: topic, error: topicErr } = await supabase
    .from('topics')
    .select('id, statement, description, category, scope, status, blue_pct, total_votes, blue_votes, red_votes, support_count, created_at, updated_at, voting_ends_at, author_id')
    .eq('id', id)
    .single()

  if (topicErr || !topic) notFound()
  if (topic.status !== 'law' && topic.status !== 'failed') notFound()

  // ── Fetch related law (if established) ────────────────────────────────────
  const lawRes = topic.status === 'law'
    ? await supabase
        .from('laws')
        .select('id, established_at, body_markdown')
        .eq('topic_id', id)
        .maybeSingle()
    : null

  const law = lawRes?.data ?? null

  // ── Fetch top arguments (3 per side) ──────────────────────────────────────
  const [forRes, againstRes] = await Promise.all([
    supabase
      .from('topic_arguments')
      .select('id, content, upvotes, user_id, source_url, created_at')
      .eq('topic_id', id)
      .eq('side', 'blue')
      .order('upvotes', { ascending: false })
      .limit(3),
    supabase
      .from('topic_arguments')
      .select('id, content, upvotes, user_id, source_url, created_at')
      .eq('topic_id', id)
      .eq('side', 'red')
      .order('upvotes', { ascending: false })
      .limit(3),
  ])

  const topFor     = forRes.data ?? []
  const topAgainst = againstRes.data ?? []

  // ── Hydrate argument authors ───────────────────────────────────────────────
  const allUserIds = Array.from(
    new Set([...topFor, ...topAgainst].map((a) => a.user_id).filter(Boolean))
  )

  const authorMap: Record<string, { username: string; display_name: string | null; avatar_url: string | null }> = {}
  if (allUserIds.length > 0) {
    const { data: profiles } = await supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url')
      .in('id', allUserIds)
    for (const p of profiles ?? []) {
      authorMap[p.id] = { username: p.username, display_name: p.display_name, avatar_url: p.avatar_url }
    }
  }

  // ── Fetch topic author ─────────────────────────────────────────────────────
  const { data: authorProfile } = await supabase
    .from('profiles')
    .select('username, display_name, avatar_url')
    .eq('id', topic.author_id)
    .maybeSingle()

  // ── Fetch argument count ───────────────────────────────────────────────────
  const { count: totalArguments } = await supabase
    .from('topic_arguments')
    .select('id', { count: 'exact', head: true })
    .eq('topic_id', id)

  // ── Derived values ─────────────────────────────────────────────────────────
  const isLaw       = topic.status === 'law'
  const forPct      = Math.round(topic.blue_pct ?? 50)
  const againstPct  = 100 - forPct
  const resolvedAt  = law?.established_at ?? topic.updated_at
  const activeDays  = daysActive(topic.created_at, resolvedAt)
  const catColor    = CATEGORY_COLORS[topic.category ?? ''] ?? 'text-surface-500'

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-5 pb-24 md:pb-10 space-y-5">

        {/* ── Back nav ──────────────────────────────────────────────── */}
        <Link
          href={`/topic/${id}`}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to debate
        </Link>

        {/* ── Verdict banner ────────────────────────────────────────── */}
        <div
          className={cn(
            'relative rounded-2xl border p-6 overflow-hidden',
            isLaw
              ? 'bg-gold/5 border-gold/30'
              : 'bg-against-500/5 border-against-500/30'
          )}
        >
          {/* glow blob */}
          <div
            className={cn(
              'absolute -top-12 -right-12 h-48 w-48 rounded-full blur-3xl opacity-20 pointer-events-none',
              isLaw ? 'bg-gold' : 'bg-against-500'
            )}
          />

          <div className="relative">
            {/* Status pill */}
            <div className="flex items-center gap-2 mb-3 flex-wrap">
              <span
                className={cn(
                  'inline-flex items-center gap-1.5 text-xs font-mono font-bold uppercase tracking-widest px-3 py-1 rounded-full border',
                  isLaw
                    ? 'text-gold bg-gold/10 border-gold/40'
                    : 'text-against-400 bg-against-500/10 border-against-500/40'
                )}
              >
                {isLaw ? (
                  <><Gavel className="h-3 w-3" />Established Law</>
                ) : (
                  <><XCircle className="h-3 w-3" />Rejected</>
                )}
              </span>
              {topic.category && (
                <span className={cn('text-xs font-mono font-semibold', catColor)}>
                  {topic.category}
                </span>
              )}
            </div>

            {/* Statement */}
            <h1 className="font-mono text-lg sm:text-xl font-bold text-white leading-snug mb-4">
              {topic.statement}
            </h1>

            {/* Proposed by */}
            {authorProfile && (
              <div className="flex items-center gap-2 mb-5">
                <Avatar
                  src={authorProfile.avatar_url}
                  fallback={authorProfile.display_name ?? authorProfile.username}
                  size="xs"
                />
                <span className="text-xs font-mono text-surface-500">
                  Proposed by{' '}
                  <Link href={`/profile/${authorProfile.username}`} className="text-surface-400 hover:text-white transition-colors">
                    @{authorProfile.username}
                  </Link>{' '}
                  on {formatDate(topic.created_at)}
                </span>
              </div>
            )}

            {/* Vote bar */}
            <div className="space-y-2 mb-5">
              <div className="flex justify-between text-sm font-mono font-bold">
                <span className="text-for-400">{forPct}% FOR</span>
                <span className="text-surface-500">{topic.total_votes.toLocaleString()} votes</span>
                <span className="text-against-400">{againstPct}% AGAINST</span>
              </div>
              <div className="relative h-4 rounded-full overflow-hidden bg-surface-300 flex">
                <div
                  className="h-full bg-gradient-to-r from-for-700 to-for-400"
                  style={{ width: `${forPct}%` }}
                />
                <div
                  className="h-full bg-against-600"
                  style={{ width: `${againstPct}%` }}
                />
              </div>
            </div>

            {/* Key stats */}
            <div className="grid grid-cols-3 gap-3">
              {[
                { label: 'Total Votes', value: topic.total_votes.toLocaleString(), icon: Users },
                { label: 'Arguments', value: (totalArguments ?? 0).toLocaleString(), icon: MessageSquare },
                { label: 'Days Active', value: activeDays.toString(), icon: Award },
              ].map(({ label, value, icon: Icon }) => (
                <div key={label} className="text-center">
                  <div
                    className={cn(
                      'flex items-center justify-center h-8 w-8 rounded-lg mx-auto mb-1',
                      isLaw ? 'bg-gold/10 text-gold' : 'bg-against-500/10 text-against-400'
                    )}
                  >
                    <Icon className="h-3.5 w-3.5" />
                  </div>
                  <div className="font-mono text-base font-bold text-white">{value}</div>
                  <div className="text-[10px] font-mono text-surface-500 uppercase tracking-wider">{label}</div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Resolution details ────────────────────────────────────── */}
        <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-2.5">
          <h2 className="text-xs font-mono uppercase tracking-wider text-surface-500 font-semibold">Resolution</h2>
          <div className="space-y-1.5 text-sm font-mono">
            <div className="flex justify-between">
              <span className="text-surface-500">Proposed</span>
              <span className="text-surface-300">{formatDate(topic.created_at)}</span>
            </div>
            {topic.voting_ends_at && (
              <div className="flex justify-between">
                <span className="text-surface-500">Voting closed</span>
                <span className="text-surface-300">{formatDate(topic.voting_ends_at)}</span>
              </div>
            )}
            {law?.established_at && (
              <div className="flex justify-between">
                <span className="text-surface-500">Established as law</span>
                <span className="text-gold font-semibold">{formatDate(law.established_at)}</span>
              </div>
            )}
            {!isLaw && (
              <div className="flex justify-between">
                <span className="text-surface-500">Outcome</span>
                <span className="text-against-400 font-semibold">Failed to pass</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-surface-500">Scope</span>
              <span className="text-surface-300 capitalize">{topic.scope}</span>
            </div>
          </div>
        </div>

        {/* ── Law text (if established) ─────────────────────────────── */}
        {isLaw && law && (
          <div className="rounded-2xl border border-gold/30 bg-gold/5 p-5 space-y-3">
            <div className="flex items-center gap-2">
              <Gavel className="h-4 w-4 text-gold flex-shrink-0" />
              <h2 className="text-sm font-mono font-bold text-gold">Law Text</h2>
              <Link
                href={`/law?topic=${id}`}
                className="ml-auto text-[10px] font-mono text-surface-500 hover:text-gold transition-colors inline-flex items-center gap-0.5"
              >
                View in codex <ExternalLink className="h-2.5 w-2.5" />
              </Link>
            </div>
            {law.body_markdown ? (
              <p className="text-sm font-mono text-surface-300 leading-relaxed line-clamp-4">
                {law.body_markdown.replace(/[#*_`>]/g, '').slice(0, 400)}
                {law.body_markdown.length > 400 && '…'}
              </p>
            ) : (
              <p className="text-sm font-mono text-surface-400 italic">
                &ldquo;{topic.statement}&rdquo;
              </p>
            )}
          </div>
        )}

        {/* ── Top Arguments ─────────────────────────────────────────── */}
        {(topFor.length > 0 || topAgainst.length > 0) && (
          <div className="space-y-3">
            <h2 className="text-xs font-mono uppercase tracking-wider text-surface-500 font-semibold">
              Top Arguments
            </h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* FOR side */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-for-400">
                  <ThumbsUp className="h-3.5 w-3.5" />
                  FOR ({forPct}%)
                </div>
                {topFor.length > 0 ? topFor.map((arg) => {
                  const author = authorMap[arg.user_id]
                  return (
                    <Link
                      key={arg.id}
                      href={`/arguments/${arg.id}`}
                      className="block rounded-xl border border-for-500/20 bg-for-500/5 p-3.5 hover:border-for-500/40 transition-colors group"
                    >
                      <p className="text-xs font-mono text-surface-300 group-hover:text-white leading-relaxed line-clamp-3 transition-colors">
                        &ldquo;{arg.content}&rdquo;
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        {author && (
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <Avatar
                              src={author.avatar_url}
                              fallback={author.display_name ?? author.username}
                              size="xs"
                            />
                            <span className="text-[10px] font-mono text-surface-500 truncate">
                              @{author.username}
                            </span>
                          </div>
                        )}
                        <span className="text-[10px] font-mono text-for-400 flex-shrink-0">
                          ↑ {arg.upvotes}
                        </span>
                      </div>
                    </Link>
                  )
                }) : (
                  <div className="rounded-xl border border-surface-300 bg-surface-100 p-4 text-center">
                    <p className="text-xs font-mono text-surface-500">No FOR arguments recorded</p>
                  </div>
                )}
              </div>

              {/* AGAINST side */}
              <div className="space-y-2.5">
                <div className="flex items-center gap-1.5 text-xs font-mono font-bold text-against-400">
                  <ThumbsDown className="h-3.5 w-3.5" />
                  AGAINST ({againstPct}%)
                </div>
                {topAgainst.length > 0 ? topAgainst.map((arg) => {
                  const author = authorMap[arg.user_id]
                  return (
                    <Link
                      key={arg.id}
                      href={`/arguments/${arg.id}`}
                      className="block rounded-xl border border-against-500/20 bg-against-500/5 p-3.5 hover:border-against-500/40 transition-colors group"
                    >
                      <p className="text-xs font-mono text-surface-300 group-hover:text-white leading-relaxed line-clamp-3 transition-colors">
                        &ldquo;{arg.content}&rdquo;
                      </p>
                      <div className="flex items-center gap-2 mt-2">
                        {author && (
                          <div className="flex items-center gap-1.5 flex-1 min-w-0">
                            <Avatar
                              src={author.avatar_url}
                              fallback={author.display_name ?? author.username}
                              size="xs"
                            />
                            <span className="text-[10px] font-mono text-surface-500 truncate">
                              @{author.username}
                            </span>
                          </div>
                        )}
                        <span className="text-[10px] font-mono text-against-400 flex-shrink-0">
                          ↑ {arg.upvotes}
                        </span>
                      </div>
                    </Link>
                  )
                }) : (
                  <div className="rounded-xl border border-surface-300 bg-surface-100 p-4 text-center">
                    <p className="text-xs font-mono text-surface-500">No AGAINST arguments recorded</p>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        {/* ── Share + navigate ──────────────────────────────────────── */}
        <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3">
          <h2 className="text-xs font-mono uppercase tracking-wider text-surface-500 font-semibold">
            Share This Recap
          </h2>
          <SharePanel
            url={`/topic/${id}/recap`}
            text={`This debate ${isLaw ? 'became law' : 'was rejected'} — ${forPct}% FOR, ${topic.total_votes.toLocaleString()} votes cast on Lobby Market.`}
            topicId={id}
          />
        </div>

        {/* ── Explore more ──────────────────────────────────────────── */}
        <div className="grid grid-cols-2 gap-3">
          <Link
            href={`/topic/${id}`}
            className="rounded-xl border border-surface-300 bg-surface-100 p-3.5 text-center hover:border-surface-400 hover:bg-surface-200 transition-colors"
          >
            <p className="text-sm font-mono font-semibold text-white mb-0.5">Full Debate</p>
            <p className="text-xs font-mono text-surface-500">Arguments, wiki, votes</p>
          </Link>
          <Link
            href={`/topic/${id}/stats`}
            className="rounded-xl border border-surface-300 bg-surface-100 p-3.5 text-center hover:border-surface-400 hover:bg-surface-200 transition-colors"
          >
            <p className="text-sm font-mono font-semibold text-white mb-0.5">Detailed Stats</p>
            <p className="text-xs font-mono text-surface-500">Vote velocity & trends</p>
          </Link>
          {isLaw && (
            <Link
              href="/law"
              className="col-span-2 rounded-xl border border-gold/30 bg-gold/5 p-3.5 text-center hover:border-gold/50 hover:bg-gold/10 transition-colors"
            >
              <div className="flex items-center justify-center gap-2">
                <Gavel className="h-4 w-4 text-gold" />
                <p className="text-sm font-mono font-semibold text-gold">Browse the Law Codex</p>
              </div>
            </Link>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
