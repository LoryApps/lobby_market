'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  Bot,
  ChevronDown,
  ChevronUp,
  Copy,
  Loader2,
  Sparkles,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { SuggestResponse, Suggestion } from '@/app/api/arguments/[id]/suggest/route'

interface ArgumentResponseSuggestProps {
  argumentId: string
  /** The side of the argument being responded TO */
  argumentSide: 'blue' | 'red'
  className?: string
}

const TYPE_CONFIG: Record<Suggestion['type'], { color: string; bg: string; border: string }> = {
  counter:  { color: 'text-against-400', bg: 'bg-against-500/10', border: 'border-against-500/25' },
  extend:   { color: 'text-for-400',     bg: 'bg-for-500/10',     border: 'border-for-500/25'     },
  reinforce:{ color: 'text-purple',      bg: 'bg-purple/10',      border: 'border-purple/25'       },
}

export function ArgumentResponseSuggest({
  argumentId,
  argumentSide,
  className,
}: ArgumentResponseSuggestProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [data, setData] = useState<SuggestResponse | null>(null)
  const [copied, setCopied] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function fetchSuggestions() {
    if (data) {
      setOpen((o) => !o)
      return
    }
    setOpen(true)
    setLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/arguments/${argumentId}/suggest`, { method: 'POST' })
      const json = (await res.json()) as SuggestResponse
      if (json.unavailable) {
        setError('AI suggestions are temporarily unavailable.')
      } else {
        setData(json)
      }
    } catch {
      setError('Failed to load suggestions.')
    } finally {
      setLoading(false)
    }
  }

  function copyStarter(starter: string, id: string) {
    navigator.clipboard.writeText(starter).catch(() => {})
    setCopied(id)
    setTimeout(() => setCopied(null), 1800)
  }

  const oppLabel = argumentSide === 'blue' ? 'AGAINST' : 'FOR'

  return (
    <div className={cn('mt-2', className)}>
      {/* Toggle button */}
      <button
        onClick={fetchSuggestions}
        className={cn(
          'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-medium',
          'bg-surface-200 border border-surface-300 text-surface-500',
          'hover:bg-surface-300 hover:text-white hover:border-surface-400',
          'transition-all duration-150',
        )}
        aria-label="Get AI response suggestions"
      >
        <Bot className="h-3 w-3" />
        {open && !loading ? 'Hide suggestions' : 'How to respond'}
        {open && !loading ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="overflow-hidden"
          >
            <div className="mt-2 rounded-xl border border-surface-300 bg-surface-100 overflow-hidden">
              {/* Header */}
              <div className="flex items-center justify-between px-3 py-2 border-b border-surface-300">
                <div className="flex items-center gap-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-purple" />
                  <span className="text-xs font-mono text-surface-500">
                    AI suggestions · {oppLabel} response angles
                  </span>
                </div>
                <button
                  onClick={() => setOpen(false)}
                  className="text-surface-600 hover:text-surface-400 transition-colors"
                  aria-label="Close suggestions"
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>

              {/* Loading */}
              {loading && (
                <div className="flex items-center gap-2 px-4 py-5 text-surface-500">
                  <Loader2 className="h-4 w-4 animate-spin" />
                  <span className="text-xs font-mono">Generating response strategies…</span>
                </div>
              )}

              {/* Error */}
              {!loading && error && (
                <div className="px-4 py-4 text-xs font-mono text-surface-500">{error}</div>
              )}

              {/* Suggestions */}
              {!loading && data && (
                <div className="divide-y divide-surface-200">
                  {data.suggestions.map((s, i) => {
                    const cfg = TYPE_CONFIG[s.type]
                    const copyId = `${argumentId}-${i}`
                    return (
                      <div key={i} className="px-3 py-3 space-y-1.5">
                        {/* Label pill */}
                        <div
                          className={cn(
                            'inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-mono font-semibold border',
                            cfg.color,
                            cfg.bg,
                            cfg.border,
                          )}
                        >
                          {s.label}
                        </div>

                        {/* Point */}
                        <p className="text-xs font-mono text-surface-400 leading-relaxed">
                          {s.point}
                        </p>

                        {/* Starter sentence */}
                        <div className="flex items-start gap-2">
                          <div className="flex-1 px-2.5 py-1.5 rounded-lg bg-surface-200 border border-surface-300">
                            <p className="text-xs font-mono text-white leading-snug italic">
                              &ldquo;{s.starter}&rdquo;
                            </p>
                          </div>
                          <button
                            onClick={() => copyStarter(s.starter, copyId)}
                            className="flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-lg bg-surface-200 border border-surface-300 text-surface-500 hover:text-white hover:bg-surface-300 transition-colors"
                            aria-label="Copy opening sentence"
                            title="Copy opening sentence"
                          >
                            <Copy className="h-3 w-3" />
                          </button>
                        </div>
                        {copied === copyId && (
                          <p className="text-[10px] font-mono text-emerald">Copied to clipboard</p>
                        )}
                      </div>
                    )
                  })}
                </div>
              )}

              {/* Footer note */}
              {!loading && data && (
                <div className="px-3 py-2 border-t border-surface-200 bg-surface-50">
                  <p className="text-[10px] font-mono text-surface-600">
                    AI-generated angles — your argument should be in your own voice and reasoning.
                  </p>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
