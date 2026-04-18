'use client'

/**
 * NotificationWatcher
 *
 * Supersedes AchievementWatcher. Uses Supabase Realtime for instant,
 * push-based notification toasts — no polling needed.
 *
 * Behaviour:
 * - On mount, fetches authoritative preferences from /api/notification-prefs
 *   (server-synced) and writes them to localStorage so the Settings page sees
 *   the canonical values.
 * - Subscribes to INSERT events on the `notifications` table filtered to the
 *   current user.
 * - Also runs a one-time initial fetch to catch any unread notifications
 *   from the last 15 minutes that arrived before the subscription was
 *   established.
 * - For each new notification, checks the `lm_notif_prefs` preference key
 *   (set by the Settings page) before showing a toast.
 * - After showing, marks the notification as read on the server.
 * - Deduplicates via a per-session in-memory Set + localStorage fallback.
 *
 * Must be rendered inside <ToastProvider>.
 */

import { useEffect, useRef } from 'react'
import type { RealtimeChannel } from '@supabase/supabase-js'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/lib/hooks/useToast'
import type { ToastTier } from '@/lib/hooks/useToast'
import type { Notification, NotificationType } from '@/lib/supabase/types'

// ─── Preference storage (mirrors Settings page) ───────────────────────────────

const NOTIF_PREFS_KEY = 'lm_notif_prefs'
const SHOWN_KEY = 'lm_shown_notif_ids'

interface NotifPrefs {
  achievement_earned: boolean
  debate_starting: boolean
  law_established: boolean
  topic_activated: boolean
  vote_threshold: boolean
  reply_received: boolean
  role_promoted: boolean
  lobby_update: boolean
}

const DEFAULT_PREFS: NotifPrefs = {
  achievement_earned: true,
  debate_starting: true,
  law_established: true,
  topic_activated: true,
  vote_threshold: true,
  reply_received: true,
  role_promoted: true,
  lobby_update: false,
}

function loadPrefs(): NotifPrefs {
  try {
    const raw = localStorage.getItem(NOTIF_PREFS_KEY)
    if (!raw) return { ...DEFAULT_PREFS }
    return { ...DEFAULT_PREFS, ...(JSON.parse(raw) as Partial<NotifPrefs>) }
  } catch {
    return { ...DEFAULT_PREFS }
  }
}

function getShownIds(): Set<string> {
  try {
    const raw = localStorage.getItem(SHOWN_KEY)
    return new Set(raw ? (JSON.parse(raw) as string[]) : [])
  } catch {
    return new Set()
  }
}

function addShownId(id: string) {
  try {
    const ids = getShownIds()
    ids.add(id)
    const arr = Array.from(ids).slice(-500)
    localStorage.setItem(SHOWN_KEY, JSON.stringify(arr))
  } catch {
    // localStorage may be unavailable
  }
}

// ─── Type → toast config ──────────────────────────────────────────────────────

const TIER_MAP: Record<string, ToastTier> = {
  common: 'common',
  rare: 'rare',
  epic: 'epic',
  legendary: 'legendary',
}

type PrefKey = keyof NotifPrefs

interface TypeConfig {
  /** Which preference key gates this type. null = always show. */
  prefKey: PrefKey | null
  /** Emoji icon shown in the toast. */
  emoji: string
  /** Toast duration in ms. */
  duration: number
}

const TYPE_CONFIG: Record<NotificationType, TypeConfig> = {
  achievement_earned: {
    prefKey: 'achievement_earned',
    emoji: '🏆',
    duration: 8000,
  },
  law_established: {
    prefKey: 'law_established',
    emoji: '⚖️',
    duration: 6000,
  },
  debate_starting: {
    prefKey: 'debate_starting',
    emoji: '🎙️',
    duration: 6000,
  },
  topic_activated: {
    prefKey: 'topic_activated',
    emoji: '⚡',
    duration: 5000,
  },
  vote_threshold: {
    prefKey: 'vote_threshold',
    emoji: '📊',
    duration: 5000,
  },
  reply_received: {
    prefKey: 'reply_received',
    emoji: '💬',
    duration: 5000,
  },
  role_promoted: {
    prefKey: 'role_promoted',
    emoji: '👑',
    duration: 7000,
  },
  lobby_update: {
    prefKey: 'lobby_update',
    emoji: '🏛️',
    duration: 4000,
  },
  coalition_invite: {
    prefKey: null,
    emoji: '🤝',
    duration: 8000,
  },
  coalition_invite_accepted: {
    prefKey: null,
    emoji: '✅',
    duration: 5000,
  },
  vote_started: {
    // Final voting phase opened — gate under the existing vote_threshold pref
    prefKey: 'vote_threshold',
    emoji: '🗳️',
    duration: 6000,
  },
  bookmark_update: {
    // Status change on a saved topic — gate under topic_activated pref
    prefKey: 'topic_activated',
    emoji: '🔖',
    duration: 5000,
  },
  new_follower: {
    prefKey: null,
    emoji: '👤',
    duration: 5000,
  },
}

// ─── Achievement body parser (reused logic from AchievementWatcher) ───────────

function parseAchievementBody(raw: string | null): {
  tier: ToastTier
  icon: string | undefined
  body: string | undefined
} {
  let tier: ToastTier = 'common'
  let body: string | undefined = raw ?? undefined
  let icon: string | undefined

  if (body) {
    const tierMatch = body.match(/^tier:\s*(common|rare|epic|legendary)\n?/i)
    if (tierMatch) {
      tier = TIER_MAP[tierMatch[1].toLowerCase()] ?? 'common'
      body = body.slice(tierMatch[0].length).trim() || undefined
    }
    if (body) {
      const firstCodePoint = body.codePointAt(0)
      if (firstCodePoint !== undefined && firstCodePoint > 127) {
        const charLen = firstCodePoint > 0xffff ? 2 : 1
        const candidate = body.slice(0, charLen)
        const rest = body.slice(charLen).trimStart()
        if (rest !== body.slice(charLen)) {
          icon = candidate
          body = rest || undefined
        }
      }
    }
  }

  return { tier, icon, body }
}

// ─── Component ────────────────────────────────────────────────────────────────

export function NotificationWatcher() {
  const { addToast } = useToast()
  const shownThisSession = useRef(new Set<string>())

  useEffect(() => {
    const supabase = createClient()
    let channel: RealtimeChannel | null = null
    let mounted = true

    async function setup() {
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user || !mounted) return

      // ── 0. Sync prefs from server → localStorage ─────────────────────────
      // This ensures preferences set on another device are respected here.
      try {
        const prefsRes = await fetch('/api/notification-prefs', { cache: 'no-store' })
        if (prefsRes.ok && mounted) {
          const serverPrefs = (await prefsRes.json()) as Partial<NotifPrefs>
          const merged: NotifPrefs = { ...DEFAULT_PREFS, ...serverPrefs }
          try {
            localStorage.setItem(NOTIF_PREFS_KEY, JSON.stringify(merged))
          } catch {
            // localStorage unavailable
          }
        }
      } catch {
        // Server unreachable — keep whatever is in localStorage
      }

      if (!mounted) return

      // ── 1. Real-time subscription ────────────────────────────────────────
      channel = supabase
        .channel(`notif-watcher:${user.id}`)
        .on(
          'postgres_changes',
          {
            event: 'INSERT',
            schema: 'public',
            table: 'notifications',
            filter: `user_id=eq.${user.id}`,
          },
          (payload) => {
            if (!mounted) return
            showNotification(payload.new as Notification)
          }
        )
        .subscribe()

      // ── 2. Catch-up: fetch recent unread (last 15 min) ───────────────────
      // Handles notifications that arrived before the subscription connected.
      try {
        const res = await fetch('/api/notifications?limit=30&offset=0', {
          cache: 'no-store',
        })
        if (!res.ok || !mounted) return
        const { notifications } = (await res.json()) as {
          notifications: Notification[]
        }
        const cutoff = Date.now() - 15 * 60 * 1000
        for (const n of notifications) {
          if (n.is_read) continue
          if (new Date(n.created_at).getTime() < cutoff) continue
          if (!mounted) break
          showNotification(n)
        }
      } catch {
        // non-fatal
      }
    }

    function showNotification(n: Notification) {
      if (shownThisSession.current.has(n.id)) return
      const persistedShown = getShownIds()
      if (persistedShown.has(n.id)) return

      const config = TYPE_CONFIG[n.type]
      if (!config) return

      const prefs = loadPrefs()
      if (config.prefKey !== null && !prefs[config.prefKey]) return

      shownThisSession.current.add(n.id)
      addShownId(n.id)

      // Mark as read on server (best-effort)
      fetch('/api/notifications', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids: [n.id] }),
      }).catch(() => {})

      // ── Achievement: rich tier-based toast ────────────────────────────────
      if (n.type === 'achievement_earned') {
        const { tier, icon, body } = parseAchievementBody(n.body)
        addToast({
          variant: 'achievement',
          title: n.title,
          body,
          icon,
          tier,
          duration: config.duration,
        })
        return
      }

      // ── All other types: info toast with emoji ────────────────────────────
      addToast({
        variant: 'info',
        title: n.title,
        body: n.body ?? undefined,
        icon: config.emoji,
        duration: config.duration,
      })
    }

    setup()

    return () => {
      mounted = false
      if (channel) {
        supabase.removeChannel(channel)
      }
    }
  }, [addToast])

  return null
}
