'use client'

import Link from 'next/link'
import { TrendingUp, Clock, Flame, Scale, FileText, Zap, Gavel, Tag, LayoutGrid } from 'lucide-react'
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

const CATEGORIES = [
  'Economics',
  'Politics',
  'Technology',
  'Science',
  'Ethics',
  'Philosophy',
  'Culture',
  'Health',
  'Environment',
  'Education',
]

export function FeedFilters() {
  const { sort, statusFilter, categoryFilter, setSort, setStatusFilter, setCategoryFilter } = useFeedStore()

  return (
    <div className="flex flex-col gap-1.5">
      {/* Row 1: Sort + Status */}
      <div
        className={cn(
          'flex items-center gap-2 px-3 py-2',
          'overflow-x-auto',
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

      {/* Row 2: Category chips */}
      <div
        className={cn(
          'flex items-center gap-1.5 px-3 pb-2',
          'overflow-x-auto',
          '[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]'
        )}
      >
        <Tag className="h-3 w-3 text-surface-500 flex-shrink-0" />
        {/* "All categories" chip */}
        <button
          onClick={() => setCategoryFilter(null)}
          aria-pressed={categoryFilter === null}
          className={cn(
            'flex-shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium',
            'border transition-all duration-150',
            categoryFilter === null
              ? 'bg-surface-400 text-white border-surface-400'
              : 'bg-transparent text-surface-500 border-surface-500/40 hover:text-surface-400 hover:border-surface-400'
          )}
        >
          All
        </button>
        {CATEGORIES.map((cat) => (
          <button
            key={cat}
            onClick={() => setCategoryFilter(categoryFilter === cat ? null : cat)}
            aria-pressed={categoryFilter === cat}
            className={cn(
              'flex-shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium',
              'border transition-all duration-150',
              categoryFilter === cat
                ? 'bg-for-600/80 text-white border-for-600'
                : 'bg-transparent text-surface-500 border-surface-500/40 hover:text-surface-400 hover:border-surface-400'
            )}
          >
            {cat}
          </button>
        ))}
        {/* Separator + browse link */}
        <div className="h-3.5 w-px bg-surface-500/30 flex-shrink-0 mx-0.5" aria-hidden />
        <Link
          href="/topic/categories"
          className={cn(
            'flex-shrink-0 flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium',
            'border border-surface-500/40 text-surface-500',
            'hover:text-surface-300 hover:border-surface-400 transition-all duration-150'
          )}
          aria-label="Browse all categories"
        >
          <LayoutGrid className="h-2.5 w-2.5" />
          Browse
        </Link>
      </div>
    </div>
  )
}
