'use client'

/**
 * GiftCloutButton
 *
 * Shows a coin/gift icon button. On click, opens an inline panel where the
 * viewer can send Clout to the target user. Preset quick amounts + custom
 * input + optional note.
 *
 * Props:
 *   recipientId    — Supabase user id of the recipient
 *   recipientName  — display name for UI copy
 *   size           — 'sm' | 'md' (default 'md')
 *   onSuccess      — callback with the sender's updated balance
 */

import { useCallback, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2,
  Coins,
  Loader2,
  Minus,
  Plus,
  X,
} from 'lucide-react'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'

// ─── Preset amounts ───────────────────────────────────────────────────────────

const PRESETS = [10, 25, 50, 100] as const

// ─── Types ────────────────────────────────────────────────────────────────────

interface GiftCloutButtonProps {
  recipientId: string
  recipientName: string
  size?: 'sm' | 'md'
  onSuccess?: (newBalance: number) => void
  className?: string
}

type PanelState = 'idle' | 'open' | 'sending' | 'success' | 'error'

// ─── Component ────────────────────────────────────────────────────────────────

export function GiftCloutButton({
  recipientId,
  recipientName,
  size = 'md',
  onSuccess,
  className,
}: GiftCloutButtonProps) {
  const [state, setState] = useState<PanelState>('idle')
  const [amount, setAmount] = useState<number>(25)
  const [customAmount, setCustomAmount] = useState<string>('')
  const [useCustom, setUseCustom] = useState(false)
  const [note, setNote] = useState<string>('')
  const [errorMsg, setErrorMsg] = useState<string>('')
  const [successMsg, setSuccessMsg] = useState<string>('')
  const panelRef = useRef<HTMLDivElement>(null)

  // Final amount to send
  const finalAmount = useCustom
    ? Math.floor(Number(customAmount) || 0)
    : amount

  const canSend = finalAmount >= 1 && finalAmount <= 500

  const handleOpen = useCallback(() => {
    setState('open')
    setErrorMsg('')
    setSuccessMsg('')
    setNote('')
    setCustomAmount('')
    setUseCustom(false)
    setAmount(25)
  }, [])

  const handleClose = useCallback(() => {
    setState('idle')
  }, [])

  const handleSend = useCallback(async () => {
    if (!canSend || state === 'sending') return
    setState('sending')
    setErrorMsg('')

    try {
      const res = await fetch('/api/clout/gift', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient_id: recipientId,
          amount: finalAmount,
          reason: note.trim() || undefined,
        }),
      })

      const data = (await res.json()) as {
        success?: boolean
        new_balance?: number
        error?: string
      }

      if (!res.ok || !data.success) {
        setErrorMsg(data.error ?? 'Something went wrong. Try again.')
        setState('error')
        return
      }

      setSuccessMsg(
        `${finalAmount} Clout sent to ${recipientName}!`
      )
      setState('success')
      if (typeof data.new_balance === 'number') {
        onSuccess?.(data.new_balance)
      }

      // Auto-close after 2.5 s
      setTimeout(() => setState('idle'), 2500)
    } catch {
      setErrorMsg('Network error. Please try again.')
      setState('error')
    }
  }, [canSend, state, recipientId, finalAmount, note, recipientName, onSuccess])

  const isSmall = size === 'sm'

  return (
    <div className={cn('relative inline-block', className)}>
      {/* Trigger button */}
      <button
        type="button"
        onClick={state === 'idle' || state === 'error' ? handleOpen : undefined}
        aria-label={`Gift Clout to ${recipientName}`}
        className={cn(
          'inline-flex items-center gap-1.5 rounded-lg border font-mono font-semibold transition-all',
          'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold/50',
          isSmall
            ? 'h-7 px-2 text-[11px]'
            : 'h-10 px-3 text-xs',
          state === 'success'
            ? 'border-emerald/40 bg-emerald/10 text-emerald cursor-default'
            : 'border-gold/30 bg-gold/10 text-gold hover:bg-gold/20 hover:border-gold/50'
        )}
      >
        {state === 'success' ? (
          <CheckCircle2 className={cn(isSmall ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
        ) : (
          <Coins className={cn(isSmall ? 'h-3 w-3' : 'h-3.5 w-3.5')} />
        )}
        {state === 'success' ? 'Sent!' : 'Gift Clout'}
      </button>

      {/* Panel */}
      <AnimatePresence>
        {(state === 'open' || state === 'sending' || state === 'error') && (
          <>
            {/* Backdrop (click outside to close) */}
            <div
              className="fixed inset-0 z-40"
              onClick={handleClose}
              aria-hidden="true"
            />

            <motion.div
              ref={panelRef}
              initial={{ opacity: 0, scale: 0.95, y: -6 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: -6 }}
              transition={{ duration: 0.15, ease: 'easeOut' }}
              className={cn(
                'absolute z-50 mt-2 w-72 rounded-2xl border border-surface-300',
                'bg-surface-100 shadow-2xl shadow-black/40',
                // Position: prefer left-align but flip if off screen
                'left-0'
              )}
              role="dialog"
              aria-label={`Gift Clout to ${recipientName}`}
            >
              {/* Header */}
              <div className="flex items-center justify-between px-4 py-3 border-b border-surface-300">
                <div className="flex items-center gap-2">
                  <Coins className="h-4 w-4 text-gold" />
                  <span className="text-sm font-mono font-semibold text-white">
                    Gift Clout
                  </span>
                </div>
                <button
                  type="button"
                  onClick={handleClose}
                  aria-label="Close gift panel"
                  className="flex items-center justify-center h-6 w-6 rounded-md text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              <div className="p-4 space-y-4">
                {/* Recipient line */}
                <p className="text-xs font-mono text-surface-500">
                  Sending to{' '}
                  <span className="text-white font-semibold">
                    {recipientName}
                  </span>
                </p>

                {/* Preset amounts */}
                <div>
                  <p className="text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-2">
                    Amount
                  </p>
                  <div className="grid grid-cols-4 gap-1.5 mb-2">
                    {PRESETS.map((preset) => (
                      <button
                        key={preset}
                        type="button"
                        onClick={() => {
                          setAmount(preset)
                          setUseCustom(false)
                        }}
                        className={cn(
                          'rounded-lg py-1.5 text-xs font-mono font-semibold transition-colors border',
                          !useCustom && amount === preset
                            ? 'bg-gold/20 border-gold/50 text-gold'
                            : 'border-surface-400 text-surface-500 hover:border-surface-300 hover:text-white'
                        )}
                      >
                        {preset}
                      </button>
                    ))}
                  </div>

                  {/* Custom amount row */}
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setUseCustom(true)}
                      className={cn(
                        'text-[10px] font-mono uppercase tracking-wider transition-colors',
                        useCustom ? 'text-gold' : 'text-surface-500 hover:text-white'
                      )}
                    >
                      Custom
                    </button>
                    {useCustom && (
                      <div className="flex items-center gap-1 flex-1">
                        <button
                          type="button"
                          onClick={() =>
                            setCustomAmount((v) =>
                              String(Math.max(1, (parseInt(v) || 0) - 5))
                            )
                          }
                          aria-label="Decrease amount"
                          className="flex items-center justify-center h-6 w-6 rounded-md bg-surface-300 text-surface-500 hover:text-white hover:bg-surface-400 transition-colors"
                        >
                          <Minus className="h-3 w-3" />
                        </button>
                        <input
                          type="number"
                          min={1}
                          max={500}
                          value={customAmount}
                          onChange={(e) => setCustomAmount(e.target.value)}
                          placeholder="1–500"
                          className={cn(
                            'flex-1 h-6 rounded-md bg-surface-300 border border-surface-400',
                            'px-2 text-xs font-mono text-white text-center',
                            'focus:outline-none focus:ring-1 focus:ring-gold/50',
                            '[appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none'
                          )}
                        />
                        <button
                          type="button"
                          onClick={() =>
                            setCustomAmount((v) =>
                              String(Math.min(500, (parseInt(v) || 0) + 5))
                            )
                          }
                          aria-label="Increase amount"
                          className="flex items-center justify-center h-6 w-6 rounded-md bg-surface-300 text-surface-500 hover:text-white hover:bg-surface-400 transition-colors"
                        >
                          <Plus className="h-3 w-3" />
                        </button>
                      </div>
                    )}
                  </div>
                </div>

                {/* Note (optional) */}
                <div>
                  <label className="block text-[10px] font-mono text-surface-500 uppercase tracking-wider mb-1.5">
                    Note{' '}
                    <span className="normal-case tracking-normal text-surface-600">
                      (optional)
                    </span>
                  </label>
                  <textarea
                    value={note}
                    onChange={(e) => setNote(e.target.value.slice(0, 200))}
                    placeholder={`Great argument…`}
                    rows={2}
                    className={cn(
                      'w-full rounded-lg bg-surface-200 border border-surface-400',
                      'px-3 py-2 text-xs font-mono text-white placeholder:text-surface-600',
                      'resize-none focus:outline-none focus:ring-1 focus:ring-gold/50',
                      'transition-colors'
                    )}
                  />
                  <p className="text-right text-[10px] font-mono text-surface-600 mt-0.5">
                    {note.length}/200
                  </p>
                </div>

                {/* Amount summary */}
                <div className="flex items-center justify-between rounded-lg bg-surface-200 border border-surface-400 px-3 py-2">
                  <span className="text-xs font-mono text-surface-500">
                    You&apos;re sending
                  </span>
                  <span
                    className={cn(
                      'text-sm font-mono font-bold',
                      canSend ? 'text-gold' : 'text-surface-600'
                    )}
                  >
                    {canSend ? `${finalAmount} Clout` : '—'}
                  </span>
                </div>

                {/* Error */}
                {state === 'error' && errorMsg && (
                  <p className="text-xs font-mono text-against-400 bg-against-950/50 border border-against-800/50 rounded-lg px-3 py-2">
                    {errorMsg}
                  </p>
                )}

                {/* Send button */}
                <Button
                  variant="gold"
                  size="md"
                  disabled={!canSend || state === 'sending'}
                  onClick={handleSend}
                  className="w-full"
                >
                  {state === 'sending' ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Sending…
                    </>
                  ) : (
                    <>
                      <Coins className="h-4 w-4" />
                      Send {canSend ? `${finalAmount} Clout` : 'Clout'}
                    </>
                  )}
                </Button>

                <p className="text-[10px] font-mono text-surface-600 text-center">
                  Gifts are non-refundable and recorded publicly on the{' '}
                  <span className="text-surface-500">Clout ledger</span>.
                </p>
              </div>
            </motion.div>
          </>
        )}

        {/* Success flash overlay */}
        {state === 'success' && (
          <motion.div
            key="success-toast"
            initial={{ opacity: 0, scale: 0.9, y: -4 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: -4 }}
            transition={{ duration: 0.2 }}
            className={cn(
              'absolute z-50 mt-2 left-0 rounded-xl border border-emerald/30',
              'bg-surface-100 px-4 py-3 shadow-xl shadow-black/30',
              'flex items-center gap-2'
            )}
          >
            <CheckCircle2 className="h-4 w-4 text-emerald flex-shrink-0" />
            <span className="text-xs font-mono text-emerald whitespace-nowrap">
              {successMsg}
            </span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
