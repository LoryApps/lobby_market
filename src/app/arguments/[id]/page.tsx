import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  Brain,
  ChevronUp,
  ExternalLink,
  FileText,
  Gavel,
  Link2,
  MessageSquare,
  ThumbsDown,
  ThumbsUp,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { Avatar } from '@/components/ui/Avatar'
import { SharePanel } from '@/components/ui/SharePanel'
import { ArgumentReactionPanel } from '@/components/arguments/ArgumentReactionPanel'
import { ArgumentRepliesClient } from './ArgumentRepliesClient'
import { ArgumentEmbedPanel } from './ArgumentEmbedPanel'
import { cn } from '@/lib/utils/cn'
import type { ReactionCounts, ArgumentReactionType } from '@/components/arguments/ArgumentReactionPanel'

export const dynamic = 'force-dynamic'

const BASE_URL = 'https://lobby.market'

interface ArgumentPageProps {
  params: { id: string }
}

// ─── Grade config ─────────────────────────────────────────────────────────────────────────────

const GRADE_CONFIG: Record<string, { text: string; bg: string; border: string; bar: string; label: string }> = {
  A: { text: 'text-emerald',      bg: 'bg-emerald/10',      border: 'border-emerald/30',      bar: 'bg-emerald',      label: 'Exceptional' },
  B: { text: 'text-for-300',     bg: 'bg-for-500/10',      border: 'border-for-500/30',      bar: 'bg-for-400',      label: 'Strong' },
  C: { text: 'text-gold',        bg: 'bg-gold/10',         border: 'border-gold/30',         bar: 'bg-gold',         label: 'Adequate' },
  D: { text: 'text-against-300', bg: 'bg-against-500/10',  border: 'border-against-500/30',  bar: 'bg-against-400',  label: 'Weak' },
  F: { text: 'text-against-400', bg: 'bg-against-600/10',  border: 'border-against-600/30',  bar: 'bg-against-600',  label: 'Poor' },
}

// ─── Status helpers ─────────────────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
  failed: 'Failed',
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

function StatusIcon({ status }: { status: string }) {
  const cls = 'h-3.5 w-3.5 flex-shrink-0'
  switch (status) {
    case 'active':
    case 'voting':
      return <Zap className={cn(cls, 'text-for-400')} />
    case 'law':
      return <Gavel className={cn(cls, 'text-gold')} />
    default:
      return <FileText className={cn(cls, 'text-surface-500')} />
  }
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  if (d < 30) return `${Math.floor(d / 7)}w ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

// ─── Metadata ─────────────────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: ArgumentPageProps): Promise<Metadata> {
  const supabase = await createClient()

  const { data: arg } = await supabase
    .from('topic_arguments')
    .select('content, side, upvotes, user_id, topic_id, ai_grade, ai_score')
    .eq('id', params.id)
    .single()

  if (!arg) return { title: 'Argument · Lobby Market' }

  const [topicRes, profileRes] = await Promise.all([
    supabase.from('topics').select('statement, category').eq('id', arg.topic_id).single(),
    supabase.from('profiles').select('username, display_name').eq('id', arg.user_id).maybeSingle(),
  ])

  const topic = topicRes.data
  const author = profileRes.data

  const sideLabel = arg.side === 'blue' ? 'FOR' : 'AGAINST'
  const authorName = author?.display_name || (author?.username ? `@${author.username}` : null)
  const gradeStr = arg.ai_grade ? ` · Grade ${arg.ai_grade}` : ''

  const snippet = arg.content.slice(0, 160).trim()
  const title = topic
    ? `${sideLabel}${gradeStr}: ${snippet.slice(0, 80)}… · Lobby Market`
    : `Argument · Lobby Market`

  const description = topic
    ? `${sideLabel} argument on "${topic.statement}"${authorName ? ` by ${authorName}` : ''}. ${arg.upvotes} upvotes${gradeStr}.`
    : snippet

  const ogImageUrl = `${BASE_URL}/api/og/argument/${params.id}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      siteName: 'Lobby Market',
      images: [{ url: ogImageUrl, width: 1200, height: 630 }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────────────

export default async function ArgumentPage({ params }: ArgumentPageProps) {
  const supabase = await createClient()

  const { data: arg } = await supabase
    .from('topic_arguments')
    .select('id, content, side, upvotes, created_at, user_id, topic_id, ai_score, ai_grade, source_url')
    .eq('id', params.id)
    .single()

  if (!arg) notFound()

  const [topicRes, profileRes, repliesRes, gradedRankRes, totalGradedRes, userRes, reactionsRes] = await Promise.all([
    supabase
      .from('topics')
      .select('id, statement, category, status, blue_pct, total_votes')
      .eq('id', arg.topic_id)
      .single(),
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .eq('id', arg.user_id)
      .maybeSingle(),
    supabase
      .from('argument_replies')
      .select('id', { count: 'exact', head: true })
      .eq('argument_id', arg.id),
    arg.ai_score !== null
      ? supabase
          .from('topic_arguments')
          .select('id', { count: 'exact', head: true })
          .not('ai_score', 'is', null)
          .gt('ai_score', arg.ai_score)
      : Promise.resolve({ count: null }),
    arg.ai_score !== null
      ? supabase
          .from('topic_arguments')
          .select('id', { count: 'exact', head: true })
          .not('ai_score', 'is', null)
      : Promise.resolve({ count: null }),
    supabase.auth.getUser(),
    supabase
      .from('argument_reactions')
      .select('reaction, user_id')
      .eq('argument_id', arg.id),
  ])

  const topic = topicRes.data
  const author = profileRes.data
  const replyCount = repliesRes.count ?? 0
  const currentUser = userRes.data.user

  // Aggregate reaction counts and detect current user's reaction
  const reactionRows = reactionsRes.data ?? []
  const initialCounts: ReactionCounts = { insightful: 0, compelling: 0, balanced: 0, needs_evidence: 0 }
  let initialUserReaction: ArgumentReactionType | null = null
  for (const row of reactionRows) {
    const r = row.reaction as ArgumentReactionType
    if (r in initialCounts) initialCounts[r]++
    if (currentUser && row.user_id === currentUser.id) initialUserReaction = r
  }

  if (!topic) notFound()

  const aiScore = arg.ai_score as number | null
  const aiGrade = arg.ai_grade as string | null
  const sourceUrl = arg.source_url as string | null
  const gradeCfg = aiGrade ? (GRADE_CONFIG[aiGrade] ?? GRADE_CONFIG.C) : null

  let percentileBetter: number | null = null
  if (aiScore !== null && gradedRankRes.count !== null && totalGradedRes.count !== null && totalGradedRes.count > 0) {
    const rank = (gradedRankRes.count ?? 0) + 1
    const total = totalGradedRes.count
    percentileBetter = Math.round(((total - rank) / total) * 100)
    if (percentileBetter < 0) percentileBetter = 0
  }

  const isFor = arg.side === 'blue'
  const sideLabel = isFor ? 'FOR' : 'AGAINST'
  const sideColor = isFor ? 'text-for-400' : 'text-against-400'
  const sideBg = isFor ? 'bg-for-500/10' : 'bg-against-500/10'
  const sideBorder = isFor ? 'border-for-500/30' : 'border-against-500/30'
  const sideDot = isFor ? 'bg-for-500' : 'bg-against-500'
  const SideIcon = isFor ? ThumbsUp : ThumbsDown

  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct

  const argUrl = `${BASE_URL}/arguments/${arg.id}`
  const shareText = `${sideLabel}: "${arg.content.slice(0, 100)}${arg.content.length > 100 ? '…' : ''}" — ${arg.upvotes} upvotes on Lobby Market`

  let sourceHost: string | null = null
  if (sourceUrl) {
    try {
      sourceHost = new URL(sourceUrl).hostname.replace(/^www\./, '')
    } catch {
      sourceHost = sourceUrl.slice(0, 40)
    }
  }

  const scorePct = aiScore !== null ? Math.round((aiScore / 10) * 100) : 0

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 py-8 pb-24 md:pb-12" id="main-content">

        {/* Back + Share header */}
        <div className="flex items-center justify-between mb-6">
          <Link
            href={`/topic/${topic.id}`}
            className={cn(
              'inline-flex items-center gap-2 text-sm font-mono text-surface-500',
              'hover:text-white transition-colors'
            )}
          >
            <ArrowLeft className="h-4 w-4" />
            Back to debate
          </Link>
          <SharePanel
            url={argUrl}
            text={shareText}
            className="text-xs"
          />
        </div>

        {/* Side label + grade badge */}
        <div className="flex items-center gap-3 mb-4 flex-wrap">
          <div
            className={cn(
              'inline-flex items-center gap-2 px-3 py-1.5 rounded-full',
              'text-xs font-mono font-bold tracking-widest uppercase',
              'border',
              sideBg,
              sideBorder,
              sideColor
            )}
          >
            <div className={cn('h-2 w-2 rounded-full flex-shrink-0', sideDot)} />
            <SideIcon className="h-3 w-3" aria-hidden />
            {sideLabel}
          </div>
          <span className="text-xs font-mono text-surface-600">argument</span>
          {aiGrade && gradeCfg && (
            <div
              className={cn(
                'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-mono font-bold',
                'border',
                gradeCfg.bg,
                gradeCfg.border,
                gradeCfg.text
              )}
              title={`AI Grade: ${aiGrade} — ${gradeCfg.label}`}
            >
              <Brain className="h-3 w-3" aria-hidden />
              Grade {aiGrade}
            </div>
          )}
        </div>

        {/* Argument content card */}
        <div
          className={cn(
            'rounded-2xl border p-6 mb-6',
            sideBg,
            sideBorder
          )}
        >
          <p className="text-white text-lg leading-relaxed font-medium whitespace-pre-wrap">
            {arg.content}
          </p>
        </div>

        {/* Stats row */}
        <div className="flex items-center gap-4 mb-6 flex-wrap">
          <div className="flex items-center gap-1.5">
            <ChevronUp className="h-4 w-4 text-emerald" aria-hidden />
            <span className="text-sm font-mono font-bold text-emerald">{arg.upvotes}</span>
            <span className="text-xs font-mono text-surface-600">upvotes</span>
          </div>
          <div className="flex items-center gap-1.5">
            <MessageSquare className="h-4 w-4 text-surface-500" aria-hidden />
            <span className="text-sm font-mono font-bold text-white">{replyCount}</span>
            <span className="text-xs font-mono text-surface-600">replies</span>
          </div>
          {aiScore !== null && (
            <div className="flex items-center gap-1.5">
              <Brain className="h-4 w-4 text-purple" aria-hidden />
              <span className="text-sm font-mono font-bold text-purple">{aiScore}/10</span>
              <span className="text-xs font-mono text-surface-600">AI score</span>
            </div>
          )}
          <span className="text-xs font-mono text-surface-600 ml-auto">
            {relativeTime(arg.created_at)}
          </span>
        </div>

        {/* Author */}
        {author && (
          <Link
            href={`/profile/${author.username}`}
            className={cn(
              'flex items-center gap-3 p-4 rounded-xl border border-surface-300',
              'bg-surface-100 hover:bg-surface-200 transition-colors mb-6'
            )}
          >
            <Avatar
              src={author.avatar_url}
              fallback={author.display_name || author.username}
              size="md"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white">
                {author.display_name || author.username}
              </p>
              <p className="text-xs font-mono text-surface-500">@{author.username}</p>
            </div>
            {author.role && author.role !== 'person' && (
              <Badge variant={author.role as 'person' | 'debator' | 'troll_catcher' | 'elder'}>
                {author.role}
              </Badge>
            )}
          </Link>
        )}

        {/* AI Grade Panel */}
        {aiGrade && aiScore !== null && gradeCfg && (
          <div
            className={cn(
              'rounded-2xl border p-5 mb-6',
              gradeCfg.bg,
              gradeCfg.border,
            )}
          >
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2">
                <Brain className={cn('h-4 w-4', gradeCfg.text)} aria-hidden />
                <span className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-widest">
                  AI Quality Grade
                </span>
              </div>
              <Link
                href="/coach"
                className="text-[10px] font-mono text-surface-500 hover:text-white transition-colors flex items-center gap-1"
              >
                Improve
                <ArrowRight className="h-3 w-3" aria-hidden />
              </Link>
            </div>

            <div className="flex items-end gap-4 mb-4">
              <div
                className={cn(
                  'flex items-center justify-center h-16 w-16 rounded-2xl border-2 flex-shrink-0',
                  'font-mono text-3xl font-black',
                  gradeCfg.text,
                  gradeCfg.border,
                  'bg-surface-100/60'
                )}
                aria-label={`Grade ${aiGrade}`}
              >
                {aiGrade}
              </div>
              <div className="flex-1 pb-1">
                <div className="flex items-baseline gap-2 mb-1">
                  <span className={cn('text-lg font-mono font-bold', gradeCfg.text)}>
                    {aiScore}/10
                  </span>
                  <span className="text-xs font-mono text-surface-500">{gradeCfg.label}</span>
                </div>
                <div className="h-2 bg-surface-300/40 rounded-full overflow-hidden">
                  <div
                    className={cn('h-full rounded-full transition-all', gradeCfg.bar)}
                    style={{ width: `${scorePct}%` }}
                  />
                </div>
              </div>
            </div>

            {percentileBetter !== null && (
              <div className="flex items-center gap-2 pt-3 border-t border-surface-300/30">
                <span className="text-xs font-mono text-surface-500">
                  Scores better than{' '}
                  <span className={cn('font-bold', gradeCfg.text)}>
                    {percentileBetter}%
                  </span>
                  {' '}of all graded arguments on the platform
                </span>
              </div>
            )}
          </div>
        )}

        {/* Source citation card */}
        {sourceUrl && (
          <a
            href={sourceUrl}
            target="_blank"
            rel="noopener noreferrer"
            className={cn(
              'flex items-center gap-3 p-4 rounded-xl border border-surface-300',
              'bg-surface-100 hover:bg-surface-200 transition-colors mb-6 group'
            )}
          >
            <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-for-500/10 border border-for-500/20 flex items-center justify-center">
              <Link2 className="h-4 w-4 text-for-400" aria-hidden />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wide mb-0.5">
                Supporting evidence
              </p>
              <p className="text-sm font-mono text-for-300 truncate group-hover:text-for-200 transition-colors">
                {sourceHost}
              </p>
            </div>
            <ExternalLink className="h-4 w-4 text-surface-600 flex-shrink-0" aria-hidden />
          </a>
        )}

        {/* Nudge for ungraded arguments */}
        {!aiGrade && (
          <Link
            href="/coach"
            className={cn(
              'flex items-center gap-3 p-4 rounded-xl border border-purple/20',
              'bg-purple/5 hover:bg-purple/10 transition-colors mb-6 group'
            )}
          >
            <div className="flex-shrink-0 h-8 w-8 rounded-lg bg-purple/10 border border-purple/20 flex items-center justify-center">
              <Brain className="h-4 w-4 text-purple" aria-hidden />
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-mono font-semibold text-white">Not yet graded</p>
              <p className="text-xs font-mono text-surface-500">
                Run a critique in the Coach to receive an AI quality grade
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-surface-600 group-hover:text-purple transition-colors flex-shrink-0" aria-hidden />
          </Link>
        )}

        {/* Community Reactions */}
        <ArgumentReactionPanel
          topicId={topic.id}
          argId={arg.id}
          initialCounts={initialCounts}
          initialUserReaction={initialUserReaction}
          compact={false}
          className="mb-6"
        />

        {/* Topic context */}
        <div className="border border-surface-300 rounded-2xl overflow-hidden mb-6">
          <div className="bg-surface-100 px-4 py-2.5 border-b border-surface-300">
            <span className="text-xs font-mono font-semibold text-surface-600 uppercase tracking-wide">
              Topic
            </span>
          </div>
          <Link
            href={`/topic/${topic.id}`}
            className="block p-4 hover:bg-surface-200 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-white leading-snug mb-2">
                  {topic.statement}
                </p>
                <div className="flex items-center gap-2 flex-wrap">
                  <div className="flex items-center gap-1.5">
                    <StatusIcon status={topic.status} />
                    <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'} className="text-[10px]">
                      {STATUS_LABEL[topic.status] ?? topic.status}
                    </Badge>
                  </div>
                  {topic.category && (
                    <span className="text-[10px] font-mono text-surface-600">
                      {topic.category}
                    </span>
                  )}
                </div>
              </div>
            </div>
          </Link>

          <div className="px-4 pb-4">
            <div className="flex h-2 rounded-full overflow-hidden bg-surface-300 mb-1.5">
              <div
                className="bg-gradient-to-r from-for-700 to-for-400 rounded-l-full"
                style={{ width: `${forPct}%` }}
              />
              <div
                className="bg-gradient-to-l from-against-700 to-against-400 rounded-r-full ml-auto"
                style={{ width: `${againstPct}%` }}
              />
            </div>
            <div className="flex items-center justify-between">
              <span className="text-[11px] font-mono font-bold text-for-400">{forPct}% FOR</span>
              <span className="text-[10px] font-mono text-surface-600">
                {topic.total_votes.toLocaleString()} votes
              </span>
              <span className="text-[11px] font-mono font-bold text-against-400">{againstPct}% AGAINST</span>
            </div>
          </div>
        </div>

        <ArgumentEmbedPanel argumentId={arg.id} isFor={isFor} />

        <ArgumentRepliesClient
          argumentId={arg.id}
          topicId={topic.id}
          initialCount={replyCount}
        />

        <Link
          href={`/topic/${topic.id}#arguments`}
          className={cn(
            'flex items-center justify-center gap-2 w-full py-3 px-4 rounded-xl mt-4',
            'bg-surface-100 hover:bg-surface-200 border border-surface-300',
            'text-sm font-mono font-semibold text-white transition-colors'
          )}
        >
          <MessageSquare className="h-4 w-4" aria-hidden />
          See all arguments on this debate
        </Link>

      </main>
      <BottomNav />
    </div>
  )
}
