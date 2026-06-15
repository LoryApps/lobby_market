import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  ChevronRight,
  Clock,
  ExternalLink,
  Globe,
  Link2,
  Scale,
  ThumbsUp,
  Trophy,
  Zap,
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

function fmtNum(n: number): string {
  if (n >= 1000) return `${(n / 1000).toFixed(1)}k`
  return String(n)
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

const SIDE_CONFIG = {
  for:     { label: 'FOR',     color: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30',     bar: 'bg-for-500' },
  against: { label: 'AGAINST', color: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30', bar: 'bg-against-500' },
  neutral: { label: 'NEUTRAL', color: 'text-surface-400', bg: 'bg-surface-300/20', border: 'border-surface-400/30', bar: 'bg-surface-500' },
} as const

type EvidenceSide = keyof typeof SIDE_CONFIG

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  accent = 'neutral',
}: {
  label: string
  value: string | number
  sub?: string
  accent?: 'gold' | 'for' | 'against' | 'emerald' | 'purple' | 'neutral'
}) {
  const accentClass = {
    gold:    'text-gold',
    for:     'text-for-400',
    against: 'text-against-400',
    emerald: 'text-emerald',
    purple:  'text-purple',
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
    title: `${name}'s Evidence Submissions · Lobby Market`,
    description: `See the research sources ${name} has submitted to civic debates — external evidence cited to support or oppose proposals on Lobby Market.`,
    openGraph: {
      title: `${name}'s Evidence Submissions`,
      description: `${name}'s research contributions on Lobby Market — sources, citations, and evidence submitted across civic debates.`,
      type: 'profile',
      siteName: 'Lobby Market',
      url: `${BASE_URL}/profile/${params.username}/evidence`,
    },
    twitter: {
      card: 'summary',
      title: `${name}'s Evidence Submissions · Lobby Market`,
      description: `How has ${name} backed their civic positions? Evidence submitted, domains cited, and community upvotes received.`,
    },
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface EvidenceRow {
  id: string
  topic_id: string
  url: string
  title: string
  description: string | null
  domain: string | null
  side: EvidenceSide
  upvotes: number
  created_at: string
  topic: {
    id: string
    statement: string
    category: string | null
    status: string
  } | null
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ProfileEvidencePage({ params }: PageProps) {
  const supabase = await createClient()

  // 1. Load profile
  const { data: profile } = await supabase
    .from('profiles')
    .select('id, username, display_name, avatar_url, role')
    .eq('username', params.username)
    .single()

  if (!profile) notFound()

  // 2. Current viewer
  const { data: { user } } = await supabase.auth.getUser()
  const isOwner = user?.id === profile.id
  const displayName = profile.display_name ?? profile.username

  // 3. Fetch all evidence submitted by this user
  const { data: rows } = await supabase
    .from('topic_evidence')
    .select(`
      id,
      topic_id,
      url,
      title,
      description,
      domain,
      side,
      upvotes,
      created_at,
      topics!topic_evidence_topic_id_fkey(id, statement, category, status)
    `)
    .eq('user_id', profile.id)
    .order('upvotes', { ascending: false })
    .order('created_at', { ascending: false })
    .limit(100)

  const evidence: EvidenceRow[] = (rows ?? []).map((r) => {
    const raw = r as {
      id: string
      topic_id: string
      url: string
      title: string
      description: string | null
      domain: string | null
      side: string
      upvotes: number
      created_at: string
      topics: { id: string; statement: string; category: string | null; status: string } | null
    }
    return {
      id: raw.id,
      topic_id: raw.topic_id,
      url: raw.url,
      title: raw.title,
      description: raw.description,
      domain: raw.domain,
      side: (raw.side as EvidenceSide) ?? 'neutral',
      upvotes: raw.upvotes ?? 0,
      created_at: raw.created_at,
      topic: raw.topics ?? null,
    }
  })

  // 4. Compute stats
  const totalEvidence = evidence.length
  const totalUpvotes = evidence.reduce((s, e) => s + e.upvotes, 0)
  const uniqueTopics = new Set(evidence.map((e) => e.topic_id)).size
  const firstAt = evidence.length > 0 ? evidence[evidence.length - 1].created_at : null

  // 5. Side breakdown
  const sideCounts: Record<EvidenceSide, number> = { for: 0, against: 0, neutral: 0 }
  for (const e of evidence) sideCounts[e.side] = (sideCounts[e.side] ?? 0) + 1

  // 6. Domain frequency
  const domainMap: Record<string, { count: number; upvotes: number }> = {}
  for (const e of evidence) {
    const d = e.domain ?? 'unknown'
    if (!domainMap[d]) domainMap[d] = { count: 0, upvotes: 0 }
    domainMap[d].count++
    domainMap[d].upvotes += e.upvotes
  }
  const topDomains = Object.entries(domainMap)
    .sort((a, b) => b[1].count - a[1].count || b[1].upvotes - a[1].upvotes)
    .slice(0, 6)

  // 7. Category breakdown
  const catMap: Record<string, number> = {}
  for (const e of evidence) {
    const cat = e.topic?.category ?? 'Other'
    catMap[cat] = (catMap[cat] ?? 0) + 1
  }
  const topCategories = Object.entries(catMap)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 5)

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

        {/* ── Header ────────────────────────────────────────────────── */}
        <div className="flex items-center gap-4 mb-6">
          <Avatar
            src={profile.avatar_url}
            fallback={displayName}
            size="lg"
            className="rounded-2xl ring-2 ring-surface-400/30 flex-shrink-0"
          />
          <div>
            <h1 className="font-mono text-xl font-bold text-white leading-tight">
              {isOwner ? 'Your' : `${displayName}'s`} Evidence Submissions
            </h1>
            <div className="flex items-center gap-2 mt-1 flex-wrap">
              {totalEvidence > 0 ? (
                <>
                  <span className="flex items-center gap-1 text-[11px] font-mono text-purple">
                    <Link2 className="h-3 w-3" />
                    {totalEvidence} source{totalEvidence !== 1 ? 's' : ''}
                  </span>
                  <span className="text-surface-600">·</span>
                  <span className="text-[11px] font-mono text-surface-400">
                    {uniqueTopics} debate{uniqueTopics !== 1 ? 's' : ''} researched
                  </span>
                  {firstAt && (
                    <>
                      <span className="text-surface-600">·</span>
                      <span className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
                        <Clock className="h-3 w-3" />
                        since {new Date(firstAt).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
                      </span>
                    </>
                  )}
                </>
              ) : (
                <span className="text-xs font-mono text-surface-500">No evidence submitted yet</span>
              )}
            </div>
          </div>
        </div>

        {totalEvidence === 0 ? (
          <EmptyState
            icon={Link2}
            title={isOwner ? 'No evidence submitted yet' : `${displayName} hasn't submitted any evidence`}
            description={
              isOwner
                ? 'Open any topic and tap "Add Evidence" to submit research sources that support or challenge the debate.'
                : 'Check back later — this citizen hasn\'t submitted any research sources yet.'
            }
            actions={isOwner ? [{ label: 'Browse topics', href: '/topics' }] : undefined}
          />
        ) : (
          <>
            {/* ── Stats row ─────────────────────────────────────────── */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-6">
              <StatCard
                label="Sources"
                value={totalEvidence}
                sub="submitted"
                accent="purple"
              />
              <StatCard
                label="Upvotes"
                value={fmtNum(totalUpvotes)}
                sub="community trust"
                accent="gold"
              />
              <StatCard
                label="Topics"
                value={uniqueTopics}
                sub="debates researched"
                accent="emerald"
              />
              <StatCard
                label="Domains"
                value={topDomains.length}
                sub="unique sources"
                accent="neutral"
              />
            </div>

            {/* ── Side breakdown ────────────────────────────────────── */}
            <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 mb-6">
              <h2 className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                <Scale className="h-3.5 w-3.5" />
                Position breakdown
              </h2>
              <div className="space-y-2.5">
                {(['for', 'against', 'neutral'] as EvidenceSide[]).map((side) => {
                  const cfg = SIDE_CONFIG[side]
                  const count = sideCounts[side]
                  const pct = totalEvidence > 0 ? Math.round((count / totalEvidence) * 100) : 0
                  return (
                    <div key={side} className="flex items-center gap-3">
                      <span className={cn('text-[10px] font-mono w-16 flex-shrink-0 font-semibold', cfg.color)}>
                        {cfg.label}
                      </span>
                      <div className="flex-1 h-1.5 bg-surface-300 rounded-full overflow-hidden">
                        <div
                          className={cn('h-full rounded-full transition-all', cfg.bar)}
                          style={{ width: `${pct}%` }}
                        />
                      </div>
                      <span className="text-[10px] font-mono text-surface-500 w-14 text-right">
                        {count} ({pct}%)
                      </span>
                    </div>
                  )
                })}
              </div>
            </div>

            {/* ── Category breakdown ────────────────────────────────── */}
            {topCategories.length > 0 && (
              <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 mb-6">
                <h2 className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                  <Zap className="h-3.5 w-3.5" />
                  Top categories
                </h2>
                <div className="space-y-2">
                  {topCategories.map(([cat, count]) => {
                    const colors = getCategoryColor(cat)
                    const pct = Math.round((count / totalEvidence) * 100)
                    return (
                      <div key={cat} className="flex items-center gap-3">
                        <span className={cn('text-[10px] font-mono w-24 flex-shrink-0 uppercase tracking-wide', colors.text)}>
                          {cat}
                        </span>
                        <div className="flex-1 h-1.5 bg-surface-300 rounded-full overflow-hidden">
                          <div
                            className={cn('h-full rounded-full', colors.bg.replace('/10', '/60'))}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="text-[10px] font-mono text-surface-500 w-8 text-right">
                          {count}
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            )}

            {/* ── Top domains ───────────────────────────────────────── */}
            {topDomains.length > 0 && (
              <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5 mb-6">
                <h2 className="text-[10px] font-mono text-surface-500 uppercase tracking-widest mb-4 flex items-center gap-1.5">
                  <Globe className="h-3.5 w-3.5" />
                  Most-cited sources
                </h2>
                <div className="space-y-2">
                  {topDomains.map(([domain, stats], idx) => (
                    <div key={domain} className="flex items-center gap-3">
                      <span className="text-[10px] font-mono text-surface-600 w-4 flex-shrink-0">
                        {idx + 1}
                      </span>
                      <span className="flex-1 text-xs font-mono text-surface-300 truncate min-w-0">
                        {domain}
                      </span>
                      <div className="flex items-center gap-2 flex-shrink-0">
                        <span className="text-[10px] font-mono text-surface-500">
                          {stats.count}×
                        </span>
                        {stats.upvotes > 0 && (
                          <span className="flex items-center gap-0.5 text-[10px] font-mono text-gold">
                            <ThumbsUp className="h-2.5 w-2.5" />
                            {stats.upvotes}
                          </span>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* ── Nav breadcrumb ────────────────────────────────────── */}
            <div className="flex items-center gap-2 mb-5 flex-wrap">
              {[
                { href: `/profile/${profile.username}`,           label: 'Profile' },
                { href: `/profile/${profile.username}/votes`,     label: 'Votes' },
                { href: `/profile/${profile.username}/arguments`, label: 'Arguments' },
                { href: `/profile/${profile.username}/wiki`,      label: 'Wiki' },
                { href: `/profile/${profile.username}/evidence`,  label: 'Evidence', active: true },
              ].map(({ href, label, active }) => (
                <Link
                  key={href}
                  href={href}
                  className={cn(
                    'text-xs font-mono px-3 py-1.5 rounded-lg border transition-colors',
                    active
                      ? 'bg-purple/10 border-purple/30 text-purple'
                      : 'bg-surface-100 border-surface-300 text-surface-400 hover:text-white hover:border-surface-400',
                  )}
                >
                  {label}
                </Link>
              ))}
            </div>

            {/* ── Evidence list ─────────────────────────────────────── */}
            <div className="space-y-3">
              <div className="flex items-center justify-between mb-2">
                <h2 className="text-xs font-mono font-semibold text-surface-500 uppercase tracking-wider">
                  {totalEvidence} source{totalEvidence !== 1 ? 's' : ''} submitted
                </h2>
                <Link
                  href="/leaderboard/evidence"
                  className="text-xs font-mono text-surface-500 hover:text-surface-300 flex items-center gap-1 transition-colors"
                >
                  Evidence leaderboard
                  <ChevronRight className="h-3 w-3" />
                </Link>
              </div>

              {evidence.map((item) => {
                const side = SIDE_CONFIG[item.side]
                const catColors = getCategoryColor(item.topic?.category ?? null)
                return (
                  <div
                    key={item.id}
                    className="rounded-xl border border-surface-300 bg-surface-100 p-4 hover:border-surface-400 transition-colors"
                  >
                    <div className="flex items-start gap-3">
                      {/* Upvote count */}
                      <div className={cn(
                        'flex-shrink-0 flex flex-col items-center justify-center h-10 w-10 rounded-xl border font-mono',
                        item.upvotes > 0
                          ? 'bg-gold/10 border-gold/30 text-gold'
                          : 'bg-surface-200 border-surface-300 text-surface-500',
                      )}>
                        <ThumbsUp className="h-3 w-3 mb-0.5" />
                        <span className="text-[10px] font-black">{item.upvotes}</span>
                      </div>

                      <div className="flex-1 min-w-0">
                        {/* Title + external link */}
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="flex items-start gap-1.5 group mb-1.5"
                        >
                          <span className="text-sm font-mono font-semibold text-surface-100 group-hover:text-white transition-colors line-clamp-2 leading-snug">
                            {item.title}
                          </span>
                          <ExternalLink className="h-3 w-3 text-surface-500 group-hover:text-surface-300 flex-shrink-0 mt-0.5 transition-colors" />
                        </a>

                        {/* Domain */}
                        {item.domain && (
                          <span className="text-[10px] font-mono text-surface-500 flex items-center gap-1 mb-1.5">
                            <Globe className="h-2.5 w-2.5" />
                            {item.domain}
                          </span>
                        )}

                        {/* Description */}
                        {item.description && (
                          <p className="text-[11px] font-mono text-surface-500 line-clamp-2 mb-1.5 leading-relaxed">
                            {item.description}
                          </p>
                        )}

                        {/* Meta row */}
                        <div className="flex items-center gap-2 flex-wrap">
                          {/* Side badge */}
                          <span className={cn(
                            'text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border font-semibold',
                            side.color, side.bg, side.border,
                          )}>
                            {side.label}
                          </span>

                          {/* Category */}
                          {item.topic?.category && (
                            <span className={cn(
                              'text-[9px] font-mono uppercase tracking-wider px-1.5 py-0.5 rounded border',
                              catColors.text, catColors.bg, catColors.border,
                            )}>
                              {item.topic.category}
                            </span>
                          )}

                          {/* Time */}
                          <span className="text-[10px] font-mono text-surface-600 flex items-center gap-1">
                            <Clock className="h-2.5 w-2.5" />
                            {relativeTime(item.created_at)}
                          </span>
                        </div>
                      </div>

                      {/* Topic link */}
                      {item.topic && (
                        <Link
                          href={`/topic/${item.topic.id}/evidence`}
                          className="flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
                          title="View debate evidence"
                        >
                          <ChevronRight className="h-3.5 w-3.5" />
                        </Link>
                      )}
                    </div>

                    {/* Topic statement */}
                    {item.topic && (
                      <Link
                        href={`/topic/${item.topic.id}`}
                        className="mt-3 block text-[10px] font-mono text-surface-600 hover:text-surface-400 transition-colors border-t border-surface-300/60 pt-2.5 line-clamp-1"
                      >
                        on: {item.topic.statement}
                      </Link>
                    )}
                  </div>
                )
              })}

              {evidence.length >= 100 && (
                <p className="text-center text-xs font-mono text-surface-600 pt-2">
                  Showing 100 most-upvoted sources
                </p>
              )}
            </div>

            {/* ── Footer CTA (owner only) ─────────────────────────── */}
            {isOwner && (
              <div className="mt-8 rounded-2xl border border-purple/20 bg-purple/5 p-5 text-center">
                <Trophy className="h-5 w-5 text-purple mx-auto mb-2" />
                <h3 className="font-mono text-sm font-bold text-white mb-1">
                  Keep researching
                </h3>
                <p className="text-xs font-mono text-surface-500 mb-4">
                  High-quality evidence strengthens the community&apos;s understanding of every debate.
                  The more upvotes your sources earn, the higher your Evidence score climbs.
                </p>
                <div className="flex items-center justify-center gap-3 flex-wrap">
                  <Link
                    href="/topics"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-purple/20 border border-purple/30 text-purple text-sm font-mono font-semibold hover:bg-purple/30 transition-colors"
                  >
                    <Link2 className="h-4 w-4" />
                    Browse topics
                  </Link>
                  <Link
                    href="/leaderboard/evidence"
                    className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-surface-200 border border-surface-300 text-surface-300 text-sm font-mono font-semibold hover:bg-surface-300 hover:text-white transition-colors"
                  >
                    <Trophy className="h-4 w-4" />
                    Evidence leaderboard
                  </Link>
                </div>
              </div>
            )}
          </>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
