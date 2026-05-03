import type { Metadata } from 'next'
import Link from 'next/link'
import {
  Monitor,
  Zap,
  Scale,
  Gavel,
  ChevronRight,
  TrendingUp,
  Users,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/server'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Badge } from '@/components/ui/Badge'
import { cn } from '@/lib/utils/cn'

export const dynamic = 'force-dynamic'
export const revalidate = 0

export const metadata: Metadata = {
  title: 'Civic Stage · Lobby Market',
  description:
    'Full-screen live presentation mode for civic debates. Project a topic\'s real-time vote split at town halls, classrooms, and civic events.',
  openGraph: {
    title: 'Civic Stage · Lobby Market',
    description: 'Project live civic debates on any screen. Auto-refreshing vote counts and top arguments.',
    type: 'website',
    siteName: 'Lobby Market',
  },
  twitter: {
    card: 'summary',
    title: 'Civic Stage · Lobby Market',
    description: 'Live debate display mode for civic events.',
  },
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface StageTopic {
  id: string
  statement: string
  category: string | null
  status: string
  blue_pct: number
  total_votes: number
  scope: string
}

// ─── Status helpers ───────────────────────────────────────────────────────────

const STATUS_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  active: Zap,
  voting: Scale,
  proposed: TrendingUp,
  law: Gavel,
}

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
}

const STATUS_LABEL: Record<string, string> = {
  proposed: 'Proposed',
  active: 'Active',
  voting: 'Voting',
  law: 'LAW',
}

const CATEGORY_COLORS: Record<string, string> = {
  Politics: 'text-for-400',
  Technology: 'text-purple',
  Ethics: 'text-emerald',
  Culture: 'text-gold',
  Economics: 'text-against-400',
  Science: 'text-for-300',
  Philosophy: 'text-purple',
  Health: 'text-emerald',
  Environment: 'text-emerald',
  Education: 'text-for-400',
}

// ─── Topic card ───────────────────────────────────────────────────────────────

function TopicCard({ topic }: { topic: StageTopic }) {
  const StatusIcon = STATUS_ICON[topic.status] ?? Zap
  const forPct = Math.round(topic.blue_pct)
  const againstPct = 100 - forPct
  const catColor = CATEGORY_COLORS[topic.category ?? ''] ?? 'text-surface-400'
  const isHot = Math.abs(forPct - 50) < 10 // near deadlock

  return (
    <Link
      href={`/stage/${topic.id}`}
      className={cn(
        'group relative flex flex-col gap-3 p-4 rounded-2xl',
        'bg-surface-100 border transition-all duration-200',
        'hover:border-for-500/40 hover:bg-surface-100/80',
        isHot
          ? 'border-gold/30 shadow-sm shadow-gold/10'
          : 'border-surface-300'
      )}
    >
      {/* Hot badge */}
      {isHot && (
        <span className="absolute top-3 right-3 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold bg-gold/20 text-gold border border-gold/30">
          CONTESTED
        </span>
      )}

      {/* Meta row */}
      <div className="flex items-center gap-2 flex-wrap pr-16">
        <Badge variant={STATUS_BADGE[topic.status] ?? 'proposed'}>
          <StatusIcon className="h-2.5 w-2.5 mr-1" />
          {STATUS_LABEL[topic.status] ?? topic.status}
        </Badge>
        {topic.category && (
          <span className={cn('text-[11px] font-mono', catColor)}>
            {topic.category}
          </span>
        )}
        <span className="text-[11px] font-mono text-surface-500 flex items-center gap-1">
          <Users className="h-2.5 w-2.5" />
          {topic.total_votes.toLocaleString()}
        </span>
      </div>

      {/* Statement */}
      <p className="text-sm font-medium text-white leading-snug line-clamp-2">
        {topic.statement}
      </p>

      {/* Vote bar */}
      <div className="flex flex-col gap-1">
        <div className="flex h-2 rounded-full overflow-hidden bg-surface-300">
          <div
            className="bg-for-500 transition-all"
            style={{ width: `${forPct}%` }}
          />
          <div
            className="bg-against-500 flex-1"
          />
        </div>
        <div className="flex justify-between text-[11px] font-mono">
          <span className="text-for-400 font-semibold">{forPct}% FOR</span>
          <span className="text-against-400 font-semibold">{againstPct}% AGAINST</span>
        </div>
      </div>

      {/* CTA */}
      <div className="flex items-center justify-between mt-auto pt-1">
        <span className="text-[11px] font-mono text-surface-500">
          {topic.scope} · Click to present
        </span>
        <ChevronRight className="h-4 w-4 text-surface-500 group-hover:text-for-400 transition-colors" />
      </div>
    </Link>
  )
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default async function StagePage() {
  const supabase = await createClient()

  const { data: rows } = await supabase
    .from('topics')
    .select('id, statement, category, status, blue_pct, total_votes, scope')
    .in('status', ['active', 'voting', 'proposed'])
    .order('total_votes', { ascending: false })
    .limit(40)

  const topics: StageTopic[] = (rows ?? []).map((t) => ({
    id: t.id,
    statement: t.statement,
    category: t.category ?? null,
    status: t.status,
    blue_pct: t.blue_pct ?? 50,
    total_votes: t.total_votes ?? 0,
    scope: t.scope ?? 'Global',
  }))

  const active = topics.filter((t) => t.status === 'active' || t.status === 'voting')
  const proposed = topics.filter((t) => t.status === 'proposed')

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-5xl mx-auto px-4 py-8 pb-24 md:pb-12">
        {/* Hero */}
        <div className="mb-8">
          <div className="flex items-center gap-3 mb-2">
            <div className="p-2 rounded-xl bg-for-600/20 border border-for-600/30">
              <Monitor className="h-5 w-5 text-for-400" />
            </div>
            <h1 className="text-2xl font-bold font-mono text-white">
              Civic Stage
            </h1>
          </div>
          <p className="text-surface-500 text-sm font-mono max-w-xl">
            Project any debate live — auto-refreshing vote counts, top arguments, and FOR/AGAINST
            split. Perfect for town halls, classrooms, and civic events.
          </p>
          <div className="mt-3 flex flex-wrap gap-2">
            {[
              { label: 'Auto-refresh every 15s', icon: Zap },
              { label: 'Full-screen mode', icon: Monitor },
              { label: 'Live vote split', icon: Scale },
            ].map(({ label, icon: Icon }) => (
              <span
                key={label}
                className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-mono text-surface-400 bg-surface-200/60 border border-surface-300/60"
              >
                <Icon className="h-3 w-3 text-for-400" />
                {label}
              </span>
            ))}
          </div>
        </div>

        {/* Active & Voting */}
        {active.length > 0 && (
          <section className="mb-8">
            <h2 className="text-sm font-mono font-semibold text-for-400 mb-3 flex items-center gap-1.5">
              <Zap className="h-3.5 w-3.5" />
              Active Debates ({active.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {active.map((t) => (
                <TopicCard key={t.id} topic={t} />
              ))}
            </div>
          </section>
        )}

        {/* Proposed */}
        {proposed.length > 0 && (
          <section>
            <h2 className="text-sm font-mono font-semibold text-surface-500 mb-3 flex items-center gap-1.5">
              <TrendingUp className="h-3.5 w-3.5" />
              Proposed Topics ({proposed.length})
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {proposed.slice(0, 12).map((t) => (
                <TopicCard key={t.id} topic={t} />
              ))}
            </div>
          </section>
        )}

        {topics.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 text-center">
            <Monitor className="h-10 w-10 text-surface-500 mb-4" />
            <p className="text-white font-mono font-semibold text-lg">No topics yet</p>
            <p className="text-surface-500 font-mono text-sm mt-1">
              Create a topic to present it on the stage.
            </p>
            <Link
              href="/topic/create"
              className="mt-4 px-4 py-2 rounded-lg bg-for-600 text-white text-sm font-mono hover:bg-for-500 transition-colors"
            >
              Create a Topic
            </Link>
          </div>
        )}
      </main>

      <BottomNav />
    </div>
  )
}
