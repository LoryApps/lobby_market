import type { Metadata } from 'next'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import {
  ArrowLeft,
  ArrowRight,
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
  Zap,
  FileText,
  TrendingUp,
  Vote,
  Tag,
  Clock,
  Flame,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'
import type { Topic } from '@/lib/supabase/types'

// ─── Category config ───────────────────────────────────────────────────────────

const CATEGORY_META: Record<
  string,
  {
    icon: React.ComponentType<{ className?: string }>
    color: string
    bg: string
    border: string
    ring: string
    label: string
  }
> = {
  economics: {
    icon: DollarSign,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    ring: 'ring-gold/20',
    label: 'Economics',
  },
  politics: {
    icon: Landmark,
    color: 'text-for-400',
    bg: 'bg-for-500/10',
    border: 'border-for-500/30',
    ring: 'ring-for-500/20',
    label: 'Politics',
  },
  technology: {
    icon: Cpu,
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
    ring: 'ring-purple/20',
    label: 'Technology',
  },
  science: {
    icon: FlaskConical,
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    ring: 'ring-emerald/20',
    label: 'Science',
  },
  ethics: {
    icon: Scale,
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
    ring: 'ring-against-500/20',
    label: 'Ethics',
  },
  philosophy: {
    icon: Lightbulb,
    color: 'text-for-300',
    bg: 'bg-for-400/10',
    border: 'border-for-400/30',
    ring: 'ring-for-400/20',
    label: 'Philosophy',
  },
  culture: {
    icon: Palette,
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
    ring: 'ring-gold/20',
    label: 'Culture',
  },
  health: {
    icon: Heart,
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    ring: 'ring-emerald/20',
    label: 'Health',
  },
  environment: {
    icon: Leaf,
    color: 'text-emerald',
    bg: 'bg-emerald/10',
    border: 'border-emerald/30',
    ring: 'ring-emerald/20',
    label: 'Environment',
  },
  education: {
    icon: GraduationCap,
    color: 'text-for-300',
    bg: 'bg-for-400/10',
    border: 'border-for-400/30',
    ring: 'ring-for-400/20',
    label: 'Education',
  },
}

const FALLBACK_META = {
  icon: LayoutGrid,
  color: 'text-surface-400',
  bg: 'bg-surface-200',
  border: 'border-surface-400',
  ring: 'ring-surface-400/20',
  label: 'Other',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function slugToCategory(slug: string): string {
  const meta = CATEGORY_META[slug.toLowerCase()]
  return meta?.label ?? slug.charAt(0).toUpperCase() + slug.slice(1)
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  if (d < 30) return `${Math.floor(d / 7)}w ago`
  if (d < 365) return `${Math.floor(d / 30)}mo ago`
  return `${Math.floor(d / 365)}y ago`
}

// ─── generateMetadata ──────────────────────────────────────────────────────────

interface PageProps {
  params: { slug: string }
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const categoryLabel = slugToCategory(params.slug)
  const title = `${categoryLabel} Topics · Lobby Market`
  const description = `Browse all ${categoryLabel.toLowerCase()} debates, laws, and consensus topics on Lobby Market.`

  return {
    title,
    description,
    openGraph: {
      title,
      description,
      type: 'website',
      siteName: 'Lobby Market',
    },
    twitter: {
      card: 'summary',
      title,
      description,
    },
  }
}

export const dynamic = 'force-dynamic'

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatPill({
  icon: Icon,
  label,
  value,
  color,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string | number
  color: string
}) {
  return (
    <div className="flex items-center gap-2 px-4 py-3 rounded-xl bg-surface-100 border border-surface-300">
      <Icon className={cn('h-4 w-4 flex-shrink-0', color)} aria-hidden="true" />
      <div>
        <p className={cn('font-mono text-base font-bold leading-none', color)}>
          {typeof value === 'number' ? value.toLocaleString() : value}
        </p>
        <p className="text-[10px] font-mono text-surface-500 mt-0.5 uppercase tracking-wide">
          {label}
        </p>
      </div>
    </div>
  )
}

const STATUS_CONFIG: Record<
  string,
  { label: string; badgeVariant: 'proposed' | 'active' | 'law' | 'failed'; dotColor: string }
> = {
  proposed: { label: 'Proposed', badgeVariant: 'proposed', dotColor: 'bg-surface-500' },
  active: { label: 'Active', badgeVariant: 'active', dotColor: 'bg-for-500' },
  voting: { label: 'Voting', badgeVariant: 'active', dotColor: 'bg-purple' },
  law: { label: 'Law', badgeVariant: 'law', dotColor: 'bg-gold' },
  failed: { label: 'Failed', badgeVariant: 'failed', dotColor: 'bg-against-500' },
}

function TopicRow({ topic }: { topic: Topic }) {
  const forPct = Math.round(topic.blue_pct ?? 50)
  const againstPct = 100 - forPct
  const statusCfg = STATUS_CONFIG[topic.status] ?? STATUS_CONFIG.proposed

  return (
    <Link
      href={`/topic/${topic.id}`}
      className={cn(
        'group flex flex-col gap-3 p-4 rounded-xl',
        'bg-surface-100 border border-surface-300',
        'hover:border-surface-400 hover:bg-surface-200/50',
        'transition-colors'
      )}
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <p className="text-sm font-mono font-semibold text-white leading-snug group-hover:text-for-300 transition-colors line-clamp-2">
            {topic.statement}
          </p>
          <div className="flex items-center gap-2 mt-1.5">
            <Badge variant={statusCfg.badgeVariant}>
              {statusCfg.label}
            </Badge>
            {topic.scope && topic.scope !== 'Global' && (
              <span className="text-[10px] font-mono text-surface-500 uppercase tracking-wide">
                {topic.scope}
              </span>
            )}
            <span className="text-[10px] font-mono text-surface-600 ml-auto">
              {relativeTime(topic.created_at)}
            </span>
          </div>
        </div>
        <ArrowRight className="h-4 w-4 text-surface-600 group-hover:text-for-400 flex-shrink-0 mt-0.5 transition-colors" aria-hidden="true" />
      </div>

      {/* Vote bar */}
      <div>
        <div className="flex justify-between text-[10px] font-mono mb-1">
          <span className="text-for-400 font-semibold">{forPct}% FOR</span>
          <span className="text-surface-500">{topic.total_votes.toLocaleString()} votes</span>
          <span className="text-against-400 font-semibold">{againstPct}% AGAINST</span>
        </div>
        <div className="h-1.5 rounded-full overflow-hidden bg-against-700/50">
          <div
            className="h-full bg-for-500 rounded-full transition-all"
            style={{ width: `${forPct}%` }}
            aria-hidden="true"
          />
        </div>
      </div>
    </Link>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function CategoryPage({ params }: PageProps) {
  const slug = params.slug.toLowerCase()
  const meta = CATEGORY_META[slug] ?? FALLBACK_META
  const categoryLabel = meta.label !== 'Other' ? meta.label : slugToCategory(params.slug)

  // Validate: only allow known categories (or fall through to notFound for truly unknown slugs)
  const isKnownCategory = slug in CATEGORY_META
  const supabase = await createClient()

  // Fetch all topics for this category
  const { data: allTopics, error } = await supabase
    .from('topics')
    .select('id, statement, status, blue_pct, total_votes, category, scope, created_at, updated_at')
    .eq('category', categoryLabel)
    .order('total_votes', { ascending: false })
    .limit(200)

  if (error || (!isKnownCategory && (!allTopics || allTopics.length === 0))) {
    notFound()
  }

  const topics = (allTopics ?? []) as Topic[]

  // Derive stats
  const total = topics.length
  const proposed = topics.filter((t) => t.status === 'proposed').length
  const active = topics.filter((t) => t.status === 'active').length
  const voting = topics.filter((t) => t.status === 'voting').length
  const laws = topics.filter((t) => t.status === 'law').length
  const failed = topics.filter((t) => t.status === 'failed').length
  const totalVotes = topics.reduce((sum, t) => sum + (t.total_votes ?? 0), 0)
  const avgForPct =
    topics.length > 0
      ? Math.round(topics.reduce((sum, t) => sum + (t.blue_pct ?? 50), 0) / topics.length)
      : 50

  // Split topics by status for sections
  const lawTopics = topics.filter((t) => t.status === 'law')
  const activeTopics = topics.filter((t) => t.status === 'active' || t.status === 'voting')
  const proposedTopics = topics.filter((t) => t.status === 'proposed')
  const failedTopics = topics.filter((t) => t.status === 'failed')

  const Icon = meta.icon

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-3xl mx-auto px-4 pt-6 pb-28 md:pb-12">

        {/* Breadcrumb */}
        <div className="flex items-center gap-2 text-xs font-mono text-surface-500 mb-5">
          <Link href="/topic/categories" className="hover:text-white transition-colors flex items-center gap-1">
            <Tag className="h-3 w-3" aria-hidden="true" />
            Categories
          </Link>
          <span>/</span>
          <span className={meta.color}>{categoryLabel}</span>
        </div>

        {/* Hero */}
        <div className={cn('flex items-start gap-4 p-5 rounded-2xl border mb-6', meta.bg, meta.border)}>
          <div
            className={cn(
              'flex items-center justify-center h-12 w-12 rounded-xl border flex-shrink-0',
              meta.bg,
              meta.border
            )}
          >
            <Icon className={cn('h-6 w-6', meta.color)} aria-hidden="true" />
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-mono text-2xl font-bold text-white">{categoryLabel}</h1>
            <p className="text-sm font-mono text-surface-500 mt-1">
              {total.toLocaleString()} topic{total !== 1 ? 's' : ''} ·{' '}
              {totalVotes.toLocaleString()} votes cast ·{' '}
              {avgForPct}% avg FOR
            </p>
          </div>
          <Link
            href="/topic/categories"
            className="flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors flex-shrink-0"
            aria-label="Back to all categories"
          >
            <ArrowLeft className="h-3.5 w-3.5" aria-hidden="true" />
            All
          </Link>
        </div>

        {/* Stats row */}
        {total > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 mb-8">
            <StatPill icon={Gavel} label="Laws" value={laws} color="text-gold" />
            <StatPill icon={Zap} label="Active" value={active + voting} color="text-for-400" />
            <StatPill icon={Vote} label="Total Votes" value={totalVotes} color="text-purple" />
            <StatPill icon={TrendingUp} label="Topics" value={total} color="text-emerald" />
          </div>
        )}

        {/* Empty state */}
        {total === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
            <div
              className={cn(
                'flex items-center justify-center h-16 w-16 rounded-2xl border',
                meta.bg,
                meta.border
              )}
            >
              <Icon className={cn('h-8 w-8', meta.color)} aria-hidden="true" />
            </div>
            <div>
              <p className="font-mono font-semibold text-white text-lg">No {categoryLabel} topics yet</p>
              <p className="text-sm text-surface-500 font-mono mt-1">
                Be the first to propose a topic in this category.
              </p>
            </div>
            <Link
              href="/topic/create"
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-for-600 text-white text-sm font-mono font-medium hover:bg-for-500 transition-colors"
            >
              Propose Topic
            </Link>
          </div>
        )}

        {/* Established Laws */}
        {lawTopics.length > 0 && (
          <section className="mb-8" aria-labelledby="laws-heading">
            <div className="flex items-center gap-2 mb-3">
              <Gavel className="h-4 w-4 text-gold" aria-hidden="true" />
              <h2 id="laws-heading" className="font-mono text-sm font-bold text-gold uppercase tracking-wide">
                Established Laws
              </h2>
              <span className="text-xs font-mono text-surface-500 ml-1">({laws})</span>
            </div>
            <div className="space-y-2">
              {lawTopics.slice(0, 10).map((t) => (
                <TopicRow key={t.id} topic={t} />
              ))}
            </div>
            {laws > 10 && (
              <Link
                href={`/?category=${encodeURIComponent(categoryLabel)}&status=law`}
                className="flex items-center justify-center gap-1.5 mt-3 text-xs font-mono text-gold hover:text-gold/80 transition-colors"
              >
                View all {laws} laws
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            )}
          </section>
        )}

        {/* Active / Voting */}
        {activeTopics.length > 0 && (
          <section className="mb-8" aria-labelledby="active-heading">
            <div className="flex items-center gap-2 mb-3">
              <Flame className="h-4 w-4 text-for-400" aria-hidden="true" />
              <h2 id="active-heading" className="font-mono text-sm font-bold text-for-400 uppercase tracking-wide">
                Active Debates
              </h2>
              <span className="text-xs font-mono text-surface-500 ml-1">({active + voting})</span>
            </div>
            <div className="space-y-2">
              {activeTopics.slice(0, 10).map((t) => (
                <TopicRow key={t.id} topic={t} />
              ))}
            </div>
            {activeTopics.length > 10 && (
              <Link
                href={`/?category=${encodeURIComponent(categoryLabel)}&status=active`}
                className="flex items-center justify-center gap-1.5 mt-3 text-xs font-mono text-for-400 hover:text-for-300 transition-colors"
              >
                View all {active + voting} active
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            )}
          </section>
        )}

        {/* Proposed */}
        {proposedTopics.length > 0 && (
          <section className="mb-8" aria-labelledby="proposed-heading">
            <div className="flex items-center gap-2 mb-3">
              <FileText className="h-4 w-4 text-surface-500" aria-hidden="true" />
              <h2 id="proposed-heading" className="font-mono text-sm font-bold text-surface-400 uppercase tracking-wide">
                Proposed
              </h2>
              <span className="text-xs font-mono text-surface-500 ml-1">({proposed})</span>
            </div>
            <div className="space-y-2">
              {proposedTopics.slice(0, 8).map((t) => (
                <TopicRow key={t.id} topic={t} />
              ))}
            </div>
            {proposed > 8 && (
              <Link
                href={`/?category=${encodeURIComponent(categoryLabel)}&status=proposed`}
                className="flex items-center justify-center gap-1.5 mt-3 text-xs font-mono text-surface-500 hover:text-white transition-colors"
              >
                View all {proposed} proposed
                <ArrowRight className="h-3 w-3" aria-hidden="true" />
              </Link>
            )}
          </section>
        )}

        {/* Failed */}
        {failedTopics.length > 0 && (
          <section className="mb-8" aria-labelledby="failed-heading">
            <div className="flex items-center gap-2 mb-3">
              <Clock className="h-4 w-4 text-against-400" aria-hidden="true" />
              <h2 id="failed-heading" className="font-mono text-sm font-bold text-against-400 uppercase tracking-wide">
                Failed
              </h2>
              <span className="text-xs font-mono text-surface-500 ml-1">({failed})</span>
            </div>
            <div className="space-y-2">
              {failedTopics.slice(0, 5).map((t) => (
                <TopicRow key={t.id} topic={t} />
              ))}
            </div>
          </section>
        )}

        {/* Footer nav */}
        <div className="flex items-center justify-between pt-6 border-t border-surface-300">
          <Link
            href="/topic/categories"
            className="inline-flex items-center gap-2 text-sm font-mono text-surface-500 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            All categories
          </Link>
          <Link
            href="/topic/create"
            className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-for-600/20 border border-for-600/40 text-for-400 hover:bg-for-600/30 text-xs font-mono font-medium transition-colors"
          >
            Propose in {categoryLabel}
            <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
          </Link>
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
