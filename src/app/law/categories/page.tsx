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
  Gavel,
  TrendingUp,
  ArrowRight,
  BarChart2,
  Tag,
  Trophy,
  Clock,
  Users,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'
import type { Law } from '@/lib/supabase/types'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Laws by Category · Lobby Market',
  description:
    'Explore every established law organised by category — see which domains have the strongest consensus and which policies are shaping the Lobby.',
  openGraph: {
    title: 'Laws by Category · Lobby Market',
    description:
      'Browse the full Law Codex grouped by category — Politics, Technology, Economics, Ethics, and more.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Laws by Category · Lobby Market',
    description: 'Every established law, organised by category.',
  },
}

// ─── Category meta ────────────────────────────────────────────────────────────

const CATEGORY_META: Record<
  string,
  { icon: React.ComponentType<{ className?: string }>; color: string; bg: string; border: string; ring: string }
> = {
  Economics:   { icon: DollarSign,    color: 'text-gold',          bg: 'bg-gold/10',         border: 'border-gold/30',         ring: 'ring-gold/20'         },
  Politics:    { icon: Landmark,      color: 'text-for-400',       bg: 'bg-for-500/10',      border: 'border-for-500/30',      ring: 'ring-for-500/20'      },
  Technology:  { icon: Cpu,           color: 'text-purple',        bg: 'bg-purple/10',       border: 'border-purple/30',       ring: 'ring-purple/20'       },
  Science:     { icon: FlaskConical,  color: 'text-emerald',       bg: 'bg-emerald/10',      border: 'border-emerald/30',      ring: 'ring-emerald/20'      },
  Ethics:      { icon: Scale,         color: 'text-against-400',   bg: 'bg-against-500/10',  border: 'border-against-500/30',  ring: 'ring-against-500/20'  },
  Philosophy:  { icon: Lightbulb,     color: 'text-gold',          bg: 'bg-gold/10',         border: 'border-gold/30',         ring: 'ring-gold/20'         },
  Culture:     { icon: Palette,       color: 'text-purple',        bg: 'bg-purple/10',       border: 'border-purple/30',       ring: 'ring-purple/20'       },
  Health:      { icon: Heart,         color: 'text-against-400',   bg: 'bg-against-500/10',  border: 'border-against-500/30',  ring: 'ring-against-500/20'  },
  Environment: { icon: Leaf,          color: 'text-emerald',       bg: 'bg-emerald/10',      border: 'border-emerald/30',      ring: 'ring-emerald/20'      },
  Education:   { icon: GraduationCap, color: 'text-for-400',       bg: 'bg-for-500/10',      border: 'border-for-500/30',      ring: 'ring-for-500/20'      },
}

const KNOWN_ORDER = [
  'Politics', 'Economics', 'Technology', 'Science',
  'Ethics', 'Philosophy', 'Culture', 'Health', 'Environment', 'Education',
]

function getFallbackMeta() {
  return {
    icon: LayoutGrid,
    color: 'text-surface-500',
    bg: 'bg-surface-300/10',
    border: 'border-surface-400/30',
    ring: 'ring-surface-400/10',
  }
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface LawCategoryStats {
  category: string
  law_count: number
  total_votes: number
  avg_blue_pct: number
  avg_quality: number
  most_recent: { id: string; statement: string; established_at: string } | null
  top_quality: { id: string; statement: string; quality_score: number } | null
}

function qualityScore(totalVotes: number, bluePct: number): number {
  const mandateStrength = Math.abs(bluePct - 50) / 50
  return Math.round(Math.sqrt(totalVotes) * mandateStrength * 100) / 100
}

// ─── Category Card ────────────────────────────────────────────────────────────

function CategoryCard({ stats }: { stats: LawCategoryStats }) {
  const meta = CATEGORY_META[stats.category] ?? getFallbackMeta()
  const Icon = meta.icon
  const forPct = Math.round(stats.avg_blue_pct)
  const againstPct = 100 - forPct

  // Consensus label
  const consensusLabel =
    forPct >= 90 ? 'Unanimous'
    : forPct >= 80 ? 'Strong'
    : forPct >= 70 ? 'Clear'
    : forPct >= 55 ? 'Slim'
    : 'Contested'

  const consensusColor =
    forPct >= 90 ? 'text-emerald'
    : forPct >= 80 ? 'text-for-300'
    : forPct >= 70 ? 'text-for-400'
    : forPct >= 55 ? 'text-gold'
    : 'text-against-400'

  return (
    <Link
      href={`/law?category=${encodeURIComponent(stats.category)}`}
      className={cn(
        'group relative flex flex-col gap-3 rounded-2xl p-5',
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
              {stats.law_count} law{stats.law_count !== 1 ? 's' : ''} established
            </p>
          </div>
        </div>
        <ArrowRight
          className={cn(
            'h-4 w-4 text-surface-600 flex-shrink-0 mt-1',
            'group-hover:text-surface-300 group-hover:translate-x-0.5',
            'transition-all duration-150'
          )}
        />
      </div>

      {/* Consensus bar */}
      {stats.total_votes > 0 && (
        <div className="space-y-1.5">
          <div className="flex h-1.5 w-full rounded-full overflow-hidden bg-surface-300">
            <div
              className="bg-for-500 h-full transition-all duration-500"
              style={{ width: `${forPct}%` }}
            />
            <div
              className="bg-against-500 h-full flex-1"
            />
          </div>
          <div className="flex items-center justify-between text-[10px] font-mono">
            <span className="text-for-400">{forPct}% For avg</span>
            <span className={cn('font-semibold', consensusColor)}>{consensusLabel}</span>
            <span className="text-against-400">{againstPct}% Ag avg</span>
          </div>
        </div>
      )}

      {/* Stats row */}
      <div className="flex items-center gap-3 pt-0.5">
        <div className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
          <Users className="h-3 w-3" />
          <span>{stats.total_votes.toLocaleString()} votes</span>
        </div>
        <div className="flex items-center gap-1 text-[11px] font-mono text-gold">
          <BarChart2 className="h-3 w-3" />
          <span>{stats.avg_quality.toFixed(1)} avg quality</span>
        </div>
      </div>

      {/* Most recent law */}
      {stats.most_recent && (
        <div className="border-t border-surface-300 pt-3 space-y-1">
          <p className="text-[10px] font-mono text-surface-500 flex items-center gap-1 uppercase tracking-wider">
            <Clock className="h-2.5 w-2.5" />
            Latest
          </p>
          <p className="text-xs font-mono text-surface-300 line-clamp-2 leading-relaxed">
            {stats.most_recent.statement}
          </p>
        </div>
      )}

      {/* Top quality law */}
      {stats.top_quality && (
        <div className="border-t border-surface-300 pt-3 space-y-1">
          <p className="text-[10px] font-mono text-gold flex items-center gap-1 uppercase tracking-wider">
            <Trophy className="h-2.5 w-2.5" />
            Top quality · {stats.top_quality.quality_score.toFixed(1)}
          </p>
          <p className="text-xs font-mono text-surface-300 line-clamp-2 leading-relaxed">
            {stats.top_quality.statement}
          </p>
        </div>
      )}
    </Link>
  )
}

// ─── Summary strip ────────────────────────────────────────────────────────────

function SummaryStrip({
  totalLaws,
  totalVotes,
  categoryCount,
  avgConsensus,
}: {
  totalLaws: number
  totalVotes: number
  categoryCount: number
  avgConsensus: number
}) {
  const items = [
    { icon: Gavel,      label: 'Laws',       value: totalLaws.toLocaleString(),         color: 'text-emerald' },
    { icon: Users,      label: 'Votes Cast', value: totalVotes.toLocaleString(),        color: 'text-for-400' },
    { icon: Tag,        label: 'Categories', value: categoryCount.toString(),           color: 'text-purple'  },
    { icon: TrendingUp, label: 'Avg Mandate', value: `${Math.round(avgConsensus)}%`,   color: 'text-gold'    },
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

export default async function LawCategoriesPage() {
  const supabase = await createClient()

  const { data: lawRows } = await supabase
    .from('laws')
    .select('id, statement, category, established_at, blue_pct, total_votes')
    .eq('is_active', true)
    .order('established_at', { ascending: false })

  const laws = (lawRows as Pick<Law, 'id' | 'statement' | 'category' | 'established_at' | 'blue_pct' | 'total_votes'>[] | null) ?? []

  // Aggregate per category
  const statsMap = new Map<
    string,
    {
      law_count: number
      total_votes: number
      blue_pct_sum: number
      quality_sum: number
      most_recent: { id: string; statement: string; established_at: string } | null
      top_quality: { id: string; statement: string; quality_score: number } | null
    }
  >()

  for (const law of laws) {
    const cat = law.category ?? 'Other'
    const bp = law.blue_pct ?? 50
    const tv = law.total_votes ?? 0
    const qs = qualityScore(tv, bp)

    const existing = statsMap.get(cat) ?? {
      law_count: 0,
      total_votes: 0,
      blue_pct_sum: 0,
      quality_sum: 0,
      most_recent: null,
      top_quality: null,
    }

    existing.law_count += 1
    existing.total_votes += tv
    existing.blue_pct_sum += bp
    existing.quality_sum += qs

    // Most recent — laws are already sorted desc by established_at so first match wins
    if (!existing.most_recent) {
      existing.most_recent = { id: law.id, statement: law.statement, established_at: law.established_at }
    }

    // Top quality
    if (!existing.top_quality || qs > existing.top_quality.quality_score) {
      existing.top_quality = { id: law.id, statement: law.statement, quality_score: qs }
    }

    statsMap.set(cat, existing)
  }

  const rawStats: LawCategoryStats[] = Array.from(statsMap.entries()).map(([cat, s]) => ({
    category: cat,
    law_count: s.law_count,
    total_votes: s.total_votes,
    avg_blue_pct: s.law_count > 0 ? s.blue_pct_sum / s.law_count : 50,
    avg_quality: s.law_count > 0 ? Math.round((s.quality_sum / s.law_count) * 10) / 10 : 0,
    most_recent: s.most_recent,
    top_quality: s.top_quality,
  }))

  // Sort: known categories in defined order first, then others
  const sorted: LawCategoryStats[] = [
    ...KNOWN_ORDER
      .map((c) => rawStats.find((s) => s.category === c))
      .filter((s): s is LawCategoryStats => s !== undefined),
    ...rawStats.filter((s) => !KNOWN_ORDER.includes(s.category)),
  ]

  // Summary totals
  const totalLaws = sorted.reduce((sum, s) => sum + s.law_count, 0)
  const totalVotes = sorted.reduce((sum, s) => sum + s.total_votes, 0)
  const avgConsensus = totalLaws > 0
    ? sorted.reduce((sum, s) => sum + s.avg_blue_pct * s.law_count, 0) / totalLaws
    : 50

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-6xl mx-auto px-4 py-8 pb-24 md:pb-8">
        {/* Hero */}
        <div className="mb-8">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-emerald/10 border border-emerald/30">
                <Tag className="h-5 w-5 text-emerald" />
              </div>
              <div>
                <h1 className="font-mono text-3xl font-bold text-white">
                  Law Categories
                </h1>
                <p className="text-sm font-mono text-surface-500 mt-0.5">
                  {totalLaws} established laws · {sorted.length} categories
                </p>
              </div>
            </div>

            {/* Nav links */}
            <div className="flex items-center gap-2 flex-shrink-0">
              <Link
                href="/law/quality"
                className={cn(
                  'inline-flex items-center gap-2 px-3 py-2 rounded-lg',
                  'bg-gold/10 border border-gold/30 text-gold text-xs font-mono font-medium',
                  'hover:bg-gold/20 hover:border-gold/50 transition-colors'
                )}
              >
                <Trophy className="h-4 w-4" />
                <span className="hidden sm:inline">Quality Index</span>
              </Link>
              <Link
                href="/law"
                className={cn(
                  'inline-flex items-center gap-2 px-3 py-2 rounded-lg',
                  'bg-surface-200 border border-surface-300 text-surface-400 text-xs font-mono font-medium',
                  'hover:bg-surface-300 hover:text-white transition-colors'
                )}
              >
                <Gavel className="h-4 w-4" />
                <span className="hidden sm:inline">Full Codex</span>
              </Link>
            </div>
          </div>
        </div>

        {/* Summary strip */}
        <SummaryStrip
          totalLaws={totalLaws}
          totalVotes={totalVotes}
          categoryCount={sorted.length}
          avgConsensus={avgConsensus}
        />

        {/* Empty state */}
        {sorted.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="flex items-center justify-center h-16 w-16 rounded-2xl bg-surface-200 border border-surface-300">
              <Gavel className="h-8 w-8 text-surface-500" />
            </div>
            <div className="text-center">
              <p className="font-mono font-semibold text-white text-lg">No laws yet</p>
              <p className="text-sm text-surface-500 font-mono mt-1">
                Laws appear here once community consensus reaches 67%.
              </p>
            </div>
            <Link
              href="/"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600 text-white text-sm font-mono font-medium hover:bg-for-500 transition-colors"
            >
              Browse Topics
              <ArrowRight className="h-3.5 w-3.5" />
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {sorted.map((s) => (
              <CategoryCard key={s.category} stats={s} />
            ))}
          </div>
        )}

        {/* Footer */}
        <p className="text-center text-xs font-mono text-surface-600 mt-10">
          Each category links to the full Codex filtered by that category.{' '}
          <Link href="/law/quality" className="text-gold hover:text-gold/80 transition-colors">
            View Quality Rankings →
          </Link>
        </p>
      </main>

      <BottomNav />
    </div>
  )
}
