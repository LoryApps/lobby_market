import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  ChevronRight,
  ExternalLink,
  Gavel,
  Star,
  ThumbsUp,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
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

function starLabel(n: number): string {
  return ['', 'Poor', 'Needs work', 'Acceptable', 'Good', 'Excellent'][n] ?? ''
}

const CATEGORY_COLOR: Record<string, { text: string; bg: string; border: string }> = {
  Economics:   { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
  Politics:    { text: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30' },
  Technology:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Science:     { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Ethics:      { text: 'text-for-300',     bg: 'bg-for-300/10',     border: 'border-for-300/30' },
  Philosophy:  { text: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/30' },
  Culture:     { text: 'text-against-300', bg: 'bg-against-400/10', border: 'border-against-400/30' },
  Health:      { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Environment: { text: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30' },
  Education:   { text: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30' },
}

function getCategoryColor(cat: string | null) {
  return CATEGORY_COLOR[cat ?? ''] ?? { text: 'text-surface-400', bg: 'bg-surface-300/30', border: 'border-surface-400/30' }
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({ label, value, sub, accent = 'neutral' }: {
  label: string
  value: string | number
  sub?: string
  accent?: 'gold' | 'for' | 'against' | 'emerald' | 'neutral'
}) {
  const accentClass = {
    gold: 'text-gold',
    for: 'text-for-400',
    against: 'text-against-400',
    emerald: 'text-emerald',
    neutral: 'text-white',
  }[accent]

  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 flex flex-col gap-1">
      <span className="text-[10px] font-mono text-surface-500 uppercase tracking-widest">{label}</span>
      <span className={cn('text-2xl font-black font-mono leading-none', accentClass)}>{value}</span>
      {sub && <span className="text-[10px] font-mono text-surface-600">{sub}</span>}
    </div>
  )
}

function DistributionBar({ distribution, total }: {
  distribution: Record<number, number>
  total: number
}) {
  return (
    <div className="space-y-1.5">
      {[5, 4, 3, 2, 1].map((n) => {
        const count = distribution[n] ?? 0
        const pct = total > 0 ? (count / total) * 100 : 0
        return (
          <div key={n} className="flex items-center gap-2">
            <span className="w-3 text-right text-xs font-mono text-surface-400">{n}</span>
            <Star className="h-3 w-3 fill-gold text-gold flex-shrink-0" />
            <div className="flex-1 h-1.5 bg-surface-300 rounded-full overflow-hidden">
              <div
                className="h-full bg-gold rounded-full transition-all duration-500"
                style={{ width: `${pct}%` }}
              />
            </div>
            <span className="w-6 text-right text-xs font-mono text-surface-500">{count}</span>
          </div>
        )
      })}
    </div>
  )
}

function ReviewCard({ review, isOwner }: {
  review: {
    id: string
    stars: number
    body: string | null
    helpful: number
    created_at: string
    law: {
      id: string
      statement: string
      category: string | null
      established_at: string
    } | null
  }
  isOwner: boolean
}) {
  const colors = getCategoryColor(review.law?.category ?? null)

  return (
    <div className={cn(
      'rounded-xl border p-4 transition-colors',
      isOwner ? 'bg-gold/5 border-gold/20 hover:border-gold/30' : 'bg-surface-100 border-surface-300 hover:border-surface-400',
    )}>
      {/* Law header */}
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className="flex-1 min-w-0">
          {review.law ? (
            <Link
              href={`/law/${review.law.id}`}
              className="group inline-flex items-start gap-1.5"
            >
              <Gavel className="h-3.5 w-3.5 text-gold flex-shrink-0 mt-0.5 group-hover:text-gold/80 transition-colors" />
              <span className="text-sm font-mono font-semibold text-surface-100 group-hover:text-gold transition-colors line-clamp-2 leading-snug">
                {review.law.statement}
              </span>
            </Link>
          ) : (
            <span className="text-sm font-mono text-surface-500 italic">Law removed</span>
          )}
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            {review.law?.category && (
              <span className={cn(
                'text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border',
                colors.text, colors.bg, colors.border,
              )}>
                {review.law.category}
              </span>
            )}
            <span className="text-[10px] font-mono text-surface-500">
              {relativeTime(review.created_at)}
            </span>
          </div>
        </div>

        {review.law && (
          <Link
            href={`/law/${review.law.id}/reviews`}
            className="flex-shrink-0 text-surface-600 hover:text-surface-300 transition-colors"
            title="View all reviews for this law"
          >
            <ExternalLink className="h-3.5 w-3.5" />
          </Link>
        )}
      </div>

      {/* Stars */}
      <div className="flex items-center gap-1 mb-2">
        {[1, 2, 3, 4, 5].map((n) => (
          <Star
            key={n}
            className={cn(
              'h-4 w-4',
              review.stars >= n ? 'fill-gold text-gold' : 'text-surface-400 fill-transparent',
            )}
          />
        ))}
        <span className="ml-1 text-xs font-mono text-surface-500">
          {starLabel(review.stars)}
        </span>
      </div>

      {/* Review text */}
      {review.body && (
        <p className="text-sm font-mono text-surface-300 leading-relaxed italic mb-2">
          &ldquo;{review.body}&rdquo;
        </p>
      )}

      {/* Helpful count */}
      {review.helpful > 0 && (
        <div className="flex items-center gap-1 text-xs font-mono text-surface-500">
          <ThumbsUp className="h-3 w-3" />
          <span>{review.helpful} found helpful</span>
        </div>
      )}
    </div>
  )
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const supabase = await createClient()
  const { data: profile } = await supabase
    .from('profiles')
    .select('display_name')
    .eq('username', params.username)
    .single()

  const name = profile?.display_name ?? params.username

  return {
    title: `${name}'s Law Reviews · Lobby Market`,
    description: `See how ${name} rates established laws on Lobby Market — star ratings and civic reviews on community-passed legislation.`,
    openGraph: {
      title: `${name}'s Law Reviews`,
      description: `${name}'s star ratings and reviews on established laws. See which laws they rate highly and why.`,
      type: 'profile',
      siteName: 'Lobby Market',
      url: `${BASE_URL}/profile/${params.username}/reviews`,
    },
    twitter: {
      card: 'summary',
      title: `${name}'s Law Reviews · Lobby Market`,
      description: `How does ${name} rate the laws passed by the Lobby? Star ratings and civic reviews.`,
    },
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ProfileReviewsPage({ params }: PageProps) {
  const supabase = await createClient()

  // 1. Load profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role')
    .eq('username', params.username)
    .single()

  if (!profile) notFound()

  // 2. Current viewer (to show "Your reviews" vs name's reviews)
  const { data: { user } } = await supabase.auth.getUser()
  const isOwner = user?.id === profile.id
  const displayName = profile.display_name ?? profile.username

  // 3. Fetch reviews with law data
  const { data: rows } = await supabase
    .from('law_reviews')
    .select(`
      id,
      stars,
      body,
      helpful,
      created_at,
      law_id,
      laws!law_reviews_law_id_fkey(id, statement, category, established_at)
    `)
    .eq('user_id', profile.id)
    .order('created_at', { ascending: false })
    .limit(100)

  type RawRow = {
    id: string
    stars: number
    body: string | null
    helpful: number
    created_at: string
    law_id: string
    laws: { id: string; statement: string; category: string | null; established_at: string } | null
  }

  const reviews = (rows ?? [] as RawRow[]).map((r: RawRow) => ({
    id: r.id,
    stars: r.stars,
    body: r.body,
    helpful: r.helpful,
    created_at: r.created_at,
    law: r.laws
      ? {
          id: r.laws.id,
          statement: r.laws.statement,
          category: r.laws.category,
          established_at: r.laws.established_at,
        }
      : null,
  }))

  // 4. Compute stats
  const total = reviews.length
  const avgStars = total > 0
    ? Math.round((reviews.reduce((s, r) => s + r.stars, 0) / total) * 10) / 10
    : 0
  const totalHelpful = reviews.reduce((s, r) => s + r.helpful, 0)

  const distribution: Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 }
  for (const r of reviews) {
    distribution[r.stars] = (distribution[r.stars] ?? 0) + 1
  }

  const filledStars = Math.round(avgStars)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-28 md:pb-12">

        {/* ── Back link ─────────────────────────────────────────────── */}
        <Link
          href={`/profile/${profile.username}`}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-surface-300 transition-colors mb-6"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to profile
        </Link>

        {/* ── Header ───────────────────────────────────────────────── */}
        <div className="flex items-center gap-4 mb-6">
          <Avatar
            src={profile.avatar_url}
            fallback={displayName}
            size="lg"
            className="rounded-2xl ring-2 ring-surface-400/30 flex-shrink-0"
          />
          <div>
            <h1 className="font-mono text-xl font-bold text-white leading-tight">
              {isOwner ? 'Your' : `${displayName}'s`} Law Reviews
            </h1>
            <div className="flex items-center gap-2 mt-1">
              {total > 0 && (
                <>
                  <div className="flex items-center gap-0.5">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={n}
                        className={cn(
                          'h-3 w-3',
                          filledStars >= n ? 'fill-gold text-gold' : 'text-surface-400 fill-transparent',
                        )}
                      />
                    ))}
                  </div>
                  <span className="text-xs font-mono text-surface-500">
                    {avgStars} avg · {total} review{total !== 1 ? 's' : ''}
                  </span>
                </>
              )}
              {total === 0 && (
                <span className="text-xs font-mono text-surface-500">No reviews yet</span>
              )}
            </div>
          </div>
        </div>

        {total === 0 ? (
          <EmptyState
            icon={Star}
            title={isOwner ? 'No reviews yet' : `${displayName} hasn't reviewed any laws`}
            description={
              isOwner
                ? 'Rate established laws to share your civic perspective on how they\'re working in practice.'
                : 'Check back later — this citizen hasn\'t reviewed any laws yet.'
            }
            actions={isOwner ? [{ label: 'Browse the Codex', href: '/law' }] : undefined}
          />
        ) : (
          <>
            {/* ── Stats row ─────────────────────────────────────────── */}
            <div className="grid grid-cols-3 gap-3 mb-6">
              <StatCard
                label="Reviews"
                value={total}
                sub="laws rated"
                accent="neutral"
              />
              <StatCard
                label="Avg rating"
                value={avgStars > 0 ? `${avgStars}★` : '—'}
                sub={avgStars >= 4 ? 'Generous reviewer' : avgStars >= 3 ? 'Fair reviewer' : 'Critical reviewer'}
                accent="gold"
              />
              <StatCard
                label="Helpful votes"
                value={totalHelpful}
                sub="from the community"
                accent={totalHelpful > 0 ? 'for' : 'neutral'}
              />
            </div>

            {/* ── Star distribution ─────────────────────────────────── */}
            <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 mb-6">
              <h2 className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-4">
                Star distribution
              </h2>
              <DistributionBar distribution={distribution} total={total} />
            </div>

            {/* ── Nav breadcrumb ───────────────────────────────────── */}
            <div className="flex items-center gap-2 mb-5 flex-wrap">
              {[
                { href: `/profile/${profile.username}`, label: 'Profile' },
                { href: `/profile/${profile.username}/votes`, label: 'Votes' },
                { href: `/profile/${profile.username}/arguments`, label: 'Arguments' },
                { href: `/profile/${profile.username}/laws`, label: 'Laws' },
                { href: `/profile/${profile.username}/reviews`, label: 'Reviews', active: true },
              ].map(({ href, label, active }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'text-xs font-mono px-3 py-1.5 rounded-lg border transition-colors',
                    active
                      ? 'bg-gold/10 border-gold/30 text-gold'
                      : 'bg-surface-100 border-surface-300 text-surface-400 hover:text-white hover:border-surface-400',
                  )}
                >
                  {label}
                </Link>
              ))}
            </div>

            {/* ── Reviews list ──────────────────────────────────────── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-1">
                <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider">
                  {total} Law Review{total !== 1 ? 's' : ''}
                </h2>
                <Link
                  href="/law/reviews"
                  className="text-xs font-mono text-surface-500 hover:text-surface-300 flex items-center gap-1 transition-colors"
                >
                  All platform reviews
                  <ChevronRight className="h-3 w-3" />
                </Link>
              </div>

              {reviews.map((review) => (
                <ReviewCard key={review.id} review={review} isOwner={isOwner} />
              ))}
            </div>

            {/* ── Footer CTA (only for owner) ──────────────────────── */}
            {isOwner && (
              <div className="mt-8 rounded-2xl border border-gold/20 bg-gold/5 p-5 text-center">
                <Star className="h-5 w-5 text-gold mx-auto mb-2" />
                <h3 className="font-mono text-sm font-bold text-white mb-1">
                  Keep reviewing
                </h3>
                <p className="text-xs font-mono text-surface-500 mb-4">
                  Every law you&apos;ve voted on can be reviewed after it&apos;s established.
                  Your ratings help the community understand real-world impact.
                </p>
                <Link
                  href="/law"
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gold/20 border border-gold/30 text-gold text-sm font-mono font-semibold hover:bg-gold/30 transition-colors"
                >
                  <Gavel className="h-4 w-4" />
                  Browse the Codex
                </Link>
              </div>
            )}
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
