import type { Metadata } from 'next'
import Link from 'next/link'
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Cpu,
  FlaskConical,
  GraduationCap,
  Heart,
  Landmark,
  Leaf,
  Music2,
  Scale,
  Scroll,
  TrendingUp,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'
import { THESIS_CATEGORIES } from '@/lib/types/thesis'
import type { ThesisCategory } from '@/lib/types/thesis'

export const dynamic = 'force-dynamic'

export const metadata: Metadata = {
  title: 'Thesis Categories · Lobby Market',
  description:
    'Browse civic theses by category — Economics, Politics, Technology, Science, Ethics, Philosophy, Culture, Health, Environment, and Education.',
  openGraph: {
    title: 'Thesis Categories · Lobby Market',
    description:
      'Explore long-term civic predictions and staked beliefs across 10 categories on Lobby Market.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Thesis Categories · Lobby Market',
    description: 'Browse civic theses by category — from Economics to Environment.',
  },
}

// ─── Category meta ────────────────────────────────────────────────────────────

const CATEGORY_META: Record<
  ThesisCategory,
  {
    label: string
    description: string
    icon: React.ComponentType<{ className?: string }>
    color: string
    bg: string
    border: string
  }
> = {
  economics: {
    label: 'Economics',
    description: 'Markets, inequality, trade, growth, and the future of money.',
    icon: TrendingUp,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
  },
  politics: {
    label: 'Politics',
    description: 'Elections, policy, governance, parties, and the exercise of power.',
    icon: Landmark,
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
  },
  technology: {
    label: 'Technology',
    description: 'AI, software, platforms, automation, and digital transformation.',
    icon: Cpu,
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
  },
  science: {
    label: 'Science',
    description: 'Research breakthroughs, medicine, physics, and discovery.',
    icon: FlaskConical,
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
  },
  ethics: {
    label: 'Ethics',
    description: 'Moral progress, social norms, rights, and human values.',
    icon: Scale,
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
  },
  philosophy: {
    label: 'Philosophy',
    description: 'Consciousness, meaning, epistemology, and the nature of existence.',
    icon: BookOpen,
    color: 'text-surface-400',
    bg: 'bg-surface-300/20',
    border: 'border-surface-400/30',
  },
  culture: {
    label: 'Culture',
    description: 'Art, media, identity, society, and the evolution of culture.',
    icon: Music2,
    color: 'text-pink-400',
    bg: 'bg-pink-500/10',
    border: 'border-pink-500/30',
  },
  health: {
    label: 'Health',
    description: 'Healthcare systems, longevity, pandemics, and wellbeing.',
    icon: Heart,
    color: 'text-green-400',
    bg: 'bg-green-500/10',
    border: 'border-green-500/30',
  },
  environment: {
    label: 'Environment',
    description: 'Climate, energy transition, biodiversity, and planetary boundaries.',
    icon: Leaf,
    color: 'text-teal-400',
    bg: 'bg-teal-500/10',
    border: 'border-teal-500/30',
  },
  education: {
    label: 'Education',
    description: 'Learning, universities, skills, credentials, and knowledge access.',
    icon: GraduationCap,
    color: 'text-indigo-400',
    bg: 'bg-indigo-500/10',
    border: 'border-indigo-500/30',
  },
}

// ─── Data fetching ─────────────────────────────────────────────────────────────

async function getCategoryCounts(): Promise<Map<string, number>> {
  try {
    const supabase = await createClient()
    const { data } = await supabase
      .from('civic_theses')
      .select('category')
      .eq('is_public', true)
      .eq('status', 'active')

    const counts = new Map<string, number>()
    for (const row of data ?? []) {
      counts.set(row.category, (counts.get(row.category) ?? 0) + 1)
    }
    return counts
  } catch {
    return new Map()
  }
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function ThesisCategoryIndexPage() {
  const counts = await getCategoryCounts()
  const total = THESIS_CATEGORIES.reduce((sum, cat) => sum + (counts.get(cat) ?? 0), 0)

  return (
    <div className="flex flex-col min-h-screen bg-surface-50">
      <TopBar />

      <main className="flex-1 max-w-lg mx-auto w-full px-4 pt-4 pb-24 space-y-4">
        {/* Back */}
        <Link
          href="/thesis"
          className="inline-flex items-center gap-1.5 text-xs text-surface-500 hover:text-for-400 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          All Theses
        </Link>

        {/* Header */}
        <div className="rounded-2xl border border-surface-300 bg-surface-100 p-5">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-surface-200 border border-surface-300">
              <Scroll className="h-5 w-5 text-surface-400" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white">Browse by Category</h1>
              <p className="text-xs text-surface-500">
                {total.toLocaleString()} active theses across {THESIS_CATEGORIES.length} domains
              </p>
            </div>
          </div>
          <p className="text-sm text-surface-400 leading-relaxed">
            Civic theses are long-term predictions staked on a resolution date. Browse by domain
            to find predictions from thinkers in your areas of interest.
          </p>
        </div>

        {/* Category grid */}
        <div className="space-y-2">
          {THESIS_CATEGORIES.map((cat) => {
            const m = CATEGORY_META[cat]
            const Icon = m.icon
            const count = counts.get(cat) ?? 0

            return (
              <Link
                key={cat}
                href={`/thesis/category/${cat}`}
                className={cn(
                  'flex items-center justify-between p-4 rounded-2xl border transition-all duration-200',
                  'bg-surface-100 border-surface-300',
                  'hover:border-surface-400 hover:bg-surface-200',
                  'group'
                )}
              >
                <div className="flex items-center gap-3">
                  <div className={cn('p-2 rounded-xl border flex-shrink-0', m.bg, m.border)}>
                    <Icon className={cn('h-5 w-5', m.color)} />
                  </div>
                  <div>
                    <p className="text-sm font-semibold text-white">{m.label}</p>
                    <p className="text-xs text-surface-500 mt-0.5 line-clamp-1">{m.description}</p>
                  </div>
                </div>
                <div className="flex items-center gap-3 flex-shrink-0">
                  {count > 0 && (
                    <span className={cn('text-xs font-mono font-semibold', m.color)}>
                      {count}
                    </span>
                  )}
                  <ArrowRight className="h-4 w-4 text-surface-500 opacity-0 group-hover:opacity-100 transition-opacity" />
                </div>
              </Link>
            )
          })}
        </div>

        {/* Related links */}
        <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-1.5">
          <p className="text-xs font-semibold text-surface-400 uppercase tracking-wider mb-2">Explore Theses</p>
          {[
            { href: '/thesis', label: 'All Theses', desc: 'Global thesis board' },
            { href: '/thesis/hot', label: 'Hot Theses', desc: 'Trending right now' },
            { href: '/thesis/following', label: 'Following', desc: 'From people you follow' },
            { href: '/leaderboard/theses', label: 'Oracle Board', desc: 'Top predictors' },
          ].map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="flex items-center justify-between p-2 rounded-lg hover:bg-surface-200 transition-colors group"
            >
              <div>
                <p className="text-sm font-medium text-white">{link.label}</p>
                <p className="text-[11px] text-surface-500">{link.desc}</p>
              </div>
              <ArrowRight className="h-3.5 w-3.5 text-surface-500 opacity-0 group-hover:opacity-100 transition-opacity" />
            </Link>
          ))}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
