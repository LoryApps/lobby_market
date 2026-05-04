'use client'

/**
 * RouteProgressBar
 *
 * A thin animated progress bar at the top of every page that fires on
 * internal navigation. Gives instant visual feedback that a click registered
 * and the app is loading the next route.
 *
 * Works in Next.js App Router by:
 *   1. Listening for clicks on same-origin <a> elements (navigation START)
 *   2. Watching usePathname() + useSearchParams() for navigation COMPLETION
 *
 * Must be wrapped in a Suspense boundary because useSearchParams() can suspend.
 */

import { Suspense, useCallback, useEffect, useRef, useState } from 'react'
import { usePathname, useSearchParams } from 'next/navigation'
import { cn } from '@/lib/utils/cn'

// ─── Inner component ──────────────────────────────────────────────────────────

function ProgressBarInner() {
  const pathname = usePathname()
  const searchParams = useSearchParams()

  const [visible, setVisible] = useState(false)
  const [width, setWidth] = useState(0)
  const [completing, setCompleting] = useState(false)

  const mounted = useRef(false)
  const crawlTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const hideTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  const clearTimers = useCallback(() => {
    if (crawlTimer.current) { clearInterval(crawlTimer.current); crawlTimer.current = null }
    if (hideTimer.current) { clearTimeout(hideTimer.current); hideTimer.current = null }
  }, [])

  const startProgress = useCallback(() => {
    clearTimers()
    setCompleting(false)
    setVisible(true)
    setWidth(8)

    let current = 8
    crawlTimer.current = setInterval(() => {
      current = Math.min(current + (75 - current) * 0.1, 74.5)
      setWidth(current)
    }, 120)
  }, [clearTimers])

  const finishProgress = useCallback(() => {
    clearTimers()
    setCompleting(true)
    setWidth(100)
    hideTimer.current = setTimeout(() => {
      setVisible(false)
      hideTimer.current = setTimeout(() => {
        setWidth(0)
        setCompleting(false)
      }, 350)
    }, 180)
  }, [clearTimers])

  // Detect navigation START via click on internal links
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = (e.target as HTMLElement).closest('a')
      if (!target) return

      const href = target.getAttribute('href')
      if (!href) return

      if (
        href.startsWith('http') ||
        href.startsWith('//') ||
        href.startsWith('mailto') ||
        href.startsWith('tel') ||
        href === '#' ||
        href.startsWith('#')
      ) return

      if (target.hasAttribute('download')) return

      startProgress()
    }

    document.addEventListener('click', handleClick, true)
    return () => document.removeEventListener('click', handleClick, true)
  }, [startProgress])

  // Detect navigation COMPLETION via pathname/searchParams change
  useEffect(() => {
    if (!mounted.current) {
      mounted.current = true
      return
    }
    finishProgress()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams])

  // Cleanup on unmount
  useEffect(() => () => clearTimers(), [clearTimers])

  return (
    <div
      aria-hidden="true"
      className={cn(
        'pointer-events-none fixed left-0 top-0 z-[9999] h-[2px]',
        'bg-for-500',
        'shadow-[0_0_8px_1px_rgba(59,130,246,0.65)]',
        completing
          ? 'transition-[width] duration-150 ease-out'
          : 'transition-[width] duration-100 ease-linear',
        visible
          ? 'opacity-100'
          : 'opacity-0 transition-opacity duration-300 ease-in',
      )}
      style={{ width: `${width}%` }}
    />
  )
}

// ─── Public export ────────────────────────────────────────────────────────────

export function RouteProgressBar() {
  return (
    <Suspense fallback={null}>
      <ProgressBarInner />
    </Suspense>
  )
}
