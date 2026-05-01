'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import Link from 'next/link'
import {
  Activity,
  AlertCircle,
  Award,
  Bell,
  Bookmark,
  CheckCheck,
  Gavel,
  MessageCircle,
  MessageSquare,
  Scale,
  Swords,
  TrendingUp,
  User,
  UserPlus,
  Users,
  CheckCircle,
  Link2,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { createClient } from '@/lib/supabase/client'
import type { Notification, NotificationType } from '@/lib/supabase/types'
import { cn } from '@/lib/utils/cn'

// ─── Type config ──────────────────────────────────────────────────────────────

const TYPE_CONFIG: Record<
  NotificationType,
  { icon: LucideIcon; color: string; bg: string }
> = {
  topic_activated:           { icon: Activity,      color: 'text-for-400',    bg: 'bg-for-500/10' },
  vote_threshold:            { icon: TrendingUp,    color: 'text-for-400',    bg: 'bg-for-500/10' },
  vote_started:              { icon: Scale,         color: 'text-purple',     bg: 'bg-purple/10' },
  law_established:           { icon: Gavel,         color: 'text-emerald',    bg: 'bg-emerald/10' },
  debate_starting:           { icon: Swords,        color: 'text-gold',       bg: 'bg-gold/10' },
  achievement_earned:        { icon: Award,         color: 'text-gold',       bg: 'bg-gold/10' },
  reply_received:            { icon: MessageCircle, color: 'text-for-400',    bg: 'bg-for-500/10' },
  lobby_update:              { icon: Bell,          color: 'text-surface-500', bg: 'bg-surface-300/40' },
  role_promoted:             { icon: User,          color: 'text-emerald',    bg: 'bg-emerald/10' },
  coalition_invite:          { icon: Users,          color: 'text-purple',      bg: 'bg-purple/10' },
  coalition_invite_accepted: { icon: CheckCircle,    color: 'text-emerald',     bg: 'bg-emerald/10' },
  bookmark_update:           { icon: Bookmark,       color: 'text-gold',        bg: 'bg-gold/10' },
  new_follower:              { icon: UserPlus,       color: 'text-purple',      bg: 'bg-purple/10' },
  argument_upvoted:          { icon: TrendingUp,     color: 'text-for-400',     bg: 'bg-for-500/10' },
  argument_cited:            { icon: Link2,          color: 'text-emerald',     bg: 'bg-emerald/10' },
  topic_subscribed_update:   { icon: Activity,       color: 'text-for-400',     bg: 'bg-for-500/10' },
  vote_phase_started:        { icon: Scale,          color: 'text-purple',      bg: 'bg-purple/10' },
  direct_message:            { icon: MessageSquare,  color: 'text-for-300',     bg: 'bg-for-500/10' },
}

const FALLBACK_CONFIG = { icon: AlertCircle, color: 'text-surface-500', bg: 'bg-surface-200' }

// ─── Helpers ──────────────────────────────────────────────────────────────────

function relativeTime(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime()
  const m = Math.floor(diff / 60_000)
  const h = Math.floor(m / 60)
  const d = Math.floor(h / 24)
  if (m < 1) return 'just now'
  if (m < 60) return `${m}m ago`
  if (h < 24) return `${h}h ago`
  if (d < 7) return `${d}d ago`
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
}

function buildHref(n: Notification): string {
  if (!n.reference_id) return '/notifications'
  switch (n.reference_type) {
    case 'topic':     return `/topic/${n.reference_id}`
    case 'law':       return `/law/${n.reference_id}`
    case 'debate':    return `/debate/${n.reference_id}`
    case 'profile':   return `/profile/${n.reference_id}`
    case 'coalition': return `/coalitions/${n.reference_id}`
    default:          return '/notifications'
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NotificationBell() {
  const [isOpen, setIsOpen] = useState(false)
  const [notifications, setNotifications] = useState<Notification[]>([])
  const [userId, setUserId] = useState<string | null>(null)
  const [markingRead, setMarkingRead] = useState(false)
  // Track if a brand-new notification just arrived (triggers bell animation)
  const [justArrived, setJustArrived] = useState(false)
  const dropdownRef = useRef<HTMLDivElement | null>(null)
  const prevUnreadRef = useRef(0)

  const unreadCount = notifications.filter((n) => !n.is_read).length

  // Flash the bell when unread count increases
  useEffect(() => {
    if (unreadCount > prevUnreadRef.current) {
      setJustArrived(true)
      const t = setTimeout(() => setJustArrived(false), 2000)
      return () => clearTimeout(t)
    }
    prevUnreadRef.current = unreadCount
  }, [unreadCount])

  // Load initial data
  useEffect(() => {
    let active = true

    async function load() {
      const supabase = createClient()
      const { data: { user } } = await supabase.auth.getUser()
      if (!active || !user) return
      setUserId(user.id)

      const { data } = await supabase
        .from('notifications')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(8)

      if (active && data) setNotifications(data as Notification[])
    }

    load()
    return () => { active = false }
  }, [])

  // Realtime: subscribe to new notifications
  useEffect(() => {
    if (!userId) return
    const supabase = createClient()
    const channel = supabase
      .channel(`bell:${userId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'notifications', filter: `user_id=eq.${userId}` },
        (payload) => {
          setNotifications((prev) => [payload.new as Notification, ...prev].slice(0, 8))
        }
      )
      .subscribe()

    return () => { supabase.removeChannel(channel) }
  }, [userId])

  // Close on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setIsOpen(false)
      }
    }
    if (isOpen) {
      document.addEventListener('mousedown', handleClick)
      return () => document.removeEventListener('mousedown', handleClick)
    }
  }, [isOpen])

  const handleMarkAllRead = useCallback(async () => {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id)
    if (!unreadIds.length || markingRead) return
    setMarkingRead(true)
    setNotifications((prev) => prev.map((n) => ({ ...n, is_read: true })))
    const supabase = createClient()
    await supabase.from('notifications').update({ is_read: true }).in('id', unreadIds)
    setMarkingRead(false)
  }, [notifications, markingRead])

  // Guest state
  if (!userId) {
    return (
      <Link
        href="/login"
        className="relative flex items-center justify-center h-8 w-8 rounded-full bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-surface-700 transition-colors"
        aria-label="Notifications — sign in to view"
      >
        <Bell className="h-4 w-4" />
      </Link>
    )
  }

  return (
    <div className="relative" ref={dropdownRef}>
      {/* Bell button */}
      <button
        type="button"
        onClick={() => setIsOpen((open) => !open)}
        aria-expanded={isOpen}
        aria-label={`Notifications${unreadCount > 0 ? `, ${unreadCount} unread` : ''}`}
        className={cn(
          'relative flex items-center justify-center h-8 w-8 rounded-full transition-colors',
          'bg-surface-200 text-surface-500 hover:bg-surface-300 hover:text-surface-700',
          isOpen && 'bg-surface-300 text-surface-700'
        )}
      >
        {/* Bell icon with shake animation on new arrival */}
        <motion.div
          animate={justArrived ? {
            rotate: [0, -12, 12, -8, 8, -4, 4, 0],
          } : { rotate: 0 }}
          transition={{ duration: 0.5 }}
        >
          <Bell className="h-4 w-4" />
        </motion.div>

        {/* Unread badge */}
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              key="badge"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              transition={{ type: 'spring', stiffness: 500, damping: 25 }}
              className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] px-1 rounded-full bg-against-500 text-white text-[10px] font-mono font-bold flex items-center justify-center border-2 border-surface-100"
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>

        {/* Pulsing ring when new notification just arrived */}
        {justArrived && (
          <span className="absolute inset-0 rounded-full animate-ping bg-against-500/30 pointer-events-none" />
        )}
      </button>

      {/* Dropdown panel */}
      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, y: -8, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -8, scale: 0.97 }}
            transition={{ duration: 0.15, ease: [0.16, 1, 0.3, 1] }}
            className="absolute right-0 mt-2 w-84 z-50 rounded-2xl border border-surface-300 bg-surface-100 shadow-2xl overflow-hidden"
            style={{ minWidth: '320px', maxWidth: '340px' }}
          >
            {/* Header */}
            <div className="px-4 py-3 border-b border-surface-300 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Bell className="h-3.5 w-3.5 text-for-400" />
                <span className="text-sm font-semibold text-white font-mono">
                  Notifications
                </span>
                {unreadCount > 0 && (
                  <span className="text-[10px] font-mono text-surface-500">
                    {unreadCount} unread
                  </span>
                )}
              </div>

              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  disabled={markingRead}
                  className="flex items-center gap-1 text-[11px] font-mono text-for-400 hover:text-for-300 transition-colors disabled:opacity-50"
                  aria-label="Mark all notifications as read"
                >
                  <CheckCheck className="h-3 w-3" />
                  Mark all read
                </button>
              )}
            </div>

            {/* Notification list */}
            <div className="max-h-96 overflow-y-auto divide-y divide-surface-300/60">
              {notifications.length === 0 ? (
                <div className="px-5 py-8 text-center">
                  <div className="flex items-center justify-center h-10 w-10 rounded-full bg-surface-200 mx-auto mb-3">
                    <Bell className="h-5 w-5 text-surface-500" />
                  </div>
                  <p className="text-xs font-mono text-surface-500">
                    No notifications yet
                  </p>
                  <p className="text-[11px] text-surface-600 mt-0.5">
                    Votes, debates, and law updates will appear here.
                  </p>
                </div>
              ) : (
                notifications.map((n) => {
                  const config = TYPE_CONFIG[n.type] ?? FALLBACK_CONFIG
                  const Icon = config.icon
                  const href = buildHref(n)

                  return (
                    <Link
                      key={n.id}
                      href={href}
                      onClick={() => setIsOpen(false)}
                      className={cn(
                        'flex items-start gap-3 px-4 py-3 hover:bg-surface-200 transition-colors group',
                        !n.is_read && 'bg-for-500/[0.04]'
                      )}
                    >
                      {/* Icon */}
                      <div className={cn(
                        'flex-shrink-0 flex items-center justify-center h-8 w-8 rounded-full',
                        config.bg
                      )}>
                        <Icon className={cn('h-4 w-4', config.color)} />
                      </div>

                      {/* Content */}
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center justify-between gap-2">
                          <span className={cn(
                            'text-xs font-semibold truncate',
                            n.is_read ? 'text-surface-700' : 'text-white'
                          )}>
                            {n.title}
                          </span>
                          <span className="text-[10px] font-mono text-surface-500 flex-shrink-0">
                            {relativeTime(n.created_at)}
                          </span>
                        </div>
                        {n.body && (
                          <p className="text-[11px] text-surface-600 line-clamp-1 mt-0.5">
                            {n.body}
                          </p>
                        )}
                      </div>

                      {/* Unread dot */}
                      {!n.is_read && (
                        <span className="flex-shrink-0 h-2 w-2 rounded-full bg-for-500 mt-1.5" />
                      )}
                    </Link>
                  )
                })
              )}
            </div>

            {/* Footer */}
            <Link
              href="/notifications"
              onClick={() => setIsOpen(false)}
              className="block px-4 py-3 text-center text-xs font-mono font-semibold text-for-400 border-t border-surface-300 hover:bg-surface-200 transition-colors"
            >
              View all notifications →
            </Link>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
