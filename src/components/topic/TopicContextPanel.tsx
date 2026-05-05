'use client'

/**
 * TopicContextPanel
 *
 * Displays an AI-generated real-world background explainer for a topic.
 * Uses Claude's world knowledge (not platform argument data) to explain:
 *   - What the underlying issue is about
 *   - What changes if FOR wins
 *   - What changes if AGAINST wins
 *   - The core value tension
 *   - Relevant real-world examples
 *
 * Distinct from TopicAIBrief (which summarises platform user arguments).
 */

import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  BookOpen,
  ChevronDown,
  ChevronUp,
  Globe,
  Loader2,
  RefreshCw,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'
import type { TopicContextResponse } from '@/app/api/topics/[id]/context/route'

interface ParsedContext {
  background: string
  if_for: string
  if_against: string
  key_tension: string
  examples?: string
}

interface TopicContextPanelProps {
  topicId: string
  className?: string
}

function parseContext(raw: string): ParsedContext | null {
  try {
    // Strip markdown code fences if present
    const clean = raw.replace(/^```(?:json)?\n?/i, '').replace(/\n?```$/i, '').trim()
    const parsed = JSON.parse(clean)
    if (typeof parsed.background === 'string' && typeof parsed.if_for === 'string') {
      return parsed as ParsedContext
    }
    return null
  } catch {
    return null
  }
}

type PanelState = 'loading' | 'empty' | 'generating' | 'ready' | 'unavailable' | 'error'

export function TopicContextPanel({ topicId, className }: TopicContextPanelProps) {
  const [panelState, setPanelState] = useState<PanelState>('loading')
  const [context, setContext] = useState<ParsedContext | null>(null)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(false)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  // Check auth
  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: { user } }) => setIsLoggedIn(!!user))
  }, [])

  // Fetch cached context
  const fetchContext = useCallback(async () => {
    try {
      const res = await fetch(`/api/topics/${topicId}/context`, { cache: 'no-store' })
      if (!res.ok) throw new Error('fetch failed')
      const data: TopicContextResponse = await res.json()

      if (data.unavailable) {
        setPanelState('unavailable')
        return
      }

      if (data.context) {
        const parsed = parseContext(data.context)
        if (parsed) {
          setContext(parsed)
          setGeneratedAt(data.generated_at)
          setPanelState('ready')
        } else {
          setPanelState('error')
        }
      } else {
        setPanelState('empty')
      }
    } catch {
      setPanelState('error')
    }
  }, [topicId])

  useEffect(() => {
    fetchContext()
  }, [fetchContext])

  // Generate context (auth required)
  const generate = useCallback(async () => {
    if (!isLoggedIn) return
    setPanelState('generating')
    try {
      const res = await fetch(`/api/topics/${topicId}/context`, {
        method: 'POST',
        cache: 'no-store',
      })
      if (!res.ok) throw new Error('generation failed')
      const data: TopicContextResponse = await res.json()

      if (data.unavailable) {
        setPanelState('unavailable')
        return
      }
      if (data.context) {
        const parsed = parseContext(data.context)
        if (parsed) {
          setContext(parsed)
          setGeneratedAt(data.generated_at)
          setPanelState('ready')
          setExpanded(true)
        } else {
          setPanelState('error')
        }
      } else {
        setPanelState('error')
      }
    } catch {
      setPanelState('error')
    }
  }, [topicId, isLoggedIn])

  // Don't render if AI isn't configured
  if (panelState === 'unavailable') return null

  // ── Loading state
  if (panelState === 'loading') {
    return (
      <div className={cn('rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden', className)}>
        <div className="flex items-center gap-3 p-4">
          <div className="h-8 w-8 rounded-lg bg-surface-300 animate-pulse flex-shrink-0" />
          <div className="flex-1 space-y-2">
            <div className="h-3.5 w-32 rounded bg-surface-300 animate-pulse" />
            <div className="h-3 w-48 rounded bg-surface-300 animate-pulse" />
          </div>
        </div>
      </div>
    )
  }

  // ── Empty — show "Generate" CTA
  if (panelState === 'empty') {
    if (!isLoggedIn) return null
    return (
      <div className={cn('rounded-2xl border border-surface-300 bg-surface-100 p-4', className)}>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-surface-200 border border-surface-300 flex-shrink-0">
            <Globe className="h-4 w-4 text-surface-500" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-mono font-semibold text-white">Real-world context</p>
            <p className="text-xs font-mono text-surface-500 mt-0.5">
              AI-generated background on what this debate means in practice
            </p>
          </div>
          <button
            onClick={generate}
            className={cn(
              'flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-mono font-semibold flex-shrink-0',
              'bg-purple/10 border border-purple/30 text-purple',
              'hover:bg-purple/20 transition-colors'
            )}
            aria-label="Generate real-world context for this topic"
          >
            <Sparkles className="h-3 w-3" />
            Generate
          </button>
        </div>
      </div>
    )
  }

  // ── Generating spinner
  if (panelState === 'generating') {
    return (
      <div className={cn('rounded-2xl border border-purple/30 bg-purple/5 p-4', className)}>
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-purple/10 border border-purple/30 flex-shrink-0">
            <Loader2 className="h-4 w-4 text-purple animate-spin" />
          </div>
          <div>
            <p className="text-sm font-mono font-semibold text-white">Researching real-world context…</p>
            <p className="text-xs font-mono text-surface-500 mt-0.5">Claude is building a neutral background brief</p>
          </div>
        </div>
      </div>
    )
  }

  // ── Error state
  if (panelState === 'error' || !context) {
    return (
      <div className={cn('rounded-2xl border border-surface-300 bg-surface-100 p-4', className)}>
        <div className="flex items-center justify-between gap-3">
          <div className="flex items-center gap-2">
            <Globe className="h-4 w-4 text-surface-500 flex-shrink-0" />
            <p className="text-xs font-mono text-surface-500">Could not load context</p>
          </div>
          {isLoggedIn && (
            <button
              onClick={generate}
              className="flex items-center gap-1 text-xs font-mono text-surface-500 hover:text-white transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              Retry
            </button>
          )}
        </div>
      </div>
    )
  }

  // ── Ready — full panel
  const relTime = generatedAt
    ? (() => {
        const diff = Date.now() - new Date(generatedAt).getTime()
        const d = Math.floor(diff / 86_400_000)
        const h = Math.floor(diff / 3_600_000)
        if (d >= 1) return `${d}d ago`
        if (h >= 1) return `${h}h ago`
        return 'recently'
      })()
    : null

  return (
    <div className={cn('rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden', className)}>
      {/* Header — always visible */}
      <button
        onClick={() => setExpanded((v) => !v)}
        className="w-full flex items-center gap-3 p-4 hover:bg-surface-200/50 transition-colors text-left"
        aria-expanded={expanded}
        aria-controls="context-body"
      >
        <div className="flex items-center justify-center h-8 w-8 rounded-lg bg-purple/10 border border-purple/30 flex-shrink-0">
          <Globe className="h-4 w-4 text-purple" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-mono font-semibold text-white">Real-world context</p>
          <p className="text-xs font-mono text-surface-500 mt-0.5 truncate">
            {expanded ? 'Background, stakes, and key tension' : context.background.slice(0, 80) + '…'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {relTime && (
            <span className="text-[10px] font-mono text-surface-600 hidden sm:inline">{relTime}</span>
          )}
          {expanded ? (
            <ChevronUp className="h-4 w-4 text-surface-500" />
          ) : (
            <ChevronDown className="h-4 w-4 text-surface-500" />
          )}
        </div>
      </button>

      {/* Expandable body */}
      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            id="context-body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 space-y-4 border-t border-surface-300 pt-4">

              {/* Background */}
              <section>
                <div className="flex items-center gap-1.5 mb-1.5">
                  <BookOpen className="h-3.5 w-3.5 text-surface-500" />
                  <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-surface-500">
                    Background
                  </span>
                </div>
                <p className="text-sm text-surface-300 leading-relaxed font-mono">{context.background}</p>
              </section>

              {/* FOR/AGAINST stakes in a 2-column grid */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="rounded-xl bg-for-500/8 border border-for-500/25 p-3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <ThumbsUp className="h-3.5 w-3.5 text-for-400" />
                    <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-for-400">
                      If FOR wins
                    </span>
                  </div>
                  <p className="text-xs text-surface-300 leading-relaxed font-mono">{context.if_for}</p>
                </div>

                <div className="rounded-xl bg-against-500/8 border border-against-500/25 p-3">
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <ThumbsDown className="h-3.5 w-3.5 text-against-400" />
                    <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-against-400">
                      If AGAINST wins
                    </span>
                  </div>
                  <p className="text-xs text-surface-300 leading-relaxed font-mono">{context.if_against}</p>
                </div>
              </div>

              {/* Key tension */}
              <div className="rounded-xl bg-gold/8 border border-gold/25 p-3">
                <div className="flex items-center gap-1.5 mb-1.5">
                  <Sparkles className="h-3.5 w-3.5 text-gold" />
                  <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-gold">
                    Core tension
                  </span>
                </div>
                <p className="text-xs text-surface-300 leading-relaxed font-mono">{context.key_tension}</p>
              </div>

              {/* Real-world examples (optional) */}
              {context.examples && (
                <section>
                  <div className="flex items-center gap-1.5 mb-1.5">
                    <Globe className="h-3.5 w-3.5 text-surface-500" />
                    <span className="text-[10px] font-mono font-semibold uppercase tracking-widest text-surface-500">
                      Real-world examples
                    </span>
                  </div>
                  <p className="text-xs text-surface-500 leading-relaxed font-mono">{context.examples}</p>
                </section>
              )}

              {/* Footer */}
              <div className="flex items-center justify-between pt-1">
                <p className="text-[10px] font-mono text-surface-600 flex items-center gap-1">
                  <Sparkles className="h-3 w-3" />
                  Generated by Claude · real-world knowledge, not platform data
                </p>
                {isLoggedIn && (
                  <button
                    onClick={generate}
                    className="text-[10px] font-mono text-surface-600 hover:text-white transition-colors flex items-center gap-1"
                    aria-label="Regenerate context"
                  >
                    <RefreshCw className="h-3 w-3" />
                    Refresh
                  </button>
                )}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
