'use client'

import { useEffect, useState, useCallback } from 'react'
import { Bell, CheckCheck, Loader2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import { NotificationsList } from '@/components/profile/NotificationsList'
import type { Notification } from '@/lib/supabase/types'

interface NotificationsClientProps {
  initialNotifications: Notification[]
  userId: string
}

export function NotificationsClient({
  initialNotifications,
  userId,
}: NotificationsClientProps) {
  const [notifications, setNotifications] =
    useState<Notification[]>(initialNotifications)
  const [markingAll, setMarkingAll] = useState(false)

  const unreadCount = notifications.filter((n) => !n.is_read).length

  // Real-time: prepend new notifications and reflect read-state updates
  useEffect(() => {
    const supabase = createClient()
    const channel = supabase
      .channel('notifications-page')
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev])
        }
      )
      .on(
        'postgres_changes',
        {
          event: 'UPDATE',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          const updated = payload.new as Notification
          setNotifications((prev) =>
            prev.map((n) => (n.id === updated.id ? updated : n))
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  const markAllRead = useCallback(async () => {
    if (unreadCount === 0 || markingAll) return
    setMarkingAll(true)
    try {
      await fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ all: true }),
      })
      setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    } finally {
      setMarkingAll(false)
    }
  }, [unreadCount, markingAll])

  return (
    <>
      {/* ── Page header ─────────────────────────────────────────────────── */}
      <div className="mb-6 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="flex items-center justify-center h-11 w-11 rounded-xl bg-for-500/10 border border-for-500/30">
            <Bell className="h-5 w-5 text-for-400" />
          </div>
          <div>
            <h1 className="font-mono text-2xl font-bold text-white">
              Notifications
            </h1>
            <p className="text-sm font-mono text-surface-500 mt-0.5">
              {unreadCount > 0
                ? `${unreadCount} unread · ${notifications.length} total`
                : `${notifications.length} notification${notifications.length !== 1 ? 's' : ''}`}
            </p>
          </div>
        </div>

        {unreadCount > 0 && (
          <button
            onClick={markAllRead}
            disabled={markingAll}
            className="flex items-center gap-1.5 h-8 px-3 rounded-lg text-xs font-mono font-medium text-surface-400 hover:text-white hover:bg-surface-200 transition-colors disabled:opacity-50 flex-shrink-0"
          >
            {markingAll ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <CheckCheck className="h-3.5 w-3.5" />
            )}
            {markingAll ? 'Marking…' : 'Mark all read'}
          </button>
        )}
      </div>

      {/* ── List ────────────────────────────────────────────────────────── */}
      <NotificationsList notifications={notifications} />
    </>
  )
}
