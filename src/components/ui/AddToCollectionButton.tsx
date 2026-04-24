'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Check,
  ChevronRight,
  Layers,
  Loader2,
  Lock,
  Globe,
  Plus,
  X,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { CollectionSummary } from '@/app/api/collections/route'

interface AddToCollectionButtonProps {
  topicId: string
  className?: string
}

export function AddToCollectionButton({ topicId, className }: AddToCollectionButtonProps) {
  const [open, setOpen] = useState(false)
  const [collections, setCollections] = useState<(CollectionSummary & { has_topic?: boolean })[]>([])
  const [loading, setLoading] = useState(false)
  const [isAuthenticated, setIsAuthenticated] = useState(false)
  const [busy, setBusy] = useState<string | null>(null)
  const panelRef = useRef<HTMLDivElement>(null)

  // Fetch user's collections when panel opens
  useEffect(() => {
    if (!open) return
    setLoading(true)
    fetch(`/api/collections?mode=mine&topic_id=${topicId}`)
      .then((r) => r.json())
      .then((json) => {
        setCollections(json.collections ?? [])
        setIsAuthenticated(json.isAuthenticated ?? false)
      })
      .catch(() => {})
      .finally(() => setLoading(false))
  }, [open, topicId])

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handler(e: MouseEvent) {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  async function toggleItem(collectionId: string, currentlyAdded: boolean) {
    setBusy(collectionId)
    try {
      const res = await fetch(`/api/collections/${collectionId}/items`, {
        method: currentlyAdded ? 'DELETE' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic_id: topicId }),
      })
      if (res.ok) {
        setCollections((prev) =>
          prev.map((c) =>
            c.id === collectionId
              ? {
                  ...c,
                  has_topic: !currentlyAdded,
                  item_count: currentlyAdded
                    ? Math.max(0, c.item_count - 1)
                    : c.item_count + 1,
                }
              : c
          )
        )
      }
    } catch {
      // best-effort
    } finally {
      setBusy(null)
    }
  }

  const anyAdded = collections.some((c) => c.has_topic)

  return (
    <div className={cn('relative', className)} ref={panelRef}>
      <button
        onClick={() => setOpen((o) => !o)}
        aria-label="Add to collection"
        aria-expanded={open}
        className={cn(
          'flex items-center justify-center h-8 w-8 rounded-lg border transition-all',
          anyAdded
            ? 'bg-gold/20 border-gold/40 text-gold'
            : 'bg-surface-200 border-surface-300 text-surface-500 hover:bg-surface-300 hover:text-white'
        )}
      >
        <Layers className="h-4 w-4" />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95, y: 6 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95, y: 6 }}
            transition={{ duration: 0.15 }}
            className={cn(
              'absolute right-0 top-full mt-2 z-50',
              'w-64 bg-surface-100 border border-surface-300 rounded-2xl shadow-2xl',
              'overflow-hidden'
            )}
          >
            {/* Header */}
            <div className="flex items-center justify-between px-3 py-2.5 border-b border-surface-300">
              <span className="text-xs font-mono font-semibold text-surface-400">
                Add to Collection
              </span>
              <button
                onClick={() => setOpen(false)}
                className="text-surface-600 hover:text-white transition-colors"
                aria-label="Close"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>

            {/* Content */}
            {loading ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="h-4 w-4 animate-spin text-surface-500" />
              </div>
            ) : !isAuthenticated ? (
              <div className="p-4 text-center">
                <Layers className="h-6 w-6 text-surface-500 mx-auto mb-2" />
                <p className="text-xs font-mono text-surface-500 mb-3">
                  Sign in to save topics to collections
                </p>
                <Link
                  href="/login"
                  className="block px-3 py-1.5 bg-for-600 hover:bg-for-500 text-white text-xs font-mono font-semibold rounded-lg transition-colors text-center"
                >
                  Sign in
                </Link>
              </div>
            ) : collections.length === 0 ? (
              <div className="p-4 text-center">
                <p className="text-xs font-mono text-surface-500 mb-3">
                  No collections yet
                </p>
                <Link
                  href="/collections"
                  className="flex items-center justify-center gap-1.5 px-3 py-1.5 bg-surface-200 hover:bg-surface-300 text-white text-xs font-mono font-semibold rounded-lg transition-colors"
                >
                  <Plus className="h-3 w-3" />
                  Create a collection
                </Link>
              </div>
            ) : (
              <>
                <ul className="max-h-52 overflow-y-auto py-1">
                  {collections.map((c) => {
                    const isBusy = busy === c.id
                    return (
                      <li key={c.id}>
                        <button
                          onClick={() => toggleItem(c.id, !!c.has_topic)}
                          disabled={isBusy}
                          className={cn(
                            'w-full flex items-center gap-2 px-3 py-2 text-left',
                            'hover:bg-surface-200 transition-colors disabled:opacity-50',
                            c.has_topic && 'bg-gold/5'
                          )}
                        >
                          <div className={cn(
                            'flex items-center justify-center h-4 w-4 rounded border shrink-0 transition-all',
                            c.has_topic
                              ? 'bg-gold border-gold/60 text-black'
                              : 'border-surface-400 text-transparent'
                          )}>
                            {isBusy ? (
                              <Loader2 className="h-2.5 w-2.5 animate-spin text-surface-500" />
                            ) : c.has_topic ? (
                              <Check className="h-2.5 w-2.5" />
                            ) : null}
                          </div>

                          <span className="flex-1 text-xs font-mono text-white truncate">
                            {c.name}
                          </span>

                          <div className="flex items-center gap-1 shrink-0">
                            {c.is_public ? (
                              <Globe className="h-2.5 w-2.5 text-surface-600" />
                            ) : (
                              <Lock className="h-2.5 w-2.5 text-surface-600" />
                            )}
                            <span className="text-[10px] font-mono text-surface-600">
                              {c.item_count}
                            </span>
                          </div>
                        </button>
                      </li>
                    )
                  })}
                </ul>

                {/* Create new */}
                <div className="border-t border-surface-300">
                  <Link
                    href="/collections"
                    className="flex items-center gap-2 px-3 py-2.5 text-xs font-mono text-surface-500 hover:text-white hover:bg-surface-200 transition-colors"
                  >
                    <Plus className="h-3.5 w-3.5" />
                    Manage collections
                    <ChevronRight className="h-3 w-3 ml-auto" />
                  </Link>
                </div>
              </>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
