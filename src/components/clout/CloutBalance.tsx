'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { Coins, ArrowUpRight, ArrowDown, Loader2 } from 'lucide-react'
import type { CloutTransaction } from '@/lib/supabase/types'
import { cn } from '@/lib/utils/cn'

interface BalanceResponse {
  profile: { id: string; username: string; clout: number } | null
  balance: number
  transactions: CloutTransaction[]
}

interface CloutBalanceProps {
  initialBalance?: number
  initialTransactions?: CloutTransaction[]
}

export function CloutBalance({
  initialBalance,
  initialTransactions,
}: CloutBalanceProps) {
  const [balance, setBalance] = useState<number | null>(
    typeof initialBalance === 'number' ? initialBalance : null
  )
  const [transactions, setTransactions] = useState<CloutTransaction[]>(
    initialTransactions ?? []
  )
  const [loading, setLoading] = useState(initialBalance === undefined)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (initialBalance !== undefined) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch('/api/clout/balance')
        if (!res.ok) {
          throw new Error(
            res.status === 401 ? 'Log in to view Clout' : 'Failed to load'
          )
        }
        const data: BalanceResponse = await res.json()
        if (cancelled) return
        setBalance(data.balance ?? 0)
        setTransactions(data.transactions ?? [])
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
  }, [initialBalance])

  const weekEarned = transactions
    .filter((t) => t.amount > 0)
    .slice(0, 10)
    .reduce((sum, t) => sum + t.amount, 0)

  const weekSpent = transactions
    .filter((t) => t.amount < 0)
    .slice(0, 10)
    .reduce((sum, t) => sum + Math.abs(t.amount), 0)

  return (
    <div
      className={cn(
        'relative overflow-hidden rounded-2xl',
        'bg-gradient-to-br from-gold/10 via-surface-100 to-surface-100',
        'border border-gold/30 p-6'
      )}
    >
      <div className="absolute top-0 right-0 w-48 h-48 bg-gold/10 rounded-full blur-3xl pointer-events-none" />

      <div className="relative flex items-start justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 text-gold">
            <Coins className="h-4 w-4" />
            <span className="text-xs font-mono uppercase tracking-wider">
              Clout Balance
            </span>
          </div>

          {loading ? (
            <div className="mt-3 flex items-center gap-2 text-surface-500">
              <Loader2 className="h-5 w-5 animate-spin" />
              <span className="text-sm">Loading…</span>
            </div>
          ) : error ? (
            <div className="mt-3 text-sm text-against-400">{error}</div>
          ) : (
            <div className="mt-2">
              <div className="text-5xl md:text-6xl font-mono font-bold text-gold tabular-nums">
                {(balance ?? 0).toLocaleString()}
              </div>
              <div className="text-xs font-mono text-surface-500 mt-1">
                influence units
              </div>
            </div>
          )}
        </div>

        <Link
          href="/clout"
          className={cn(
            'flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
            'bg-gold/10 border border-gold/30 text-gold',
            'hover:bg-gold/20 text-xs font-mono font-medium transition-colors'
          )}
        >
          Ledger
          <ArrowUpRight className="h-3.5 w-3.5" />
        </Link>
      </div>

      {!loading && !error && (
        <div className="relative grid grid-cols-2 gap-3 mt-6 pt-5 border-t border-surface-300/60">
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-emerald/10 text-emerald">
              <ArrowUpRight className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase text-surface-500">
                Earned
              </div>
              <div className="text-sm font-mono font-semibold text-emerald">
                +{weekEarned.toLocaleString()}
              </div>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-against-500/10 text-against-400">
              <ArrowDown className="h-4 w-4" />
            </div>
            <div>
              <div className="text-[10px] font-mono uppercase text-surface-500">
                Spent
              </div>
              <div className="text-sm font-mono font-semibold text-against-400">
                -{weekSpent.toLocaleString()}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
