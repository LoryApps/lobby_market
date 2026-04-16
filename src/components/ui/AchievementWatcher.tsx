'use client'

/**
 * AchievementWatcher
 *
 * Silently polls the /api/notifications endpoint every 60 s for unread
 * achievement_earned notifications.  Any notifications created after the
 * session start that haven't been shown yet are surfaced as toast popups,
 * then immediately marked as read so they don't repeat.
 *
 * Must be rendered inside <ToastProvider>.
 */

import { useEffect, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useToast } from '@/lib/hooks/useToast'
import type { ToastTier } from '@/lib/hooks/useToast'

const POLL_INTERVAL_MS = 60_000
const SHOWN_KEY = 'lm_shown_achievement_ids'
const TIER_MAP: Record<string, ToastTier> = {
  common: 'common',
  rare: 'rare',
  epic: 'epic',
  legendary: 'legendary',
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
    // Keep the set bounded to 500 most-recent IDs
    const arr = Array.from(ids).slice(-500)
    localStorage.setItem(SHOWN_KEY, JSON.stringify(arr))
  } catch {
    // localStorage may be unavailable (private mode, etc.)
  }
}

interface RawNotification {
  id: string
  type: string
  title: string
  body: string | null
  reference_id: string | null
  reference_type: string | null
  is_read: boolean
  created_at: string
}

export function AchievementWatcher() {
  const { addToast } = useToast()
  const sessionStart = useRef(Date.now())

  useEffect(() => {
    let mounted = true

    async function checkAchievements() {
      // Only run for logged-in users
      const supabase = createClient()
      const {
        data: { user },
      } = await supabase.auth.getUser()
      if (!user || !mounted) return

      try {
        const res = await fetch(
          '/api/notifications?limit=20&offset=0',
          { cache: 'no-store' }
        )
        if (!res.ok || !mounted) return

        const { notifications } = (await res.json()) as {
          notifications: RawNotification[]
        }

        const shown = getShownIds()
        const toShow: RawNotification[] = []

        for (const n of notifications) {
          if (n.type !== 'achievement_earned') continue
          if (shown.has(n.id)) continue
          // Only toast notifications created this session
          const createdMs = new Date(n.created_at).getTime()
          if (createdMs < sessionStart.current) {
            // Still mark as "shown" so we don't re-evaluate them endlessly
            addShownId(n.id)
            continue
          }
          toShow.push(n)
        }

        if (!mounted || toShow.length === 0) return

        // Parse tier + icon from the body/title (title format: "Achievement: <name>")
        for (const n of toShow) {
          addShownId(n.id)

          // Parse tier from body if formatted as "Tier: <tier>\n<description>"
          let tier: ToastTier = 'common'
          let body = n.body ?? undefined
          let icon: string | undefined

          if (body) {
            const tierMatch = body.match(/^tier:\s*(common|rare|epic|legendary)\n?/i)
            if (tierMatch) {
              tier = TIER_MAP[tierMatch[1].toLowerCase()] ?? 'common'
              body = body.slice(tierMatch[0].length).trim() || undefined
            }
            // Extract icon if body starts with a non-ASCII character (emoji)
            if (body) {
              const firstCodePoint = body.codePointAt(0)
              if (firstCodePoint !== undefined && firstCodePoint > 127) {
                // grab the first "character" (may be 2 JS chars for supplementary plane)
                const charLen = firstCodePoint > 0xffff ? 2 : 1
                const candidate = body.slice(0, charLen)
                const rest = body.slice(charLen).trimStart()
                if (rest !== body.slice(charLen)) {
                  // there was whitespace — treat leading char as icon
                  icon = candidate
                  body = rest || undefined
                }
              }
            }
          }

          // Build a shareable link when reference_type is 'achievement'
          const link =
            n.reference_type === 'achievement' && n.reference_id
              ? `/achievements/${n.reference_id}`
              : undefined

          addToast({
            variant: 'achievement',
            title: n.title,
            body,
            icon,
            tier,
            duration: 8000,
            link,
          })

          // Mark as read on server
          fetch('/api/notifications', {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ ids: [n.id] }),
          }).catch(() => {/* best-effort */})
        }
      } catch {
        // Network errors are non-fatal
      }
    }

    // Initial check after a short delay (let the page settle)
    const init = setTimeout(checkAchievements, 3000)

    // Recurring poll
    const interval = setInterval(checkAchievements, POLL_INTERVAL_MS)

    return () => {
      mounted = false
      clearTimeout(init)
      clearInterval(interval)
    }
  }, [addToast])

  return null
}
