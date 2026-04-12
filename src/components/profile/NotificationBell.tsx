'use client'

import { useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import { Bell } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import type { Notification } from '@/lib/supabase/types'
import { cn } from '@/lib/utils/cn'

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const dropdownRef = useRef<HTMLDivElement | null>(null)

  const unreadCount = notifications.filter((n) => !n.is_read).length

  // Load initial data
  useEffect(() => {
    let active = true

    async function loadNotifications() {
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()

      if (!active || !user) return
      setUserId(user.id)

      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(5)

      if (active && data) {
        setNotifications(data as Notification[])
      }
    }

    loadNotifications()
    return () => {
      active = false
    }
  }, [])

  // Subscribe to realtime inserts
  useEffect(() => {
    if (!userId) return
    const supabase = createClient()

    const channel = supabase
      .channel(`notifications:${userId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'notifications',
          filter: `user_id=eq.${userId}`,
        },
        (payload) => {
          setNotifications((prev) =>
            [payload.new as Notification, ...prev].slice(0, 5)
          )
        }
      )
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [userId])

  // Click outside to close
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (
        dropdownRef.current &&
        !dropdownRef.current.contains(e.target as Node)
      ) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [isOpen])

  if (!userId) {
    // Still render the bell icon — guests won't see anything but keeps layout stable
    return (
      <Link
        href="/login"
        className="relative flex items-center justify-center h-8 w-8 rounded-full bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-surface-700 transition-colors"
        aria-label="Notifications"
      >
        <Bell className="h-4 w-4" />
      </Link>
    )
  }

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        className={cn(
          'relative flex items-center justify-center h-8 w-8 rounded-full transition-colors',
          'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-surface-700',
          isOpen && 'bg-surface-300 text-surface-700'
        )}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
      >
        <Bell className="h-4 w-4" />
        {unreadCount > 0 && (
          <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-against-500 text-white text-[10px] font-mono font-bold flex items-center justify-center border border-surface-100">
            {unreadCount > 9 ? '9+' : unreadCount}
          </span>
        )}
      </button>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 mt-2 w-80 z-50 rounded-2xl border border-surface-300 bg-surface-100 shadow-2xl overflow-hidden"
          >
            <div className="px-4 py-3 border-b border-surface-300 flex items-center justify-between">
              <span className="text-sm font-semibold text-white">
                Notifications
              </span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-mono text-surface-500">
                  {unreadCount} unread
                </span>
              )}
            </div>

            <div className="max-h-96 overflow-y-auto divide-y divide-surface-300">
              {notifications.length === 0 && (
                <div className="p-6 text-center text-xs font-mono text-surface-500">
                  No notifications yet.
                </div>
              )}
              {notifications.map((n) => (
                <Link
                  key={n.id}
                  href={
                    n.reference_type && n.reference_id
                      ? `/${n.reference_type}/${n.reference_id}`
                      : '/notifications'
                  }
                  onClick={() => setIsOpen(false)}
                  className={cn(
                    'block px-4 py-3 hover:bg-surface-200 transition-colors',
                    !n.is_read && 'bg-for-500/[0.04]'
                  )}
                >
                  <div className="flex items-start gap-2">
                    {!n.is_read && (
                      <span className="flex-shrink-0 h-2 w-2 rounded-full bg-for-500 mt-1.5" />
                    )}
                    <div className="flex-1 min-w-0">
                      <div className="text-xs font-semibold text-white truncate">
                        {n.title}
                      </div>
                      {n.body && (
                        <div className="text-[11px] text-surface-600 line-clamp-2 mt-0.5">
                          {n.body}
                        </div>
                      )}
                      <div className="text-[10px] font-mono text-surface-500 mt-0.5">
                        {new Date(n.created_at).toLocaleString()}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>

            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className="block px-4 py-3 text-center text-xs font-mono font-semibold text-for-400 border-t border-surface-300 hover:bg-surface-200 transition-colors"
            >
              View all notifications
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
