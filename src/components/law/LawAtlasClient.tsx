'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Gavel,
  Globe,
  MapPin,
  X,
  ThumbsUp,
  ThumbsDown,
  Filter,
  BarChart2,
  ArrowUpRight,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import { EmptyState } from '@/components/ui/EmptyState'
import type { AtlasLaw, AtlasMatrix } from '@/app/api/laws/atlas/route'

// ─── Constants ─────────────────────────────────────────────────────────────────

const SCOPES = ['Global', 'National', 'Regional', 'Local'] as const
const CATEGORIES = [
  'Economics', 'Politics', 'Technology', 'Science', 'Ethics',
  'Philosophy', 'Culture', 'Health', 'Environment', 'Education', 'Other',
] as const

const SCOPE_CONFIG: Record<
  string,
  { icon: typeof Globe; color: string; bg: string; border: string; badge: string }
> = {
  Global:   { icon: Globe,  color: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/30',     badge: 'bg-for-600/80 text-white' },
  National: { icon: MapPin, color: 'text-emerald',     bg: 'bg-emerald/10',     border: 'border-emerald/30',     badge: 'bg-emerald/80 text-white' },
  Regional: { icon: MapPin, color: 'text-gold',        bg: 'bg-gold/10',        border: 'border-gold/30',        badge: 'bg-gold/80 text-black' },
  Local:    { icon: MapPin, color: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/30', badge: 'bg-against-600/80 text-white' },
}

const CATEGORY_COLORS: Record<string, string> = {
  Economics: '#f59e0b', Politics: '#60a5fa', Technology: '#8b5cf6',
  Science: '#10b981', Ethics: '#f87171', Philosophy: '#818cf8',
  Culture: '#fb923c', Health: '#f472b6', Environment: '#4ade80',
  Education: '#22d3ee', Other: '#71717a',
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeDate(iso: string): string {
  const date = new Date(iso)
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })
}

function formatVotes(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`
  return String(n)
}

// ─── Matrix heat cell ─────────────────────────────────────────────────────────

function MatrixCell({
  count,
  maxCount,
  scope,
  category,
  isSelected,
  onClick,
}: {
  count: number
  maxCount: number
  scope: string
  category: string
  isSelected: boolean
  onClick: () => void
}) {
  const intensity = maxCount > 0 ? count / maxCount : 0
  const cat = SCOPE_CONFIG[scope] ?? SCOPE_CONFIG.Global

  return (
    <button
      onClick={onClick}
      title={`${scope} · ${category}: ${count} law${count !== 1 ? 's' : ''}`}
      aria-pressed={isSelected}
      className={cn(
        'relative h-10 sm:h-12 w-full rounded-lg border transition-all duration-150',
        'hover:scale-105 focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500/50',
        isSelected
          ? `${cat.border} scale-105 ring-2 ring-for-500/40`
          : count > 0
          ? 'border-surface-400/40 hover:border-surface-400'
          : 'border-surface-300/20 opacity-40 cursor-default hover:scale-100'
      )}
      style={{
        backgroundColor:
          count > 0
            ? `${CATEGORY_COLORS[category] ?? '#71717a'}${Math.round(intensity * 0.35 * 255).toString(16).padStart(2, '0')}`
            : 'transparent',
      }}
      disabled={count === 0}
    >
      {count > 0 && (
        <span
          className={cn(
            'absolute inset-0 flex items-center justify-center',
            'text-[11px] font-mono font-bold',
            isSelected ? 'text-white' : intensity > 0.5 ? 'text-white' : 'text-surface-600'
          )}
        >
          {count}
        </span>
      )}
    </button>
  )
}

// ─── Law row ─────────────────────────────────────────────────────────────────

function LawRow({ law }: { law: AtlasLaw }) {
  const forPct = Math.round(law.blue_pct ?? 50)
  const againstPct = 100 - forPct
  const scopeConf = SCOPE_CONFIG[law.scope] ?? SCOPE_CONFIG.Global
  const catColor = CATEGORY_COLORS[law.category ?? 'Other'] ?? CATEGORY_COLORS.Other

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      layout
    >
      <Link
        href={`/law/${law.id}`}
        className={cn(
          'block group p-4 rounded-xl border transition-all duration-150',
          'bg-surface-100/60 border-surface-300/60',
          'hover:bg-surface-200/80 hover:border-surface-400/60'
        )}
      >
        <div className="flex items-start gap-3">
          {/* Scope badge */}
          <span
            className={cn(
              'flex-shrink-0 mt-0.5 px-2 py-0.5 rounded-full text-[10px] font-mono font-semibold',
              scopeConf.badge
            )}
          >
            {law.scope}
          </span>

          {/* Statement */}
          <p className="flex-1 min-w-0 text-sm font-medium text-white leading-snug line-clamp-2 group-hover:text-for-300 transition-colors">
            {law.statement}
          </p>

          <ArrowUpRight className="flex-shrink-0 h-4 w-4 text-surface-500 group-hover:text-for-400 transition-colors mt-0.5" />
        </div>

        <div className="mt-2.5 flex items-center gap-3">
          {/* Category dot */}
          {law.category && (
            <span className="flex items-center gap-1 text-[11px] font-mono text-surface-500">
              <span
                className="inline-block h-2 w-2 rounded-full flex-shrink-0"
                style={{ backgroundColor: catColor }}
              />
              {law.category}
            </span>
          )}

          {/* Vote split */}
          <div className="flex items-center gap-1.5 text-[11px] font-mono">
            <ThumbsUp className="h-3 w-3 text-for-400" />
            <span className="text-for-400 font-semibold">{forPct}%</span>
            <span className="text-surface-500">·</span>
            <ThumbsDown className="h-3 w-3 text-against-400" />
            <span className="text-against-400 font-semibold">{againstPct}%</span>
          </div>

          {/* Total votes */}
          {law.total_votes != null && law.total_votes > 0 && (
            <span className="text-[11px] font-mono text-surface-500 ml-auto">
              {formatVotes(law.total_votes)} votes · {relativeDate(law.established_at)}
            </span>
          )}
        </div>

        {/* Mini vote bar */}
        <div className="mt-2 h-1 rounded-full bg-surface-300 overflow-hidden">
          <div
            className="h-full bg-gradient-to-r from-for-700 to-for-500 rounded-l-full"
            style={{ width: `${forPct}%` }}
          />
        </div>
      </Link>
    </motion.div>
  )
}

// ─── Main client ──────────────────────────────────────────────────────────────

interface LawAtlasClientProps {
  data: AtlasMatrix
}

export function LawAtlasClient({ data }: LawAtlasClientProps) {
  const { matrix, byScope, byCategory, laws } = data

  const [selectedScope, setSelectedScope] = useState<string | null>(null)
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null)
  const [sortBy, setSortBy] = useState<'date' | 'votes'>('date')

  // Max cell value for heat intensity
  const maxCount = useMemo(() => {
    let m = 0
    for (const scope of Object.values(matrix)) {
      for (const count of Object.values(scope)) {
        if (count > m) m = count
      }
    }
    return m
  }, [matrix])

  // Active categories (appear in at least one law)
  const activeCategories = useMemo(
    () => CATEGORIES.filter((c) => byCategory[c] != null && byCategory[c] > 0),
    [byCategory]
  )

  // Filtered + sorted law list
  const filteredLaws = useMemo(() => {
    let list = laws
    if (selectedScope) list = list.filter((l) => l.scope === selectedScope)
    if (selectedCategory) {
      list = list.filter((l) => {
        const cat = l.category
          ? (CATEGORIES.find((c) => c.toLowerCase() === l.category!.toLowerCase()) ?? 'Other')
          : 'Other'
        return cat === selectedCategory
      })
    }
    if (sortBy === 'votes') {
      list = [...list].sort((a, b) => (b.total_votes ?? 0) - (a.total_votes ?? 0))
    }
    return list
  }, [laws, selectedScope, selectedCategory, sortBy])

  function toggleScope(scope: string) {
    setSelectedScope((s) => (s === scope ? null : scope))
  }

  function toggleCategory(cat: string) {
    setSelectedCategory((c) => (c === cat ? null : cat))
  }

  function clearFilters() {
    setSelectedScope(null)
    setSelectedCategory(null)
  }

  const hasFilters = selectedScope !== null || selectedCategory !== null
  const activeScopes = SCOPES.filter((s) => byScope[s] != null && byScope[s] > 0)

  return (
    <div className="space-y-8">
      {/* ── Stats strip ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        {SCOPES.map((scope) => {
          const conf = SCOPE_CONFIG[scope]
          const count = byScope[scope] ?? 0
          const Icon = conf.icon
          return (
            <button
              key={scope}
              onClick={() => toggleScope(scope)}
              disabled={count === 0}
              aria-pressed={selectedScope === scope}
              className={cn(
                'flex flex-col gap-1 p-4 rounded-xl border transition-all text-left',
                'disabled:opacity-40 disabled:cursor-not-allowed',
                selectedScope === scope
                  ? `${conf.bg} ${conf.border} ring-2 ring-for-500/30`
                  : 'bg-surface-100 border-surface-300 hover:border-surface-400'
              )}
            >
              <div className="flex items-center gap-2">
                <Icon className={cn('h-4 w-4', conf.color)} />
                <span className={cn('text-xs font-mono font-semibold', conf.color)}>
                  {scope}
                </span>
              </div>
              <span className="text-2xl font-mono font-bold text-white">{count}</span>
              <span className="text-[11px] font-mono text-surface-500">
                {count === 1 ? 'law' : 'laws'}
              </span>
            </button>
          )
        })}
      </div>

      {/* ── Heat matrix ───────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <BarChart2 className="h-4 w-4 text-surface-500" />
            <h2 className="text-sm font-mono font-semibold text-surface-500 uppercase tracking-wider">
              Scope × Category Matrix
            </h2>
          </div>
          <span className="text-[11px] font-mono text-surface-500">
            Click a cell to filter
          </span>
        </div>

        <div className="overflow-x-auto rounded-xl border border-surface-300 bg-surface-100">
          <table className="w-full min-w-[520px]">
            <thead>
              <tr>
                <th className="w-24 p-2 text-left">
                  <span className="sr-only">Scope</span>
                </th>
                {activeCategories.map((cat) => (
                  <th key={cat} className="p-1.5 text-center">
                    <button
                      onClick={() => toggleCategory(cat)}
                      aria-pressed={selectedCategory === cat}
                      className={cn(
                        'text-[10px] font-mono font-semibold transition-colors px-1.5 py-0.5 rounded',
                        selectedCategory === cat
                          ? 'text-white bg-surface-400'
                          : 'text-surface-500 hover:text-surface-300'
                      )}
                      style={selectedCategory === cat ? { backgroundColor: CATEGORY_COLORS[cat] + '80' } : {}}
                    >
                      {cat}
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {activeScopes.map((scope) => {
                const conf = SCOPE_CONFIG[scope]
                const Icon = conf.icon
                return (
                  <tr key={scope} className="border-t border-surface-300/40">
                    <td className="p-2">
                      <button
                        onClick={() => toggleScope(scope)}
                        aria-pressed={selectedScope === scope}
                        className={cn(
                          'flex items-center gap-1.5 text-xs font-mono font-semibold transition-colors',
                          selectedScope === scope ? conf.color : 'text-surface-500 hover:text-surface-300'
                        )}
                      >
                        <Icon className="h-3 w-3 flex-shrink-0" />
                        {scope}
                        <span className="text-[10px] font-normal opacity-60">({byScope[scope] ?? 0})</span>
                      </button>
                    </td>
                    {activeCategories.map((cat) => {
                      const count = matrix[scope]?.[cat] ?? 0
                      const isSelected = selectedScope === scope && selectedCategory === cat
                      return (
                        <td key={cat} className="p-1.5">
                          <MatrixCell
                            count={count}
                            maxCount={maxCount}
                            scope={scope}
                            category={cat}
                            isSelected={isSelected}
                            onClick={() => {
                              toggleScope(scope)
                              toggleCategory(cat)
                            }}
                          />
                        </td>
                      )
                    })}
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Filter controls ───────────────────────────────────────────── */}
      {hasFilters && (
        <div className="flex items-center gap-2 flex-wrap">
          <Filter className="h-3.5 w-3.5 text-surface-500 flex-shrink-0" />
          <span className="text-xs font-mono text-surface-500">Showing:</span>

          {selectedScope && (
            <span
              className={cn(
                'flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full text-xs font-mono font-semibold',
                SCOPE_CONFIG[selectedScope]?.badge ?? 'bg-surface-400 text-white'
              )}
            >
              {selectedScope}
              <button
                onClick={() => setSelectedScope(null)}
                aria-label={`Remove ${selectedScope} filter`}
                className="ml-0.5 rounded-full p-0.5 hover:bg-white/20 transition-colors"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          )}

          {selectedCategory && (
            <span
              className="flex items-center gap-1 pl-2.5 pr-1 py-0.5 rounded-full text-xs font-mono font-semibold"
              style={{ backgroundColor: (CATEGORY_COLORS[selectedCategory] ?? '#71717a') + '33', color: CATEGORY_COLORS[selectedCategory] ?? '#71717a', border: `1px solid ${CATEGORY_COLORS[selectedCategory] ?? '#71717a'}50` }}
            >
              {selectedCategory}
              <button
                onClick={() => setSelectedCategory(null)}
                aria-label={`Remove ${selectedCategory} filter`}
                className="ml-0.5 rounded-full p-0.5 hover:bg-white/20 transition-colors"
              >
                <X className="h-2.5 w-2.5" />
              </button>
            </span>
          )}

          <button
            onClick={clearFilters}
            className="text-xs font-mono text-surface-500 hover:text-surface-300 underline transition-colors"
          >
            Clear all
          </button>

          <span className="ml-auto text-xs font-mono text-surface-500">
            {filteredLaws.length} law{filteredLaws.length !== 1 ? 's' : ''}
          </span>
        </div>
      )}

      {/* ── Sort + list ───────────────────────────────────────────────── */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Gavel className="h-4 w-4 text-emerald" />
            <h2 className="text-sm font-mono font-semibold text-surface-500 uppercase tracking-wider">
              {hasFilters ? 'Matching Laws' : 'All Laws'}
            </h2>
          </div>

          {/* Sort toggle */}
          <div className="flex items-center gap-0.5 bg-surface-200 border border-surface-300 rounded-lg p-0.5">
            {(['date', 'votes'] as const).map((s) => (
              <button
                key={s}
                onClick={() => setSortBy(s)}
                aria-pressed={sortBy === s}
                className={cn(
                  'px-2.5 py-1 rounded-md text-[11px] font-mono font-medium transition-all',
                  sortBy === s ? 'bg-surface-400 text-white' : 'text-surface-500 hover:text-surface-300'
                )}
              >
                {s === 'date' ? 'Newest' : 'Most Voted'}
              </button>
            ))}
          </div>
        </div>

        <AnimatePresence mode="popLayout">
          {filteredLaws.length === 0 ? (
            <EmptyState
              icon={Gavel}
              title="No laws found"
              description="Try adjusting your filters or clearing the selection."
              actions={[{ label: 'Clear filters', onClick: clearFilters }]}
            />
          ) : (
            <motion.div layout className="space-y-2">
              {filteredLaws.map((law) => (
                <LawRow key={law.id} law={law} />
              ))}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
