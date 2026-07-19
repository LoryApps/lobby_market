'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { AnimatePresence, motion } from 'framer-motion'
import { Check, ChevronDown, FolderOpen, Loader2, Plus, X } from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { ExchangeGroup } from '@/app/api/exchange/groups/route'

interface Props {
  topicId: string
}

export function AddToGroupButton({ topicId }: Props) {
  const [open, setOpen] = useState(false)
  const [groups, setGroups] = useState<ExchangeGroup[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const [added, setAdded] = useState<Set<string>>(new Set())
  const ref = useRef<HTMLDivElement>(null)

  // Close on outside click
  useEffect(() => {
    if (!open) return
    function handle(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handle)
    return () => document.removeEventListener('mousedown', handle)
  }, [open])

  async function handleOpen() {
    setOpen((v) => !v)
    if (groups !== null) return
    setLoading(true)
    try {
      const res = await fetch('/api/exchange/groups')
      if (res.ok) {
        const data = await res.json() as { mine: ExchangeGroup[] }
        setGroups(data.mine ?? [])
      }
    } finally {
      setLoading(false)
    }
  }

  async function addToGroup(groupId: string) {
    if (adding) return
    setAdding(groupId)
    try {
      const res = await fetch(`/api/exchange/groups/${groupId}/items`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic_id: topicId }),
      })
      if (res.ok || res.status === 409) {
        setAdded((prev) => new Set([...prev, groupId]))
      }
    } finally {
      setAdding(null)
    }
  }

  return (
    <div ref={ref} className="relative">
      <button
        onClick={handleOpen}
        title="Add to a market group"
        className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg bg-surface-200 border border-surface-300 hover:border-purple/40 text-xs text-surface-500 hover:text-purple transition-colors"
      >
        <FolderOpen className="h-3 w-3" />
        Groups
        <ChevronDown className={cn('h-2.5 w-2.5 transition-transform', open && 'rotate-180')} />
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: 4, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 4, scale: 0.97 }}
            transition={{ duration: 0.12 }}
            className="absolute right-0 top-full mt-1.5 z-40 w-56 bg-surface-100 border border-surface-300 rounded-xl shadow-xl overflow-hidden"
          >
            <div className="flex items-center justify-between px-3 py-2 border-b border-surface-300/50">
              <span className="font-mono text-[11px] text-surface-500 uppercase tracking-wider">Add to Group</span>
              <button onClick={() => setOpen(false)} className="p-0.5 rounded hover:bg-surface-300 transition-colors">
                <X className="h-3 w-3 text-surface-600" />
              </button>
            </div>

            <div className="max-h-52 overflow-y-auto py-1">
              {loading && (
                <div className="flex items-center justify-center py-4">
                  <Loader2 className="h-4 w-4 text-surface-500 animate-spin" />
                </div>
              )}

              {!loading && groups !== null && groups.length === 0 && (
                <div className="px-3 py-3 text-center">
                  <p className="text-[11px] font-mono text-surface-500 mb-2">No groups yet</p>
                  <Link
                    href="/exchange/groups"
                    onClick={() => setOpen(false)}
                    className="text-[11px] font-mono text-for-400 hover:underline"
                  >
                    Create a group →
                  </Link>
                </div>
              )}

              {!loading && groups?.map((group) => {
                const isAdded = added.has(group.id)
                const isAdding = adding === group.id
                return (
                  <button
                    key={group.id}
                    onClick={() => !isAdded && addToGroup(group.id)}
                    disabled={isAdded || isAdding}
                    className={cn(
                      'w-full flex items-center gap-2.5 px-3 py-2 text-left transition-colors',
                      isAdded
                        ? 'opacity-60 cursor-default'
                        : 'hover:bg-surface-200'
                    )}
                  >
                    <span className="text-base flex-shrink-0">{group.emoji}</span>
                    <span className="flex-1 min-w-0 font-mono text-xs text-white truncate">{group.name}</span>
                    {isAdding ? (
                      <Loader2 className="h-3 w-3 text-surface-500 animate-spin flex-shrink-0" />
                    ) : isAdded ? (
                      <Check className="h-3 w-3 text-for-400 flex-shrink-0" />
                    ) : (
                      <Plus className="h-3 w-3 text-surface-600 flex-shrink-0" />
                    )}
                  </button>
                )
              })}
            </div>

            <div className="border-t border-surface-300/50 px-3 py-2">
              <Link
                href="/exchange/groups"
                onClick={() => setOpen(false)}
                className="flex items-center gap-1.5 text-[11px] font-mono text-surface-500 hover:text-white transition-colors"
              >
                <FolderOpen className="h-3 w-3" />
                Manage Groups
              </Link>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
