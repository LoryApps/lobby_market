import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowRight,
  Award,
  BarChart2,
  BookOpen,
  Clock,
  FileWarning,
  Gavel,
  GitCompare,
  Globe,
  Network,
  Scale,
  Shield,
  Star,
  Tag,
  Trophy,
  Users,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'
import type { Law } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Laws · Lobby Market',
  description:
    'Every law established by community consensus on Lobby Market — browse the full Codex, explore the network graph, compare laws, and track conflicts.',
  openGraph: {
    title: 'Laws · Lobby Market',
    description:
      'Browse every civic law established by democratic consensus. The full Codex, graph network, conflicts, reviews, and more.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Laws · Lobby Market',
    description: 'Every law made by the Lobby — browse, compare, review, and track the civic Codex.',
  },
}

// ─── Tool nav tiles ───────────────────────────────────────────────────────────

const LAW_TOOLS = [
  {
    href: '/law',
    label: 'The Codex',
    description: 'Browse all established laws with search & filters',
    icon: BookOpen,
    accent: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    hoverBorder: 'hover:border-emerald/60',
  },
  {
    href: '/law/today',
    label: 'Law of the Day',
    description: 'Daily spotlight on one established law',
    icon: Award,
    accent: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    hoverBorder: 'hover:border-gold/60',
  },
  {
    href: '/law/timeline',
    label: 'Timeline',
    description: 'Chronological history of all ratifications',
    icon: Clock,
    accent: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    hoverBorder: 'hover:border-for-500/60',
  },
  {
    href: '/laws/atlas',
    label: 'Atlas',
    description: 'Heatmap of laws by scope × category',
    icon: Globe,
    accent: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    hoverBorder: 'hover:border-for-500/60',
  },
  {
    href: '/law/graph',
    label: 'Law Graph',
    description: 'Network graph of linked and related laws',
    icon: Network,
    accent: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    hoverBorder: 'hover:border-purple/60',
  },
  {
    href: '/law/compare',
    label: 'Compare',
    description: 'Side-by-side comparison of two laws',
    icon: GitCompare,
    accent: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    hoverBorder: 'hover:border-emerald/60',
  },
  {
    href: '/law/categories',
    label: 'Categories',
    description: 'Laws grouped by civic category',
    icon: Tag,
    accent: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    hoverBorder: 'hover:border-gold/60',
  },
  {
    href: '/law/quality',
    label: 'Quality Index',
    description: 'Laws ranked by debate depth and consensus strength',
    icon: Trophy,
    accent: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    hoverBorder: 'hover:border-gold/60',
  },
  {
    href: '/law/ratings',
    label: 'Ratings',
    description: 'Citizen star ratings for each established law',
    icon: Star,
    accent: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    hoverBorder: 'hover:border-gold/60',
  },
  {
    href: '/law/reviews',
    label: 'Reviews',
    description: 'Written citizen reviews reflecting on each law',
    icon: BookOpen,
    accent: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    hoverBorder: 'hover:border-for-500/60',
  },
  {
    href: '/law/conflicts',
    label: 'Conflicts',
    description: 'Detect contradictions between established laws',
    icon: Scale,
    accent: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    hoverBorder: 'hover:border-against-500/60',
  },
  {
    href: '/petitions',
    label: 'Petitions',
    description: 'Challenge or reopen laws with citizen petitions',
    icon: FileWarning,
    accent: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    hoverBorder: 'hover:border-against-500/60',
  },
  {
    href: '/law/challenges',
    label: 'Challenges',
    description: 'Formal constitutional, factual & ethical challenges',
    icon: Shield,
    accent: 'text-against-300',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    hoverBorder: 'hover:border-against-500/60',
  },
] as const

// ─── Category colors ──────────────────────────────────────────────────────────

const CAT_COLOR: Record<string, string> = {
  Economics: 'bg-gold',
  Politics: 'bg-for-500',
  Technology: 'bg-purple',
  Science: 'bg-emerald',
  Ethics: 'bg-against-500',
  Philosophy: 'bg-for-400',
  Culture: 'bg-gold',
  Health: 'bg-emerald',
  Environment: 'bg-emerald',
  Education: 'bg-for-400',
}

function catColor(cat: string) {
  return CAT_COLOR[cat] ?? 'bg-surface-500'
}

function formatNum(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`
  return n.toString()
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const d = Math.floor(diff / 86_400_000)
  if (d === 0) return 'today'
  if (d === 1) return 'yesterday'
  if (d < 30) return `${d}d ago`
  if (d < 365) return `${Math.floor(d / 30)}mo ago`
  return `${Math.floor(d / 365)}y ago`
}

export default async function LawsHubPage() {
  const supabase = await createClient()

  const { data: lawRows } = await supabase
    .from('laws')
    .select('id, statement, category, established_at, blue_pct, total_votes, topic_id')
    .eq('is_active', true)
    .order('established_at', { ascending: false })

  const laws = (lawRows as Pick<
    Law,
    'id' | 'statement' | 'category' | 'established_at' | 'blue_pct' | 'total_votes' | 'topic_id'
  >[] | null) ?? []

  const totalLaws = laws.length
  const totalVotes = laws.reduce((s, l) => s + (l.total_votes ?? 0), 0)
  const avgConsensus = totalLaws
    ? Math.round(laws.reduce((s, l) => s + (l.blue_pct ?? 50), 0) / totalLaws)
    : 0

  // Category breakdown
  const catMap = new Map<string, number>()
  for (const l of laws) {
    const c = l.category ?? 'Other'
    catMap.set(c, (catMap.get(c) ?? 0) + 1)
  }
  const categories = Array.from(catMap.entries())
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)

  const maxCatCount = categories[0]?.[1] ?? 1

  const recentLaws = laws.slice(0, 6)

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-5xl mx-auto px-4 py-8 pb-28 md:pb-12">

        {/* ── Hero ─────────────────────────────────────────────────────── */}
        <div className="mb-8 flex items-start justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-gold/10 border border-gold/30">
              <Gavel className="h-5 w-5 text-gold" />
            </div>
            <div>
              <h1 className="font-mono text-3xl font-bold text-white">Laws</h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                Established by community consensus · The civic record
              </p>
            </div>
          </div>

          <Link
            href="/law"
            className={cn(
              'inline-flex items-center gap-2 px-4 py-2 rounded-xl',
              'bg-gold/10 border border-gold/30 text-gold text-sm font-mono font-semibold',
              'hover:bg-gold/20 hover:border-gold/50 transition-colors flex-shrink-0'
            )}
          >
            Browse All
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>

        {/* ── Stats strip ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-3 gap-3 mb-8">
          {[
            { label: 'Laws Established', value: totalLaws, icon: Gavel, color: 'text-gold' },
            { label: 'Total Votes Cast', value: formatNum(totalVotes), icon: Users, color: 'text-for-400' },
            { label: 'Avg Consensus', value: `${avgConsensus}%`, icon: BarChart2, color: 'text-emerald' },
          ].map(({ label, value, icon: Icon, color }) => (
            <div
              key={label}
              className="rounded-2xl bg-surface-100 border border-surface-300 p-5"
            >
              <div className="flex items-center gap-1.5 text-xs font-mono text-surface-500 uppercase tracking-wider mb-2">
                <Icon className={cn('h-3.5 w-3.5', color)} />
                {label}
              </div>
              <p className={cn('font-mono text-2xl font-bold', color)}>{value}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">

          {/* ── Recent laws ───────────────────────────────────────────── */}
          <div className="lg:col-span-2">
            <div className="flex items-center justify-between mb-3">
              <h2 className="font-mono text-sm font-bold text-white uppercase tracking-wider">
                Recently Established
              </h2>
              <Link
                href="/law/timeline"
                className="text-xs font-mono text-for-400 hover:text-for-300 transition-colors flex items-center gap-1"
              >
                Full timeline <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
            <div className="space-y-2">
              {recentLaws.length === 0 ? (
                <div className="rounded-2xl bg-surface-100 border border-surface-300 p-8 text-center">
                  <Gavel className="h-8 w-8 text-surface-500 mx-auto mb-2" />
                  <p className="font-mono text-sm text-surface-500">No laws established yet</p>
                </div>
              ) : recentLaws.map((law, i) => {
                const forPct = Math.round(law.blue_pct ?? 50)
                return (
                  <Link
                    key={law.id}
                    href={`/law/${law.id}`}
                    className={cn(
                      'block rounded-xl bg-surface-100 border border-surface-300 p-4',
                      'hover:border-gold/40 hover:bg-surface-200/60 transition-all group'
                    )}
                  >
                    <div className="flex items-start gap-3">
                      <div className="flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-lg bg-gold/10 border border-gold/30 mt-0.5">
                        <span className="font-mono text-[10px] font-bold text-gold">#{i + 1}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-mono text-sm font-semibold text-white group-hover:text-gold transition-colors line-clamp-2">
                          {law.statement}
                        </p>
                        <div className="flex items-center gap-3 mt-2">
                          {law.category && (
                            <span className="text-[11px] font-mono text-surface-500">
                              {law.category}
                            </span>
                          )}
                          <span className="text-[11px] font-mono text-surface-600">
                            {relativeTime(law.established_at)}
                          </span>
                          <span className="text-[11px] font-mono text-for-400">
                            {forPct}% FOR
                          </span>
                        </div>
                        {/* Consensus bar */}
                        <div className="mt-2 h-1 rounded-full bg-surface-300 overflow-hidden">
                          <div
                            className="h-full rounded-full bg-gradient-to-r from-for-600 to-for-400"
                            style={{ width: `${forPct}%` }}
                          />
                        </div>
                      </div>
                      <ArrowRight className="h-4 w-4 text-surface-600 group-hover:text-gold transition-colors flex-shrink-0 mt-0.5" />
                    </div>
                  </Link>
                )
              })}
            </div>
          </div>

          {/* ── Category breakdown ────────────────────────────────────── */}
          <div>
            <h2 className="font-mono text-sm font-bold text-white uppercase tracking-wider mb-3">
              By Category
            </h2>
            <div className="rounded-2xl bg-surface-100 border border-surface-300 p-4 space-y-3">
              {categories.length === 0 ? (
                <p className="text-xs font-mono text-surface-500 text-center py-4">No data yet</p>
              ) : categories.map(([cat, count]) => (
                <Link
                  key={cat}
                  href={`/law/categories?cat=${encodeURIComponent(cat)}`}
                  className="group flex items-center gap-3 hover:opacity-80 transition-opacity"
                >
                  <span className="w-20 flex-shrink-0 text-[11px] font-mono text-surface-400 group-hover:text-white transition-colors truncate">
                    {cat}
                  </span>
                  <div className="flex-1 h-2 rounded-full bg-surface-300 overflow-hidden">
                    <div
                      className={cn('h-full rounded-full', catColor(cat))}
                      style={{ width: `${(count / maxCatCount) * 100}%` }}
                    />
                  </div>
                  <span className="w-5 flex-shrink-0 text-[11px] font-mono text-surface-500 text-right">
                    {count}
                  </span>
                </Link>
              ))}

              <div className="pt-2 border-t border-surface-300">
                <Link
                  href="/laws/atlas"
                  className="flex items-center gap-1.5 text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors"
                >
                  <Globe className="h-3 w-3" />
                  View full atlas
                </Link>
              </div>
            </div>

            {/* Quick badge */}
            <div className="mt-3 rounded-xl bg-gold/5 border border-gold/20 p-3 text-center">
              <Gavel className="h-5 w-5 text-gold mx-auto mb-1.5" />
              <p className="font-mono text-xs text-surface-400">
                A law requires <span className="text-gold font-bold">≥ 67%</span> consensus
                and a minimum vote quorum.
              </p>
            </div>
          </div>
        </div>

        {/* ── Tools grid ───────────────────────────────────────────────── */}
        <div className="mb-4">
          <h2 className="font-mono text-sm font-bold text-white uppercase tracking-wider mb-4">
            Explore the Codex
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
            {LAW_TOOLS.map(({ href, label, description, icon: Icon, accent, bg, border, hoverBorder }) => (
              <Link
                key={href}
                href={href}
                className={cn(
                  'flex flex-col gap-2 rounded-xl p-4',
                  'bg-surface-100 border transition-all',
                  border,
                  hoverBorder,
                  'hover:bg-surface-200/60'
                )}
              >
                <div className={cn('flex items-center justify-center h-8 w-8 rounded-lg', bg, 'border', border)}>
                  <Icon className={cn('h-4 w-4', accent)} />
                </div>
                <div>
                  <p className={cn('font-mono text-xs font-bold', accent)}>{label}</p>
                  <p className="text-[11px] font-mono text-surface-500 mt-0.5 line-clamp-2">
                    {description}
                  </p>
                </div>
              </Link>
            ))}
          </div>
        </div>

      </main>

      <BottomNav />
    </div>
  )
}
