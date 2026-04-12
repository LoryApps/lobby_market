'use client'

import { useEffect, useState } from 'react'
import { ArrowDown, ArrowUp, Loader2, Receipt } from 'lucide-react'
import type {
  CloutTransaction,
  CloutTransactionType,
  Profile,
} from '@/lib/supabase/types'
import { cn } from '@/lib/utils/cn'

type LedgerRow = CloutTransaction & {
  user?: Pick<
    Profile,
    'id' | 'username' | 'display_name' | 'avatar_url' | 'role'
  > | null
}

interface CloutLedgerProps {
  userId?: string
  initialTransactions?: LedgerRow[]
  limit?: number
}

const typeLabel: Record<CloutTransactionType, string> = {
  earned: 'EARNED',
  spent: 'SPENT',
  gifted: 'GIFTED',
  refunded: 'REFUNDED',
}

const typeColor: Record<CloutTransactionType, string> = {
  earned: 'text-emerald',
  spent: 'text-against-400',
  gifted: 'text-purple',
  refunded: 'text-for-400',
}

function formatTime(iso: string): string {
  const date = new Date(iso)
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMin = Math.floor(diffMs / 60000)
  if (diffMin < 1) return 'just now'
  if (diffMin < 60) return `${diffMin}m ago`
  const diffHr = Math.floor(diffMin / 60)
  if (diffHr < 24) return `${diffHr}h ago`
  const diffDay = Math.floor(diffHr / 24)
  if (diffDay < 30) return `${diffDay}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function CloutLedger({
  userId,
  initialTransactions,
  limit = 50,
}: CloutLedgerProps) {
  const [rows, setRows] = useState<LedgerRow[]>(initialTransactions ?? [])
  const [loading, setLoading] = useState(!initialTransactions)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (initialTransactions) return
    let cancelled = false
    ;(async () => {
      try {
        const params = new URLSearchParams()
        if (userId) params.set('user_id', userId)
        params.set('limit', String(limit))
        const res = await fetch(`/api/clout/ledger?${params.toString()}`)
        if (!res.ok) throw new Error('Failed to load ledger')
        const data = await res.json()
        if (cancelled) return
        setRows(data.transactions ?? [])
      } catch (err) {
        if (cancelled) return
        setError(err instanceof Error ? err.message : 'Unknown error')
      } finally {
        if (!cancelled) setLoading(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [userId, limit, initialTransactions])

  if (loading) {
    return (
      <div className="flex items-center justify-center py-10 text-surface-500">
        <Loader2 className="h-5 w-5 animate-spin mr-2" />
        <span className="text-sm font-mono">Loading ledger…</span>
      </div>
    )
  }

  if (error) {
    return (
      <div className="rounded-xl border border-against-500/30 bg-against-500/10 p-4 text-sm font-mono text-against-400">
        {error}
      </div>
    )
  }

  if (rows.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-center">
        <Receipt className="h-10 w-10 text-surface-500 mb-3" />
        <p className="font-mono text-sm text-white">No transactions yet</p>
        <p className="font-mono text-xs text-surface-500 mt-1">
          Cast a vote to earn your first Clout.
        </p>
      </div>
    )
  }

  return (
    <div className="rounded-xl border border-surface-300 bg-surface-100 divide-y divide-surface-300/60">
      {rows.map((tx) => {
        const positive = tx.amount >= 0
        const label = typeLabel[tx.type] ?? tx.type.toUpperCase()
        const color = typeColor[tx.type] ?? 'text-surface-500'
        const name =
          tx.user?.display_name ?? tx.user?.username ?? 'anonymous'
        return (
          <div
            key={tx.id}
            className="flex items-center gap-3 px-4 py-3 font-mono text-xs"
          >
            <div
              className={cn(
                'flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-lg',
                positive
                  ? 'bg-emerald/10 text-emerald'
                  : 'bg-against-500/10 text-against-400'
              )}
            >
              {positive ? (
                <ArrowUp className="h-4 w-4" />
              ) : (
                <ArrowDown className="h-4 w-4" />
              )}
            </div>
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span
                  className={cn(
                    'text-[10px] font-semibold uppercase tracking-wider',
                    color
                  )}
                >
                  {label}
                </span>
                <span className="text-surface-500 truncate">
                  @{tx.user?.username ?? 'unknown'}
                </span>
              </div>
              <p className="mt-0.5 text-surface-700 truncate">{tx.reason}</p>
            </div>
            <div className="flex flex-col items-end flex-shrink-0">
              <span
                className={cn(
                  'text-sm font-semibold tabular-nums',
                  positive ? 'text-emerald' : 'text-against-400'
                )}
              >
                {positive ? '+' : ''}
                {tx.amount.toLocaleString()}
              </span>
              <span className="text-[10px] text-surface-500 mt-0.5">
                {formatTime(tx.created_at)}
              </span>
            </div>
            <span className="sr-only">user {name}</span>
          </div>
        )
      })}
    </div>
  )
}
