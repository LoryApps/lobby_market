'use client'

/**
 * TopicSynthesisPanel
 *
 * Shows a Claude-generated argument synthesis for a topic — distinct from
 * the AI Brief (which summarises the debate neutrally). The synthesis:
 *   • identifies common ground both sides share
 *   • names the core value tensions driving the disagreement
 *   • offers a nuanced synthesis position acknowledging both sets of concerns
 *
 * States:
 *   loading          – fetching cached synthesis from server
 *   empty            – no synthesis yet; show "Generate" CTA
 *   generated        – show 3-section synthesis with "Regenerate" option
 *   unavailable      – ANTHROPIC_API_KEY not configured
 *   insufficient_data– too few arguments to synthesize
 */

import { useCallback, useEffect, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import {
  ChevronDown,
  ChevronUp,
  GitMerge,
  Handshake,
  Loader2,
  RefreshCw,
  Scale,
  Swords,
  WandSparkles,
} from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'
import type { SynthesisResponse } from '@/app/api/topics/[id]/synthesis/route'

interface TopicSynthesisPanelProps {
  topicId: string
  className?: string
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

export function TopicSynthesisPanel({ topicId, className }: TopicSynthesisPanelProps) {
  const [data, setData] = useState<{
    common_ground: string
    tensions: string
    synthesis: string
  } | null>(null)
  const [generatedAt, setGeneratedAt] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [generating, setGenerating] = useState(false)
  const [unavailable, setUnavailable] = useState(false)
  const [insufficientData, setInsufficientData] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [expanded, setExpanded] = useState(true)
  const [isLoggedIn, setIsLoggedIn] = useState(false)

  useEffect(() => {
    const supabase = createClient()
    supabase.auth.getUser().then(({ data: d }) => {
      setIsLoggedIn(!!d.user)
    })
  }, [])

  useEffect(() => {
    setLoading(true)
    fetch(`/api/topics/${topicId}/synthesis`)
      .then((r) => r.json())
      .then((res: SynthesisResponse) => {
        if (res.unavailable) {
          setUnavailable(true)
        } else if (res.common_ground && res.tensions && res.synthesis) {
          setData({
            common_ground: res.common_ground,
            tensions: res.tensions,
            synthesis: res.synthesis,
          })
          setGeneratedAt(res.generated_at)
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [topicId])

  const generate = useCallback(async () => {
    setGenerating(true)
    setError(null)
    try {
      const res = await fetch(`/api/topics/${topicId}/synthesis`, { method: 'POST' })
      if (res.status === 422) {
        setInsufficientData(true)
        return
      }
      if (!res.ok) {
        setError('Generation failed. Please try again.')
        return
      }
      const body: SynthesisResponse = await res.json()
      if (body.common_ground && body.tensions && body.synthesis) {
        setData({
          common_ground: body.common_ground,
          tensions: body.tensions,
          synthesis: body.synthesis,
        })
        setGeneratedAt(body.generated_at)
        setExpanded(true)
      }
    } finally {
      setGenerating(false)
    }
  }, [topicId])

  // Don't render anything if AI is not configured
  if (unavailable) return null

  return (
    <div className={cn('rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden', className)}>
      {/* Header */}
      <button
        type="button"
        onClick={() => setExpanded((e) => !e)}
        className="w-full flex items-center gap-2.5 px-4 py-3.5 hover:bg-surface-200 transition-colors"
      >
        <div className="flex items-center justify-center h-7 w-7 rounded-lg bg-purple/10 flex-shrink-0">
          <GitMerge className="h-3.5 w-3.5 text-purple" />
        </div>
        <div className="flex-1 text-left min-w-0">
          <p className="text-xs font-mono font-bold text-white">Argument Synthesis</p>
          <p className="text-[10px] font-mono text-surface-500">
            {loading
              ? 'Loading…'
              : data
              ? `AI synthesis · ${generatedAt ? relativeTime(generatedAt) : 'cached'}`
              : 'Common ground & core tensions'}
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {loading && <Loader2 className="h-3.5 w-3.5 text-surface-500 animate-spin" />}
          {!loading && data && isLoggedIn && (
            <button
              type="button"
              title="Regenerate synthesis"
              disabled={generating}
              onClick={(e) => { e.stopPropagation(); generate() }}
              className="p-1 rounded text-surface-500 hover:text-surface-300 hover:bg-surface-300 transition-colors disabled:opacity-40"
            >
              <RefreshCw className={cn('h-3 w-3', generating && 'animate-spin')} />
            </button>
          )}
          {expanded ? (
            <ChevronUp className="h-3.5 w-3.5 text-surface-500" />
          ) : (
            <ChevronDown className="h-3.5 w-3.5 text-surface-500" />
          )}
        </div>
      </button>

      <AnimatePresence initial={false}>
        {expanded && (
          <motion.div
            key="body"
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-4 pb-4 pt-1 space-y-3 border-t border-surface-300">
              {/* Loading skeleton */}
              {loading && (
                <div className="space-y-2.5 animate-pulse">
                  <div className="h-3 bg-surface-300 rounded w-3/4" />
                  <div className="h-3 bg-surface-300 rounded w-full" />
                  <div className="h-3 bg-surface-300 rounded w-5/6" />
                  <div className="h-3 bg-surface-300 rounded w-2/3" />
                </div>
              )}

              {/* Insufficient data notice */}
              {!loading && insufficientData && (
                <p className="text-xs font-mono text-surface-500 text-center py-2">
                  Not enough arguments yet to synthesize. Come back after more debate.
                </p>
              )}

              {/* Error */}
              {!loading && error && (
                <p className="text-xs font-mono text-against-400">{error}</p>
              )}

              {/* Generated synthesis */}
              {!loading && data && (
                <motion.div
                  initial={{ opacity: 0, y: 4 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.25 }}
                  className="space-y-3"
                >
                  {/* Common Ground */}
                  <div className="rounded-xl border border-emerald/20 bg-emerald/5 p-3.5 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <Handshake className="h-3.5 w-3.5 text-emerald flex-shrink-0" />
                      <span className="text-[10px] font-mono font-bold text-emerald uppercase tracking-wider">
                        Common Ground
                      </span>
                    </div>
                    <p className="text-xs font-mono text-surface-300 leading-relaxed">
                      {data.common_ground}
                    </p>
                  </div>

                  {/* Core Tensions */}
                  <div className="rounded-xl border border-against-500/20 bg-against-500/5 p-3.5 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <Swords className="h-3.5 w-3.5 text-against-400 flex-shrink-0" />
                      <span className="text-[10px] font-mono font-bold text-against-400 uppercase tracking-wider">
                        Core Tensions
                      </span>
                    </div>
                    <p className="text-xs font-mono text-surface-300 leading-relaxed">
                      {data.tensions}
                    </p>
                  </div>

                  {/* Synthesis */}
                  <div className="rounded-xl border border-purple/20 bg-purple/5 p-3.5 space-y-1.5">
                    <div className="flex items-center gap-1.5">
                      <Scale className="h-3.5 w-3.5 text-purple flex-shrink-0" />
                      <span className="text-[10px] font-mono font-bold text-purple uppercase tracking-wider">
                        Synthesis
                      </span>
                    </div>
                    <p className="text-xs font-mono text-surface-300 leading-relaxed">
                      {data.synthesis}
                    </p>
                  </div>

                  <p className="text-[10px] font-mono text-surface-600 text-right">
                    AI-generated · not an editorial position
                  </p>
                </motion.div>
              )}

              {/* Empty state — show generate CTA */}
              {!loading && !data && !insufficientData && !error && (
                <div className="text-center py-3 space-y-3">
                  <div className="flex items-center justify-center h-10 w-10 rounded-xl bg-purple/10 mx-auto">
                    <GitMerge className="h-5 w-5 text-purple" />
                  </div>
                  <div>
                    <p className="text-sm font-mono font-semibold text-white mb-1">
                      Synthesize this debate
                    </p>
                    <p className="text-xs font-mono text-surface-500 max-w-xs mx-auto">
                      AI will find what both sides agree on, name the core tensions,
                      and offer a nuanced synthesis position.
                    </p>
                  </div>
                  {isLoggedIn ? (
                    <button
                      type="button"
                      disabled={generating}
                      onClick={generate}
                      className={cn(
                        'inline-flex items-center gap-2 px-4 py-2 rounded-lg text-xs font-mono font-semibold transition-colors',
                        'bg-purple text-white hover:bg-purple/80 disabled:opacity-50'
                      )}
                    >
                      {generating ? (
                        <><Loader2 className="h-3.5 w-3.5 animate-spin" />Synthesizing…</>
                      ) : (
                        <><WandSparkles className="h-3.5 w-3.5" />Generate Synthesis</>
                      )}
                    </button>
                  ) : (
                    <p className="text-xs font-mono text-surface-500">
                      Sign in to generate the synthesis.
                    </p>
                  )}
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
