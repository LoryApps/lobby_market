'use client'

import { useEffect, useState } from 'react'
import { Coins, Loader2, X } from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'

interface SpendCloutModalProps {
  open: boolean
  onClose: () => void
  defaultAmount?: number
  defaultReason?: string
  referenceId?: string | null
  referenceType?: string | null
  currentBalance?: number
  onSuccess?: (result: { balance: number }) => void
}

export function SpendCloutModal({
  open,
  onClose,
  defaultAmount = 10,
  defaultReason = '',
  referenceId = null,
  referenceType = null,
  currentBalance,
  onSuccess,
}: SpendCloutModalProps) {
  const [amount, setAmount] = useState(defaultAmount)
  const [reason, setReason] = useState(defaultReason)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Reset state whenever the modal opens with fresh inputs.
  useEffect(() => {
    if (!open) return
    setAmount(defaultAmount)
    setReason(defaultReason)
    setError(null)
  }, [open, defaultAmount, defaultReason])

  if (!open) return null

  const insufficient =
    typeof currentBalance === 'number' && amount > currentBalance

  const handleSubmit = async () => {
    if (!reason.trim()) {
      setError('Tell us what this is for')
      return
    }
    if (!Number.isFinite(amount) || amount <= 0) {
      setError('Amount must be positive')
      return
    }
    if (insufficient) {
      setError('Insufficient Clout')
      return
    }

    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch('/api/clout/spend', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          amount,
          reason: reason.trim(),
          reference_id: referenceId,
          reference_type: referenceType,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to spend Clout')
      }

      const data = await res.json()
      onSuccess?.({ balance: data.balance ?? 0 })
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/70 backdrop-blur-sm">
      <div
        className={cn(
          'relative w-full max-w-md rounded-2xl overflow-hidden',
          'bg-surface-100 border border-gold/30',
          'shadow-2xl'
        )}
      >
        <div className="absolute top-0 right-0 w-40 h-40 bg-gold/10 rounded-full blur-3xl pointer-events-none" />

        <div className="relative px-6 py-5 border-b border-surface-300/60 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Coins className="h-5 w-5 text-gold" />
            <h2 className="font-mono text-base font-semibold text-white">
              Spend Clout
            </h2>
          </div>
          <button
            onClick={onClose}
            className="flex h-8 w-8 items-center justify-center rounded-lg bg-surface-200 text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
            aria-label="Close"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="relative px-6 py-5 space-y-5">
          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-surface-500 mb-2">
              Amount
            </label>
            <div className="relative">
              <input
                type="number"
                min={1}
                step={1}
                value={Number.isFinite(amount) ? amount : ''}
                onChange={(e) => setAmount(Number(e.target.value))}
                className={cn(
                  'w-full rounded-xl px-4 py-3 font-mono text-2xl font-semibold',
                  'bg-surface-200 border border-surface-300 text-gold',
                  'focus:outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/20'
                )}
              />
              <span className="absolute right-4 top-1/2 -translate-y-1/2 text-[11px] font-mono uppercase text-surface-500">
                clout
              </span>
            </div>
            {typeof currentBalance === 'number' && (
              <div className="mt-1 text-[11px] font-mono text-surface-500">
                Balance: {currentBalance.toLocaleString()}
              </div>
            )}
          </div>

          <div>
            <label className="block text-[11px] font-mono uppercase tracking-wider text-surface-500 mb-2">
              Reason
            </label>
            <input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="e.g., Promote argument in topic X"
              className={cn(
                'w-full rounded-xl px-4 py-3 font-mono text-sm',
                'bg-surface-200 border border-surface-300 text-white',
                'placeholder:text-surface-500',
                'focus:outline-none focus:border-gold/50 focus:ring-2 focus:ring-gold/20'
              )}
            />
          </div>

          {error && (
            <div className="rounded-lg border border-against-500/30 bg-against-500/10 px-3 py-2 text-xs font-mono text-against-400">
              {error}
            </div>
          )}

          <div className="flex items-center gap-2 pt-2">
            <Button
              variant="gold"
              size="md"
              onClick={handleSubmit}
              disabled={submitting || insufficient || amount <= 0}
              className="flex-1"
            >
              {submitting ? (
                <>
                  <Loader2 className="h-4 w-4 animate-spin" />
                  Spending…
                </>
              ) : (
                <>
                  <Coins className="h-4 w-4" />
                  Confirm Spend
                </>
              )}
            </Button>
            <Button variant="ghost" size="md" onClick={onClose}>
              Cancel
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
