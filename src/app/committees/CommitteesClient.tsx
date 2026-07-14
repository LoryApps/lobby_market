'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ArrowRight,
  BookOpen,
  Cpu,
  FileText,
  FlaskConical,
  GraduationCap,
  Heart,
  Landmark,
  Leaf,
  Loader2,
  Music2,
  RefreshCw,
  Scale,
  Search,
  TrendingUp,
  Users,
  X,
} from 'lucide-react'
import { TopBar } from '@/components/layout/TopBar'
import { BottomNav } from '@/components/layout/BottomNav'
import { Avatar } from '@/components/ui/Avatar'
import { Badge } from '@/components/ui/Badge'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { SelectCommittee } from '@/app/api/committees/route'

// ── Icon map for committee policy areas ────────────────────────────────────

const AREA_ICON: Record<string, React.ComponentType<{ className?: string }>> = {
  Politics: Landmark,
  Economics: TrendingUp,
  Technology: Cpu,
  Science: FlaskConical,
  Ethics: Scale,
  Philosophy: BookOpen,
  Culture: Music2,
  Health: Heart,
  Environment: Leaf,
  Education: GraduationCap,
}

const AREA_COLOR: Record<string, string> = {
  Politics: 'text-for-400',
  Economics: 'text-gold',
  Technology: 'text-purple',
  Science: 'text-emerald',
  Ethics: 'text-against-400',
  Philosophy: 'text-for-300',
  Culture: 'text-pink-400',
  Health: 'text-red-400',
  Environment: 'text-emerald',
  Education: 'text-amber-400',
}

const AREA_BG: Record<string, string> = {
  Politics: 'bg-for-500/10',
  Economics: 'bg-gold/10',
  Technology: 'bg-purple/10',
  Science: 'bg-emerald/10',
  Ethics: 'bg-against-500/10',
  Philosophy: 'bg-for-500/5',
  Culture: 'bg-pink-500/10',
  Health: 'bg-red-500/10',
  Environment: 'bg-emerald/10',
  Education: 'bg-amber-500/10',
}

const AREA_BORDER: Record<string, string> = {
  Politics: 'border-for-500/30',
  Economics: 'border-gold/30',
  Technology: 'border-purple/30',
  Science: 'border-emerald/30',
  Ethics: 'border-against-500/30',
  Philosophy: 'border-for-500/20',
  Culture: 'border-pink-500/30',
  Health: 'border-red-500/30',
  Environment: 'border-emerald/30',
  Education: 'border-amber-500/30',
}

// ── Skeleton ───────────────────────────────────────────────────────────────

function CommitteeSkeleton() {
  return (
    <div className="rounded-2xl bg-surface-100 border border-surface-300 p-5 space-y-4">
      <div className="flex items-center gap-3">
        <Skeleton className="h-10 w-10 rounded-xl flex-shrink-0" />
        <div className="flex-1 space-y-2">
          <Skeleton className="h-4 w-48" />
          <Skeleton className="h-3 w-24" />
        </div>
      </div>
      <Skeleton className="h-12 w-full" />
      <div className="flex gap-3">
        <Skeleton className="h-7 w-20 rounded-full" />
        <Skeleton className="h-7 w-20 rounded-full" />
      </div>
    </div>
  )
}

// ── Committee Card ─────────────────────────────────────────────────────────

function CommitteeCard({
  committee,
  onToggleMembership,
}: {
  committee: SelectCommittee
  onToggleMembership: (id: string, join: boolean) => Promise<void>
}) {
  const [joining, setJoining] = useState(false)
  const area = committee.policy_area
  const Icon = AREA_ICON[area] ?? Scale

  async function handleToggle(e: React.MouseEvent) {
    e.preventDefault()
    setJoining(true)
    try {
      await onToggleMembership(committee.id, !committee.user_is_member)
    } finally {
      setJoining(false)
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      className="group"
    >
      <Link
        href={`/committees/${committee.slug}`}
        className={cn(
          'flex flex-col gap-4 p-5 rounded-2xl border transition-all duration-200',
          'bg-surface-100 border-surface-300',
          'hover:border-surface-400 hover:bg-surface-200/50'
        )}
      >
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className={cn(
            'flex items-center justify-center h-10 w-10 rounded-xl flex-shrink-0',
            AREA_BG[area],
            `border ${AREA_BORDER[area]}`
          )}>
            <Icon className={cn('h-5 w-5', AREA_COLOR[area])} />
          </div>
          <div className="flex-1 min-w-0">
            <h3 className="font-mono text-sm font-bold text-white leading-tight">{committee.name}</h3>
            <p className={cn('text-xs font-mono mt-0.5', AREA_COLOR[area])}>{area}</p>
          </div>
          {committee.open_inquiry_count > 0 && (
            <Badge variant="custom" className="bg-gold/10 border-gold/30 text-gold text-[10px] font-mono flex-shrink-0">
              {committee.open_inquiry_count} open
            </Badge>
          )}
        </div>

        {/* Description */}
        <p className="text-xs text-surface-400 leading-relaxed line-clamp-2">
          {committee.description}
        </p>

        {/* Chair */}
        {committee.chair && (
          <div className="flex items-center gap-2 min-w-0">
            <span className="text-[10px] font-mono text-surface-500 flex-shrink-0">Chair:</span>
            <Avatar
              src={committee.chair.avatar_url}
              fallback={committee.chair.display_name || committee.chair.username}
              size="xs"
              className="flex-shrink-0"
            />
            <span className="text-[10px] font-mono text-surface-400 truncate">
              {committee.chair.display_name || `@${committee.chair.username}`}
            </span>
          </div>
        )}

        {/* Footer stats + join button */}
        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="flex items-center gap-3">
            <span className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
              <Users className="h-3 w-3" />
              {committee.member_count.toLocaleString()}
            </span>
            <span className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
              <FileText className="h-3 w-3" />
              {committee.inquiry_count} inquiries
            </span>
          </div>

          <button
            onClick={handleToggle}
            disabled={joining}
            className={cn(
              'px-3 py-1 rounded-lg text-[11px] font-mono font-semibold border transition-all',
              committee.user_is_member
                ? 'bg-for-500/20 border-for-500/40 text-for-400 hover:bg-against-500/20 hover:border-against-500/40 hover:text-against-400'
                : 'bg-surface-200 border-surface-300 text-surface-400 hover:bg-for-500/20 hover:border-for-500/40 hover:text-for-400'
            )}
          >
            {joining ? <Loader2 className="h-3 w-3 animate-spin inline" /> : committee.user_is_member ? 'Following' : 'Follow'}
          </button>
        </div>
      </Link>
    </motion.div>
  )
}

// ── Main component ─────────────────────────────────────────────────────────

export function CommitteesClient() {
  const [committees, setCommittees] = useState<SelectCommittee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [search, setSearch] = useState('')
  const [areaFilter, setAreaFilter] = useState<string>('All')
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    try {
      const res = await fetch('/api/committees', { cache: 'no-store' })
      if (!res.ok) throw new Error(`HTTP ${res.status}`)
      const json = await res.json() as { committees: SelectCommittee[] }
      setCommittees(json.committees)
      setError(null)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load committees')
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  async function toggleMembership(id: string, join: boolean) {
    const method = join ? 'POST' : 'DELETE'
    await fetch(`/api/committees/${id}/join`, { method })
    setCommittees((prev) =>
      prev.map((c) =>
        c.id === id
          ? { ...c, user_is_member: join, member_count: c.member_count + (join ? 1 : -1) }
          : c
      )
    )
  }

  // Areas for filter chips
  const areas = ['All', ...Array.from(new Set(committees.map((c) => c.policy_area))).sort()]

  // Filter
  const filtered = committees.filter((c) => {
    const matchesArea = areaFilter === 'All' || c.policy_area === areaFilter
    const matchesSearch = !search
      || c.name.toLowerCase().includes(search.toLowerCase())
      || c.policy_area.toLowerCase().includes(search.toLowerCase())
      || c.description.toLowerCase().includes(search.toLowerCase())
    return matchesArea && matchesSearch
  })

  return (
    <div className="min-h-screen bg-surface-50 flex flex-col">
      <TopBar />

      {/* Header */}
      <div className="border-b border-surface-300/50 bg-surface-100/80 backdrop-blur-sm">
        <div className="max-w-5xl mx-auto px-4 py-5">
          <div className="flex items-start gap-4 mb-4">
            <div className="flex items-center justify-center h-12 w-12 rounded-2xl bg-for-500/10 border border-for-500/30 flex-shrink-0">
              <Scale className="h-6 w-6 text-for-400" />
            </div>
            <div>
              <h1 className="font-mono text-xl font-bold text-white">Select Committees</h1>
              <p className="text-sm text-surface-400 mt-0.5">
                Ten standing committees scrutinising civic policy — follow inquiries, submit evidence, shape findings.
              </p>
            </div>
          </div>

          {/* Search */}
          <div className="relative mb-3">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-surface-500 pointer-events-none" />
            <input
              type="text"
              placeholder="Search committees…"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              className="w-full pl-9 pr-8 py-2 rounded-xl bg-surface-200 border border-surface-300/60 text-sm font-mono text-white placeholder-surface-500 focus:outline-none focus:border-for-500/40 transition-colors"
            />
            {search && (
              <button onClick={() => setSearch('')} className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-white">
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Area filter chips */}
          <div className="flex gap-2 overflow-x-auto pb-1 hide-scrollbar">
            {areas.map((area) => {
              const Icon = area === 'All' ? Scale : (AREA_ICON[area] ?? Scale)
              const active = areaFilter === area
              return (
                <button
                  key={area}
                  onClick={() => setAreaFilter(area)}
                  className={cn(
                    'flex-shrink-0 flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-mono font-semibold border transition-all',
                    active
                      ? area === 'All'
                        ? 'bg-for-500/20 border-for-500/40 text-for-400'
                        : cn(AREA_BG[area], AREA_BORDER[area], AREA_COLOR[area])
                      : 'bg-surface-200/60 border-surface-300/60 text-surface-500 hover:text-white hover:border-surface-400'
                  )}
                >
                  <Icon className="h-3 w-3" />
                  {area}
                </button>
              )
            })}
          </div>
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 pb-20 md:pb-8">
        <div className="max-w-5xl mx-auto px-4 py-6">
          {/* Toolbar */}
          <div className="flex items-center justify-between mb-4">
            <p className="text-xs font-mono text-surface-500">
              {loading ? 'Loading…' : `${filtered.length} ${filtered.length === 1 ? 'committee' : 'committees'}`}
            </p>
            <button
              onClick={() => load(true)}
              disabled={refreshing}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-surface-200 border border-surface-300 text-xs font-mono text-surface-400 hover:text-white transition-colors disabled:opacity-50"
            >
              <RefreshCw className={cn('h-3 w-3', refreshing && 'animate-spin')} />
              Refresh
            </button>
          </div>

          {loading ? (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {Array.from({ length: 6 }).map((_, i) => <CommitteeSkeleton key={i} />)}
            </div>
          ) : error ? (
            <EmptyState
              icon={Scale}
              title="Failed to load committees"
              description={error}
              action={{ label: 'Try again', onClick: () => load() }}
            />
          ) : filtered.length === 0 ? (
            <EmptyState
              icon={Scale}
              title="No committees found"
              description={search ? `No committees match "${search}"` : 'No committees in this area.'}
              action={search ? { label: 'Clear search', onClick: () => setSearch('') } : undefined}
            />
          ) : (
            <AnimatePresence mode="wait">
              <motion.div
                key={`${areaFilter}-${search}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4"
              >
                {filtered.map((committee) => (
                  <CommitteeCard
                    key={committee.id}
                    committee={committee}
                    onToggleMembership={toggleMembership}
                  />
                ))}
              </motion.div>
            </AnimatePresence>
          )}

          {/* Parliament link */}
          {!loading && !error && (
            <div className="mt-8 text-center">
              <Link
                href="/parliament"
                className="inline-flex items-center gap-2 text-xs font-mono text-surface-500 hover:text-white transition-colors"
              >
                <Landmark className="h-3.5 w-3.5" />
                Back to Parliament Hub
                <ArrowRight className="h-3 w-3" />
              </Link>
            </div>
          )}
        </div>
      </main>

      <BottomNav />
    </div>
  )
}
