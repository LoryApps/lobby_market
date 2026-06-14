import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  BarChart2,
  Building2,
  Cpu,
  ExternalLink,
  Gavel,
  GraduationCap,
  Globe,
  Heart,
  Landmark,
  Leaf,
  Mic,
  Scale,
  Search,
  Shield,
  TrendingDown,
  TrendingUp,
  Users,
  Vote,
  Zap,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { CIVIC_ISSUES } from '@/app/api/issues/route'
import { cn } from '@/lib/utils/cn'

export const dynamic = 'force-dynamic'

interface Props {
  params: { slug: string }
}

// ─── Icon map ─────────────────────────────────────────────────────────────────

const ICON_MAP: Record<string, React.ComponentType<{ className?: string }>> = {
  Leaf: Leaf,
  TrendingUp,
  Vote,
  Cpu,
  Scale,
  Heart,
  GraduationCap,
  Globe,
  Mic,
  Building2,
  Shield,
  Landmark,
}

// ─── Color config ─────────────────────────────────────────────────────────────

const COLOR_CONFIG: Record<string, {
  iconBg: string
  iconColor: string
  badge: string
  bar: string
  border: string
  accent: string
  text: string
}> = {
  emerald: {
    iconBg: 'bg-emerald/10',
    iconColor: 'text-emerald',
    badge: 'text-emerald bg-emerald/10 border-emerald/30',
    bar: 'bg-emerald',
    border: 'border-emerald/20',
    accent: 'from-emerald/10 to-transparent',
    text: 'text-emerald',
  },
  gold: {
    iconBg: 'bg-gold/10',
    iconColor: 'text-gold',
    badge: 'text-gold bg-gold/10 border-gold/30',
    bar: 'bg-gold',
    border: 'border-gold/20',
    accent: 'from-gold/10 to-transparent',
    text: 'text-gold',
  },
  for: {
    iconBg: 'bg-for-500/10',
    iconColor: 'text-for-400',
    badge: 'text-for-400 bg-for-500/10 border-for-500/30',
    bar: 'bg-for-500',
    border: 'border-for-500/20',
    accent: 'from-for-500/10 to-transparent',
    text: 'text-for-400',
  },
  purple: {
    iconBg: 'bg-purple/10',
    iconColor: 'text-purple',
    badge: 'text-purple bg-purple/10 border-purple/30',
    bar: 'bg-purple',
    border: 'border-purple/20',
    accent: 'from-purple/10 to-transparent',
    text: 'text-purple',
  },
  against: {
    iconBg: 'bg-against-500/10',
    iconColor: 'text-against-400',
    badge: 'text-against-400 bg-against-500/10 border-against-500/30',
    bar: 'bg-against-500',
    border: 'border-against-500/20',
    accent: 'from-against-500/10 to-transparent',
    text: 'text-against-400',
  },
}

const STATUS_CONFIG: Record<string, { label: string; badge: string }> = {
  proposed:  { label: 'Proposed',  badge: 'text-surface-400 bg-surface-200/60 border-surface-300' },
  active:    { label: 'Active',    badge: 'text-for-400 bg-for-500/10 border-for-500/30' },
  voting:    { label: 'Voting',    badge: 'text-purple bg-purple/10 border-purple/30' },
  law:       { label: 'LAW',       badge: 'text-gold bg-gold/10 border-gold/30' },
  failed:    { label: 'Failed',    badge: 'text-surface-500 bg-surface-200/40 border-surface-300' },
}

function fmtNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return n.toLocaleString()
}

function relTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  if (d === 0) return 'today'
  if (d === 1) return 'yesterday'
  if (d < 30) return `${d}d ago`
  const m = Math.floor(d / 30)
  if (m < 12) return `${m}mo ago`
  return `${Math.floor(m / 12)}y ago`
}

// ─── Metadata ─────────────────────────────────────────────────────────────────

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const issue = CIVIC_ISSUES.find((i) => i.slug === params.slug)
  if (!issue) return { title: 'Issue · Lobby Market' }

  return {
    title: `${issue.title} · Civic Issues · Lobby Market`,
    description: `${issue.description}. Browse all civic topics, established laws, and top contributors in the ${issue.title} policy area on Lobby Market.`,
    openGraph: {
      title: `${issue.title} · Civic Issues Hub`,
      description: issue.description,
      type: 'website',
      siteName: 'Lobby Market',
    },
    twitter: {
      card: 'summary',
      title: `${issue.title} · Lobby Market`,
      description: issue.description,
    },
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function IssueDetailPage({ params }: Props) {
  const issue = CIVIC_ISSUES.find((i) => i.slug === params.slug)
  if (!issue) notFound()

  const supabase = await createClient()

  // Fetch from own API route by calling Supabase directly
  // (avoids internal fetch in server component)
  const { data: allTopicRows } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, tags, created_at')
    .gte('total_votes', 1)
    .not('status', 'in', '("archived","continued")')
    .order('total_votes', { ascending: false })
    .limit(3000)

  const allTopics = allTopicRows ?? []

  const matched = allTopics.filter((t) => {
    const topicTags: string[] = (t.tags as string[]) ?? []
    const hasTagMatch = issue.tags.some((tag) =>
      topicTags.some((tt) => tt.toLowerCase().includes(tag) || tag.includes(tt.toLowerCase()))
    )
    const hasCategoryMatch = issue.categories.includes(t.category as string)
    return hasTagMatch || hasCategoryMatch
  })

  const totalVotes = matched.reduce((s, t) => s + (t.total_votes ?? 0), 0)
  const lawTopics   = matched.filter((t) => t.status === 'law')
  const activeTopics = matched.filter((t) => ['active', 'voting'].includes(t.status as string))
  const failedTopics  = matched.filter((t) => t.status === 'failed')

  const weightedBlueSum = matched.reduce(
    (s, t) => s + (t.blue_pct ?? 50) * (t.total_votes ?? 1), 0
  )
  const avgBluePct = totalVotes > 0 ? weightedBlueSum / totalVotes : 50
  const consensusStrength = Math.abs(avgBluePct - 50) * 2

  let trendDir: 'up' | 'down' | 'flat' = 'flat'
  if (activeTopics.length > 0) {
    const avg = activeTopics.reduce((s, t) => s + (t.blue_pct ?? 50), 0) / activeTopics.length
    if (avg > 55) trendDir = 'up'
    else if (avg < 45) trendDir = 'down'
  }

  const topics = matched.slice(0, 30)

  // Laws
  let laws: { id: string; statement: string; blue_pct: number; total_votes: number; established_at: string }[] = []
  if (lawTopics.length > 0) {
    const { data: lawRows } = await supabase
      .from('laws')
      .select('id, statement, blue_pct, total_votes, established_at')
      .in('id', lawTopics.map((t) => t.id).slice(0, 50))
      .order('established_at', { ascending: false })
      .limit(8)
    laws = lawRows ?? []
  }

  // Top contributors
  let contributors: { id: string; username: string; display_name: string | null; avatar_url: string | null; role: string; clout: number; arg_count: number; upvotes: number }[] = []
  if (matched.length > 0) {
    const topicIds = matched.map((t) => t.id).slice(0, 150)
    const { data: argRows } = await supabase
      .from('topic_arguments')
      .select('user_id, upvotes')
      .in('topic_id', topicIds)

    if (argRows && argRows.length > 0) {
      const userMap = new Map<string, { count: number; upvotes: number }>()
      for (const row of argRows) {
        const ex = userMap.get(row.user_id) ?? { count: 0, upvotes: 0 }
        userMap.set(row.user_id, { count: ex.count + 1, upvotes: ex.upvotes + (row.upvotes ?? 0) })
      }
      const sorted = Array.from(userMap.entries())
        .map(([id, { count, upvotes }]) => ({ id, count, upvotes, score: upvotes + count * 2 }))
        .sort((a, b) => b.score - a.score)
        .slice(0, 6)

      if (sorted.length > 0) {
        const { data: profileRows } = await supabase
          .from('profiles')
          .select('id, username, display_name, avatar_url, role, clout')
          .in('id', sorted.map((u) => u.id))

        const profileMap = new Map((profileRows ?? []).map((p) => [p.id, p]))
        contributors = sorted
          .filter((u) => profileMap.has(u.id))
          .map((u) => {
            const p = profileMap.get(u.id)!
            return { id: p.id, username: p.username, display_name: p.display_name, avatar_url: p.avatar_url, role: p.role, clout: p.clout ?? 0, arg_count: u.count, upvotes: u.upvotes }
          })
      }
    }
  }

  // Related issues
  const relatedIssues = CIVIC_ISSUES
    .filter((other) => other.slug !== issue.slug)
    .map((other) => {
      const overlap = matched.filter((t) => {
        const topicTags: string[] = (t.tags as string[]) ?? []
        return (
          other.tags.some((tag) =>
            topicTags.some((tt) => tt.toLowerCase().includes(tag) || tag.includes(tt.toLowerCase()))
          ) || other.categories.includes(t.category as string)
        )
      }).length
      return { ...other, overlap }
    })
    .sort((a, b) => b.overlap - a.overlap)
    .slice(0, 4)

  const colors = COLOR_CONFIG[issue.color] ?? COLOR_CONFIG['for']
  const IssueIcon = ICON_MAP[issue.icon] ?? Landmark
  const TrendIcon = trendDir === 'up' ? TrendingUp : trendDir === 'down' ? TrendingDown : BarChart2
  const trendColor = trendDir === 'up' ? 'text-for-400' : trendDir === 'down' ? 'text-against-400' : 'text-surface-500'

  const forPct = Math.round(avgBluePct)
  const againstPct = 100 - forPct

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-5xl mx-auto px-4 pt-6 pb-28">

        {/* ─── Breadcrumb ─────────────────────────────────────────────────── */}
        <nav className="flex items-center gap-2 text-xs font-mono text-surface-500 mb-4">
          <Link href="/issues" className="hover:text-white transition-colors flex items-center gap-1">
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            Issues Hub
          </Link>
          <span aria-hidden="true">/</span>
          <span className={colors.text}>{issue.title}</span>
        </nav>

        {/* ─── Hero card ──────────────────────────────────────────────────── */}
        <section
          className={cn(
            'rounded-2xl border bg-surface-100 p-6 mb-6',
            'bg-gradient-to-br', colors.accent, colors.border,
          )}
          aria-label={`${issue.title} overview`}
        >
          <div className="flex items-start gap-4 mb-6">
            <div
              className={cn('flex items-center justify-center h-14 w-14 rounded-2xl flex-shrink-0 border', colors.iconBg, colors.border)}
              aria-hidden="true"
            >
              <IssueIcon className={cn('h-7 w-7', colors.iconColor)} />
            </div>
            <div className="flex-1 min-w-0">
              <h1 className="text-2xl font-bold text-white mb-1">{issue.title}</h1>
              <p className="text-sm font-mono text-surface-400 leading-relaxed">{issue.description}</p>
            </div>
            <div className="flex items-center gap-1.5 flex-shrink-0">
              <TrendIcon className={cn('h-4 w-4', trendColor)} aria-hidden="true" />
              <span className={cn('text-xs font-mono capitalize', trendColor)}>
                {trendDir === 'flat' ? 'Balanced' : trendDir === 'up' ? 'FOR trending' : 'AGAINST trending'}
              </span>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
            {[
              { label: 'Topics', value: fmtNum(matched.length), sub: 'in debate' },
              { label: 'Total Votes', value: fmtNum(totalVotes), sub: 'cast' },
              { label: 'Laws', value: fmtNum(lawTopics.length), sub: 'established' },
              { label: 'Active', value: fmtNum(activeTopics.length), sub: 'live now' },
              { label: 'FOR avg', value: `${forPct}%`, sub: 'consensus lean' },
              { label: 'Strength', value: `${Math.round(consensusStrength)}%`, sub: 'consensus' },
            ].map(({ label, value, sub }) => (
              <div
                key={label}
                className="rounded-xl bg-surface-200/60 border border-surface-300/60 p-3 text-center"
              >
                <p className={cn('text-lg font-bold font-mono tabular-nums', colors.text)}>{value}</p>
                <p className="text-[10px] font-mono text-surface-400 mt-0.5 leading-tight">{label}</p>
                <p className="text-[9px] font-mono text-surface-600">{sub}</p>
              </div>
            ))}
          </div>

          {/* Consensus bar */}
          <div className="mt-4 space-y-1.5">
            <div className="flex items-center justify-between text-xs font-mono">
              <span className="text-for-400">{forPct}% FOR</span>
              <span className="text-surface-500">platform consensus</span>
              <span className="text-against-400">{againstPct}% AGAINST</span>
            </div>
            <div
              className="h-1.5 rounded-full overflow-hidden bg-surface-300 flex"
              role="meter"
              aria-valuenow={forPct}
              aria-valuemin={0}
              aria-valuemax={100}
              aria-label={`${forPct}% for, ${againstPct}% against across all ${issue.title} topics`}
            >
              <div className="h-full bg-for-500 rounded-l-full" style={{ width: `${forPct}%` }} />
              <div className="h-full bg-against-500 rounded-r-full" style={{ width: `${againstPct}%` }} />
            </div>
          </div>

          {/* Tag pills */}
          <div className="flex flex-wrap gap-1.5 mt-4" aria-label="Issue keywords">
            {issue.tags.slice(0, 8).map((tag) => (
              <Link
                key={tag}
                href={`/search?q=${encodeURIComponent(tag)}&tab=topics`}
                className={cn(
                  'text-[10px] font-mono px-2 py-0.5 rounded-full border transition-opacity hover:opacity-80',
                  colors.badge,
                )}
                aria-label={`Search for ${tag}`}
              >
                #{tag}
              </Link>
            ))}
          </div>
        </section>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

          {/* ─── Topics list ─────────────────────────────────────────── */}
          <section className="lg:col-span-2 space-y-3" aria-label="Topics in this issue">
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-mono font-semibold text-white flex items-center gap-2">
                <Zap className="h-4 w-4 text-for-400" aria-hidden="true" />
                Topics
                <span className="text-surface-500 font-normal">({fmtNum(matched.length)})</span>
              </h2>
              <Link
                href={`/search?q=${encodeURIComponent(issue.title)}&tab=topics`}
                className="text-xs font-mono text-surface-500 hover:text-white transition-colors flex items-center gap-1"
                aria-label={`Search all ${issue.title} topics`}
              >
                <Search className="h-3.5 w-3.5" aria-hidden="true" />
                All topics
              </Link>
            </div>

            {topics.length === 0 ? (
              <EmptyState
                icon={<Zap className="h-6 w-6 text-surface-500" />}
                title="No topics yet"
                description={`Be the first to propose a ${issue.title} debate.`}
              />
            ) : (
              <div className="space-y-2">
                {topics.map((topic) => {
                  const cfg = STATUS_CONFIG[topic.status] ?? STATUS_CONFIG['proposed']
                  const blue = Math.round(topic.blue_pct ?? 50)
                  const red = 100 - blue
                  return (
                    <Link
                      key={topic.id}
                      href={`/topic/${topic.id}`}
                      className="block rounded-xl border border-surface-300 bg-surface-100 p-3.5 hover:border-surface-400 hover:bg-surface-200/60 transition-all group focus:outline-none focus:ring-2 focus:ring-for-500/40"
                      aria-label={`${topic.statement} — ${cfg.label}`}
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 mb-1.5">
                            <span className={cn('text-[10px] font-mono px-1.5 py-0.5 rounded border', cfg.badge)}>
                              {cfg.label}
                            </span>
                            {topic.category && (
                              <span className="text-[10px] font-mono text-surface-500 truncate">
                                {topic.category}
                              </span>
                            )}
                          </div>
                          <p className="text-sm font-semibold text-white leading-snug line-clamp-2 group-hover:text-surface-100 transition-colors">
                            {topic.statement}
                          </p>
                          <div className="flex items-center gap-3 mt-2">
                            <div
                              className="flex-1 h-1 rounded-full overflow-hidden bg-surface-300 flex"
                              role="presentation"
                            >
                              <div className="h-full bg-for-500/70" style={{ width: `${blue}%` }} />
                              <div className="h-full bg-against-500/70" style={{ width: `${red}%` }} />
                            </div>
                            <span className="text-[10px] font-mono text-surface-500 flex-shrink-0 tabular-nums">
                              {fmtNum(topic.total_votes ?? 0)} votes
                            </span>
                          </div>
                        </div>
                        <ArrowRight className="h-4 w-4 text-surface-600 group-hover:text-surface-400 flex-shrink-0 mt-0.5 transition-colors" aria-hidden="true" />
                      </div>
                    </Link>
                  )
                })}
              </div>
            )}
          </section>

          {/* ─── Right column ─────────────────────────────────────────── */}
          <aside className="space-y-5">

            {/* Laws */}
            {laws.length > 0 && (
              <section aria-label="Established laws in this issue">
                <h2 className="text-sm font-mono font-semibold text-white flex items-center gap-2 mb-3">
                  <Gavel className="h-4 w-4 text-gold" aria-hidden="true" />
                  Laws Passed
                  <span className="text-surface-500 font-normal">({lawTopics.length})</span>
                </h2>
                <div className="space-y-2">
                  {laws.map((law) => (
                    <Link
                      key={law.id}
                      href={`/law/${law.id}`}
                      className="block rounded-xl border border-gold/20 bg-gold/5 p-3 hover:bg-gold/10 hover:border-gold/30 transition-all group focus:outline-none focus:ring-2 focus:ring-gold/40"
                      aria-label={`Law: ${law.statement}`}
                    >
                      <div className="flex items-start gap-2">
                        <Gavel className="h-3.5 w-3.5 text-gold flex-shrink-0 mt-0.5" aria-hidden="true" />
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-white leading-snug line-clamp-2 group-hover:text-surface-100 transition-colors">
                            {law.statement}
                          </p>
                          <p className="text-[10px] font-mono text-surface-500 mt-1">
                            {Math.round(law.blue_pct ?? 0)}% consensus · {relTime(law.established_at)}
                          </p>
                        </div>
                      </div>
                    </Link>
                  ))}
                  {lawTopics.length > 8 && (
                    <Link
                      href={`/search?q=${encodeURIComponent(issue.title)}&tab=laws`}
                      className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors mt-1"
                    >
                      <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                      View all {lawTopics.length} laws
                    </Link>
                  )}
                </div>
              </section>
            )}

            {/* Top contributors */}
            {contributors.length > 0 && (
              <section aria-label="Top contributors in this issue">
                <h2 className="text-sm font-mono font-semibold text-white flex items-center gap-2 mb-3">
                  <Users className="h-4 w-4 text-purple" aria-hidden="true" />
                  Top Contributors
                </h2>
                <div className="space-y-2">
                  {contributors.map((c, i) => (
                    <Link
                      key={c.id}
                      href={`/profile/${c.username}`}
                      className="flex items-center gap-2.5 p-2.5 rounded-xl border border-surface-300 bg-surface-100 hover:bg-surface-200/60 hover:border-surface-400 transition-all group focus:outline-none focus:ring-2 focus:ring-for-500/40"
                      aria-label={`${c.display_name ?? c.username} — ${c.arg_count} arguments`}
                    >
                      <span className="text-[10px] font-mono text-surface-500 w-4 text-right flex-shrink-0">
                        {i + 1}
                      </span>
                      <Avatar
                        src={c.avatar_url}
                        fallback={c.display_name ?? c.username}
                        size="xs"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-xs font-semibold text-white truncate group-hover:text-surface-100">
                          {c.display_name ?? `@${c.username}`}
                        </p>
                        <p className="text-[10px] font-mono text-surface-500">
                          {c.arg_count} args · {fmtNum(c.upvotes)} upvotes
                        </p>
                      </div>
                    </Link>
                  ))}
                </div>
              </section>
            )}

            {/* Related issues */}
            {relatedIssues.length > 0 && (
              <section aria-label="Related policy issues">
                <h2 className="text-sm font-mono font-semibold text-white mb-3">
                  Related Issues
                </h2>
                <div className="space-y-2">
                  {relatedIssues.map((rel) => {
                    const RelIcon = ICON_MAP[rel.icon] ?? Landmark
                    const relColors = COLOR_CONFIG[rel.color] ?? COLOR_CONFIG['for']
                    return (
                      <Link
                        key={rel.slug}
                        href={`/issues/${rel.slug}`}
                        className="flex items-center gap-3 p-2.5 rounded-xl border border-surface-300 bg-surface-100 hover:bg-surface-200/60 hover:border-surface-400 transition-all group focus:outline-none focus:ring-2 focus:ring-for-500/40"
                        aria-label={`${rel.title} — ${rel.topic_count} topics`}
                      >
                        <div className={cn('flex items-center justify-center h-8 w-8 rounded-lg border flex-shrink-0', relColors.iconBg, relColors.border)}>
                          <RelIcon className={cn('h-4 w-4', relColors.iconColor)} aria-hidden="true" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-semibold text-white truncate group-hover:text-surface-100">{rel.title}</p>
                          <p className="text-[10px] font-mono text-surface-500">{fmtNum(rel.topic_count)} topics</p>
                        </div>
                        <ArrowRight className="h-3.5 w-3.5 text-surface-600 group-hover:text-surface-400 flex-shrink-0" aria-hidden="true" />
                      </Link>
                    )
                  })}
                </div>

                <Link
                  href="/issues"
                  className="flex items-center gap-1.5 mt-3 text-xs font-mono text-surface-500 hover:text-white transition-colors"
                >
                  <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
                  All issue areas
                </Link>
              </section>
            )}
          </aside>
        </div>

        {/* ─── Stats footer ────────────────────────────────────────────────── */}
        <footer className="mt-8 pt-6 border-t border-surface-300 flex flex-wrap items-center justify-between gap-4 text-xs font-mono text-surface-500">
          <div className="flex items-center gap-4">
            <span>{fmtNum(matched.length)} topics</span>
            <span aria-hidden="true">·</span>
            <span>{fmtNum(totalVotes)} total votes</span>
            <span aria-hidden="true">·</span>
            <span>{lawTopics.length} laws established</span>
            <span aria-hidden="true">·</span>
            <span>{failedTopics.length} failed</span>
          </div>
          <Link
            href={`/search?q=${encodeURIComponent(issue.title)}&tab=topics`}
            className="flex items-center gap-1.5 hover:text-white transition-colors"
            aria-label={`Search all ${issue.title} topics`}
          >
            <Search className="h-3.5 w-3.5" aria-hidden="true" />
            Full search
          </Link>
        </footer>
      </main>

      <BottomNav />
    </div>
  )
}
