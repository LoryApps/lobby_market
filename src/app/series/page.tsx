import type { Metadata } from 'next'
import Link from 'next/link'
import { BookOpen, Gavel, ChevronRight, Flame, Layers, Scale, Zap } from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { CIVIC_SERIES } from '@/lib/config/series'
import { cn } from '@/lib/utils/cn'

export const metadata: Metadata = {
  title: 'Civic Series · Lobby Market',
  description:
    'Curated thematic reading paths through the most important civic debates. Pick a series and work through eight related topics — from AI to climate, democracy to economics.',
  openGraph: {
    title: 'Civic Series · Lobby Market',
    description:
      'Guided journeys through civic debates. Each series curates 6-10 related topics around a theme — from the AI Frontier to Economic Fault Lines.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Series · Lobby Market',
    description:
      'Curated reading paths through Lobby Market debates — themed series from AI and climate to democracy and healthcare.',
  },
}

// ─── Accent configs ───────────────────────────────────────────────────────────

const ACCENT_CONFIG = {
  blue: {
    border: 'border-for-500/30',
    bg: 'bg-for-500/5',
    hover: 'hover:border-for-500/50 hover:bg-for-500/10',
    badge: 'bg-for-500/15 text-for-400 border-for-500/30',
    icon: 'text-for-400',
    arrow: 'text-for-400 group-hover:translate-x-0.5',
    number: 'text-for-500/50',
  },
  red: {
    border: 'border-against-500/30',
    bg: 'bg-against-500/5',
    hover: 'hover:border-against-500/50 hover:bg-against-500/10',
    badge: 'bg-against-500/15 text-against-400 border-against-500/30',
    icon: 'text-against-400',
    arrow: 'text-against-400 group-hover:translate-x-0.5',
    number: 'text-against-500/50',
  },
  gold: {
    border: 'border-gold/30',
    bg: 'bg-gold/5',
    hover: 'hover:border-gold/50 hover:bg-gold/10',
    badge: 'bg-gold/15 text-gold border-gold/30',
    icon: 'text-gold',
    arrow: 'text-gold group-hover:translate-x-0.5',
    number: 'text-gold/50',
  },
  emerald: {
    border: 'border-emerald/30',
    bg: 'bg-emerald/5',
    hover: 'hover:border-emerald/50 hover:bg-emerald/10',
    badge: 'bg-emerald/15 text-emerald border-emerald/30',
    icon: 'text-emerald',
    arrow: 'text-emerald group-hover:translate-x-0.5',
    number: 'text-emerald/50',
  },
  purple: {
    border: 'border-purple/30',
    bg: 'bg-purple/5',
    hover: 'hover:border-purple/50 hover:bg-purple/10',
    badge: 'bg-purple/15 text-purple border-purple/30',
    icon: 'text-purple',
    arrow: 'text-purple group-hover:translate-x-0.5',
    number: 'text-purple/50',
  },
}

// ─── Special icons for certain series ─────────────────────────────────────────

function SeriesIcon({ accent }: { accent: keyof typeof ACCENT_CONFIG }) {
  const cfg = ACCENT_CONFIG[accent]
  const Icon =
    accent === 'gold' ? Gavel
    : accent === 'red' ? Flame
    : accent === 'emerald' ? Layers
    : accent === 'purple' ? Scale
    : Zap
  return <Icon className={cn('h-5 w-5', cfg.icon)} />
}

// ─── Series card ──────────────────────────────────────────────────────────────

function SeriesCard({
  slug,
  title,
  subtitle,
  description,
  accent,
  limit,
}: {
  slug: string
  title: string
  subtitle: string
  description: string
  accent: keyof typeof ACCENT_CONFIG
  limit: number
}) {
  const cfg = ACCENT_CONFIG[accent]

  return (
    <Link
      href={`/series/${slug}`}
      className={cn(
        'group flex flex-col rounded-2xl border p-5 transition-all duration-200',
        cfg.border,
        cfg.bg,
        cfg.hover,
        'cursor-pointer'
      )}
    >
      <div className="flex items-start justify-between gap-3 mb-3">
        <div className={cn('flex items-center justify-center h-9 w-9 rounded-xl border flex-shrink-0', cfg.border, 'bg-surface-100')}>
          <SeriesIcon accent={accent} />
        </div>
        <span className={cn('text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-1 rounded-full border', cfg.badge)}>
          {limit} topics
        </span>
      </div>

      <h2 className="font-mono text-base font-bold text-white mb-1 leading-snug group-hover:text-surface-600 transition-colors">
        {title}
      </h2>
      <p className={cn('text-[11px] font-mono font-medium mb-2', cfg.icon)}>
        {subtitle}
      </p>
      <p className="text-xs font-mono text-surface-500 leading-relaxed flex-1 mb-4 line-clamp-3">
        {description}
      </p>

      <div className="flex items-center gap-1.5">
        <span className="text-xs font-mono text-surface-600">Start series</span>
        <ChevronRight className={cn('h-3.5 w-3.5 flex-shrink-0 transition-transform duration-150', cfg.arrow)} />
      </div>
    </Link>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function SeriesPage() {
  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-4xl mx-auto px-4 pt-8 pb-24 md:pb-12">

        {/* ── Header ── */}
        <div className="flex items-center gap-3 mb-2">
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30">
            <BookOpen className="h-5 w-5 text-for-400" />
          </div>
          <div>
            <h1 className="font-mono text-2xl font-bold text-white">Civic Series</h1>
            <p className="text-sm font-mono text-surface-500 mt-0.5">Guided journeys through the Lobby&apos;s debates</p>
          </div>
        </div>

        <p className="text-sm font-mono text-surface-500 leading-relaxed mt-4 mb-8 max-w-xl">
          Each series groups 6–10 related debates around a shared theme — from the AI Frontier to Economic Fault Lines.
          Work through a series to understand an issue in depth, or jump straight to the debates you care about most.
        </p>

        {/* ── Series grid ── */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {CIVIC_SERIES.map((series) => (
            <SeriesCard
              key={series.slug}
              slug={series.slug}
              title={series.title}
              subtitle={series.subtitle}
              description={series.description}
              accent={series.accent}
              limit={series.limit}
            />
          ))}
        </div>

        {/* ── Footer note ── */}
        <div className="mt-12 rounded-2xl border border-surface-300 bg-surface-100 px-6 py-5 text-center">
          <p className="text-xs font-mono text-surface-500 mb-3">
            Series are platform-curated. Looking for something specific?
          </p>
          <div className="flex items-center justify-center gap-3 flex-wrap">
            <Link
              href="/categories"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-600 hover:text-white hover:border-surface-400 transition-colors"
            >
              Browse by category
            </Link>
            <Link
              href="/tags"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-600 hover:text-white hover:border-surface-400 transition-colors"
            >
              Browse by tag
            </Link>
            <Link
              href="/search"
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-600 hover:text-white hover:border-surface-400 transition-colors"
            >
              Search topics
            </Link>
          </div>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
