'use client'

import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import dynamic from 'next/dynamic'
import { Check, Copy, RotateCcw, Search, X } from 'lucide-react'
import type { CoalitionNode, TreatyEdge } from './CoalitionNetworkGraph'
import { cn } from '@/lib/utils/cn'

const CoalitionNetworkGraph = dynamic(
  () => import('./CoalitionNetworkGraph').then((m) => m.CoalitionNetworkGraph),
  {
    ssr: false,
    loading: () => (
      <div className="flex-1 flex items-center justify-center min-h-[480px]">
        <div className="text-surface-500 text-sm font-mono">Loading network…</div>
      </div>
    ),
  },
)

interface CoalitionNetworkViewProps {
  coalitions: CoalitionNode[]
  treaties: TreatyEdge[]
}

const TREATY_TYPES = [
  { id: 'alliance',          label: 'Alliances',       color: 'text-for-400',    border: 'border-for-500/50',    activeBg: 'bg-for-500/20' },
  { id: 'non_aggression',    label: 'Non-Aggression',  color: 'text-gold',        border: 'border-gold/50',        activeBg: 'bg-gold/20' },
  { id: 'research_exchange', label: 'Research',        color: 'text-purple',      border: 'border-purple/50',      activeBg: 'bg-purple/20' },
] as const

function readParams(): { q: string; hiddenTypes: Set<string> } {
  if (typeof window === 'undefined') return { q: '', hiddenTypes: new Set() }
  const sp = new URLSearchParams(window.location.search)
  const q = sp.get('q') ?? ''
  const hidden = new Set(
    (sp.get('hide') ?? '').split(',').map((s) => s.trim().toLowerCase()).filter(Boolean),
  )
  return { q, hiddenTypes: hidden }
}

function writeParams(q: string, hiddenTypes: Set<string>) {
  if (typeof window === 'undefined') return
  const sp = new URLSearchParams(window.location.search)
  if (q) {
    sp.set('q', q)
  } else {
    sp.delete('q')
  }
  if (hiddenTypes.size > 0) {
    sp.set('hide', Array.from(hiddenTypes).join(','))
  } else {
    sp.delete('hide')
  }
  const qs = sp.toString()
  window.history.replaceState(null, '', window.location.pathname + (qs ? `?${qs}` : ''))
}

export function CoalitionNetworkView({ coalitions, treaties }: CoalitionNetworkViewProps) {
  const [search, setSearch] = useState('')
  const [hiddenTypes, setHiddenTypes] = useState<Set<string>>(new Set())
  const [copied, setCopied] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)
  const initialized = useRef(false)

  // Read URL params on mount
  useEffect(() => {
    if (initialized.current) return
    initialized.current = true
    const { q, hiddenTypes: ht } = readParams()
    setSearch(q)
    setHiddenTypes(ht)
  }, [])

  // Sync URL params
  useEffect(() => {
    writeParams(search, hiddenTypes)
  }, [search, hiddenTypes])

  const toggleType = useCallback((type: string) => {
    setHiddenTypes((prev) => {
      const next = new Set(prev)
      if (next.has(type)) next.delete(type)
      else next.add(type)
      return next
    })
  }, [])

  const handleReset = useCallback(() => {
    setSearch('')
    setHiddenTypes(new Set())
    inputRef.current?.focus()
  }, [])

  const handleCopy = useCallback(async () => {
    try {
      await navigator.clipboard.writeText(window.location.href)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch { /* ignore */ }
  }, [])

  const isDirty = search.trim() || hiddenTypes.size > 0

  // Stats
  const activeTreaties = useMemo(
    () => treaties.filter((t) => !hiddenTypes.has(t.treaty_type)),
    [treaties, hiddenTypes],
  )

  const alliancedCoalitionIds = useMemo(() => {
    const ids = new Set<string>()
    for (const t of activeTreaties) {
      ids.add(t.source)
      ids.add(t.target)
    }
    return ids
  }, [activeTreaties])

  const treatyCounts = useMemo(() => {
    const counts: Record<string, number> = {}
    for (const t of treaties) {
      counts[t.treaty_type] = (counts[t.treaty_type] ?? 0) + 1
    }
    return counts
  }, [treaties])

  return (
    <div className="flex flex-col gap-4">
      {/* Controls */}
      <div className="flex flex-col gap-3">
        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-surface-500 pointer-events-none" />
          <input
            ref={inputRef}
            type="text"
            placeholder="Search coalitions by name or tag…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={cn(
              'w-full pl-9 pr-9 py-2.5 rounded-xl text-sm font-mono',
              'bg-surface-200 border border-surface-300 text-white placeholder:text-surface-500',
              'focus:outline-none focus:border-for-500/50 focus:ring-1 focus:ring-for-500/30',
              'transition-colors',
            )}
          />
          {search && (
            <button
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-surface-500 hover:text-white transition-colors"
              aria-label="Clear search"
            >
              <X className="h-4 w-4" />
            </button>
          )}
        </div>

        {/* Treaty type filters + actions */}
        <div className="flex flex-wrap items-center gap-2">
          {TREATY_TYPES.map((tt) => {
            const active = !hiddenTypes.has(tt.id)
            const count = treatyCounts[tt.id] ?? 0
            return (
              <button
                key={tt.id}
                onClick={() => toggleType(tt.id)}
                aria-pressed={active}
                className={cn(
                  'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border transition-all',
                  active
                    ? cn(tt.activeBg, tt.color, tt.border)
                    : 'bg-surface-200 text-surface-500 border-surface-300 hover:border-surface-400',
                )}
              >
                {tt.label}
                <span
                  className={cn(
                    'inline-flex items-center justify-center h-4 min-w-[16px] px-1 rounded text-[10px]',
                    active ? 'bg-surface-300/60' : 'bg-surface-300/40 text-surface-600',
                  )}
                >
                  {count}
                </span>
              </button>
            )
          })}

          <div className="ml-auto flex items-center gap-1.5">
            {isDirty && (
              <button
                onClick={handleReset}
                title="Reset filters"
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border border-surface-300 bg-surface-200 text-surface-500 hover:text-white hover:border-surface-400 transition-all"
              >
                <RotateCcw className="h-3 w-3" />
                Reset
              </button>
            )}
            <button
              onClick={handleCopy}
              title="Copy link with current filters"
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono border border-surface-300 bg-surface-200 text-surface-500 hover:text-white hover:border-surface-400 transition-all"
            >
              {copied ? <Check className="h-3 w-3 text-emerald" /> : <Copy className="h-3 w-3" />}
              {copied ? 'Copied' : 'Share'}
            </button>
          </div>
        </div>
      </div>

      {/* Graph */}
      <CoalitionNetworkGraph
        coalitions={coalitions}
        treaties={treaties}
        searchQuery={search}
        hiddenTypes={hiddenTypes}
        className="w-full"
      />

      {/* Summary stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 text-center">
          <div className="text-2xl font-bold font-mono text-white">
            {alliancedCoalitionIds.size}
          </div>
          <div className="text-xs font-mono text-surface-500 mt-0.5">Coalitions with treaties</div>
        </div>
        <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 text-center">
          <div className="text-2xl font-bold font-mono text-for-400">
            {treaties.length}
          </div>
          <div className="text-xs font-mono text-surface-500 mt-0.5">Active treaties</div>
        </div>
        <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 text-center">
          <div className="text-2xl font-bold font-mono text-gold">
            {coalitions.length}
          </div>
          <div className="text-xs font-mono text-surface-500 mt-0.5">Total coalitions</div>
        </div>
      </div>

      {/* Treaty list table */}
      {activeTreaties.length > 0 && (
        <div className="rounded-xl bg-surface-100 border border-surface-300 overflow-hidden">
          <div className="px-4 py-3 border-b border-surface-300">
            <h2 className="text-sm font-mono font-semibold text-white">Active Treaties</h2>
          </div>
          <div className="divide-y divide-surface-300">
            {activeTreaties.slice(0, 20).map((t) => {
              const srcCoalition = coalitions.find((c) => c.id === t.source)
              const tgtCoalition = coalitions.find((c) => c.id === t.target)
              if (!srcCoalition || !tgtCoalition) return null
              const typeLabel = t.treaty_type === 'alliance'
                ? 'Alliance'
                : t.treaty_type === 'non_aggression'
                ? 'Non-Aggression'
                : 'Research Exchange'
              const typeColor = {
                alliance: 'text-for-400',
                non_aggression: 'text-gold',
                research_exchange: 'text-purple',
              }[t.treaty_type]

              const expiresAt = t.expires_at ? new Date(t.expires_at) : null
              const daysLeft = expiresAt
                ? Math.max(0, Math.ceil((expiresAt.getTime() - Date.now()) / 86400000))
                : null

              return (
                <div key={t.id} className="px-4 py-3 flex items-center gap-3 flex-wrap">
                  <div className="flex items-center gap-1.5 min-w-0 flex-1">
                    <span className="text-xs font-mono text-white font-semibold truncate">
                      [{srcCoalition.tag}]
                    </span>
                    <span className="text-surface-500 text-xs font-mono flex-shrink-0">⟺</span>
                    <span className="text-xs font-mono text-white font-semibold truncate">
                      [{tgtCoalition.tag}]
                    </span>
                    <span className="text-xs font-mono text-surface-600 truncate hidden sm:block">
                      · {t.title}
                    </span>
                  </div>
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <span className={cn('text-[11px] font-mono', typeColor)}>{typeLabel}</span>
                    {daysLeft !== null && (
                      <span className="text-[11px] font-mono text-surface-500">
                        {daysLeft}d left
                      </span>
                    )}
                  </div>
                </div>
              )
            })}
            {activeTreaties.length > 20 && (
              <div className="px-4 py-2 text-[11px] font-mono text-surface-500 text-center">
                +{activeTreaties.length - 20} more treaties
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
