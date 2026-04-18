'use client'

import { useEffect, useMemo, useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import Link from 'next/link'
import {
  Activity,
  AlertCircle,
  Award,
  Bell,
  Bookmark,
  Gavel,
  MessageCircle,
  Scale,
  Swords,
  TrendingUp,
  User,
  UserPlus,
  Users,
  CheckCircle,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Notification, NotificationType } from '@/lib/supabase/types'
import { EmptyState } from '@/components/ui/EmptyState'
import { cn } from '@/lib/utils/cn'

interface NotificationsListProps {
  notifications: Notification[]
}

// ─── Icon + colour mapping per type ──────────────────────────────────────────

const typeConfig: Record<
  NotificationType,
  { icon: LucideIcon; color: string }
> = {
  topic_activated: { icon: Activity, color: 'text-for-400' },
  vote_threshold: { icon: TrendingUp, color: 'text-for-400' },
  vote_started: { icon: Scale, color: 'text-purple' },
  law_established: { icon: Gavel, color: 'text-emerald' },
  debate_starting: { icon: Swords, color: 'text-gold' },
  achievement_earned: { icon: Award, color: 'text-gold' },
  reply_received: { icon: MessageCircle, color: 'text-for-400' },
  lobby_update: { icon: Bell, color: 'text-surface-600' },
  role_promoted: { icon: User, color: 'text-emerald' },
  coalition_invite: { icon: Users, color: 'text-purple' },
  coalition_invite_accepted: { icon: CheckCircle, color: 'text-emerald' },
  bookmark_update: { icon: Bookmark, color: 'text-gold' },
  new_follower: { icon: UserPlus, color: 'text-purple' },
}

// ─── Filter tabs ──────────────────────────────────────────────────────────────

type FilterTab = 'all' | 'unread' | 'social' | 'debates' | 'achievements'

const FILTER_TABS: { id: FilterTab; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'unread', label: 'Unread' },
  { id: 'social', label: 'Social' },
  { id: 'debates', label: 'Debates' },
  { id: 'achievements', label: 'Achievements' },
]

const SOCIAL_TYPES: NotificationType[] = [
  'new_follower',
  'coalition_invite',
  'coalition_invite_accepted',
  'reply_received',
  'role_promoted',
]

const DEBATE_TYPES: NotificationType[] = ['debate_starting']

const ACHIEVEMENT_TYPES: NotificationType[] = ['achievement_earned']

function filterNotifications(
  notifications: Notification[],
  tab: FilterTab
): Notification[] {
  switch (tab) {
    case 'unread':
      return notifications.filter((n) => !n.is_read)
    case 'social':
      return notifications.filter((n) =>
        SOCIAL_TYPES.includes(n.type as NotificationType)
      )
    case 'debates':
      return notifications.filter((n) =>
        DEBATE_TYPES.includes(n.type as NotificationType)
      )
    case 'achievements':
      return notifications.filter((n) =>
        ACHIEVEMENT_TYPES.includes(n.type as NotificationType)
      )
    default:
      return notifications
  }
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function buildHref(notification: Notification): string {
  const { reference_id, reference_type } = notification
  if (!reference_id) return '#'
  switch (reference_type) {
    case 'topic':
      return `/topic/${reference_id}`
    case 'law':
      return `/law/${reference_id}`
    case 'debate':
      return `/debates/${reference_id}`
    case 'profile':
      return `/profile/${reference_id}`
    case 'coalition':
      return `/coalitions/${reference_id}`
    default:
      return '#'
  }
}

function formatDateGroup(iso: string): string {
  const d = new Date(iso)
  const now = new Date()
  const diffDays = Math.floor(
    (now.getTime() - d.getTime()) / (1000 * 60 * 60 * 24)
  )
  if (diffDays === 0) return 'Today'
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays} days ago`
  return d.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
  })
}

function formatTime(iso: string): string {
  const d = new Date(iso)
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
  })
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NotificationsList({ notifications }: NotificationsListProps) {
  const [activeFilter, setActiveFilter] = useState<FilterTab>('all')

  // Auto-mark all as read when the page is first viewed
  useEffect(() => {
    const unreadIds = notifications.filter((n) => !n.is_read).map((n) => n.id)
    if (unreadIds.length === 0) return

    async function markRead() {
      const supabase = createClient()
      await supabase
        .from('notifications')
        .update({ is_read: true })
        .in('id', unreadIds)
    }
    markRead()
  }, [notifications])

  const filtered = useMemo(
    () => filterNotifications(notifications, activeFilter),
    [notifications, activeFilter]
  )

  const grouped = useMemo(() => {
    const result = new Map<string, Notification[]>()
    for (const notification of filtered) {
      const key = formatDateGroup(notification.created_at)
      const list = result.get(key) ?? []
      list.push(notification)
      result.set(key, list)
    }
    return Array.from(result.entries())
  }, [filtered])

  // Tab badge counts
  const counts = useMemo(
    () => ({
      unread: notifications.filter((n) => !n.is_read).length,
      social: notifications.filter((n) =>
        SOCIAL_TYPES.includes(n.type as NotificationType)
      ).length,
      debates: notifications.filter((n) =>
        DEBATE_TYPES.includes(n.type as NotificationType)
      ).length,
      achievements: notifications.filter((n) =>
        ACHIEVEMENT_TYPES.includes(n.type as NotificationType)
      ).length,
    }),
    [notifications]
  )

  if (notifications.length === 0) {
    return (
      <EmptyState
        icon={Bell}
        title="No notifications"
        description="You'll see updates from the Lobby here — votes, debates, achievements, and more."
        actions={[{ label: 'Explore the feed', href: '/' }]}
        size="sm"
      />
    )
  }

  return (
    <div className="space-y-6">
      {/* ── Filter tabs ───────────────────────────────────────────────────── */}
      <div
        role="tablist"
        aria-label="Filter notifications by type"
        className="flex items-center gap-1 p-1 bg-surface-200 rounded-xl overflow-x-auto scrollbar-hide"
      >
        {FILTER_TABS.map((tab) => {
          const count = counts[tab.id as keyof typeof counts] ?? 0
          const isActive = activeFilter === tab.id
          return (
            <button
              key={tab.id}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveFilter(tab.id)}
              className={cn(
                'flex items-center gap-1.5 flex-shrink-0 h-8 px-3 rounded-lg text-xs font-mono font-medium transition-colors whitespace-nowrap',
                isActive
                  ? 'bg-surface-100 text-white shadow-sm'
                  : 'text-surface-500 hover:text-surface-300'
              )}
            >
              {tab.label}
              {tab.id !== 'all' && count > 0 && (
                <span
                  className={cn(
                    'inline-flex items-center justify-center h-4 min-w-[1rem] px-1 rounded-full text-[10px] font-bold',
                    isActive
                      ? 'bg-for-500/20 text-for-400'
                      : 'bg-surface-300 text-surface-500'
                  )}
                >
                  {count}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* ── Notification list ─────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        <motion.div
          key={activeFilter}
          initial={{ opacity: 0, y: 4 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -4 }}
          transition={{ duration: 0.15 }}
          className="space-y-8"
        >
          {filtered.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
              <div className="h-10 w-10 rounded-xl bg-surface-200 flex items-center justify-center">
                <Bell className="h-5 w-5 text-surface-500" aria-hidden="true" />
              </div>
              <p className="text-surface-500 text-sm">
                No {activeFilter === 'all' ? '' : activeFilter + ' '}
                notifications yet.
              </p>
            </div>
          ) : (
            grouped.map(([label, items]) => (
              <section key={label}>
                <div className="sticky top-14 z-10 -mx-1 px-1 py-2 bg-surface-50/80 backdrop-blur">
                  <h2 className="text-[11px] font-mono text-surface-500 uppercase tracking-wider">
                    {label}
                  </h2>
                </div>
                <div className="rounded-2xl border border-surface-300 bg-surface-100 divide-y divide-surface-300 overflow-hidden">
                  {items.map((notification, idx) => {
                    const config =
                      typeConfig[notification.type as NotificationType] ?? {
                        icon: AlertCircle,
                        color: 'text-surface-500',
                      }
                    const Icon = config.icon
                    const href = buildHref(notification)
                    const wasUnread = !notification.is_read

                    return (
                      <motion.div
                        key={notification.id}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03 }}
                      >
                        <Link
                          href={href}
                          className={cn(
                            'flex items-start gap-4 px-5 py-4 hover:bg-surface-200 transition-colors',
                            wasUnread && 'bg-for-500/[0.04]'
                          )}
                        >
                          <div
                            className={cn(
                              'flex-shrink-0 flex items-center justify-center h-10 w-10 rounded-full border',
                              wasUnread
                                ? 'bg-surface-200 border-for-500/40'
                                : 'bg-surface-200 border-surface-300'
                            )}
                          >
                            <Icon
                              className={cn('h-5 w-5', config.color)}
                              aria-hidden="true"
                            />
                          </div>

                          <div className="flex-1 min-w-0">
                            <div className="flex items-start justify-between gap-3">
                              <div className="font-semibold text-sm text-white truncate">
                                {notification.title}
                              </div>
                              <span className="text-[10px] font-mono text-surface-500 whitespace-nowrap flex-shrink-0">
                                {formatTime(notification.created_at)}
                              </span>
                            </div>
                            {notification.body && (
                              <p className="text-xs text-surface-600 mt-1 line-clamp-2">
                                {notification.body}
                              </p>
                            )}
                          </div>

                          {wasUnread && (
                            <span
                              className="flex-shrink-0 h-2 w-2 rounded-full bg-for-500 mt-3"
                              aria-label="Unread"
                            />
                          )}
                        </Link>
                      </motion.div>
                    )
                  })}
                </div>
              </section>
            ))
          )}
        </motion.div>
      </AnimatePresence>
    </div>
  )
}
