'use client'

import { useCallback, useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import { MessageSquare, RefreshCw } from 'lucide-react'
import { Avatar } from '@/components/ui/Avatar'
import { EmptyState } from '@/components/ui/EmptyState'
import { Skeleton } from '@/components/ui/Skeleton'
import { cn } from '@/lib/utils/cn'
import type { DmConversation } from '@/lib/supabase/types'

interface InboxResponse {
  conversations: DmConversation[]
  totalUnread: number
}

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 2) return 'just now'
  if (m < 60) return `${m}m`
  if (h < 24) return `${h}h`
  if (d < 7) return `${d}d`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function ConversationSkeleton() {
  return (
    <div className="space-y-2">
      {[0, 1, 2].map((i) => (
        <div key={i} className="flex items-center gap-3 p-4 rounded-2xl bg-surface-100 border border-surface-300">
          <Skeleton className="h-11 w-11 rounded-full flex-shrink-0" />
          <div className="flex-1 min-w-0 space-y-2">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-3 w-48" />
          </div>
          <Skeleton className="h-3 w-10 flex-shrink-0" />
        </div>
      ))}
    </div>
  )
}

export function InboxClient() {
  const [data, setData] = useState<InboxResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true)
    try {
      const res = await fetch('/api/messages')
      if (res.ok) setData(await res.json())
    } catch {
      // best-effort
    } finally {
      setLoading(false)
      setRefreshing(false)
    }
  }, [])

  useEffect(() => { load() }, [load])

  if (loading) return <ConversationSkeleton />

  const conversations = data?.conversations ?? []

  return (
    <div className="space-y-3">
      {/* Refresh row */}
      <div className="flex items-center justify-between mb-1">
        <p className="text-xs font-mono text-surface-500">
          {conversations.length} conversation{conversations.length !== 1 ? 's' : ''}
          {(data?.totalUnread ?? 0) > 0 && (
            <span className="ml-2 text-for-400 font-semibold">
              · {data!.totalUnread} unread
            </span>
          )}
        </p>
        <button
          onClick={() => load(true)}
          disabled={refreshing}
          className="flex items-center gap-1 text-xs font-mono text-surface-500 hover:text-white transition-colors disabled:opacity-50"
        >
          <RefreshCw className={cn('h-3 w-3', refreshing && 'animate-spin')} />
          Refresh
        </button>
      </div>

      {conversations.length === 0 ? (
        <EmptyState
          icon={MessageSquare}
          title="No messages yet"
          description="Start a conversation from any user's profile page."
        />
      ) : (
        <AnimatePresence initial={false}>
          {conversations.map((conv, idx) => (
            <motion.div
              key={conv.partner.id}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.03 }}
            >
              <Link
                href={`/messages/${conv.partner.username}`}
                className={cn(
                  'flex items-center gap-3 p-4 rounded-2xl border transition-all',
                  'bg-surface-100 border-surface-300 hover:border-surface-400 hover:bg-surface-200',
                  conv.unread_count > 0 && 'border-for-500/40 bg-for-500/5'
                )}
              >
                <div className="relative flex-shrink-0">
                  <Avatar
                    src={conv.partner.avatar_url}
                    fallback={conv.partner.display_name ?? conv.partner.username}
                    size="lg"
                  />
                  {conv.unread_count > 0 && (
                    <span className="absolute -top-1 -right-1 flex h-4 w-4 items-center justify-center rounded-full bg-for-500 text-[10px] font-bold text-white">
                      {conv.unread_count > 9 ? '9+' : conv.unread_count}
                    </span>
                  )}
                </div>

                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className={cn('text-sm font-semibold truncate', conv.unread_count > 0 ? 'text-white' : 'text-surface-100')}>
                      {conv.partner.display_name ?? conv.partner.username}
                    </p>
                    <p className="text-xs text-surface-500 truncate hidden sm:block">
                      @{conv.partner.username}
                    </p>
                  </div>
                  <p className={cn(
                    'text-xs truncate mt-0.5',
                    conv.unread_count > 0 ? 'text-surface-200' : 'text-surface-500'
                  )}>
                    {conv.last_sender_id !== conv.partner.id && (
                      <span className="text-surface-500">You: </span>
                    )}
                    {conv.last_message}
                  </p>
                </div>

                <div className="flex-shrink-0 text-right">
                  <p className="text-xs text-surface-500">{relativeTime(conv.last_message_at)}</p>
                </div>
              </Link>
            </motion.div>
          ))}
        </AnimatePresence>
      )}
    </div>
  )
}
