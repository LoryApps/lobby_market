'use client'

import { useEffect, useMemo } from 'react'
import { motion } from 'framer-motion'
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
  Users,
  CheckCircle,
} from 'lucide-react'
import type { LucideIcon } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'
import type { Notification, NotificationType } from '@/lib/supabase/types'
import { cn } from '@/lib/utils/cn'

interface NotificationsListProps {
  notifications: Notification[]
}

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
}

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

export function NotificationsList({ notifications }: NotificationsListProps) {
  // Auto-mark viewed as read
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

  const grouped = useMemo(() => {
    const result = new Map<string, Notification[]>()
    for (const notification of notifications) {
      const key = formatDateGroup(notification.created_at)
      const list = result.get(key) ?? []
      list.push(notification)
      result.set(key, list)
    }
    return Array.from(result.entries())
  }, [notifications])

  if (notifications.length === 0) {
    return (
      <div className="rounded-2xl border border-surface-300 bg-surface-100 p-12 text-center">
        <Bell className="h-10 w-10 text-surface-500 mx-auto mb-3" />
        <div className="text-base font-mono text-surface-700">
          No notifications
        </div>
        <div className="text-sm font-mono text-surface-500 mt-1">
          You&rsquo;ll see updates from the Lobby here.
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-8">
      {grouped.map(([label, items]) => (
        <section key={label}>
          <div className="sticky top-14 z-10 -mx-1 px-1 py-2 bg-surface-50/80 backdrop-blur">
            <h2 className="text-[11px] font-mono text-surface-500 uppercase tracking-wider">
              {label}
            </h2>
          </div>
          <div className="rounded-2xl border border-surface-300 bg-surface-100 divide-y divide-surface-300 overflow-hidden">
            {items.map((notification, idx) => {
              const config =
                typeConfig[notification.type] ?? {
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
                      <Icon className={cn('h-5 w-5', config.color)} />
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
                      <span className="flex-shrink-0 h-2 w-2 rounded-full bg-for-500 mt-3" />
                    )}
                  </Link>
                </motion.div>
              )
            })}
          </div>
        </section>
      ))}
    </div>
  )
}
