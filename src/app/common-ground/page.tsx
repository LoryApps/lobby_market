import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  BarChart2,
  CheckCircle2,
  Gavel,
  HandshakeIcon,
  Scale,
  Swords,
  TrendingUp,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'

export const dynamic = 'force-dynamic'
export const revalidate = 900

export const metadata: Metadata = {
  title: 'Common Ground · Lobby Market',
  description:
    'Topics where the Lobby is converging toward consensus — strong majorities forming, laws established, and where society still divides.',
  openGraph: {
    title: 'Common Ground · Lobby Market',
    description: 'Where society agrees, where it divides — and how fast consensus is forming.',
    type: 'website',
    siteName: 'Lobby Market',
  },
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface Topic {
  id: string
  statement: string
  category: string | null
  status: string
  total_votes: number
  blue_pct: number
}

interface Law {
  id: string
  statement: string
  category: string | null
  total_votes: number
  blue_pct: number
  established_at: string
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function consensusStrength(bluePct: number): number {
  return Math.round(Math.abs(bluePct - 50) * 2)
}

function consensusDirection(bluePct: number): 'for' | 'against' {
  return bluePct >= 50 ? 'for' : 'against'
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const h = Math.floor(diff / 3_600_000)
  const d = Math.floor(h / 24)
  if (h < 1) return 'just now'
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

const CATEGORY_COLORS: Record<string, { text: string; bg: string; border: string }> = {
  Economics: { text: 'text-gold', bg: 'bg-gold/10', border: 'border-gold/30' },
  Politics: { text: 'text-for-400', bg: 'bg-for-500/10', border: 'border-for-500/30' },
  Technology: { text: 'text-purple', bg: 'bg-purple/10', border: 'border-purple/30' },
  Science: { text: 'text-emerald', bg: 'bg-emerald/10', border: 'border-emerald/30' },
  Ethics: { text: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30' },
  Philosophy: { text: 'text-purple', bg: 'bg-purple/10', border: 'border-purple/30' },
  Culture: { text: 'text-gold', bg: 'bg-gold/10', border: 'border-gold/30' },
  Health: { text: 'text-emerald', bg: 'bg-emerald/10', border: 'border-emerald/30' },
  Environment: { text: 'text-emerald', bg: 'bg-emerald/10', border: 'border-emerald/30' },
  Education: { text: 'text-for-400', bg: 'bg-for-500/10', border: 'border-for-500/30' },
  Other: { text: 'text-surface-500', bg: 'bg-surface-300/30', border: 'border-surface-400/30' },
}

function catColors(category: string | null) {
  return CATEGORY_COLORS[category ?? 'Other'] ?? CATEGORY_COLORS.Other
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionHeader({
  icon: Icon,
  iconColor,
  iconBg,
  title,
  subtitle,
}: {
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
  iconBg: string
  title: string
  subtitle?: string
}) {
  return (
    <div className="flex items-center gap-3 mb-4">
      <div className={cn('flex items-center justify-center h-9 w-9 rounded-xl border', iconBg)}>
        <Icon className={cn('h-4 w-4', iconColor)} />
      </div>
      <div>
        <h2 className="text-base font-bold text-white font-mono">{title}</h2>
        {subtitle && <p className="text-xs text-surface-500 mt-0.5">{subtitle}</p>}
      </div>
    </div>
  )
}

function StatPill({ label, value, color }: { label: string; value: string | number; color: string }) {
  return (
    <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 text-center">
      <p className={cn('text-2xl font-bold font-mono tabular-nums', color)}>
        {typeof value === 'number' ? value.toLocaleString() : value}
      </p>
      <p className="text-xs text-surface-500 mt-1">{label}</p>
    </div>
  )
}

function ConsensusBar({ bluePct }: { bluePct: number }) {
  const forPct = Math.round(bluePct)
  const againstPct = 100 - forPct
  const strength = consensusStrength(bluePct)
  const dir = consensusDirection(bluePct)

  return (
    <div className="space-y-1">
      <div className="flex items-center gap-2">
        <span className="text-[11px] font-mono text-for-400 w-8 text-right shrink-0">{forPct}%</span>
        <div className="flex-1 h-2 rounded-full bg-surface-300 overflow-hidden">
          <div className="h-full bg-for-500 rounded-l-full transition-all" style={{ width: `${forPct}%` }} />
        </div>
        <span className="text-[11px] font-mono text-against-400 w-8 shrink-0">{againstPct}%</span>
      </div>
      <div className="flex items-center justify-center gap-1.5">
        <div
          className={cn(
            'h-1 rounded-full transition-all',
            dir === 'for' ? 'bg-emerald/60' : 'bg-against-500/60'
          )}
          style={{ width: `${strength}%`, maxWidth: '120px' }}
        />
        <span
          className={cn(
            'text-[10px] font-mono',
            dir === 'for' ? 'text-emerald' : 'text-against-400'
          )}
        >
          {strength}% consensus
        </span>
      </div>
    </div>
  )
}

function EmptySection({ message }: { message: string }) {
  return (
    <div className="rounded-xl bg-surface-100 border border-surface-300 px-6 py-10 text-center">
      <p className="text-sm text-surface-500 font-mono">{message}</p>
    </div>
  )
}

// ─── Data fetch ───────────────────────────────────────────────────────────────

async function fetchData() {
  const supabase = await createClient()

  const [
    convergingRes,
    lawsRes,
    dividedCandidatesRes,
    totalLawsRes,
    totalTopicsRes,
    categoryRes,
  ] = await Promise.all([
    // Topics with strong majority forming
    supabase
      .from('topics')
      .select('id, statement, category, status, total_votes, blue_pct')
      .in('status', ['active', 'voting'])
      .gte('total_votes', 10)
      .or('blue_pct.gte.65,blue_pct.lte.35')
      .order('total_votes', { ascending: false })
      .limit(8),

    // Recently established laws
    supabase
      .from('laws')
      .select('id, statement, category, total_votes, blue_pct, established_at')
      .eq('is_active', true)
      .order('established_at', { ascending: false })
      .limit(5),

    // Topics near 50/50 for "battle lines"
    supabase
      .from('topics')
      .select('id, statement, category, status, total_votes, blue_pct')
      .in('status', ['active', 'voting'])
      .gte('total_votes', 10)
      .gte('blue_pct', 38)
      .lte('blue_pct', 62)
      .order('total_votes', { ascending: false })
      .limit(50),

    // Total law count
    supabase
      .from('laws')
      .select('id', { count: 'exact', head: true })
      .eq('is_active', true),

    // Total active topics
    supabase
      .from('topics')
      .select('id', { count: 'exact', head: true })
      .in('status', ['active', 'voting']),

    // Category consensus breakdown
    supabase
      .from('topics')
      .select('category, blue_pct, total_votes')
      .in('status', ['active', 'voting', 'law'])
      .gte('total_votes', 5),
  ])

  // Sort divided candidates by proximity to 50/50
  const mostDivided = (dividedCandidatesRes.data ?? [])
    .sort((a, b) => Math.abs((a.blue_pct ?? 50) - 50) - Math.abs((b.blue_pct ?? 50) - 50))
    .slice(0, 4) as Topic[]

  // Build category consensus map
  const catMap: Record<string, { totalStrength: number; count: number; votes: number }> = {}
  for (const t of categoryRes.data ?? []) {
    const cat = t.category ?? 'Other'
    if (!catMap[cat]) catMap[cat] = { totalStrength: 0, count: 0, votes: 0 }
    catMap[cat].totalStrength += consensusStrength(t.blue_pct ?? 50)
    catMap[cat].count += 1
    catMap[cat].votes += t.total_votes ?? 0
  }
  const categoryConsensus = Object.entries(catMap)
    .map(([category, d]) => ({
      category,
      avgStrength: Math.round(d.totalStrength / d.count),
      count: d.count,
      votes: d.votes,
    }))
    .sort((a, b) => b.avgStrength - a.avgStrength)
    .slice(0, 6)

  const convergingTopics = (convergingRes.data ?? []) as Topic[]
  const avgConsensus =
    convergingTopics.length > 0
      ? Math.round(
          convergingTopics.reduce((s, t) => s + consensusStrength(t.blue_pct), 0) /
            convergingTopics.length
        )
      : 0

  return {
    convergingTopics,
    recentLaws: (lawsRes.data ?? []) as Law[],
    mostDivided,
    categoryConsensus,
    stats: {
      totalLaws: totalLawsRes.count ?? 0,
      totalActiveTopics: totalTopicsRes.count ?? 0,
      convergingCount: convergingTopics.length,
      avgConsensus,
    },
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CommonGroundPage() {
  const data = await fetchData()
  const { convergingTopics, recentLaws, mostDivided, categoryConsensus, stats } = data

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 pt-6 pb-24 md:pb-12">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-emerald/10 border border-emerald/30">
              <HandshakeIcon className="h-5 w-5 text-emerald" />
            </div>
            <div>
              <h1 className="text-xl font-bold text-white font-mono">Common Ground</h1>
              <p className="text-xs text-surface-500 mt-0.5 font-mono">Where the Lobby finds consensus</p>
            </div>
          </div>
          <p className="text-sm text-surface-600">
            Topics where strong majorities are forming, laws already established, and where society still draws battle lines.
          </p>
        </div>

        {/* ── Stats ──────────────────────────────────────────────────────── */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-10">
          <StatPill label="Laws passed" value={stats.totalLaws} color="text-gold" />
          <StatPill label="Active topics" value={stats.totalActiveTopics} color="text-for-400" />
          <StatPill label="Near consensus" value={stats.convergingCount} color="text-emerald" />
          <StatPill
            label="Avg. consensus"
            value={`${stats.avgConsensus}%`}
            color="text-purple"
          />
        </div>

        {/* ── Converging topics ──────────────────────────────────────────── */}
        <section className="mb-10">
          <SectionHeader
            icon={TrendingUp}
            iconColor="text-emerald"
            iconBg="bg-emerald/10 border-emerald/30"
            title="Converging toward consensus"
            subtitle="Active topics with a strong majority forming"
          />

          {convergingTopics.length === 0 ? (
            <EmptySection message="No topics with a strong majority yet. Go vote." />
          ) : (
            <div className="space-y-2">
              {convergingTopics.map((topic) => {
                const col = catColors(topic.category)
                const dir = consensusDirection(topic.blue_pct)
                const strength = consensusStrength(topic.blue_pct)
                return (
                  <Link
                    key={topic.id}
                    href={`/topic/${topic.id}`}
                    className={cn(
                      'group block rounded-xl bg-surface-100 border px-4 py-3.5 transition-colors',
                      dir === 'for'
                        ? 'border-emerald/20 hover:border-emerald/40'
                        : 'border-against-900/40 hover:border-against-800/60'
                    )}
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <p className="text-sm font-medium text-white group-hover:text-for-300 transition-colors line-clamp-2 flex-1">
                        {topic.statement}
                      </p>
                      <ArrowRight className="h-4 w-4 text-surface-500 group-hover:text-for-400 transition-colors shrink-0 mt-0.5" />
                    </div>
                    <ConsensusBar bluePct={topic.blue_pct} />
                    <div className="flex items-center gap-2 flex-wrap mt-2.5">
                      {topic.category && (
                        <span
                          className={cn(
                            'text-[10px] font-mono px-2 py-0.5 rounded-full border',
                            col.text,
                            col.bg,
                            col.border
                          )}
                        >
                          {topic.category}
                        </span>
                      )}
                      <Badge variant={STATUS_BADGE[topic.status] ?? 'active'} className="text-[10px] px-1.5 py-0">
                        {topic.status === 'voting' ? 'VOTING' : topic.status.toUpperCase()}
                      </Badge>
                      <span className="text-[11px] font-mono text-surface-500">
                        {topic.total_votes.toLocaleString()} votes
                      </span>
                      <span
                        className={cn(
                          'ml-auto text-[11px] font-mono font-semibold',
                          dir === 'for' ? 'text-emerald' : 'text-against-400'
                        )}
                      >
                        {strength}% consensus
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </section>

        {/* ── Laws established ───────────────────────────────────────────── */}
        <section className="mb-10">
          <SectionHeader
            icon={Gavel}
            iconColor="text-gold"
            iconBg="bg-gold/10 border-gold/30"
            title="Consensus achieved"
            subtitle={`${stats.totalLaws.toLocaleString()} laws in the Lobby Codex — most recent first`}
          />

          {recentLaws.length === 0 ? (
            <EmptySection message="No laws yet. The Lobby is still deliberating." />
          ) : (
            <div className="space-y-2">
              {recentLaws.map((law) => {
                const col = catColors(law.category)
                const forPct = Math.round(law.blue_pct)
                const againstPct = 100 - forPct
                return (
                  <Link
                    key={law.id}
                    href={`/law/${law.id}`}
                    className="group block rounded-xl bg-surface-100 border border-gold/20 hover:border-gold/40 px-4 py-3.5 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="flex items-center gap-2 shrink-0">
                        <CheckCircle2 className="h-4 w-4 text-gold shrink-0" />
                      </div>
                      <p className="text-sm font-medium text-white group-hover:text-gold transition-colors line-clamp-2 flex-1">
                        {law.statement}
                      </p>
                      <ArrowRight className="h-4 w-4 text-surface-500 group-hover:text-gold transition-colors shrink-0 mt-0.5" />
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mb-2 pl-6">
                      {law.category && (
                        <span
                          className={cn(
                            'text-[10px] font-mono px-2 py-0.5 rounded-full border',
                            col.text,
                            col.bg,
                            col.border
                          )}
                        >
                          {law.category}
                        </span>
                      )}
                      <span className="text-[11px] font-mono text-surface-500">
                        {law.total_votes.toLocaleString()} votes
                      </span>
                      <span className="text-[11px] font-mono text-surface-600">
                        {relativeTime(law.established_at)}
                      </span>
                    </div>
                    <div className="flex items-center gap-2 pl-6">
                      <span className="text-[11px] font-mono text-for-400 w-8 text-right shrink-0">
                        {forPct}%
                      </span>
                      <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden">
                        <div
                          className="h-full bg-for-500 rounded-l-full"
                          style={{ width: `${forPct}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-mono text-against-400 w-8 shrink-0">
                        {againstPct}%
                      </span>
                    </div>
                  </Link>
                )
              })}

              <Link
                href="/law"
                className="group flex items-center justify-center gap-2 rounded-xl border border-surface-300/50 border-dashed px-4 py-3 text-sm text-surface-500 hover:text-white hover:border-surface-400 transition-colors"
              >
                View all {stats.totalLaws.toLocaleString()} laws in the Codex
                <ArrowRight className="h-4 w-4 group-hover:translate-x-0.5 transition-transform" />
              </Link>
            </div>
          )}
        </section>

        {/* ── Category consensus ─────────────────────────────────────────── */}
        {categoryConsensus.length > 0 && (
          <section className="mb-10">
            <SectionHeader
              icon={BarChart2}
              iconColor="text-purple"
              iconBg="bg-purple/10 border-purple/30"
              title="Consensus by category"
              subtitle="Average consensus strength across active topics"
            />

            <div className="rounded-xl bg-surface-100 border border-surface-300 divide-y divide-surface-300 overflow-hidden">
              {categoryConsensus.map((cat) => {
                const col = catColors(cat.category)
                return (
                  <Link
                    key={cat.category}
                    href={`/topic/categories#${cat.category.toLowerCase()}`}
                    className="group flex items-center gap-3 px-4 py-3 hover:bg-surface-200 transition-colors"
                  >
                    <span
                      className={cn(
                        'text-xs font-mono px-2 py-0.5 rounded-full border w-24 text-center shrink-0',
                        col.text,
                        col.bg,
                        col.border
                      )}
                    >
                      {cat.category}
                    </span>
                    <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden">
                      <div
                        className="h-full bg-emerald/60 rounded-full transition-all"
                        style={{ width: `${cat.avgStrength}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-mono text-emerald shrink-0 w-12 text-right">
                      {cat.avgStrength}%
                    </span>
                    <span className="text-[10px] font-mono text-surface-600 shrink-0 hidden sm:block">
                      {cat.count} topic{cat.count !== 1 ? 's' : ''}
                    </span>
                  </Link>
                )
              })}
            </div>
          </section>
        )}

        {/* ── Battle lines ───────────────────────────────────────────────── */}
        <section className="mb-10">
          <SectionHeader
            icon={Swords}
            iconColor="text-against-400"
            iconBg="bg-against-500/10 border-against-500/30"
            title="Battle lines"
            subtitle="Where the Lobby is most divided — closest to 50/50"
          />

          {mostDivided.length === 0 ? (
            <EmptySection message="No deeply divided topics right now. That's a good sign." />
          ) : (
            <div className="space-y-2">
              {mostDivided.map((topic) => {
                const col = catColors(topic.category)
                const distFrom50 = Math.abs(topic.blue_pct - 50)
                const forPct = Math.round(topic.blue_pct)
                return (
                  <Link
                    key={topic.id}
                    href={`/topic/${topic.id}`}
                    className="group block rounded-xl bg-surface-100 border border-against-900/40 hover:border-against-800/60 px-4 py-3.5 transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <p className="text-sm font-medium text-white group-hover:text-against-300 transition-colors line-clamp-2 flex-1">
                        {topic.statement}
                      </p>
                      <ArrowRight className="h-4 w-4 text-surface-500 group-hover:text-against-400 transition-colors shrink-0 mt-0.5" />
                    </div>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-mono text-for-400 w-8 text-right shrink-0">
                        {forPct}%
                      </span>
                      <div className="flex-1 h-1.5 rounded-full bg-surface-300 overflow-hidden">
                        <div
                          className="h-full bg-for-500 rounded-l-full"
                          style={{ width: `${forPct}%` }}
                        />
                      </div>
                      <span className="text-[11px] font-mono text-against-400 w-8 shrink-0">
                        {100 - forPct}%
                      </span>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap mt-2">
                      {topic.category && (
                        <span
                          className={cn(
                            'text-[10px] font-mono px-2 py-0.5 rounded-full border',
                            col.text,
                            col.bg,
                            col.border
                          )}
                        >
                          {topic.category}
                        </span>
                      )}
                      <span className="text-[11px] font-mono text-surface-500">
                        {topic.total_votes.toLocaleString()} votes
                      </span>
                      <span className="ml-auto text-[11px] font-mono text-against-400">
                        {distFrom50.toFixed(1)}pp from 50/50
                      </span>
                    </div>
                  </Link>
                )
              })}
            </div>
          )}
        </section>

        {/* ── Footer links ───────────────────────────────────────────────── */}
        <div className="mt-6 pt-6 border-t border-surface-300 flex flex-wrap gap-3">
          <Link href="/law" className="flex items-center gap-2 text-sm text-surface-500 hover:text-white transition-colors">
            <Gavel className="h-4 w-4" />
            Law Codex
          </Link>
          <Link href="/trending" className="flex items-center gap-2 text-sm text-surface-500 hover:text-white transition-colors">
            <TrendingUp className="h-4 w-4" />
            Trending
          </Link>
          <Link href="/digest" className="flex items-center gap-2 text-sm text-surface-500 hover:text-white transition-colors">
            <Scale className="h-4 w-4" />
            Weekly Digest
          </Link>
        </div>

        <p className="text-center text-[10px] font-mono text-surface-600 mt-8">
          Updates every 15 minutes · Lobby Market
        </p>
      </main>

      <BottomNav />
    </div>
  )
}
