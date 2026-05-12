'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { CheckCircle2, ChevronDown, ChevronUp, Copy, Lightbulb, Loader2, RefreshCw, Sparkles } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { Suggestion, SuggestResponse } from '@/app/api/arguments/[id]/suggest/route'

// ─── Type configs ────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<Suggestion['type'], { label: string; color: string; bg: string; border: string }> = {
  counter: {
    label: 'Counter',
    color: 'text-against-400',
    bg: 'bg-against-500/10',
    border: 'border-against-500/30',
  },
  extend: {
    label: 'Extend',
    color: 'text-gold',
    bg: 'bg-gold/10',
    border: 'border-gold/30',
  },
  reinforce: {
    label: 'Reframe',
    color: 'text-purple',
    bg: 'bg-purple/10',
    border: 'border-purple/30',
  },
}

// ─── Single suggestion card ───────────────────────────────────────────────────

function SuggestionCard({ s, isFor }: { s: Suggestion; isFor: boolean }) {
  const cfg = TYPE_CONFIG[s.type]
  const [copied, setCopied] = useState(false)

  function copyStarter() {
    navigator.clipboard.writeText(s.starter).then(() => {
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    })
  }

  return (
    <div className={cn('rounded-xl border p-4', cfg.bg, cfg.border)}>
      {/* Strategy type pill */}
      <div className="flex items-center gap-2 mb-2">
        <span className={cn('text-[10px] font-mono font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border', cfg.color, cfg.bg, cfg.border)}>
          {cfg.label}
        </span>
        <span className="text-xs font-mono font-semibold text-white">{s.label}</span>
      </div>

      {/* The strategic point */}
      <p className="text-sm text-surface-600 leading-relaxed mb-3">
        {s.point}
      </p>

      {/* Starter sentence */}
      <div className="rounded-lg bg-surface-200/60 border border-surface-300 p-3">
        <div className="flex items-start justify-between gap-2">
          <p className={cn('text-sm font-mono leading-snug', isFor ? 'text-against-300' : 'text-for-300')}>
            &ldquo;{s.starter}&rdquo;
          </p>
          <button
            onClick={copyStarter}
            aria-label="Copy starter sentence"
            className={cn(
              'flex-shrink-0 flex items-center gap-1 text-[10px] font-mono px-2 py-1 rounded border transition-all',
              copied
                ? 'text-emerald border-emerald/40 bg-emerald/10'
                : 'text-surface-500 border-surface-300 hover:text-white hover:border-surface-400',
            )}
          >
            {copied ? (
              <><CheckCircle2 className="h-3 w-3" aria-hidden />Copied</>
            ) : (
              <><Copy className="h-3 w-3" aria-hidden />Copy</>
            )}
          </button>
        </div>
      </div>
    </div>
  )
}

// ─── Main panel ───────────────────────────────────────────────────────────────

interface ArgumentSuggestPanelProps {
  argumentId: string
  isFor: boolean
}

export function ArgumentSuggestPanel({ argumentId, isFor }: ArgumentSuggestPanelProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [suggestions, setSuggestions] = useState<Suggestion[] | null>(null)
  const [unavailable, setUnavailable] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const oppSide = isFor ? 'AGAINST' : 'FOR'

  async function load() {
    setLoading(true)
    setError(null)
    setUnavailable(false)
    try {
      const res = await fetch(`/api/arguments/${argumentId}/suggest`, { method: 'POST' })
      if (res.status === 401) {
        setError('Sign in to get AI response strategies.')
        return
      }
      const data = (await res.json()) as SuggestResponse
      if (data.unavailable) {
        setUnavailable(true)
        return
      }
      setSuggestions(data.suggestions)
    } catch {
      setError('Could not generate suggestions. Try again.')
    } finally {
      setLoading(false)
    }
  }

  function toggle() {
    if (!open && !suggestions && !unavailable) {
      load()
    }
    setOpen((o) => !o)
  }

  return (
    <div className="rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden mb-6">
      {/* Header button */}
      <button
        onClick={toggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between px-4 py-3 hover:bg-surface-200 transition-colors"
      >
        <div className="flex items-center gap-2">
          <Lightbulb className="h-4 w-4 text-gold" aria-hidden />
          <span className="text-sm font-mono font-semibold text-white">
            How to argue {oppSide}
          </span>
          <span className="text-[10px] font-mono text-surface-600 bg-surface-200 px-1.5 py-0.5 rounded-full border border-surface-300">
            AI strategies
          </span>
        </div>
        {open ? (
          <ChevronUp className="h-4 w-4 text-surface-500" aria-hidden />
        ) : (
          <ChevronDown className="h-4 w-4 text-surface-500" aria-hidden />
        )}
      </button>

      {/* Expandable body */}
      <AnimatePresence initial={false}>
        {open && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="overflow-hidden border-t border-surface-300"
          >
            <div className="p-4 space-y-3">
              {loading && (
                <div className="flex items-center justify-center gap-2 py-8 text-surface-500">
                  <Loader2 className="h-4 w-4 animate-spin" aria-hidden />
                  <span className="text-sm font-mono">Generating strategies…</span>
                </div>
              )}

              {!loading && error && (
                <div className="text-center py-6">
                  <p className="text-sm font-mono text-against-400 mb-2">{error}</p>
                  {!error.includes('Sign in') && (
                    <button
                      onClick={load}
                      className="text-xs font-mono text-for-400 hover:text-for-300 transition-colors flex items-center gap-1 mx-auto"
                    >
                      <RefreshCw className="h-3 w-3" aria-hidden />
                      Try again
                    </button>
                  )}
                </div>
              )}

              {!loading && unavailable && (
                <p className="text-sm font-mono text-surface-500 text-center py-6">
                  AI strategies are unavailable right now.
                </p>
              )}

              {!loading && suggestions && suggestions.length > 0 && (
                <>
                  <div className="flex items-center justify-between">
                    <p className="text-xs font-mono text-surface-500 flex items-center gap-1.5">
                      <Sparkles className="h-3 w-3 text-gold" aria-hidden />
                      3 ways to counter this argument
                    </p>
                    <button
                      onClick={load}
                      aria-label="Regenerate strategies"
                      className="text-[10px] font-mono text-surface-500 hover:text-white transition-colors flex items-center gap-1"
                    >
                      <RefreshCw className="h-3 w-3" aria-hidden />
                      Regenerate
                    </button>
                  </div>
                  {suggestions.map((s) => (
                    <SuggestionCard key={s.type} s={s} isFor={isFor} />
                  ))}
                  <p className="text-[10px] font-mono text-surface-600 text-center pt-1">
                    Copy a starter · adapt it · write your own argument
                  </p>
                </>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
