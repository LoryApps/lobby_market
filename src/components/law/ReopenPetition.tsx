'use client'

import { useState } from 'react'
import { AlertTriangle, FileWarning, Loader2, ShieldCheck } from 'lucide-react'
import type { Law, LawReopenRequest } from '@/lib/supabase/types'
import { Button } from '@/components/ui/Button'
import { cn } from '@/lib/utils/cn'

interface ReopenPetitionProps {
  law: Law
  reopenRequest: LawReopenRequest | null
  totalOriginalVoters: number
}

const MIN_CASE_LENGTH = 200

interface CircularProgressProps {
  value: number
  max: number
  size?: number
}

function CircularProgress({ value, max, size = 96 }: CircularProgressProps) {
  const pct = max > 0 ? Math.min(value / max, 1) : 0
  const radius = (size - 12) / 2
  const circumference = 2 * Math.PI * radius
  const offset = circumference * (1 - pct)

  return (
    <div className="relative inline-flex items-center justify-center">
      <svg width={size} height={size} className="-rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={6}
          fill="none"
          className="text-surface-300"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          stroke="currentColor"
          strokeWidth={6}
          fill="none"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          className="text-gold transition-[stroke-dashoffset] duration-700 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-base font-mono font-bold text-white leading-none">
          {Math.round(pct * 100)}%
        </span>
        <span className="text-[9px] font-mono text-surface-500 uppercase tracking-wider mt-0.5">
          consent
        </span>
      </div>
    </div>
  )
}

export function ReopenPetition({
  law,
  reopenRequest,
  totalOriginalVoters,
}: ReopenPetitionProps) {
  const [formOpen, setFormOpen] = useState(false)
  const [caseText, setCaseText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleFilePetition = async () => {
    if (caseText.length < MIN_CASE_LENGTH) {
      setError(
        `Case must be at least ${MIN_CASE_LENGTH} characters (currently ${caseText.length}).`
      )
      return
    }
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/laws/${law.id}/reopen`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ case_for_repeal: caseText }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to file petition')
      }
      setFormOpen(false)
      setCaseText('')
      // Caller can refresh via router or the parent refetches
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSubmitting(false)
    }
  }

  const handleSignPetition = async () => {
    if (!reopenRequest) return
    setSubmitting(true)
    setError(null)
    try {
      const res = await fetch(`/api/laws/${law.id}/reopen/consent`, {
        method: 'POST',
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error ?? 'Failed to sign petition')
      }
      window.location.reload()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error')
    } finally {
      setSubmitting(false)
    }
  }

  // -------------------------------------------------------------------------
  // No active petition
  // -------------------------------------------------------------------------
  if (!reopenRequest) {
    return (
      <div
        className={cn(
          'bg-surface-100 border border-surface-300 rounded-xl p-5',
          'relative overflow-hidden'
        )}
      >
        <div className="absolute top-0 right-0 w-32 h-32 bg-gold/5 rounded-full blur-3xl pointer-events-none" />

        <div className="relative flex items-start gap-4 flex-wrap">
          <div className="flex items-center justify-center h-10 w-10 rounded-lg bg-gold/10 border border-gold/30 text-gold flex-shrink-0">
            <FileWarning className="h-5 w-5" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <h3 className="text-sm font-mono font-semibold text-white">
              Repeal this Law
            </h3>
            <p className="text-xs text-surface-500 font-mono mt-1 leading-relaxed">
              Filing a repeal petition sends this Law back to voting if enough
              original voters consent. Requires {MIN_CASE_LENGTH}+ character case.
            </p>

            {!formOpen ? (
              <button
                onClick={() => setFormOpen(true)}
                className={cn(
                  'mt-3 inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg',
                  'bg-gold/10 border border-gold/30 text-gold',
                  'hover:bg-gold/20 hover:border-gold/50',
                  'text-xs font-mono font-medium transition-colors'
                )}
              >
                <AlertTriangle className="h-3.5 w-3.5" />
                File Repeal Petition
              </button>
            ) : (
              <div className="mt-4 space-y-3">
                <textarea
                  value={caseText}
                  onChange={(e) => setCaseText(e.target.value)}
                  placeholder="Make your case for repeal. What has changed? What was missed during the original vote? Why should the community reconsider?"
                  rows={6}
                  className={cn(
                    'w-full p-3 rounded-lg font-mono text-sm',
                    'bg-surface-200 border border-surface-300 text-surface-800',
                    'placeholder:text-surface-500 placeholder:text-xs',
                    'focus:outline-none focus:border-gold/50 focus:ring-1 focus:ring-gold/20',
                    'resize-y'
                  )}
                />
                <div className="flex items-center justify-between text-[11px] font-mono">
                  <span
                    className={cn(
                      caseText.length >= MIN_CASE_LENGTH
                        ? 'text-emerald'
                        : 'text-surface-500'
                    )}
                  >
                    {caseText.length} / {MIN_CASE_LENGTH} min
                  </span>
                  {error && (
                    <span className="text-against-500">{error}</span>
                  )}
                </div>
                <div className="flex items-center gap-2">
                  <Button
                    variant="gold"
                    size="sm"
                    onClick={handleFilePetition}
                    disabled={
                      submitting || caseText.length < MIN_CASE_LENGTH
                    }
                  >
                    {submitting ? (
                      <>
                        <Loader2 className="h-3.5 w-3.5 animate-spin" />
                        Filing…
                      </>
                    ) : (
                      'Submit Petition'
                    )}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      setFormOpen(false)
                      setCaseText('')
                      setError(null)
                    }}
                  >
                    Cancel
                  </Button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    )
  }

  // -------------------------------------------------------------------------
  // Active petition
  // -------------------------------------------------------------------------
  const consent = reopenRequest.consent_count
  const needed = reopenRequest.total_original_voters || totalOriginalVoters
  const isApproved = consent >= needed || reopenRequest.status === 'approved'

  return (
    <div
      className={cn(
        'bg-surface-100 border border-gold/30 rounded-xl p-5',
        'relative overflow-hidden'
      )}
    >
      <div className="absolute top-0 right-0 w-40 h-40 bg-gold/10 rounded-full blur-3xl pointer-events-none" />

      {isApproved ? (
        <div className="relative flex items-center gap-4">
          <ShieldCheck className="h-8 w-8 text-emerald flex-shrink-0" />
          <div>
            <h3 className="text-sm font-mono font-semibold text-emerald uppercase tracking-wider">
              Reopening…
            </h3>
            <p className="text-xs text-surface-500 font-mono mt-1">
              Petition reached quorum. This Law is being returned to voting.
            </p>
          </div>
        </div>
      ) : (
        <div className="relative flex items-start gap-5 flex-wrap">
          <CircularProgress value={consent} max={needed} />
          <div className="flex-1 min-w-[200px]">
            <div className="flex items-center gap-2">
              <AlertTriangle className="h-4 w-4 text-gold" />
              <h3 className="text-sm font-mono font-semibold text-gold uppercase tracking-wider">
                Repeal Petition Active
              </h3>
            </div>
            <p className="text-sm text-white font-mono mt-2">
              <span className="text-gold font-bold">{consent}</span>
              <span className="text-surface-500"> of </span>
              <span className="text-white">{needed}</span>
              <span className="text-surface-500">
                {' '}
                original voters consent to reopen
              </span>
            </p>

            {reopenRequest.case_for_repeal && (
              <blockquote
                className={cn(
                  'mt-3 p-3 border-l-2 border-gold/50 bg-gold/5 rounded-r',
                  'text-[12px] font-mono text-surface-700 italic leading-relaxed',
                  'line-clamp-4'
                )}
              >
                {reopenRequest.case_for_repeal}
              </blockquote>
            )}

            <div className="mt-4 flex items-center gap-2">
              <Button
                variant="gold"
                size="sm"
                onClick={handleSignPetition}
                disabled={submitting}
              >
                {submitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    Signing…
                  </>
                ) : (
                  'Sign Petition'
                )}
              </Button>
              {error && (
                <span className="text-[11px] font-mono text-against-500">
                  {error}
                </span>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
