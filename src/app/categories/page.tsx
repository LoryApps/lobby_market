import type { Metadata } from 'next'
import Link from 'next/link'
import {
  TrendingUp,
  Landmark,
  Cpu,
  FlaskConical,
  Scale,
  BookOpen,
  Music2,
  Heart,
  Leaf,
  GraduationCap,
  Gavel,
  Zap,
  BarChart2,
  ChevronRight,
  Flame,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'

export const dynamic = 'force-dynamic'
export const revalidate = 300

export const metadata: Metadata = {
  title: 'Categories · Lobby Market',
  description:
    'Browse debates by topic — Economics, Politics, Technology, Science, and more.',
  openGraph: {
    title: 'Categories · Lobby Market',
    description: 'Browse the full breadth of civic debate across every category.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Categories · Lobby Market',
    description: 'Browse debates by topic — Economics, Politics, Technology, and more.',
  },
}

// ─── Category config ──────────────────────────────────────────────────────────

const CATEGORY_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  Economics: TrendingUp,
  Politics: Landmark,
  Technology: Cpu,
  Science: FlaskConical,
  Ethics: Scale,
  Philosophy: BookOpen,
  Culture: Music2,
  Health: Heart,
  Environment: Leaf,
  Education: GraduationCap,
}

const CATEGORY_STYLE: Record<
  string,
  { color: string; bg: string; border: string; activeBg: string; description: string }
> = {
  Economics: {
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    activeBg: 'bg-gold/5',
    description: 'Markets, wealth, fiscal policy, and economic systems.',
  },
  Politics: {
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    activeBg: 'bg-for-500/5',
    description: 'Governance, elections, power, and democratic systems.',
  },
  Technology: {
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    activeBg: 'bg-purple/5',
    description: 'AI, innovation, digital rights, and the tech frontier.',
  },
  Science: {
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    activeBg: 'bg-emerald/5',
    description: 'Research, discovery, empirical debates, and scientific consensus.',
  },
  Ethics: {
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    activeBg: 'bg-against-500/5',
    description: 'Moral philosophy, rights, obligations, and value systems.',
  },
  Philosophy: {
    color: 'text-for-300',
    bg: 'bg-for-500/10',
    border: 'border-for-500/20',
    activeBg: 'bg-for-500/5',
    description: 'Epistemology, metaphysics, logic, and the big questions.',
  },
  Culture: {
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/20',
    activeBg: 'bg-gold/5',
    description: 'Art, media, identity, society, and cultural norms.',
  },
  Health: {
    color: 'text-against-300',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    activeBg: 'bg-against-500/5',
    description: 'Medicine, public health, mental wellness, and healthcare policy.',
  },
  Environment: {
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    activeBg: 'bg-emerald/5',
    description: 'Climate, ecology, sustainability, and environmental justice.',
  },
  Education: {
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    activeBg: 'bg-purple/5',
    description: 'Learning systems, curriculum, access, and pedagogy.',
  },
}

const ALL_CATEGORIES = Object.keys(CATEGORY_STYLE)

// ─── Types ────────────────────────────────────────────────────────────────────

interface CategoryStat {
  name: string
  total: number
  proposed: number
  active: number
  voting: number
  law: number
  failed: number
  most_contested: {
    id: string
    statement: string
    blue_pct: number
    total_votes: number
  } | null
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusPill(
  count: number,
  variant: 'active' | 'law' | 'voting' | 'proposed' | 'failed'
) {
  if (count === 0) return null

  const styles: Record<typeof variant, string> = {
    proposed: 'bg-surface-300/50 text-surface-500',
    active: 'bg-for-500/20 text-for-400',
    voting: 'bg-purple/20 text-purple',
    law: 'bg-gold/20 text-gold',
    failed: 'bg-against-500/20 text-against-400',
  }

  const labels: Record<typeof variant, string> = {
    proposed: 'Proposed',
    active: 'Active',
    voting: 'Voting',
    law: 'Law',
    failed: 'Failed',
  }

  return (
    <span
      className={cn(
        'inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold',
        styles[variant]
      )}
    >
      {count} {labels[variant]}
    </span>
  )
}

// ─── Category card ────────────────────────────────────────────────────────────

function CategoryCard({ stat }: { stat: CategoryStat }) {
  const style = CATEGORY_STYLE[stat.name]
  const Icon = CATEGORY_ICON[stat.name]

  const activeCount = stat.active + stat.voting

  return (
    <Link
      href={`/categories/${encodeURIComponent(stat.name.toLowerCase())}`}
      className={cn(
        'group relative flex flex-col gap-4 p-5 rounded-2xl',
        'bg-surface-100 border transition-all duration-200',
        style.border,
        'hover:border-opacity-60 hover:shadow-lg',
        stat.total === 0 && 'opacity-50 pointer-events-none'
      )}
    >
      {/* Icon + name */}
      <div className="flex items-start justify-between">
        <div className="flex items-center gap-3">
          <div
            className={cn(
              'flex items-center justify-center h-10 w-10 rounded-xl border',
              style.bg,
              style.border
            )}
          >
            {Icon && <Icon className={cn('h-5 w-5', style.color)} />}
          </div>
          <div>
            <h2 className="font-mono text-sm font-bold text-white leading-tight">
              {stat.name}
            </h2>
            <p className="font-mono text-[10px] text-surface-500 mt-0.5">
              {stat.total} topic{stat.total !== 1 ? 's' : ''}
            </p>
          </div>
        </div>

        <ChevronRight
          className={cn(
            'h-4 w-4 text-surface-500 transition-transform group-hover:translate-x-0.5',
            style.color,
            'opacity-0 group-hover:opacity-100'
          )}
          aria-hidden="true"
        />
      </div>

      {/* Description */}
      <p className="font-mono text-[11px] text-surface-500 leading-relaxed line-clamp-2">
        {style?.description}
      </p>

      {/* Status pills */}
      {stat.total > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {statusPill(activeCount, 'active')}
          {statusPill(stat.voting, 'voting')}
          {statusPill(stat.law, 'law')}
          {statusPill(stat.proposed, 'proposed')}
        </div>
      )}

      {/* Most contested */}
      {stat.most_contested && (
        <div className="mt-auto pt-3 border-t border-surface-300">
          <p className="font-mono text-[9px] uppercase tracking-widest text-surface-500 mb-1">
            Most contested
          </p>
          <p className="font-mono text-[11px] text-surface-600 line-clamp-2 leading-snug">
            {stat.most_contested.statement}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            {/* Vote bar */}
            <div className="flex-1 h-1 rounded-full bg-surface-300 overflow-hidden">
              <div
                className="h-full bg-for-500 rounded-full"
                style={{ width: `${stat.most_contested.blue_pct}%` }}
              />
            </div>
            <span className="font-mono text-[10px] text-surface-500 whitespace-nowrap">
              {stat.most_contested.blue_pct}%&nbsp;For
            </span>
          </div>
        </div>
      )}

      {/* Hot indicator for active categories */}
      {activeCount >= 3 && (
        <div
          className={cn(
            'absolute top-3 right-3 flex items-center gap-1 px-1.5 py-0.5 rounded-md',
            'bg-against-500/10 border border-against-500/30'
          )}
          title="Highly active"
        >
          <Flame className="h-2.5 w-2.5 text-against-400" aria-hidden="true" />
          <span className="font-mono text-[9px] text-against-400 font-semibold">HOT</span>
        </div>
      )}
    </Link>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CategoriesPage() {
  const supabase = await createClient()

  // Fetch all live topics with category + status info
  const { data: topics } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes')
    .in('status', ['proposed', 'active', 'voting', 'law', 'failed'])
    .not('category', 'is', null)

  const rows = topics ?? []

  // Build per-category stats
  const stats: CategoryStat[] = ALL_CATEGORIES.map((name) => {
    const cats = rows.filter((t) => t.category === name)

    const byStatus = (s: string) => cats.filter((t) => t.status === s).length

    // Most contested = topic closest to 50/50 with at least 1 vote
    const contested = cats
      .filter((t) => (t.total_votes ?? 0) > 0)
      .map((t) => ({
        ...t,
        _gap: Math.abs((t.blue_pct ?? 50) - 50),
      }))
      .sort((a, b) => a._gap - b._gap)[0]

    return {
      name,
      total: cats.length,
      proposed: byStatus('proposed'),
      active: byStatus('active'),
      voting: byStatus('voting'),
      law: byStatus('law'),
      failed: byStatus('failed'),
      most_contested: contested
        ? {
            id: contested.id,
            statement: contested.statement,
            blue_pct: Math.round(contested.blue_pct ?? 50),
            total_votes: contested.total_votes ?? 0,
          }
        : null,
    }
  })

  // Sort: categories with active topics first, then by total desc
  const sorted = [...stats].sort((a, b) => {
    const aActive = a.active + a.voting
    const bActive = b.active + b.voting
    if (bActive !== aActive) return bActive - aActive
    return b.total - a.total
  })

  const totalTopics = rows.length
  const totalLaws = rows.filter((t) => t.status === 'law').length
  const totalActive = rows.filter(
    (t) => t.status === 'active' || t.status === 'voting'
  ).length
  const categoriesWithActivity = sorted.filter(
    (s) => s.active + s.voting > 0
  ).length

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-5xl mx-auto px-4 py-8 pb-28 md:pb-12">

        {/* ── Hero ──────────────────────────────────────────────────────── */}
        <div className="mb-10">
          <div className="flex items-center gap-3 mb-4">
            <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-purple/10 border border-purple/30">
              <BarChart2 className="h-5 w-5 text-purple" />
            </div>
            <div>
              <h1 className="font-mono text-2xl font-bold text-white">
                Categories
              </h1>
              <p className="text-sm font-mono text-surface-500 mt-0.5">
                Browse debates by subject
              </p>
            </div>
          </div>

          {/* Platform stats bar */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mt-6">
            {[
              { label: 'Total topics', value: totalTopics, icon: BarChart2, color: 'text-for-400' },
              { label: 'Active now', value: totalActive, icon: Zap, color: 'text-emerald' },
              { label: 'Laws passed', value: totalLaws, icon: Gavel, color: 'text-gold' },
              { label: 'Hot categories', value: categoriesWithActivity, icon: Flame, color: 'text-against-400' },
            ].map(({ label, value, icon: Icon, color }) => (
              <div
                key={label}
                className="flex flex-col gap-1 p-4 rounded-xl bg-surface-100 border border-surface-300"
              >
                <div className="flex items-center gap-2">
                  <Icon className={cn('h-4 w-4', color)} aria-hidden="true" />
                  <span className="font-mono text-[10px] uppercase tracking-widest text-surface-500">
                    {label}
                  </span>
                </div>
                <span className="font-mono text-2xl font-bold text-white tabular-nums">
                  {value.toLocaleString()}
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* ── Category grid ──────────────────────────────────────────────── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {sorted.map((stat) => (
            <CategoryCard key={stat.name} stat={stat} />
          ))}
        </div>

        {/* ── Footer nudge ───────────────────────────────────────────────── */}
        <div className="mt-10 text-center">
          <p className="font-mono text-xs text-surface-500">
            Don&rsquo;t see your topic?{' '}
            <Link
              href="/"
              className="text-for-400 hover:text-for-300 transition-colors"
            >
              Propose it on the feed
            </Link>
          </p>
        </div>

      </main>

      <BottomNav />
    </div>
  )
}
