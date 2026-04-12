'use client'

import { TrendingUp, Clock, Flame, Scale, FileText, Zap, Gavel } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useFeedStore } from '@/lib/stores/feed-store'
import type { FeedSort, FeedStatus } from '@/lib/stores/feed-store'

const SORT_OPTIONS: { id: FeedSort; label: string; icon: typeof TrendingUp }[] = [
  { id: 'top', label: 'Top', icon: TrendingUp },
  { id: 'new', label: 'New', icon: Clock },
  { id: 'hot', label: 'Hot', icon: Flame },
]

const STATUS_OPTIONS: {
  id: FeedStatus
  label: string
  icon: typeof FileText
  activeClass: string
}[] = [
  {
    id: null,
    label: 'All',
    icon: FileText,
    activeClass: 'bg-surface-300 text-white border-surface-400',
  },
  {
    id: 'proposed',
    label: 'Proposed',
    icon: FileText,
    activeClass: 'bg-surface-300/60 text-surface-700 border-surface-500',
  },
  {
    id: 'active',
    label: 'Active',
    icon: Zap,
    activeClass: 'bg-for-500/20 text-for-300 border-for-500/50',
  },
  {
    id: 'voting',
    label: 'Voting',
    icon: Scale,
    activeClass: 'bg-purple/20 text-purple border-purple/50',
  },
  {
    id: 'law',
    label: 'LAW',
    icon: Gavel,
    activeClass: 'bg-gold/20 text-gold border-gold/50',
  },
]

export function FeedFilters() {
  const { sort, statusFilter, setSort, setStatusFilter } = useFeedStore()

  return (
    <div
      className={cn(
        'flex items-center gap-2 px-3 py-2',
        'overflow-x-auto',
        // Hide scrollbar cross-browser
        '[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]'
      )}
    >
      {/* Sort group */}
      <div className="flex items-center gap-0.5 flex-shrink-0 bg-surface-200/80 border border-surface-300 rounded-lg p-0.5 backdrop-blur-sm">
        {SORT_OPTIONS.map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setSort(id)}
            aria-pressed={sort === id}
            className={cn(
              'flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-all duration-150',
              sort === id
                ? 'bg-for-600 text-white shadow-sm'
                : 'text-surface-500 hover:text-surface-700'
            )}
          >
            <Icon className="h-3 w-3 flex-shrink-0" />
            <span>{label}</span>
          </button>
        ))}
      </div>

      {/* Separator */}
      <div className="h-4 w-px bg-surface-400 flex-shrink-0" aria-hidden />

      {/* Status pills */}
      {STATUS_OPTIONS.map(({ id, label, activeClass }) => (
        <button
          key={String(id)}
          onClick={() => setStatusFilter(id)}
          aria-pressed={statusFilter === id}
          className={cn(
            'flex-shrink-0 px-2.5 py-1 rounded-lg text-xs font-mono font-medium',
            'border transition-all duration-150',
            statusFilter === id
              ? activeClass
              : 'bg-surface-200/60 text-surface-500 border-transparent hover:text-surface-700 backdrop-blur-sm'
          )}
        >
          {label}
        </button>
      ))}
    </div>
  )
}
