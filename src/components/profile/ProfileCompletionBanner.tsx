'use client'

/**
 * ProfileCompletionBanner
 *
 * Shows on a user's own profile when it is not 100% complete.
 * Calculates completion across 5 milestones and renders a progress bar
 * with action items linking to the relevant settings/onboarding pages.
 *
 * Dismissible: stores a per-user flag in localStorage so it doesn't
 * reappear once dismissed (key: lm_pcb_dismissed_v1_<userId>).
 */

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { motion, AnimatePresence } from 'framer-motion'
import {
  CheckCircle2,
  X,
  Sparkles,
  ChevronRight,
  User,
  Image,
  FileText,
  Link2,
  BookOpen,
} from 'lucide-react'
import { cn } from '@/lib/utils/cn'
import type { Profile } from '@/lib/supabase/types'

// ─── Completion items ─────────────────────────────────────────────────────────

interface CompletionItem {
  id: string
  label: string
  sublabel: string
  done: boolean
  href: string
  icon: React.ComponentType<{ className?: string }>
  iconColor: string
}

function buildItems(profile: Profile): CompletionItem[] {
  const hasDisplayName = !!(profile.display_name && profile.display_name.trim())
  const hasAvatar = !!profile.avatar_url
  const hasBio = !!(profile.bio && profile.bio.trim())
  const hasSocialLinks = !!(
    profile.social_links &&
    (profile.social_links.twitter ||
      profile.social_links.github ||
      profile.social_links.website)
  )
  const hasOnboarding = profile.onboarding_complete

  return [
    {
      id: 'onboarding',
      label: 'Calibrate your feed',
      sublabel: 'Take the 5-question quiz to tune your feed',
      done: hasOnboarding,
      href: '/onboarding',
      icon: Sparkles,
      iconColor: 'text-gold',
    },
    {
      id: 'display_name',
      label: 'Set a display name',
      sublabel: 'Let the Lobby know what to call you',
      done: hasDisplayName,
      href: '/profile/settings',
      icon: User,
      iconColor: 'text-for-400',
    },
    {
      id: 'avatar',
      label: 'Add a profile photo',
      sublabel: 'Put a face to your votes',
      done: hasAvatar,
      href: '/profile/settings',
      icon: Image,
      iconColor: 'text-purple',
    },
    {
      id: 'bio',
      label: 'Write a short bio',
      sublabel: 'Tell the Lobby who you are',
      done: hasBio,
      href: '/profile/settings',
      icon: FileText,
      iconColor: 'text-emerald',
    },
    {
      id: 'social',
      label: 'Connect a social account',
      sublabel: 'Add Twitter/X, GitHub, or your website',
      done: hasSocialLinks,
      href: '/profile/settings',
      icon: Link2,
      iconColor: 'text-against-400',
    },
  ]
}

function calcPct(items: CompletionItem[]) {
  const done = items.filter((i) => i.done).length
  return Math.round((done / items.length) * 100)
}

// ─── Single action row ────────────────────────────────────────────────────────

function ActionRow({ item }: { item: CompletionItem }) {
  if (item.done) {
    return (
      <div
        className={cn(
          'flex items-center gap-3 px-4 py-3 rounded-xl',
          'bg-surface-200/50 border border-surface-300/50',
          'opacity-50'
        )}
        aria-label={`${item.label} — complete`}
      >
        <CheckCircle2 className="h-4 w-4 text-emerald flex-shrink-0" aria-hidden />
        <span className="text-sm font-mono text-surface-500 line-through">{item.label}</span>
      </div>
    )
  }

  const Icon = item.icon

  return (
    <Link
      href={item.href}
      className={cn(
        'group flex items-center gap-3 px-4 py-3 rounded-xl',
        'bg-surface-200 border border-surface-300',
        'hover:border-surface-400 hover:bg-surface-300/60',
        'transition-all duration-150',
        'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500/50'
      )}
      aria-label={`${item.label}: ${item.sublabel}`}
    >
      <Icon className={cn('h-4 w-4 flex-shrink-0', item.iconColor)} aria-hidden />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-mono font-medium text-white truncate">{item.label}</p>
        <p className="text-xs font-mono text-surface-500 truncate">{item.sublabel}</p>
      </div>
      <ChevronRight
        className="h-4 w-4 text-surface-600 flex-shrink-0 group-hover:text-surface-400 group-hover:translate-x-0.5 transition-all duration-150"
        aria-hidden
      />
    </Link>
  )
}

// ─── Main banner ──────────────────────────────────────────────────────────────

interface ProfileCompletionBannerProps {
  profile: Profile
  /** Supabase auth user ID — used to namespace the dismiss flag */
  userId: string
}

export function ProfileCompletionBanner({
  profile,
  userId,
}: ProfileCompletionBannerProps) {
  const DISMISS_KEY = `lm_pcb_dismissed_v1_${userId}`

  const items = buildItems(profile)
  const pct = calcPct(items)

  // Don't render if profile is complete
  const [mounted, setMounted] = useState(false)
  const [dismissed, setDismissed] = useState(false)

  useEffect(() => {
    setMounted(true)
    try {
      setDismissed(localStorage.getItem(DISMISS_KEY) === '1')
    } catch {
      // localStorage unavailable (private mode)
    }
  }, [DISMISS_KEY])

  function handleDismiss() {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // best-effort
    }
  }

  // Hydration: don't render before mount (SSR doesn't know localStorage state)
  if (!mounted) return null
  if (dismissed) return null
  if (pct === 100) return null

  const remaining = items.filter((i) => !i.done)
  const nextItem = remaining[0]

  // Gradient color for the progress bar based on completion level
  const barColor =
    pct >= 80
      ? 'from-emerald to-emerald'
      : pct >= 60
      ? 'from-for-500 to-emerald'
      : pct >= 40
      ? 'from-for-600 to-for-500'
      : 'from-against-600 to-for-600'

  return (
    <AnimatePresence>
      <motion.section
        key="profile-completion-banner"
        initial={{ opacity: 0, y: -12, scale: 0.98 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: -8, scale: 0.97 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        aria-label="Profile completion"
        className={cn(
          'relative rounded-2xl border border-surface-300 bg-surface-100 overflow-hidden',
          'shadow-lg shadow-surface-950/20'
        )}
      >
        {/* Top progress bar */}
        <div className="h-1 w-full bg-surface-300" aria-hidden>
          <motion.div
            initial={{ width: 0 }}
            animate={{ width: `${pct}%` }}
            transition={{ duration: 0.8, delay: 0.2, ease: 'easeOut' }}
            className={cn('h-full rounded-full bg-gradient-to-r', barColor)}
          />
        </div>

        {/* Dismiss button */}
        <button
          type="button"
          onClick={handleDismiss}
          aria-label="Dismiss profile completion reminder"
          className={cn(
            'absolute top-4 right-4 z-10',
            'flex items-center justify-center h-7 w-7 rounded-lg',
            'bg-surface-200 text-surface-500',
            'hover:bg-surface-300 hover:text-white',
            'transition-colors duration-150',
            'focus:outline-none focus-visible:ring-2 focus-visible:ring-surface-400/50'
          )}
        >
          <X className="h-3.5 w-3.5" />
        </button>

        {/* Content */}
        <div className="p-5 pr-12">
          {/* Header */}
          <div className="flex items-start gap-3 mb-4">
            {/* Circle progress indicator */}
            <div className="relative flex-shrink-0" aria-hidden>
              <svg className="h-14 w-14 -rotate-90" viewBox="0 0 56 56">
                {/* Background ring */}
                <circle
                  cx="28"
                  cy="28"
                  r="22"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="4"
                  className="text-surface-300"
                />
                {/* Progress arc */}
                <circle
                  cx="28"
                  cy="28"
                  r="22"
                  fill="none"
                  strokeWidth="4"
                  strokeLinecap="round"
                  className={
                    pct >= 80
                      ? 'text-emerald'
                      : pct >= 60
                      ? 'text-for-400'
                      : pct >= 40
                      ? 'text-for-500'
                      : 'text-against-500'
                  }
                  stroke="currentColor"
                  strokeDasharray={`${2 * Math.PI * 22}`}
                  strokeDashoffset={`${2 * Math.PI * 22 * (1 - pct / 100)}`}
                  style={{ transition: 'stroke-dashoffset 0.8s ease 0.2s' }}
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center font-mono text-sm font-bold text-white">
                {pct}%
              </span>
            </div>

            <div className="pt-1">
              <h2 className="font-mono text-base font-bold text-white leading-tight">
                Your profile is {pct}% complete
              </h2>
              <p className="text-xs font-mono text-surface-500 mt-0.5 leading-relaxed">
                {remaining.length === 1
                  ? 'One more step to a complete profile.'
                  : `${remaining.length} steps left. A complete profile builds trust and clout.`}
              </p>

              {/* Quick-action shortcut for the first missing item */}
              {nextItem && (
                <Link
                  href={nextItem.href}
                  className={cn(
                    'inline-flex items-center gap-1.5 mt-2',
                    'text-xs font-mono font-medium text-for-400',
                    'hover:text-for-300 transition-colors',
                    'focus:outline-none focus-visible:underline'
                  )}
                >
                  <BookOpen className="h-3 w-3" aria-hidden />
                  Next: {nextItem.label}
                  <ChevronRight className="h-3 w-3" aria-hidden />
                </Link>
              )}
            </div>
          </div>

          {/* Action items grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            {items.map((item) => (
              <ActionRow key={item.id} item={item} />
            ))}
          </div>

          {/* Footer CTA */}
          <div className="mt-4 flex items-center justify-between gap-4">
            <p className="text-xs font-mono text-surface-600">
              Complete your profile to unlock more visibility and earn <span className="text-gold">Clout</span>.
            </p>
            <Link
              href="/profile/settings"
              className={cn(
                'inline-flex items-center gap-1.5 flex-shrink-0',
                'px-3 py-1.5 rounded-lg text-xs font-mono font-medium',
                'bg-for-600 text-white hover:bg-for-500',
                'transition-colors duration-150',
                'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500/50'
              )}
            >
              Edit Profile
              <ChevronRight className="h-3 w-3" aria-hidden />
            </Link>
          </div>
        </div>
      </motion.section>
    </AnimatePresence>
  )
}
