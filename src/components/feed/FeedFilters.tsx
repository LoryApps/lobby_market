'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { TrendingUp, Clock, Flame, Scale, FileText, Zap, Gavel, Tag, LayoutGrid, Globe, Users, MapPin, Sparkles, History, X, Hash, Vote, Swords } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { useFeedStore } from '@/lib/stores/feed-store'
import type { FeedSort, FeedStatus, FeedMode, FeedScope } from '@/lib/stores/feed-store'
import type { TrendingTag } from '@/app/api/tags/trending/route'

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

const SCOPE_OPTIONS: {
  id: FeedScope
  label: string
  activeClass: string
}[] = [
  { id: null, label: 'All', activeClass: 'bg-surface-300 text-white border-surface-400' },
  { id: 'Global', label: 'Global', activeClass: 'bg-for-600/80 text-white border-for-600' },
  { id: 'National', label: 'National', activeClass: 'bg-emerald/20 text-emerald border-emerald/50' },
  { id: 'Regional', label: 'Regional', activeClass: 'bg-gold/20 text-gold border-gold/50' },
  { id: 'Local', label: 'Local', activeClass: 'bg-against-600/20 text-against-300 border-against-500/50' },
]

// Popular tags surfaced in the feed filter — drawn from the civic vocabulary in migration 00059
const POPULAR_TAGS: { id: string; label: string }[] = [
  { id: 'climate',      label: 'Climate'      },
  { id: 'economy',      label: 'Economy'      },
  { id: 'healthcare',   label: 'Healthcare'   },
  { id: 'ai',           label: 'AI'           },
  { id: 'immigration',  label: 'Immigration'  },
  { id: 'tax',          label: 'Tax'          },
  { id: 'housing',      label: 'Housing'      },
  { id: 'education',    label: 'Education'    },
  { id: 'democracy',    label: 'Democracy'    },
  { id: 'free-speech',  label: 'Free Speech'  },
  { id: 'guns',         label: 'Guns'         },
  { id: 'labor',        label: 'Labor'        },
  { id: 'energy',       label: 'Energy'       },
  { id: 'privacy',      label: 'Privacy'      },
  { id: 'justice',      label: 'Justice'      },
  { id: 'gender',       label: 'Gender'       },
  { id: 'race',         label: 'Race'         },
  { id: 'policing',     label: 'Policing'     },
  { id: 'military',     label: 'Military'     },
  { id: 'abortion',     label: 'Abortion'     },
]

const FEED_MODES: { id: FeedMode; label: string; icon: typeof Globe; activeClass: string }[] = [
  { id: 'discover', label: 'Discover', icon: Globe, activeClass: 'bg-for-600 text-white shadow-sm' },
  { id: 'following', label: 'Following', icon: Users, activeClass: 'bg-purple/90 text-white shadow-sm' },
  { id: 'foryou', label: 'For You', icon: Sparkles, activeClass: 'bg-gold/20 text-gold border border-gold/40 shadow-sm' },
  { id: 'mytags', label: 'My Tags', icon: Hash, activeClass: 'bg-for-500/20 text-for-300 border border-for-500/30 shadow-sm' },
  { id: 'unvoted', label: 'Unvoted', icon: Vote, activeClass: 'bg-emerald/20 text-emerald border border-emerald/40 shadow-sm' },
  { id: 'battleground', label: 'Battleground', icon: Swords, activeClass: 'bg-gradient-to-r from-for-600/70 to-against-600/70 text-white shadow-sm' },
]

// Module-level cache so all FeedFilters instances share the same fetch
let _cachedTags: TrendingTag[] = []
let _tagsFetchedAt = 0
const TAGS_TTL_MS = 5 * 60 * 1000 // 5 minutes

async function fetchTrendingTags(): Promise<TrendingTag[]> {
  const now = Date.now()
  if (_cachedTags.length > 0 && now - _tagsFetchedAt < TAGS_TTL_MS) return _cachedTags
  try {
    const res = await fetch('/api/tags/trending', { cache: 'no-store' })
    if (!res.ok) return _cachedTags
    const json = await res.json()
    _cachedTags = (json.tags ?? []).slice(0, 20)
    _tagsFetchedAt = now
  } catch {
    // keep stale cache
  }
  return _cachedTags
}

export function FeedFilters() {
  const {
    sort,
    statusFilter,
    categoryFilter,
    scopeFilter,
    tagFilter,
    feedMode,
    preferredCategories,
    preferenceSource,
    inferredFromVotes,
    setSort,
    setStatusFilter,
    setCategoryFilter,
    setScopeFilter,
    setTagFilter,
    setFeedMode,
    clearFilters,
  } = useFeedStore()

  const [liveTags, setLiveTags] = useState<TrendingTag[]>(_cachedTags)

  useEffect(() => {
    fetchTrendingTags().then(setLiveTags)
  }, [])

  // Merge: live tags take priority; fall back to static POPULAR_TAGS shape
  const displayTags: { id: string; label: string }[] = liveTags.length > 0
    ? liveTags.map((t) => ({ id: t.tag, label: t.tag }))
    : POPULAR_TAGS

  // Count non-default active filters in discover mode
  const activeFilterCount = feedMode === 'discover'
    ? [
        statusFilter !== null,
        categoryFilter !== null,
        scopeFilter !== null,
        tagFilter !== null,
        sort !== 'top',
      ].filter(Boolean).length
    : (sort !== 'new' && feedMode === 'following' ? 1 : 0)
      + (sort !== 'top' && feedMode === 'foryou' ? 1 : 0)
      + (sort !== 'new' && feedMode === 'mytags' ? 1 : 0)
      + (sort !== 'hot' && feedMode === 'unvoted' ? 1 : 0)
      + (sort !== 'hot' && feedMode === 'battleground' ? 1 : 0)

  return (
    <div className="flex flex-col gap-1.5">
      {/* Row 0: Discover / Following mode toggle + clear-filters */}
      <div className="flex items-center gap-2 px-3 pt-2">
        <div className="flex items-center gap-0.5 bg-surface-200/80 border border-surface-300 rounded-xl p-0.5 backdrop-blur-sm">
          {FEED_MODES.map(({ id, label, icon: Icon, activeClass }) => (
            <button
              key={id}
              onClick={() => setFeedMode(id)}
              aria-pressed={feedMode === id}
              className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold transition-all duration-150',
                feedMode === id ? activeClass : 'text-surface-500 hover:text-surface-300'
              )}
            >
              <Icon className="h-3 w-3 flex-shrink-0" />
              {label}
            </button>
          ))}
        </div>

        {/* Clear-filters pill — shown when any non-default filter is active */}
        {activeFilterCount > 0 && (
          <button
            onClick={clearFilters}
            aria-label="Clear all filters"
            className={cn(
              'flex items-center gap-1 flex-shrink-0 px-2 py-1 rounded-lg text-[11px] font-mono font-medium',
              'bg-against-500/15 border border-against-500/30 text-against-300',
              'hover:bg-against-500/25 hover:border-against-500/50 transition-all duration-150'
            )}
          >
            <X className="h-2.5 w-2.5" />
            <span>{activeFilterCount}</span>
          </button>
        )}
      </div>

      {/* Row 1: Sort + Status (hidden in Following mode) */}
      {feedMode === 'discover' && <div
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
      </div>}

      {/* Row 2: Category chips (hidden in Following mode) */}
      {feedMode === 'discover' && <div
        className={cn(
          'flex items-center gap-1.5 px-3',
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
      </div>}

      {/* Row 3: Scope chips (hidden in Following mode) */}
      {feedMode === 'discover' && <div
        className={cn(
          'flex items-center gap-1.5 px-3',
          'overflow-x-auto',
          '[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]'
        )}
      >
        <MapPin className="h-3 w-3 text-surface-500 flex-shrink-0" />
        {SCOPE_OPTIONS.map(({ id, label, activeClass }) => (
          <button
            key={String(id)}
            onClick={() => setScopeFilter(id)}
            aria-pressed={scopeFilter === id}
            className={cn(
              'flex-shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium',
              'border transition-all duration-150',
              scopeFilter === id
                ? activeClass
                : 'bg-transparent text-surface-500 border-surface-500/40 hover:text-surface-400 hover:border-surface-400'
            )}
          >
            {label}
          </button>
        ))}
      </div>}

      {/* Row 4: Tag chips (hidden in Following / For You mode) */}
      {feedMode === 'discover' && <div
        className={cn(
          'flex items-center gap-1.5 px-3 pb-2',
          'overflow-x-auto',
          '[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]'
        )}
        aria-label="Filter by topic tag"
      >
        <Hash className="h-3 w-3 text-surface-500 flex-shrink-0" aria-hidden />
        {/* Clear-tag chip */}
        <button
          onClick={() => setTagFilter(null)}
          aria-pressed={tagFilter === null}
          className={cn(
            'flex-shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium',
            'border transition-all duration-150',
            tagFilter === null
              ? 'bg-surface-400 text-white border-surface-400'
              : 'bg-transparent text-surface-500 border-surface-500/40 hover:text-surface-400 hover:border-surface-400'
          )}
        >
          All
        </button>
        {displayTags.map(({ id, label }) => (
          <button
            key={id}
            onClick={() => setTagFilter(tagFilter === id ? null : id)}
            aria-pressed={tagFilter === id}
            className={cn(
              'flex-shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium',
              'border transition-all duration-150',
              tagFilter === id
                ? 'bg-emerald/20 text-emerald border-emerald/50'
                : 'bg-transparent text-surface-500 border-surface-500/40 hover:text-surface-400 hover:border-surface-400'
            )}
          >
            #{label}
          </button>
        ))}
        {/* Separator + browse all tags link */}
        <div className="h-3.5 w-px bg-surface-500/30 flex-shrink-0 mx-0.5" aria-hidden />
        <Link
          href="/tags"
          className={cn(
            'flex-shrink-0 flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium',
            'border border-surface-500/40 text-surface-500',
            'hover:text-surface-300 hover:border-surface-400 transition-all duration-150'
          )}
          aria-label="Browse all tags"
        >
          <LayoutGrid className="h-2.5 w-2.5" />
          All tags
        </Link>
      </div>}

      {/* Following mode: sort strip (only New/Hot/Top, no status or category) */}
      {feedMode === 'following' && (
        <div
          className={cn(
            'flex items-center gap-2 px-3 py-1.5',
            'overflow-x-auto',
            '[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]'
          )}
        >
          <div className="flex items-center gap-0.5 flex-shrink-0 bg-surface-200/80 border border-surface-300 rounded-lg p-0.5 backdrop-blur-sm">
            {SORT_OPTIONS.map(({ id, label, icon: Icon }) => (
              <button
                key={id}
                onClick={() => setSort(id)}
                aria-pressed={sort === id}
                className={cn(
                  'flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-all duration-150',
                  sort === id
                    ? 'bg-purple/80 text-white shadow-sm'
                    : 'text-surface-500 hover:text-surface-700'
                )}
              >
                <Icon className="h-3 w-3 flex-shrink-0" />
                <span>{label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* For You mode: sort strip + preferred category pills */}
      {feedMode === 'foryou' && (
        <div className="flex flex-col gap-1 pb-1">
          {/* Sort controls */}
          <div
            className={cn(
              'flex items-center gap-2 px-3 py-1.5',
              'overflow-x-auto',
              '[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]'
            )}
          >
            <div className="flex items-center gap-0.5 flex-shrink-0 bg-surface-200/80 border border-surface-300 rounded-lg p-0.5 backdrop-blur-sm">
              {SORT_OPTIONS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setSort(id)}
                  aria-pressed={sort === id}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-all duration-150',
                    sort === id
                      ? 'bg-gold/20 text-gold shadow-sm border border-gold/30'
                      : 'text-surface-500 hover:text-surface-700'
                  )}
                >
                  <Icon className="h-3 w-3 flex-shrink-0" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Preferred category pills — read-only, shows calibration source */}
          {preferredCategories.length > 0 && (
            <div
              className={cn(
                'flex items-center gap-1.5 px-3 pb-1',
                'overflow-x-auto',
                '[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]'
              )}
              aria-label="Your preferred categories"
            >
              {/* Source indicator icon */}
              {preferenceSource === 'history' ? (
                <History
                  className="h-3 w-3 text-emerald/70 flex-shrink-0"
                  aria-hidden="true"
                />
              ) : (
                <Sparkles className="h-3 w-3 text-gold/70 flex-shrink-0" aria-hidden />
              )}
              {preferredCategories.map((cat) => (
                <span
                  key={cat}
                  className={cn(
                    'flex-shrink-0 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium',
                    preferenceSource === 'history'
                      ? 'bg-emerald/10 text-emerald border border-emerald/20'
                      : 'bg-gold/10 text-gold border border-gold/20'
                  )}
                >
                  {cat}
                </span>
              ))}
              {/* Recalibrate / calibrate CTA */}
              <Link
                href="/onboarding"
                className={cn(
                  'flex-shrink-0 flex items-center gap-1 px-2.5 py-0.5 rounded-full text-[11px] font-mono font-medium',
                  'border border-surface-500/40 text-surface-500',
                  'hover:text-surface-300 hover:border-surface-400 transition-all duration-150 ml-1'
                )}
                aria-label={
                  preferenceSource === 'history'
                    ? 'Take the quiz to personalise your feed further'
                    : 'Recalibrate your feed preferences'
                }
              >
                {preferenceSource === 'history' ? 'Take quiz' : 'Recalibrate'}
              </Link>
            </div>
          )}
          {/* History inference notice */}
          {preferenceSource === 'history' && inferredFromVotes > 0 && (
            <p className="px-3 pb-1 text-[10px] font-mono text-surface-500">
              Personalised from {inferredFromVotes} vote{inferredFromVotes !== 1 ? 's' : ''} — take the quiz for better accuracy
            </p>
          )}
        </div>
      )}

      {/* ── My Tags mode ──────────────────────────────────────────────────── */}
      {feedMode === 'mytags' && (
        <div className="flex flex-col gap-1 pb-1">
          {/* Sort controls */}
          <div
            className={cn(
              'flex items-center gap-2 px-3 py-1.5',
              'overflow-x-auto',
              '[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]'
            )}
          >
            <div className="flex items-center gap-0.5 flex-shrink-0 bg-surface-200/80 border border-surface-300 rounded-lg p-0.5 backdrop-blur-sm">
              {SORT_OPTIONS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setSort(id)}
                  aria-pressed={sort === id}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-all duration-150',
                    sort === id
                      ? 'bg-for-500/20 text-for-300 shadow-sm border border-for-500/30'
                      : 'text-surface-500 hover:text-surface-700'
                  )}
                >
                  <Icon className="h-3 w-3 flex-shrink-0" />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {/* Link to browse / manage followed tags */}
            <Link
              href="/tags"
              className={cn(
                'flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium',
                'border border-surface-500/40 text-surface-500',
                'hover:text-surface-300 hover:border-surface-400 transition-all duration-150'
              )}
            >
              <Hash className="h-3 w-3" />
              Manage tags
            </Link>
          </div>
        </div>
      )}

      {/* ── Battleground mode ─────────────────────────────────────────────── */}
      {feedMode === 'battleground' && (
        <div className="flex flex-col gap-1 pb-1">
          {/* Contextual label */}
          <div className="flex items-center gap-2 px-3 py-1">
            <Swords className="h-3 w-3 text-against-300 flex-shrink-0" />
            <p className="text-[11px] font-mono text-surface-400">
              Active topics where opinion is split closest to 50/50 — your vote matters most here
            </p>
          </div>

          {/* Sort controls */}
          <div
            className={cn(
              'flex items-center gap-2 px-3 py-1.5',
              'overflow-x-auto',
              '[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]'
            )}
          >
            <div className="flex items-center gap-0.5 flex-shrink-0 bg-surface-200/80 border border-surface-300 rounded-lg p-0.5 backdrop-blur-sm">
              {SORT_OPTIONS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setSort(id)}
                  aria-pressed={sort === id}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-all duration-150',
                    sort === id
                      ? 'bg-gradient-to-r from-for-600/80 to-against-600/80 text-white shadow-sm'
                      : 'text-surface-500 hover:text-surface-700'
                  )}
                >
                  <Icon className="h-3 w-3 flex-shrink-0" />
                  <span>{label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* ── Unvoted mode ──────────────────────────────────────────────────── */}
      {feedMode === 'unvoted' && (
        <div className="flex flex-col gap-1 pb-1">
          {/* Contextual label */}
          <div className="flex items-center gap-2 px-3 py-1">
            <Vote className="h-3 w-3 text-emerald flex-shrink-0" />
            <p className="text-[11px] font-mono text-emerald/80">
              Topics in your preferred categories that you haven&rsquo;t voted on yet
            </p>
          </div>

          {/* Sort controls */}
          <div
            className={cn(
              'flex items-center gap-2 px-3 py-1.5',
              'overflow-x-auto',
              '[&::-webkit-scrollbar]:hidden [-ms-overflow-style:none] [scrollbar-width:none]'
            )}
          >
            <div className="flex items-center gap-0.5 flex-shrink-0 bg-surface-200/80 border border-surface-300 rounded-lg p-0.5 backdrop-blur-sm">
              {SORT_OPTIONS.map(({ id, label, icon: Icon }) => (
                <button
                  key={id}
                  onClick={() => setSort(id)}
                  aria-pressed={sort === id}
                  className={cn(
                    'flex items-center gap-1 px-2.5 py-1 rounded-md text-xs font-mono font-medium transition-all duration-150',
                    sort === id
                      ? 'bg-emerald/20 text-emerald shadow-sm border border-emerald/30'
                      : 'text-surface-500 hover:text-surface-700'
                  )}
                >
                  <Icon className="h-3 w-3 flex-shrink-0" />
                  <span>{label}</span>
                </button>
              ))}
            </div>

            {/* Link to calibrate preferences */}
            <Link
              href="/onboarding"
              className={cn(
                'flex-shrink-0 flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-mono font-medium',
                'border border-emerald/30 text-emerald/70',
                'hover:text-emerald hover:border-emerald/50 transition-all duration-150'
              )}
            >
              <Sparkles className="h-3 w-3" />
              Recalibrate
            </Link>
          </div>
        </div>
      )}
    </div>
  )
}
