'use client'

import { useEffect, useState } from 'react'
import { ArrowDown, GitBranch, Trophy } from 'lucide-react'
import type { Topic, ChainNode } from '@/lib/supabase/types'
import { cn } from '@/lib/utils/cn'

interface ChainVisualizationProps {
  topic: Topic
  className?: string
}

interface ChainHistoryResponse {
  nodes: ChainNode[]
  alternatives?: ChainNode[]
}

function truncate(text: string, length: number): string {
  if (text.length <= length) return text
  return text.slice(0, length).trimEnd() + '...'
}

function statusLabel(node: ChainNode): string {
  if (node.status === 'law') return 'LAW'
  if (node.status === 'failed') return 'Failed'
  if (node.status === 'continued') return 'Continued'
  if (node.status === 'archived') return 'Archived'
  return node.status.toUpperCase()
}

export function ChainVisualization({
  topic,
  className,
}: ChainVisualizationProps) {
  const [history, setHistory] = useState<ChainHistoryResponse | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    fetch(`/api/topics/${topic.id}/chain-history`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data: ChainHistoryResponse | null) => {
        if (!cancelled) {
          setHistory(data)
          setLoading(false)
        }
      })
      .catch(() => {
        if (!cancelled) setLoading(false)
      })

    return () => {
      cancelled = true
    }
  }, [topic.id])

  if (topic.chain_depth <= 0 && !topic.parent_id) return null

  if (loading) {
    return (
      <div
        className={cn(
          'rounded-2xl border border-surface-300 bg-surface-100 p-5',
          className
        )}
      >
        <div className="h-24 animate-pulse rounded-xl bg-surface-200/40" />
      </div>
    )
  }

  const nodes = history?.nodes ?? []
  if (nodes.length === 0) return null

  return (
    <div
      className={cn(
        'rounded-2xl border border-surface-300 bg-surface-100 p-5',
        className
      )}
    >
      {/* Header */}
      <div className="flex items-center gap-2 mb-5">
        <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-surface-300">
          <GitBranch className="h-3.5 w-3.5 text-surface-600" />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-surface-600">
            Chain history
          </p>
          <p className="text-[11px] text-surface-500">
            {nodes.length} {nodes.length === 1 ? 'link' : 'links'} in this chain
          </p>
        </div>
      </div>

      {/* Vertical tree */}
      <div className="space-y-2">
        {nodes.map((node, index) => {
          const isLast = index === nodes.length - 1
          const isLaw = node.status === 'law'
          const isWinningPath = node.winning_path

          return (
            <div key={node.id}>
              <div
                className={cn(
                  'relative rounded-xl border px-4 py-3 transition-colors',
                  node.is_current && 'border-gold glow-gold',
                  !node.is_current && isWinningPath && 'border-gold/40 bg-gold/5',
                  !node.is_current && !isWinningPath && 'border-surface-300 bg-surface-50 opacity-60'
                )}
              >
                {/* Depth indicator */}
                <div className="flex items-start justify-between gap-2 mb-1.5">
                  <div className="flex items-center gap-2">
                    {node.connector ? (
                      <span
                        className={cn(
                          'inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                          isWinningPath
                            ? 'bg-gold/15 text-gold'
                            : 'bg-surface-300 text-surface-500'
                        )}
                      >
                        ...{node.connector}
                      </span>
                    ) : (
                      <span className="inline-flex items-center rounded-full bg-surface-300 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-surface-500">
                        Original
                      </span>
                    )}
                    <span className="text-[10px] text-surface-500">
                      Depth {node.chain_depth}
                    </span>
                  </div>
                  <div className="flex items-center gap-1.5">
                    {isLaw && (
                      <span className="inline-flex items-center gap-1 rounded-full bg-emerald/20 px-2 py-0.5 text-[10px] font-bold text-emerald">
                        <Trophy className="h-2.5 w-2.5" />
                        LAW
                      </span>
                    )}
                    {!isLaw && (
                      <span className="text-[10px] text-surface-500 uppercase font-semibold">
                        {statusLabel(node)}
                      </span>
                    )}
                  </div>
                </div>

                {/* Statement */}
                <p
                  className={cn(
                    'text-sm leading-snug',
                    node.is_current
                      ? 'text-white font-medium'
                      : isWinningPath
                        ? 'text-surface-700'
                        : 'text-surface-500'
                  )}
                >
                  {truncate(node.statement, 140)}
                </p>

                {/* Vote % */}
                {node.total_votes > 0 && (
                  <div className="mt-2 flex items-center gap-2 text-[11px]">
                    <span
                      className={cn(
                        'font-mono font-bold tabular-nums',
                        isWinningPath ? 'text-gold' : 'text-surface-500'
                      )}
                    >
                      {Math.round(node.blue_pct)}%
                    </span>
                    <span className="text-surface-500 tabular-nums">
                      {node.total_votes} votes
                    </span>
                  </div>
                )}
              </div>

              {/* Connector arrow */}
              {!isLast && (
                <div className="flex justify-center py-1">
                  <ArrowDown className="h-4 w-4 text-surface-400" />
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Losing alternatives, if any */}
      {history?.alternatives && history.alternatives.length > 0 && (
        <div className="mt-5 pt-4 border-t border-surface-300">
          <p className="text-[10px] font-semibold uppercase tracking-wider text-surface-500 mb-2">
            Losing continuations
          </p>
          <div className="space-y-1.5">
            {history.alternatives.map((alt) => (
              <div
                key={alt.id}
                className="rounded-lg bg-surface-200/40 px-3 py-2"
              >
                <p className="text-xs text-surface-500 leading-snug line-through decoration-surface-400/60">
                  ...{alt.connector} {truncate(alt.statement, 100)}
                </p>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  )
}
