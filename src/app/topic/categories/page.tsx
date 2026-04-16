import type { Metadata } from 'next'
import Link from 'next/link'
import {
  DollarSign,
  Landmark,
  Cpu,
  FlaskConical,
  Scale,
  Lightbulb,
  Palette,
  Heart,
  Leaf,
  GraduationCap,
  LayoutGrid,
  TrendingUp,
  Gavel,
  Zap,
  FileText,
  Tag,
  ArrowRight,
  Network,
  FileEdit,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Browse Topics by Category · Lobby Market',
  description:
    'Explore debates and consensus topics organized by category — Politics, Technology, Economics, Ethics, and more.',
  openGraph: {
    title: 'Browse Topics by Category · Lobby Market',
    description:
      'Explore debates and consensus topics organized by category.',
    type: 'website',
    siteName: 'Lobby Market',
  },
}

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_META: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; color: string; bg: string; border: string }
> = {
  Economics: {
    icon: DollarSign,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
  },
  Politics: {
    icon: Landmark,
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
  },
  Technology: {
    icon: Cpu,
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
  },
  Science: {
    icon: FlaskConical,
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
  },
  Ethics: {
    icon: Scale,
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
  },
  Philosophy: {
    icon: Lightbulb,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
  },
  Culture: {
    icon: Palette,
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
  },
  Health: {
    icon: Heart,
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
  },
  Environment: {
    icon: Leaf,
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
  },
  Education: {
    icon: GraduationCap,
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
  },
  Other: {
    icon: LayoutGrid,
    color: 'text-surface-500',
    bg: 'bg-surface-300/10',
    border: 'border-surface-400/30',
  },
  Uncategorized: {
    icon: LayoutGrid,
    color: 'text-surface-500',
    bg: 'bg-surface-300/10',
    border: 'border-surface-400/30',
  },
}

function getFallbackMeta(_name: string) {
  return {
    icon: LayoutGrid,
    color: 'text-surface-500',
    bg: 'bg-surface-300/10',
    border: 'border-surface-400/30',
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface CategoryStats {
  category: string
  total: number
  proposed_count: number
  active_count: number
  voting_count: number
  law_count: number
  failed_count: number
  avg_blue_pct: number
  total_votes: number
}

// ─── Category Card ────────────────────────────────────────────────────────────

function CategoryCard({ stats }: { stats: CategoryStats }) {
  const meta = CATEGORY_META[stats.category] ?? getFallbackMeta(stats.category)
  const Icon = meta.icon
  const forPct = Math.round(stats.avg_blue_pct)
  const againstPct = 100 - forPct

  const statusItems = [
    { label: 'Proposed', count: stats.proposed_count, color: 'bg-surface-400' },
    { label: 'Active', count: stats.active_count, color: 'bg-for-500' },
    { label: 'Voting', count: stats.voting_count, color: 'bg-purple' },
    { label: 'Law', count: stats.law_count, color: 'bg-emerald' },
  ].filter((s) => s.count > 0)

  return (
    <Link
      href={`/?category=${encodeURIComponent(stats.category)}`}
      className={cn(
        'group relative flex flex-col gap-4 rounded-2xl p-5',
        'bg-surface-100 border border-surface-300',
        'hover:border-surface-400 hover:bg-surface-200/60',
        'transition-all duration-200',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500/50'
      )}
    >
      {/* Header */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex items-center justify-center h-10 w-10 rounded-xl flex-shrink-0',
              meta.bg,
              'border',
              meta.border
            )}
          >
            <Icon className={cn('h-5 w-5', meta.color)} />
          </div>
          <div>
            <h2 className="font-mono font-semibold text-white text-base leading-tight">
              {stats.category}
            </h2>
            <p className="text-xs text-surface-500 font-mono mt-0.5">
              {stats.total} topic{stats.total !== 1 ? 's' : ''}
            </p>
          </div>
        </div>
        <ArrowRight
          className={cn(
            'h-4 w-4 text-surface-500 flex-shrink-0 mt-1',
            'group-hover:text-surface-300 group-hover:translate-x-0.5',
            'transition-all duration-150'
          )}
        />
      </div>

      {/* Vote bar */}
      {stats.total_votes > 0 && (
        <div className="space-y-1.5">
          <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-surface-300">
            <div
              className="bg-for-500 h-full transition-all duration-500"
              style={{ width: `${forPct}%` }}
            />
            <div
              className="bg-against-500 h-full transition-all duration-500"
              style={{ width: `${againstPct}%` }}
            />
          </div>
          <div className="flex justify-between text-[10px] font-mono">
            <span className="text-for-400">{forPct}% For</span>
            <span className="text-surface-500">
              {stats.total_votes.toLocaleString()} votes
            </span>
            <span className="text-against-400">{againstPct}% Against</span>
          </div>
        </div>
      )}

      {/* Status breakdown */}
      {statusItems.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {statusItems.map((item) => (
            <span
              key={item.label}
              className={cn(
                'inline-flex items-center gap-1 text-[10px] font-mono font-medium',
                'px-2 py-0.5 rounded-full bg-surface-200 border border-surface-300 text-surface-400'
              )}
            >
              <span
                className={cn('h-1.5 w-1.5 rounded-full inline-block flex-shrink-0', item.color)}
              />
              {item.count} {item.label}
            </span>
          ))}
        </div>
      )}

      {/* Laws badge */}
      {stats.law_count > 0 && (
        <div className="flex items-center gap-1.5 text-xs font-mono text-emerald">
          <Gavel className="h-3 w-3" />
          <span>
            {stats.law_count} established law{stats.law_count !== 1 ? 's' : ''}
          </span>
        </div>
      )}
    </Link>
  )
}

// ─── Summary stat bar ─────────────────────────────────────────────────────────

function SummaryBar({
  total,
  active,
  laws,
  votes,
}: {
  total: number
  active: number
  laws: number
  votes: number
}) {
  const items = [
    { icon: FileText, label: 'Total Topics', value: total.toLocaleString(), color: 'text-surface-400' },
    { icon: Zap, label: 'Active', value: active.toLocaleString(), color: 'text-for-400' },
    { icon: Gavel, label: 'Laws', value: laws.toLocaleString(), color: 'text-emerald' },
    { icon: TrendingUp, label: 'Votes Cast', value: votes.toLocaleString(), color: 'text-gold' },
  ]

  return (
    <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
      {items.map(({ icon: Icon, label, value, color }) => (
        <div
          key={label}
          className="flex flex-col gap-1 bg-surface-100 border border-surface-300 rounded-xl px-4 py-3"
        >
          <div className="flex items-center gap-1.5">
            <Icon className={cn('h-3.5 w-3.5', color)} />
            <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">
              {label}
            </span>
          </div>
          <span className={cn('text-xl font-mono font-bold', color)}>{value}</span>
        </div>
      ))}
    </div>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CategoriesPage() {
  const supabase = await createClient()

  // Fetch aggregated stats per category
  const { data: rows } = await supabase
    .from('topics')
    .select('category, status, blue_pct, total_votes')

  // Aggregate client-side (Supabase JS client doesn't support GROUP BY directly)
  const statsMap = new Map<string, CategoryStats>()

  for (const row of rows ?? []) {
    const cat = row.category ?? 'Uncategorized'
    const existing = statsMap.get(cat) ?? {
      category: cat,
      total: 0,
      proposed_count: 0,
      active_count: 0,
      voting_count: 0,
      law_count: 0,
      failed_count: 0,
      avg_blue_pct: 0,
      total_votes: 0,
    }

    existing.total += 1
    existing.total_votes += row.total_votes ?? 0
    // Running sum for average (divide later)
    existing.avg_blue_pct += row.blue_pct ?? 50

    switch (row.status) {
      case 'proposed': existing.proposed_count += 1; break
      case 'active': existing.active_count += 1; break
      case 'voting': existing.voting_count += 1; break
      case 'law': existing.law_count += 1; break
      case 'failed': existing.failed_count += 1; break
      default: break
    }

    statsMap.set(cat, existing)
  }

  // Compute averages
  const stats: CategoryStats[] = Array.from(statsMap.values())
    .map((s) => ({ ...s, avg_blue_pct: s.total > 0 ? s.avg_blue_pct / s.total : 50 }))
    .sort((a, b) => b.total - a.total)

  // Summary totals
  const totalTopics = stats.reduce((sum, s) => sum + s.total, 0)
  const totalActive = stats.reduce((sum, s) => sum + s.active_count + s.voting_count, 0)
  const totalLaws = stats.reduce((sum, s) => sum + s.law_count, 0)
  const totalVotes = stats.reduce((sum, s) => sum + s.total_votes, 0)

  // Sort: known categories first in defined order, then unknowns, Uncategorized last
  const KNOWN_ORDER = [
    'Politics', 'Economics', 'Technology', 'Science',
    'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education', 'Other',
  ]
  const sorted = [
    ...KNOWN_ORDER.map((c) => stats.find((s) => s.category === c)).filter(Boolean),
    ...stats.filter((s) => !KNOWN_ORDER.includes(s.category) && s.category !== 'Uncategorized'),
    stats.find((s) => s.category === 'Uncategorized'),
  ].filter(Boolean) as CategoryStats[]

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-6xl mx-auto px-4 py-8 pb-24 md:pb-8">
        {/* Hero */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-3">
            <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-for-500/10 border border-for-500/30">
              <Tag className="h-5 w-5 text-for-400" />
            </div>
            <div>
              <h1 className="font-mono text-3xl font-bold text-white">
                Categories
              </h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                Browse {totalTopics.toLocaleString()} topics across {sorted.length} categories
              </p>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <Link
                href="/topic/wiki/recent"
                className={cn(
                  'inline-flex items-center gap-2 px-3 py-2 rounded-lg',
                  'bg-emerald/10 border border-emerald/30 text-emerald',
                  'hover:bg-emerald/20 hover:border-emerald/50',
                  'text-xs font-mono font-medium transition-colors'
                )}
              >
                <FileEdit className="h-3.5 w-3.5" />
                Wiki Edits
              </Link>
              <Link
                href="/topic/graph"
                className={cn(
                  'inline-flex items-center gap-2 px-3 py-2 rounded-lg',
                  'bg-for-500/10 border border-for-500/30 text-for-400',
                  'hover:bg-for-500/20 hover:border-for-500/50',
                  'text-xs font-mono font-medium transition-colors'
                )}
              >
                <Network className="h-3.5 w-3.5" />
                Network
              </Link>
              <Link
                href="/"
                className={cn(
                  'inline-flex items-center gap-2 px-3 py-2 rounded-lg',
                  'bg-surface-200 border border-surface-300 text-surface-400',
                  'hover:bg-surface-300 hover:text-white',
                  'text-xs font-mono font-medium transition-colors'
                )}
              >
                All Topics
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            </div>
          </div>
        </div>

        {/* Summary bar */}
        <SummaryBar
          total={totalTopics}
          active={totalActive}
          laws={totalLaws}
          votes={totalVotes}
        />

        {/* Empty state */}
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-surface-200 border border-surface-300">
              <Tag className="h-8 w-8 text-surface-500" />
            </div>
            <div className="text-center">
              <p className="font-mono font-semibold text-white text-lg">No topics yet</p>
              <p className="text-sm text-surface-500 font-mono mt-1">
                Be the first to propose a topic.
              </p>
            </div>
            <Link
              href="/topic/create"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600 text-white text-sm font-mono font-medium hover:bg-for-500 transition-colors"
            >
              Create Topic
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sorted.map((s) => (
              <CategoryCard key={s.category} stats={s} />
            ))}
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
