'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { HandshakeIcon, Loader2, Plus } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { Avatar } from '@/components/ui/Avatar'
import { cn } from '@/lib/utils/cn'
import type { EndorsementItem } from '@/app/api/laws/[id]/endorse/route'

interface LawEndorsementsPanelProps {
  lawId: string
}

interface Summary {
  count: number
  recent: EndorsementItem[]
  userEndorsed: boolean
}

export function LawEndorsementsPanel({ lawId }: LawEndorsementsPanelProps) {
  const [data, setData] = useState<Summary | null>(null)
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const res = await fetch(`/api/laws/${lawId}/endorse`, { cache: 'no-store' })
      if (!res.ok) return
      const json = await res.json()
      setData({
        count: json.endorsement_count ?? 0,
        recent: (json.endorsements ?? []).slice(0, 6),
        userEndorsed: !!json.user_endorsement,
      })
    } catch {
      // fail silently
    } finally {
      setLoading(false)
    }
  }, [lawId])

  useEffect(() => { load() }, [load])

  if (loading) {
    return (
      <div className="rounded-xl bg-surface-100 border border-surface-300 p-4 flex items-center gap-2 text-surface-500">
        <Loader2 className="h-3.5 w-3.5 animate-spin" />
        <span className="text-xs font-mono">Loading endorsements…</span>
      </div>
    )
  }

  if (!data) return null

  const { count, recent, userEndorsed } = data

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.25 }}
        className="rounded-xl bg-surface-100 border border-surface-300 overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-4 pt-4 pb-2">
          <div className="flex items-center gap-2">
            <HandshakeIcon className="h-4 w-4 text-emerald" aria-hidden="true" />
            <span className="text-[11px] font-mono font-semibold uppercase tracking-widest text-surface-500">
              Community Endorsements
            </span>
          </div>
          <span className="font-mono text-lg font-bold text-white tabular-nums">
            {count.toLocaleString()}
          </span>
        </div>

        {/* Endorser avatar strip */}
        {recent.length > 0 && (
          <div className="px-4 pb-3">
            <div className="flex items-center gap-1.5 flex-wrap">
              {recent.map((e) => (
                <Link
                  key={e.id}
                  href={`/profile/${e.author?.username ?? ''}`}
                  title={e.author?.display_name ?? e.author?.username ?? 'Endorser'}
                  className="relative group"
                >
                  <Avatar
                    src={e.author?.avatar_url ?? null}
                    name={e.author?.display_name ?? e.author?.username ?? '?'}
                    size="xs"
                    className={cn(
                      'ring-1 ring-surface-300 group-hover:ring-emerald/60 transition-all',
                    )}
                  />
                </Link>
              ))}
              {count > 6 && (
                <span className="text-[10px] font-mono text-surface-500">
                  +{(count - 6).toLocaleString()} more
                </span>
              )}
            </div>

            {/* Featured message from most-recent endorser with a message */}
            {(() => {
              const featured = recent.find((e) => e.message)
              if (!featured) return null
              return (
                <blockquote className="mt-2 border-l-2 border-emerald/40 pl-3">
                  <p className="text-[11px] font-mono text-surface-500 italic line-clamp-2">
                    &ldquo;{featured.message}&rdquo;
                  </p>
                  <cite className="text-[10px] font-mono text-surface-600 not-italic">
                    — {featured.author?.display_name ?? featured.author?.username ?? 'Citizen'}
                  </cite>
                </blockquote>
              )
            })()}
          </div>
        )}

        {count === 0 && (
          <p className="px-4 pb-3 text-xs font-mono text-surface-500">
            No endorsements yet. Be the first to formally stand behind this law.
          </p>
        )}

        {/* CTA */}
        <div className="border-t border-surface-300 px-4 py-3">
          <Link
            href={`/law/${lawId}/endorse`}
            className={cn(
              'flex items-center justify-center gap-2 w-full rounded-lg px-4 py-2',
              'text-xs font-mono font-semibold transition-colors',
              userEndorsed
                ? 'bg-emerald/10 border border-emerald/30 text-emerald hover:bg-emerald/20'
                : 'bg-surface-200 border border-surface-300 text-surface-500 hover:bg-surface-300 hover:text-white',
            )}
          >
            {userEndorsed ? (
              <>
                <HandshakeIcon className="h-3.5 w-3.5" />
                You endorsed this law
              </>
            ) : (
              <>
                <Plus className="h-3.5 w-3.5" />
                Endorse this law
              </>
            )}
          </Link>
        </div>
      </motion.div>
    </AnimatePresence>
  )
}
