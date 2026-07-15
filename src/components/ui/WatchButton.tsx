'use client'

/**
 * WatchButton
 *
 * A toggleable button for adding/removing a market from the user's Exchange watchlist.
 * Optimistically updates local state, then syncs with the server.
 */

import { useCallback, useEffect, useState } from 'react'
import { Bookmark, BookmarkCheck, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { cn } from '@/lib/utils/cn'

interface WatchButtonProps {
  topicId: string
  className?: string
  iconOnly?: boolean
}

export function WatchButton({ topicId, className, iconOnly = false }: WatchButtonProps) {
  const [watching, setWatching] = useState(false)
  const [loading, setLoading] = useState(true)
  const [pending, setPending] = useState(false)
  const [authed, setAuthed] = useState(false)

  // Check auth + existing watch state
  useEffect(() => {
    let cancelled = false
    async function check() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!user || cancelled) {
        setLoading(false)
        return
      }
      setAuthed(true)

      const { data } = await supabase
        .from('exchange_watchlist')
        .select('id')
        .eq('user_id', user.id)
        .eq('topic_id', topicId)
        .maybeSingle()

      if (!cancelled) {
        setWatching(!!data)
        setLoading(false)
      }
    }
    check()
    return () => { cancelled = true }
  }, [topicId])

  const toggle = useCallback(async () => {
    if (!authed || pending) return
    setPending(true)
    const next = !watching
    setWatching(next)

    try {
      if (next) {
        await fetch('/api/exchange/watchlist', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ topic_id: topicId }),
        })
      } else {
        await fetch(`/api/exchange/watchlist?topic_id=${topicId}`, { method: 'DELETE' })
      }
    } catch {
      setWatching(!next)
    } finally {
      setPending(false)
    }
  }, [authed, pending, watching, topicId])

  if (!authed && !loading) return null

  if (loading) {
    return (
      <div className={cn('flex items-center justify-center h-9 w-9', className)}>
        <Loader2 className="h-4 w-4 text-surface-500 animate-spin" />
      </div>
    )
  }

  return (
    <button
      onClick={toggle}
      disabled={pending}
      title={watching ? 'Remove from watchlist' : 'Add to watchlist'}
      aria-label={watching ? 'Remove from watchlist' : 'Add to watchlist'}
      aria-pressed={watching}
      className={cn(
        'flex items-center gap-1.5 rounded-lg transition-colors',
        iconOnly
          ? 'justify-center h-9 w-9'
          : 'px-3 h-9 text-xs font-medium',
        watching
          ? 'bg-for-900/40 text-for-300 border border-for-800/50 hover:bg-against-900/30 hover:text-against-300 hover:border-against-800/40'
          : 'bg-surface-200 text-surface-500 border border-surface-400/20 hover:bg-surface-300 hover:text-white',
        pending && 'opacity-60 cursor-not-allowed',
        className,
      )}
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin flex-shrink-0" />
      ) : watching ? (
        <BookmarkCheck className="h-4 w-4 flex-shrink-0" />
      ) : (
        <Bookmark className="h-4 w-4 flex-shrink-0" />
      )}
      {!iconOnly && (
        <span>{watching ? 'Watching' : 'Watch'}</span>
      )}
    </button>
  )
}
