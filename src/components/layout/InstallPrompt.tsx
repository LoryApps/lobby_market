'use client'

/**
 * InstallPrompt
 *
 * Displays a branded "Add to Home Screen" nudge for mobile users who haven't
 * installed the PWA yet.
 *
 * Two paths:
 *  - Android / Chrome: listens for the `beforeinstallprompt` event and calls
 *    `prompt()` directly when the user taps Install.
 *  - iOS Safari: no native event is fired, so we show a manual guide with a
 *    Share icon + "Add to Home Screen" instructions.
 *
 * Dismissal is stored in localStorage (key: lm_install_prompt_dismissed_v1).
 * Once dismissed, the banner never reappears (even after reload).
 *
 * The banner waits 8 seconds after mount before appearing so it doesn't
 * interrupt the user's first impression of the feed.
 */

import { useEffect, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Share, Download, X, Smartphone } from 'lucide-react'
import { cn } from '@/lib/utils/cn'

const DISMISS_KEY = 'lm_install_prompt_dismissed_v1'
const SHOW_DELAY_MS = 8_000

// ─── Platform detection ───────────────────────────────────────────────────────

function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  return /iphone|ipad|ipod/i.test(navigator.userAgent)
}

function isInStandaloneMode(): boolean {
  if (typeof window === 'undefined') return false
  // navigator.standalone is set by Safari on iOS when running as installed PWA
  return (
    (window.navigator as Navigator & { standalone?: boolean }).standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches
  )
}

function isAndroidChrome(): boolean {
  if (typeof navigator === 'undefined') return false
  return /android/i.test(navigator.userAgent) && /chrome/i.test(navigator.userAgent)
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed' }>
}

type Variant = 'android' | 'ios' | null

// ─── Component ────────────────────────────────────────────────────────────────

export function InstallPrompt() {
  const [variant, setVariant] = useState<Variant>(null)
  const [visible, setVisible] = useState(false)
  const [installed, setInstalled] = useState(false)
  const deferredPromptRef = useRef<BeforeInstallPromptEvent | null>(null)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    // Don't show if already dismissed or already installed
    if (
      localStorage.getItem(DISMISS_KEY) === '1' ||
      isInStandaloneMode()
    ) {
      return
    }

    function scheduleShow(v: Variant) {
      timerRef.current = setTimeout(() => setVisible(true), SHOW_DELAY_MS)
      setVariant(v)
    }

    // Android / Chrome path — native install prompt
    function handleBeforeInstallPrompt(e: Event) {
      e.preventDefault()
      deferredPromptRef.current = e as BeforeInstallPromptEvent
      scheduleShow('android')
    }

    // iOS path — show manual guide
    if (isIOS() && !isInStandaloneMode()) {
      scheduleShow('ios')
    } else if (isAndroidChrome()) {
      window.addEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
    }

    // Listen for successful install
    window.addEventListener('appinstalled', () => {
      setInstalled(true)
      dismiss()
    })

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstallPrompt)
      if (timerRef.current !== null) clearTimeout(timerRef.current)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function dismiss() {
    localStorage.setItem(DISMISS_KEY, '1')
    setVisible(false)
  }

  async function handleInstall() {
    const prompt = deferredPromptRef.current
    if (!prompt) return
    await prompt.prompt()
    const { outcome } = await prompt.userChoice
    if (outcome === 'accepted') {
      setInstalled(true)
    }
    dismiss()
  }

  if (installed || variant === null) return null

  return (
    <AnimatePresence>
      {visible && (
        <motion.div
          key="install-prompt"
          initial={{ y: 120, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 120, opacity: 0 }}
          transition={{ type: 'spring', stiffness: 400, damping: 32 }}
          className={cn(
            'fixed bottom-0 left-0 right-0 z-[100]',
            // Sit just above the bottom nav on mobile, clear on desktop
            'md:bottom-6 md:left-auto md:right-6 md:w-[340px]',
            // Safe area padding on mobile
            'pb-[max(1rem,env(safe-area-inset-bottom))]',
            'px-4 md:px-0 md:pb-0'
          )}
          role="dialog"
          aria-label="Install Lobby Market"
        >
          <div
            className={cn(
              'relative rounded-2xl md:rounded-2xl rounded-b-none md:rounded-b-2xl',
              'bg-surface-100 border border-surface-300 border-b-0 md:border-b',
              'shadow-2xl shadow-surface-0/80',
              'p-4 flex items-start gap-3'
            )}
          >
            {/* App icon */}
            <div className="flex-shrink-0 mt-0.5 flex items-center justify-center h-11 w-11 rounded-xl bg-gradient-to-br from-for-600 to-against-600 shadow-sm">
              <Smartphone className="h-5 w-5 text-white" aria-hidden="true" />
            </div>

            {/* Content */}
            <div className="flex-1 min-w-0 space-y-2">
              <div>
                <p className="text-sm font-mono font-semibold text-white leading-snug">
                  Install Lobby Market
                </p>
                <p className="text-xs text-surface-500 font-mono mt-0.5 leading-relaxed">
                  {variant === 'ios'
                    ? 'Tap the Share button below, then "Add to Home Screen" for the full experience.'
                    : 'Get the full native experience — faster load, offline access, and instant notifications.'}
                </p>
              </div>

              {variant === 'android' && (
                <button
                  onClick={handleInstall}
                  className={cn(
                    'flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg',
                    'bg-for-600 hover:bg-for-500 text-white',
                    'text-xs font-mono font-semibold transition-colors',
                    'focus:outline-none focus-visible:ring-2 focus-visible:ring-for-500/50'
                  )}
                >
                  <Download className="h-3.5 w-3.5" aria-hidden="true" />
                  Install App
                </button>
              )}

              {variant === 'ios' && (
                <div className="flex items-center gap-1.5 text-xs font-mono text-surface-500">
                  <span>Tap</span>
                  <span
                    className="inline-flex items-center justify-center h-5 w-5 rounded bg-surface-300 border border-surface-400"
                    aria-label="Share icon"
                  >
                    <Share className="h-3 w-3 text-for-400" aria-hidden="true" />
                  </span>
                  <span className="text-surface-600">→</span>
                  <span className="text-surface-500">&quot;Add to Home Screen&quot;</span>
                </div>
              )}
            </div>

            {/* Dismiss */}
            <button
              onClick={dismiss}
              aria-label="Dismiss install prompt"
              className={cn(
                'flex-shrink-0 flex items-center justify-center h-7 w-7 rounded-lg',
                'text-surface-500 hover:text-white hover:bg-surface-300',
                'transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-surface-400/50'
              )}
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  )
}
