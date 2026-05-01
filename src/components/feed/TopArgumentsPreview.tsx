'use client'

import { useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, ThumbsUp, ThumbsDown, ChevronDown, ChevronUp } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

interface TopArgument {
  id: string
  content: string
  upvotes: number
}

interface TopArgumentsPreviewProps {
  topicId: string
}

export function TopArgumentsPreview({ topicId }: TopArgumentsPreviewProps) {
  const [open, setOpen] = useState(false)
  const [loading, setLoading] = useState(false)
  const [fetched, setFetched] = useState(false)
  const [forArg, setForArg] = useState<TopArgument | null>(null)
  const [againstArg, setAgainstArg] = useState<TopArgument | null>(null)

  const toggle = async (e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()

    if (!open && !fetched) {
      setLoading(true)
      try {
        const res = await fetch(`/api/topics/${topicId}/top-arguments`)
        if (res.ok) {
          const data = await res.json()
          setForArg(data.forArg)
          setAgainstArg(data.againstArg)
          setFetched(true)
        }
      } finally {
        setLoading(false)
      }
    }

    setOpen((v) => !v)
  }

  const hasAny = fetched && (forArg || againstArg)

  return (
    <div className="w-full">
      {/* Toggle pill */}
      <button
        onClick={toggle}
        aria-expanded={open}
        aria-label={open ? 'Hide top arguments' : 'Show top arguments'}
        className={cn(
          'flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-colors w-full justify-center',
          'text-[11px] font-mono font-medium',
          open
            ? 'bg-surface-200 border-surface-400 text-surface-400'
            : 'bg-surface-200/60 border-surface-400/50 text-surface-500 hover:border-surface-400 hover:text-surface-400',
        )}
      >
        <MessageSquare className="h-3 w-3" aria-hidden="true" />
        <span>Top Arguments</span>
        {loading ? (
          <span className="h-3 w-3 rounded-full border border-surface-500 border-t-transparent animate-spin" />
        ) : open ? (
          <ChevronUp className="h-3 w-3" />
        ) : (
          <ChevronDown className="h-3 w-3" />
        )}
      </button>

      {/* Expanded content */}
      <AnimatePresence>
        {open && !loading && (
          <motion.div
            key="args-preview"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="mt-2 space-y-2">
              {!hasAny && (
                <p className="text-center text-[11px] font-mono text-surface-600 py-2">
                  No arguments yet — be the first.
                </p>
              )}

              {forArg && (
                <div className="flex gap-2 p-2.5 rounded-xl bg-for-500/5 border border-for-500/20">
                  <ThumbsUp
                    className="h-3.5 w-3.5 mt-0.5 shrink-0 text-for-400"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-mono text-for-300 line-clamp-2 leading-relaxed">
                      {forArg.content}
                    </p>
                    {forArg.upvotes > 0 && (
                      <span className="text-[10px] text-for-500/70 font-mono">
                        {forArg.upvotes} {forArg.upvotes === 1 ? 'upvote' : 'upvotes'}
                      </span>
                    )}
                  </div>
                </div>
              )}

              {againstArg && (
                <div className="flex gap-2 p-2.5 rounded-xl bg-against-500/5 border border-against-500/20">
                  <ThumbsDown
                    className="h-3.5 w-3.5 mt-0.5 shrink-0 text-against-400"
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <p className="text-[11px] font-mono text-against-300 line-clamp-2 leading-relaxed">
                      {againstArg.content}
                    </p>
                    {againstArg.upvotes > 0 && (
                      <span className="text-[10px] text-against-500/70 font-mono">
                        {againstArg.upvotes} {againstArg.upvotes === 1 ? 'upvote' : 'upvotes'}
                      </span>
                    )}
                  </div>
                </div>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
