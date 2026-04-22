import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowRight,
  Gavel,
  Scale,
  ThumbsDown,
  ThumbsUp,
  Zap,
  FileText,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'

const BASE_URL = 'https://lobby.market'

// ─── Status helpers ────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'Established Law',
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
    case 'law': return <Gavel className={cn(cls, 'text-emerald')} aria-hidden="true" />
    case 'voting': return <Scale className={cn(cls, 'text-purple')} aria-hidden="true" />
    case 'active': return <Zap className={cn(cls, 'text-for-400')} aria-hidden="true" />
    default: return <FileText className={cn(cls, 'text-surface-500')} aria-hidden="true" />
  }
}

// ─── Types ─────────────────────────────────────────────────────────────────────

interface PageProps {
  params: { topicId: string }
  searchParams: {
    side?: string
    pct?: string
    votes?: string
    category?: string
  }
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params, searchParams }: PageProps): Promise<Metadata> {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('statement, category, status, blue_pct, total_votes')
    .eq('id', params.topicId)
    .maybeSingle()

  if (!topic) {
    return { title: 'Lobby Market' }
  }

  const side = searchParams.side === 'against' ? 'against' : 'for'
  const pct = Math.max(0, Math.min(100, parseInt(searchParams.pct ?? '', 10) || Math.round(topic.blue_pct ?? 50)))
  const votes = Math.max(0, parseInt(searchParams.votes ?? '', 10) || (topic.total_votes ?? 0))
  const category = searchParams.category ?? topic.category ?? null

  const sideLabel = side === 'for' ? 'FOR' : 'AGAINST'
  const title = `I voted ${sideLabel}: ${topic.statement}`
  const description = `${pct}% For · ${100 - pct}% Against among ${votes.toLocaleString()} votes on Lobby Market`

  const ogParams = new URLSearchParams({
    statement: topic.statement,
    side,
    pct: String(pct),
    votes: String(votes),
    ...(category ? { category } : {}),
  })
  const ogImageUrl = `${BASE_URL}/api/og/stance?${ogParams.toString()}`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: 'Lobby Market',
      url: `${BASE_URL}/share/stance/${params.topicId}`,
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

export const dynamic = 'force-dynamic'

export default async function StanceSharePage({ params, searchParams }: PageProps) {
  const supabase = await createClient()

  const { data: topic } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .eq('id', params.topicId)
    .maybeSingle()

  if (!topic) notFound()

  const side = searchParams.side === 'against' ? 'against' : 'for'
  const isFor = side === 'for'

  const forPct = Math.round(topic.blue_pct ?? 50)
  const againstPct = 100 - forPct
  const totalVotes = topic.total_votes ?? 0

  const sideLabel = isFor ? 'FOR' : 'AGAINST'
  const statusBadge = STATUS_BADGE[topic.status] ?? 'proposed'

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />
      <main className="max-w-2xl mx-auto px-4 pt-8 pb-24 md:pb-12">

        {/* ── "Voted" badge ──────────────────────────────────────────── */}
        <div className="flex items-center justify-center mb-8">
          <div
            className={cn(
              'inline-flex items-center gap-2.5 px-5 py-2.5 rounded-full border text-sm font-mono font-bold uppercase tracking-widest',
              isFor
                ? 'bg-for-500/10 border-for-500/30 text-for-400'
                : 'bg-against-500/10 border-against-500/30 text-against-400'
            )}
          >
            {isFor ? (
              <ThumbsUp className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
            ) : (
              <ThumbsDown className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
            )}
            Someone voted {sideLabel}
          </div>
        </div>

        {/* ── Topic card ─────────────────────────────────────────────── */}
        <div className="rounded-3xl bg-surface-100 border border-surface-300 p-6 mb-6">

          {/* Status + category */}
          <div className="flex items-center gap-2 mb-4 flex-wrap">
            <Badge variant={statusBadge} className="flex items-center gap-1">
              <StatusIcon status={topic.status} />
              {STATUS_LABEL[topic.status] ?? topic.status}
            </Badge>
            {topic.category && (
              <span className="text-xs font-mono text-surface-500 bg-surface-200 border border-surface-300 px-2 py-0.5 rounded-full">
                {topic.category}
              </span>
            )}
          </div>

          {/* Statement */}
          <p className="text-xl font-bold text-white leading-snug mb-6">
            {topic.statement}
          </p>

          {/* Vote split bar */}
          <div className="space-y-2">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-for-400 font-bold">{forPct}% For</span>
              <span className="text-surface-500">
                {totalVotes.toLocaleString()} votes
              </span>
              <span className="text-against-400 font-bold">{againstPct}% Against</span>
            </div>
            <div className="relative h-3 w-full rounded-full overflow-hidden bg-surface-300">
              <div
                className="absolute inset-y-0 left-0 bg-gradient-to-r from-for-700 to-for-500 transition-all duration-500"
                style={{ width: `${forPct}%` }}
                aria-hidden="true"
              />
              <div
                className="absolute inset-y-0 right-0 bg-gradient-to-l from-against-700 to-against-500 transition-all duration-500"
                style={{ width: `${againstPct}%` }}
                aria-hidden="true"
              />
            </div>
          </div>

          {/* Side highlight */}
          <div
            className={cn(
              'mt-5 flex items-center gap-3 p-3 rounded-xl border',
              isFor
                ? 'bg-for-500/8 border-for-500/20'
                : 'bg-against-500/8 border-against-500/20'
            )}
          >
            <div
              className={cn(
                'flex items-center justify-center h-9 w-9 rounded-full flex-shrink-0',
                isFor ? 'bg-for-500/15' : 'bg-against-500/15'
              )}
            >
              {isFor ? (
                <ThumbsUp className="h-4 w-4 text-for-400" aria-hidden="true" />
              ) : (
                <ThumbsDown className="h-4 w-4 text-against-400" aria-hidden="true" />
              )}
            </div>
            <div>
              <p className={cn('text-sm font-mono font-bold', isFor ? 'text-for-300' : 'text-against-300')}>
                Voted {sideLabel}
              </p>
              <p className="text-xs font-mono text-surface-500 mt-0.5">
                {isFor
                  ? `Agrees with ${forPct}% of voters`
                  : `Agrees with ${againstPct}% of voters`}
              </p>
            </div>
          </div>
        </div>

        {/* ── CTA ───────────────────────────────────────────────────── */}
        <div className="flex flex-col gap-3">
          <Link
            href={`/topic/${topic.id}`}
            className={cn(
              'flex items-center justify-center gap-2 py-3.5 rounded-xl font-mono font-bold text-sm transition-all',
              isFor
                ? 'bg-for-600 hover:bg-for-500 text-white'
                : 'bg-against-600 hover:bg-against-500 text-white'
            )}
          >
            Join the debate
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </Link>

          <Link
            href="/"
            className="flex items-center justify-center gap-2 py-3 rounded-xl font-mono text-sm text-surface-500 hover:text-white bg-surface-200 border border-surface-300 hover:border-surface-400 transition-all"
          >
            Explore Lobby Market
          </Link>
        </div>

        {/* ── Lobby Market brand ────────────────────────────────────── */}
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
