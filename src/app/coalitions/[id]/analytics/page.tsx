'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { useParams } from 'next/navigation'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowLeft,
  BarChart2,
  CheckCircle2,
  Crown,
  RefreshCw,
  Shield,
  Swords,
  Target,
  Trophy,
  Users,
  XCircle,
  Zap,
} from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { Skeleton } from '@/components/ui/Skeleton'
import { EmptyState } from '@/components/ui/EmptyState'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { cn } from '@/lib/utils/cn'
import type { CoalitionAnalyticsResponse, StanceAlignment, CategoryBreakdown, TopMember } from '@/app/api/coalitions/[id]/analytics/route'

// ─── Helpers ──────────────────────────────────────────────────────────────────

const ROLE_CONFIG = {
  leader: { label: 'Leader', icon: Crown, color: 'text-gold' },
  officer: { label: 'Officer', icon: Shield, color: 'text-purple' },
  member: { label: 'Member', icon: Users, color: 'text-surface-500' },
} as const

const STATUS_BADGE: Record<string, 'proposed' | 'active' | 'law' | 'failed'> = {
  proposed: 'proposed',
  active: 'active',
  voting: 'active',
  law: 'law',
  failed: 'failed',
}

function AlignmentBar({ pct, size = 'md' }: { pct: number; size?: 'sm' | 'md' }) {
  const h = size === 'sm' ? 'h-1.5' : 'h-2'
  return (
    <div className={cn('w-full rounded-full bg-surface-300 overflow-hidden', h)}>
      <motion.div
        className={cn(
          'h-full rounded-full',
          pct >= 70
            ? 'bg-emerald'
            : pct >= 50
              ? 'bg-for-500'
              : pct >= 30
                ? 'bg-gold'
                : 'bg-against-500',
        )}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.6, ease: 'easeOut' }}
      />
    </div>
  )
}

function AlignmentLabel({ pct }: { pct: number }) {
  if (pct >= 80) return <span className="text-emerald font-semibold">Unified</span>
  if (pct >= 60) return <span className="text-for-400 font-semibold">Aligned</span>
  if (pct >= 40) return <span className="text-gold font-semibold">Mixed</span>
  return <span className="text-against-400 font-semibold">Divided</span>
}

// ─── Stat card ─────────────────────────────────────────────────────────────────

function StatCard({
  label,
  value,
  sub,
  icon: Icon,
  iconColor,
}: {
  label: string
  value: string | number
  sub?: string
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
}) {
  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 flex items-start gap-3">
      <div className={cn('flex h-9 w-9 items-center justify-center rounded-xl bg-surface-200 flex-shrink-0', iconColor)}>
        <Icon className="h-4.5 w-4.5" />
      </div>
      <div className="min-w-0">
        <div className="text-xs font-mono text-surface-500 uppercase tracking-wider mb-0.5">{label}</div>
        <div className="text-xl font-bold font-mono text-white leading-tight">{value}</div>
        {sub && <div className="text-[11px] font-mono text-surface-500 mt-0.5">{sub}</div>}
      </div>
    </div>
  )
}

// ─── Stance card ───────────────────────────────────────────────────────────────

function StanceCard({ stance }: { stance: StanceAlignment }) {
  const badgeVariant = STATUS_BADGE[stance.topicStatus] ?? 'proposed'
  const alignIcon = stance.alignmentPct >= 50 ? CheckCircle2 : XCircle
  const AlignIcon = alignIcon

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3"
    >
      {/* Header */}
      <div className="flex items-start gap-2 justify-between">
        <div className="flex items-start gap-2 min-w-0">
          <div className={cn(
            'flex-shrink-0 mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold uppercase tracking-wider border',
            stance.stance === 'for'
              ? 'text-for-300 border-for-500/40 bg-for-500/10'
              : 'text-against-300 border-against-500/40 bg-against-500/10',
          )}>
            {stance.stance}
          </div>
          <p className="text-sm text-white leading-snug line-clamp-2 font-medium">
            {stance.topicStatement}
          </p>
        </div>
        <Badge variant={badgeVariant} className="flex-shrink-0 text-[10px]">
          {stance.topicStatus}
        </Badge>
      </div>

      {/* Alignment bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-xs font-mono">
          <span className="text-surface-500">Member alignment</span>
          <div className="flex items-center gap-1.5">
            <AlignIcon className={cn('h-3.5 w-3.5', stance.alignmentPct >= 50 ? 'text-emerald' : 'text-against-400')} />
            <AlignmentLabel pct={stance.alignmentPct} />
            <span className="text-surface-500">({stance.alignmentPct}%)</span>
          </div>
        </div>
        <AlignmentBar pct={stance.alignmentPct} />
        <div className="flex items-center justify-between text-[11px] font-mono text-surface-500">
          <span>{stance.alignedVotes} aligned · {stance.opposedVotes} opposed</span>
          <span>{stance.abstainedMembers} abstained</span>
        </div>
      </div>

      {/* Coalition stance statement */}
      {stance.stanceStatement && (
        <p className="text-[12px] font-mono text-surface-500 border-l-2 border-surface-300 pl-3 italic">
          &ldquo;{stance.stanceStatement}&rdquo;
        </p>
      )}
    </motion.div>
  )
}

// ─── Category bar ──────────────────────────────────────────────────────────────

function CategoryRow({ cat, maxVotes }: { cat: CategoryBreakdown; maxVotes: number }) {
  const width = maxVotes > 0 ? (cat.voteCount / maxVotes) * 100 : 0

  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between text-xs font-mono">
        <span className="text-white font-medium">{cat.category}</span>
        <span className="text-surface-500">{cat.voteCount} votes · {cat.forPct}% for</span>
      </div>
      <div className="h-2 rounded-full bg-surface-300 overflow-hidden">
        <motion.div
          className="h-full rounded-full bg-surface-400 relative overflow-hidden"
          initial={{ width: 0 }}
          animate={{ width: `${width}%` }}
          transition={{ duration: 0.5, ease: 'easeOut' }}
        >
          <div
            className="absolute inset-y-0 left-0 bg-for-500 rounded-full"
            style={{ width: `${cat.forPct}%` }}
          />
        </motion.div>
      </div>
    </div>
  )
}

// ─── Member row ────────────────────────────────────────────────────────────────

function MemberRow({ member, rank }: { member: TopMember; rank: number }) {
  const roleConfig = ROLE_CONFIG[member.coalitionRole] ?? ROLE_CONFIG.member
  const RoleIcon = roleConfig.icon

  return (
    <motion.div
      initial={{ opacity: 0, x: -8 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ delay: rank * 0.05 }}
      className="flex items-center gap-3 py-2"
    >
      <span className="text-[11px] font-mono text-surface-500 w-5 text-right flex-shrink-0">
        {rank}
      </span>
      <Link href={`/profile/${member.username}`} className="flex items-center gap-2.5 min-w-0 flex-1 group">
        <Avatar
          src={member.avatarUrl}
          fallback={member.displayName ?? member.username}
          size="sm"
          className="flex-shrink-0"
        />
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium text-white group-hover:text-for-400 transition-colors truncate">
            {member.displayName ?? member.username}
          </div>
          <div className="flex items-center gap-1.5 text-[11px] font-mono text-surface-500">
            <RoleIcon className={cn('h-3 w-3', roleConfig.color)} />
            <span className={roleConfig.color}>{roleConfig.label}</span>
          </div>
        </div>
      </Link>
      <div className="text-right flex-shrink-0">
        <div className="text-sm font-mono font-bold text-white">{member.reputationScore.toLocaleString()}</div>
        <div className="text-[10px] font-mono text-surface-500">rep</div>
      </div>
    </motion.div>
  )
}

// ─── Main page ─────────────────────────────────────────────────────────────────

export default function CoalitionAnalyticsPage() {
  const { id } = useParams<{ id: string }>()
  const [data, setData] = useState<CoalitionAnalyticsResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/coalitions/${id}/analytics`, { cache: 'no-store' })
      if (!res.ok) {
        const j = await res.json().catch(() => ({}))
        setError((j as { error?: string }).error ?? 'Failed to load analytics')
        return
      }
      setData(await res.json())
    } catch {
      setError('Failed to load analytics')
    } finally {
      setLoading(false)
    }
  }, [id])

  useEffect(() => { load() }, [load])

  const maxCategoryVotes = data?.categoryBreakdown[0]?.voteCount ?? 1
  const totalMatches = data ? data.coalition.wins + data.coalition.losses : 0
  const winRate = totalMatches > 0
    ? Math.round((data!.coalition.wins / totalMatches) * 100)
    : null

  return (
    <div className="min-h-screen bg-surface-50">
      <TopBar />

      <main className="max-w-2xl mx-auto px-4 py-6 pb-24 md:pb-12">

        {/* Back link */}
        <Link
          href={`/coalitions/${id}`}
          className="inline-flex items-center gap-1.5 text-xs font-mono text-surface-500 hover:text-white transition-colors mb-5"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Back to coalition
        </Link>

        {/* Page title */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="font-mono text-xl font-bold text-white tracking-tight flex items-center gap-2">
              <BarChart2 className="h-5 w-5 text-for-400" />
              War Room
            </h1>
            {data && (
              <p className="text-xs font-mono text-surface-500 mt-1">
                {data.coalition.name} · coalition analytics
              </p>
            )}
          </div>
          <button
            onClick={load}
            disabled={loading}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-mono',
              'border border-surface-300 text-surface-500 hover:text-white hover:border-surface-400 transition-colors',
            )}
          >
            <RefreshCw className={cn('h-3.5 w-3.5', loading && 'animate-spin')} />
            Refresh
          </button>
        </div>

        {/* Loading skeleton */}
        <AnimatePresence>
          {loading && !data && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="space-y-4"
            >
              <div className="grid grid-cols-2 gap-3">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="h-20 rounded-2xl" />
                ))}
              </div>
              <Skeleton className="h-48 rounded-2xl" />
              <Skeleton className="h-48 rounded-2xl" />
            </motion.div>
          )}
        </AnimatePresence>

        {/* Error */}
        {error && !loading && (
          <EmptyState
            icon={XCircle}
            title="Couldn't load analytics"
            description={error}
            actions={[{ label: 'Try again', onClick: load }]}
          />
        )}

        {/* Content */}
        {data && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="space-y-6"
          >
            {/* Stats grid */}
            <div className="grid grid-cols-2 gap-3">
              <StatCard
                label="Members"
                value={data.coalition.memberCount}
                sub={`of ${data.coalition.maxMembers} max`}
                icon={Users}
                iconColor="text-for-400"
              />
              <StatCard
                label="Influence"
                value={data.coalition.influence.toLocaleString()}
                sub="coalition score"
                icon={Zap}
                iconColor="text-gold"
              />
              <StatCard
                label="Win Rate"
                value={winRate !== null ? `${winRate}%` : '—'}
                sub={`${data.coalition.wins}W · ${data.coalition.losses}L`}
                icon={Trophy}
                iconColor="text-emerald"
              />
              <StatCard
                label="Alignment"
                value={data.overallAlignmentPct !== null ? `${data.overallAlignmentPct}%` : '—'}
                sub={data.stanceAlignments.length > 0 ? `across ${data.stanceAlignments.length} stances` : 'no stances yet'}
                icon={Target}
                iconColor="text-purple"
              />
            </div>

            {/* Stance alignment section */}
            <section>
              <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-3">
                <Swords className="h-3.5 w-3.5" />
                Stance Alignment
              </div>

              {data.stanceAlignments.length === 0 ? (
                <div className="rounded-2xl border border-surface-300 bg-surface-100 p-8 text-center">
                  <div className="text-sm font-mono text-surface-500">
                    No stances declared yet.{' '}
                    <Link href={`/coalitions/${id}`} className="text-for-400 hover:underline">
                      Declare a stance
                    </Link>{' '}
                    to track member alignment.
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  {data.stanceAlignments.map((stance) => (
                    <StanceCard key={stance.topicId} stance={stance} />
                  ))}
                </div>
              )}
            </section>

            {/* Category breakdown */}
            {data.categoryBreakdown.length > 0 && (
              <section>
                <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-3">
                  <BarChart2 className="h-3.5 w-3.5" />
                  Category Activity
                  <span className="ml-auto normal-case text-surface-600">
                    {data.totalMemberVotes.toLocaleString()} votes · last 6 months
                  </span>
                </div>
                <div className="rounded-2xl border border-surface-300 bg-surface-100 p-4 space-y-3">
                  {data.categoryBreakdown.map((cat) => (
                    <CategoryRow key={cat.category} cat={cat} maxVotes={maxCategoryVotes} />
                  ))}
                </div>
              </section>
            )}

            {/* Top members */}
            {data.topMembers.length > 0 && (
              <section>
                <div className="flex items-center gap-2 text-xs font-mono text-surface-500 uppercase tracking-wider mb-3">
                  <Crown className="h-3.5 w-3.5 text-gold" />
                  Top Members
                </div>
                <div className="rounded-2xl border border-surface-300 bg-surface-100 px-4 divide-y divide-surface-300">
                  {data.topMembers.map((member, idx) => (
                    <MemberRow key={member.id} member={member} rank={idx + 1} />
                  ))}
                </div>
              </section>
            )}

            {/* No data yet */}
            {data.totalMemberVotes === 0 && data.categoryBreakdown.length === 0 && (
              <div className="rounded-2xl border border-surface-300 bg-surface-100 p-8 text-center space-y-2">
                <BarChart2 className="h-8 w-8 text-surface-500 mx-auto" />
                <p className="text-sm font-mono text-surface-500">
                  No voting activity to analyze yet.
                </p>
                <p className="text-xs font-mono text-surface-600">
                  Data appears once members start voting on topics.
                </p>
              </div>
            )}
          </motion.div>
        )}

      </main>

      <BottomNav />
    </div>
  )
}
