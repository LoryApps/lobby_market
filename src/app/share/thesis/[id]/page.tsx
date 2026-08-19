import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Link2,
  Target,
  ThumbsDown,
  ThumbsUp,
  Users,
  XCircle,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'

export const dynamic = 'force-dynamic'

const BASE_URL = 'https://lobby.market'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  active:     'Active',
  vindicated: 'Vindicated',
  refuted:    'Refuted',
  expired:    'Expired',
}

const CATEGORY_LABEL: Record<string, string> = {
  economics:   'Economics',
  politics:    'Politics',
  technology:  'Technology',
  science:     'Science',
  ethics:      'Ethics',
  philosophy:  'Philosophy',
  culture:     'Culture',
  health:      'Health',
  environment: 'Environment',
  education:   'Education',
}

const CATEGORY_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  economics:   { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  politics:    { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
  technology:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  science:     { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  ethics:      { text: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  philosophy:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  culture:     { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  health:      { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  environment: { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  education:   { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
}

const ROLE_LABEL: Record<string, string> = {
  person:        'Citizen',
  debator:       'Debator',
  troll_catcher: 'Troll Catcher',
  elder:         'Elder',
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
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function timeUntil(iso: string): string {
  const diff = new Date(iso).getTime() - Date.now()
  if (diff <= 0) return 'resolution passed'
  const h = Math.floor(diff / 3_600_000)
  const d = Math.floor(h / 24)
  if (h < 1) return 'resolves soon'
  if (h < 24) return `resolves in ${h}h`
  if (d === 1) return 'resolves tomorrow'
  return `resolves in ${d}d`
}

function StatusIcon({ status }: { status: string }) {
  const cls = 'h-3.5 w-3.5 flex-shrink-0'
  switch (status) {
    case 'vindicated': return <CheckCircle2 className={cn(cls, 'text-emerald')} aria-hidden="true" />
    case 'refuted':    return <XCircle      className={cn(cls, 'text-against-400')} aria-hidden="true" />
    case 'expired':    return <Clock        className={cn(cls, 'text-surface-500')} aria-hidden="true" />
    default:           return <Target       className={cn(cls, 'text-for-400')} aria-hidden="true" />
  }
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PageProps {
  params: { id: string }
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = await createClient()

  const { data: thesis } = await supabase
    .from('civic_theses')
    .select('statement, category, status, agree_count, disagree_count, rationale')
    .eq('id', params.id)
    .maybeSingle()

  if (!thesis) return { title: 'Civic Thesis · Lobby Market' }

  const total = thesis.agree_count + thesis.disagree_count
  const agreePct = total > 0 ? Math.round((thesis.agree_count / total) * 100) : 50
  const statusLabel = STATUS_LABEL[thesis.status] ?? thesis.status

  const title = `"${thesis.statement}" · Civic Thesis`
  const description = thesis.rationale
    ? `${thesis.rationale.slice(0, 140)}${thesis.rationale.length > 140 ? '…' : ''} · ${agreePct}% agree · ${statusLabel}`
    : `${agreePct}% of the Lobby agrees with this civic prediction. Status: ${statusLabel}.`

  const ogImageUrl = `${BASE_URL}/api/og/thesis/${params.id}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'article',
      siteName: 'Lobby Market',
      url: `${BASE_URL}/share/thesis/${params.id}`,
      images: [{ url: ogImageUrl, width: 1200, height: 630, alt: title }],
    },
    twitter: {
      card: 'summary_large_image',
      title,
      description,
      images: [ogImageUrl],
    },
  }
}

// ─── Page ──────────────────────────────────────────────────────────────────────

export default async function ThesisSharePage({ params }: PageProps) {
  const supabase = await createClient()

  const { data: thesis } = await supabase
    .from('civic_theses')
    .select(
      'id, user_id, statement, rationale, category, resolution_date, status, agree_count, disagree_count, related_topic_id, resolved_at, created_at'
    )
    .eq('id', params.id)
    .eq('is_public', true)
    .maybeSingle()

  if (!thesis) notFound()

  const [authorRes, topicRes, commentRes] = await Promise.all([
    supabase
      .from('profiles')
      .select('id, username, display_name, avatar_url, role')
      .eq('id', thesis.user_id)
      .maybeSingle(),
    thesis.related_topic_id
      ? supabase
          .from('topics')
          .select('id, statement, status')
          .eq('id', thesis.related_topic_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    supabase
      .from('thesis_comments')
      .select('id', { count: 'exact', head: true })
      .eq('thesis_id', thesis.id),
  ])

  const author = authorRes.data
  const relatedTopic = topicRes.data
  const commentCount = commentRes.count ?? 0

  const total = thesis.agree_count + thesis.disagree_count
  const agreePct  = total > 0 ? Math.round((thesis.agree_count  / total) * 100) : 50
  const disagreePct = 100 - agreePct

  const catColor = CATEGORY_COLOR[thesis.category] ?? { text: 'text-surface-500', bg: 'bg-surface-200', border: 'border-surface-300' }

  const isActive     = thesis.status === 'active'
  const isVindicated = thesis.status === 'vindicated'
  const isRefuted    = thesis.status === 'refuted'

  const statusBadge: 'proposed' | 'active' | 'law' | 'failed' =
    isVindicated ? 'law' :
    isRefuted    ? 'failed' :
    isActive     ? 'active' :
    'proposed'

  // Glow color from status
  const glowColor =
    isVindicated ? 'rgba(16,185,129,0.07)' :
    isRefuted    ? 'rgba(239,68,68,0.07)'  :
    'rgba(59,130,246,0.06)'

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-8 pb-24 md:pb-12">

        {/* ── Header pill ───────────────────────────────────────────── */}
        <div className="flex items-center justify-center mb-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-surface-300 bg-surface-100 text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider">
            <Link2 className="h-3.5 w-3.5" aria-hidden="true" />
            Shared civic thesis
          </div>
        </div>

        {/* ── Main thesis card ───────────────────────────────────────── */}
        <div
          className="relative rounded-3xl border border-surface-300 overflow-hidden mb-5"
          style={{ background: 'linear-gradient(135deg, #0d0f14 0%, #111318 100%)' }}
        >
          {/* Ambient glow */}
          <div
            className="absolute inset-0 rounded-3xl pointer-events-none"
            style={{ background: glowColor }}
            aria-hidden="true"
          />

          <div className="relative p-6">
            {/* Status + category badges */}
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <Badge variant={statusBadge} className="flex items-center gap-1">
                <StatusIcon status={thesis.status} />
                {STATUS_LABEL[thesis.status] ?? thesis.status}
              </Badge>
              <span
                className={cn(
                  'text-xs font-mono px-2 py-0.5 rounded-full border',
                  catColor.text, catColor.bg, catColor.border
                )}
              >
                {CATEGORY_LABEL[thesis.category] ?? thesis.category}
              </span>
            </div>

            {/* Statement */}
            <h1 className="text-xl font-bold text-white leading-snug mb-4">
              &ldquo;{thesis.statement}&rdquo;
            </h1>

            {/* Rationale if present */}
            {thesis.rationale && (
              <p className="text-sm text-surface-400 leading-relaxed mb-5 line-clamp-4">
                {thesis.rationale}
              </p>
            )}

            {/* Agree/Disagree bar */}
            <div className="space-y-2 mb-5">
              <div className="flex items-center justify-between text-xs font-mono">
                <span className="font-bold text-emerald">{agreePct}% Agree</span>
                <span className="text-surface-500">
                  {total.toLocaleString()} {total === 1 ? 'vote' : 'votes'}
                </span>
                <span className="font-bold text-against-400">{disagreePct}% Disagree</span>
              </div>
              <div className="relative h-3 w-full rounded-full overflow-hidden bg-surface-300">
                {agreePct > 0 && (
                  <div
                    className="absolute inset-y-0 left-0 bg-gradient-to-r from-emerald/70 to-emerald"
                    style={{ width: `${agreePct}%` }}
                    aria-label={`${agreePct}% agree`}
                  />
                )}
                {disagreePct > 0 && (
                  <div
                    className="absolute inset-y-0 right-0 bg-gradient-to-l from-against-700 to-against-500"
                    style={{ width: `${disagreePct}%` }}
                    aria-hidden="true"
                  />
                )}
              </div>
              <div className="flex items-center justify-between text-[11px] font-mono text-surface-600">
                <span>{thesis.agree_count.toLocaleString()} agree</span>
                <span>{thesis.disagree_count.toLocaleString()} disagree</span>
              </div>
            </div>

            {/* Stats row */}
            <div className="grid grid-cols-3 gap-3">
              <div className="flex flex-col items-center gap-1 py-3 rounded-xl bg-surface-200/60 border border-surface-300">
                <ThumbsUp className="h-4 w-4 text-emerald/80" aria-hidden="true" />
                <span className="text-sm font-bold font-mono text-white">
                  {thesis.agree_count.toLocaleString()}
                </span>
                <span className="text-[10px] font-mono text-surface-600">agree</span>
              </div>
              <div className="flex flex-col items-center gap-1 py-3 rounded-xl bg-surface-200/60 border border-surface-300">
                <ThumbsDown className="h-4 w-4 text-against-400/80" aria-hidden="true" />
                <span className="text-sm font-bold font-mono text-white">
                  {thesis.disagree_count.toLocaleString()}
                </span>
                <span className="text-[10px] font-mono text-surface-600">disagree</span>
              </div>
              <div className="flex flex-col items-center gap-1 py-3 rounded-xl bg-surface-200/60 border border-surface-300">
                <Users className="h-4 w-4 text-surface-500" aria-hidden="true" />
                <span className="text-sm font-bold font-mono text-white">
                  {commentCount.toLocaleString()}
                </span>
                <span className="text-[10px] font-mono text-surface-600">
                  {commentCount === 1 ? 'comment' : 'comments'}
                </span>
              </div>
            </div>

            {/* Resolution date (for active theses) */}
            {isActive && thesis.resolution_date && (
              <div className="mt-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-for-500/10 border border-for-500/20">
                <Clock className="h-3.5 w-3.5 text-for-400 flex-shrink-0" aria-hidden="true" />
                <span className="text-xs font-mono text-for-400/80">
                  {timeUntil(thesis.resolution_date)}
                </span>
              </div>
            )}

            {/* Resolution outcome banners */}
            {isVindicated && thesis.resolved_at && (
              <div className="mt-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-emerald/10 border border-emerald/20">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald flex-shrink-0" aria-hidden="true" />
                <span className="text-xs font-mono text-emerald/80">
                  Vindicated · {relativeTime(thesis.resolved_at)}
                </span>
              </div>
            )}
            {isRefuted && thesis.resolved_at && (
              <div className="mt-4 flex items-center gap-2 px-3 py-2 rounded-lg bg-against-500/10 border border-against-500/20">
                <XCircle className="h-3.5 w-3.5 text-against-400 flex-shrink-0" aria-hidden="true" />
                <span className="text-xs font-mono text-against-400/80">
                  Refuted · {relativeTime(thesis.resolved_at)}
                </span>
              </div>
            )}
          </div>
        </div>

        {/* ── Author ────────────────────────────────────────────────── */}
        {author && (
          <Link
            href={`/profile/${author.username}`}
            className="flex items-center gap-3 p-4 rounded-2xl border border-surface-300 bg-surface-100 hover:bg-surface-200 transition-colors mb-5"
          >
            <Avatar
              src={author.avatar_url}
              fallback={author.display_name || author.username}
              size="sm"
            />
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-white truncate">
                {author.display_name || author.username}
              </p>
              <p className="text-xs font-mono text-surface-500">
                @{author.username} · predicted {relativeTime(thesis.created_at)}
              </p>
            </div>
            {author.role && author.role !== 'person' && (
              <span className="text-[10px] font-mono text-surface-400 bg-surface-200 border border-surface-300 px-2 py-0.5 rounded-full flex-shrink-0">
                {ROLE_LABEL[author.role] ?? author.role}
              </span>
            )}
          </Link>
        )}

        {/* ── Related topic ─────────────────────────────────────────── */}
        {relatedTopic && (
          <Link
            href={`/topic/${relatedTopic.id}`}
            className="flex items-center gap-3 p-4 rounded-2xl border border-surface-300 bg-surface-100 hover:bg-surface-200 transition-colors mb-5"
          >
            <BookOpen className="h-4 w-4 text-surface-500 flex-shrink-0" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-mono text-surface-600 uppercase tracking-wide mb-0.5">
                Related debate
              </p>
              <p className="text-sm text-white leading-snug line-clamp-2">
                {relatedTopic.statement}
              </p>
            </div>
            <ArrowRight className="h-4 w-4 text-surface-600 flex-shrink-0" aria-hidden="true" />
          </Link>
        )}

        {/* ── CTAs ──────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <Link
            href={`/thesis/${thesis.id}`}
            className="flex items-center justify-center gap-2 py-3.5 rounded-xl font-mono font-bold text-sm bg-for-600 hover:bg-for-500 text-white transition-all"
          >
            {isActive ? (
              <>
                <ThumbsUp className="h-4 w-4" aria-hidden="true" />
                Agree or disagree
              </>
            ) : (
              <>
                <Target className="h-4 w-4" aria-hidden="true" />
                View full thesis
              </>
            )}
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>

          <Link
            href="/thesis"
            className="flex items-center justify-center gap-2 py-3 rounded-xl font-mono text-sm text-surface-500 hover:text-white bg-surface-200 border border-surface-300 hover:border-surface-400 transition-all"
          >
            Browse civic theses
          </Link>

          <Link
            href="/"
            className="flex items-center justify-center gap-2 py-3 rounded-xl font-mono text-sm text-surface-600 hover:text-surface-400 transition-colors"
          >
            Explore Lobby Market
          </Link>
        </div>

        {/* ── Brand footer ──────────────────────────────────────────── */}
        <div className="mt-10 flex flex-col items-center gap-1">
          <div className="flex items-center gap-1">
            <span className="text-white font-bold text-lg tracking-wider">LOBBY</span>
            <span className="text-surface-500 font-bold text-lg tracking-wider">MARKET</span>
          </div>
          <div className="flex h-0.5 w-24">
            <div className="flex-1 bg-for-500 rounded-l-full" />
            <div className="flex-1 bg-against-500 rounded-r-full" />
          </div>
          <p className="text-xs font-mono text-surface-600 mt-1">
            The people&apos;s consensus engine
          </p>
        </div>

      </main>
      <BottomNav />
    </div>
  )
}
